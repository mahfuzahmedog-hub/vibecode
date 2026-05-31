#!/usr/bin/env node
import { execSync, spawn } from 'child_process';
import { existsSync, writeFileSync, readFileSync, mkdirSync, rmSync, statSync } from 'fs';
import { platform, totalmem, freemem } from 'os';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const isWin = platform() === 'win32';
const isMac = platform() === 'darwin';
const isLinux = platform() === 'linux';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HEALTH_CHECK_MS = 30000;
const MAX_RESTARTS = 3;
const RESTART_DELAY_MS = 2000;
const HEALTH_PATH = resolve(root, 'scripts', 'health.json');

const colors = {
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

let health = { startups: 0, heals: {}, lastStart: null, lastCrash: null };
let child = null;
let restartCount = 0;
let healthCheckInterval = null;
let isShuttingDown = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { cwd: root, stdio: 'pipe', encoding: 'utf-8', timeout: 120000, ...opts }).trim();
  } catch { return ''; }
}

function log(step, msg) { console.log(` ${colors.blue('→')} ${colors.dim(step.padEnd(18))} ${msg}`); }
function ok(msg) { console.log(` ${colors.green('✓')} ${msg}`); }
function warn(msg) { console.log(` ${colors.yellow('⚠')} ${msg}`); }
function fail(msg) { console.log(` ${colors.red('✗')} ${msg}`); }

function step(label, fn) {
  log(label, '...');
  try { fn(); ok(label); }
  catch (e) { fail(`${label}: ${e.message}`); throw e; }
}

function recordHeal(key) {
  health.heals[key] = (health.heals[key] || 0) + 1;
}

function loadHealth() {
  try {
    if (existsSync(HEALTH_PATH)) {
      health = JSON.parse(readFileSync(HEALTH_PATH, 'utf-8'));
    }
  } catch {}
}

function saveHealth() {
  try {
    if (!existsSync(dirname(HEALTH_PATH))) mkdirSync(dirname(HEALTH_PATH), { recursive: true });
    writeFileSync(HEALTH_PATH, JSON.stringify(health, null, 2), 'utf-8');
  } catch {}
}

function getFirstRun() {
  return health.startups <= 1;
}

// ---------------------------------------------------------------------------
// Phase 2 — Startup Checks
// ---------------------------------------------------------------------------

function checkNodeVersion() {
  const v = process.version.match(/^v(\d+)/);
  if (!v || parseInt(v[1]) < 18) {
    throw new Error(`Node.js 18+ required, got ${process.version}`);
  }
}

function checkNodeModules() {
  const nmDir = resolve(root, 'node_modules');
  const pkgPath = resolve(root, 'package.json');

  if (!existsSync(nmDir)) {
    warn('node_modules not found, running npm install...');
    run('npm install', { stdio: 'inherit', timeout: 180000 });
    recordHeal('missing_node_modules');
    if (!existsSync(resolve(nmDir, 'next'))) {
      throw new Error('npm install still missing next; try deleting package-lock.json and node_modules, then reinstall');
    }
    return;
  }

  // Stale dependency detection
  if (existsSync(pkgPath)) {
    const pkgMtime = statSync(pkgPath).mtimeMs;
    const nmMtime = statSync(nmDir).mtimeMs;
    if (pkgMtime > nmMtime + 5000) {
      warn('package.json is newer than node_modules — dependencies may be stale');
      warn('Running npm install to sync...');
      run('npm install', { stdio: 'inherit', timeout: 180000 });
      recordHeal('stale_dependencies');
    }
  }
}

function healTailwindBinary() {
  const oxideDir = resolve(root, 'node_modules', '@tailwindcss', 'oxide');
  if (!existsSync(oxideDir)) return;

  const pkgPath = resolve(oxideDir, 'package.json');
  if (!existsSync(pkgPath)) return;

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const optionalDeps = pkg.optionalDependencies || {};
  const platformDeps = Object.keys(optionalDeps);

  let targetPkg = null;
  if (isLinux) {
    const arch = process.arch === 'arm64' ? 'linux-arm64-gnu' : 'linux-x64-gnu';
    targetPkg = platformDeps.find((d) => d.endsWith(arch));
  } else if (isMac) {
    const arch = process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
    targetPkg = platformDeps.find((d) => d.endsWith(arch));
  } else if (isWin) {
    targetPkg = platformDeps.find((d) => d.endsWith('win32-x64-msvc'));
  }

  if (!targetPkg) return;

  try { require.resolve(targetPkg); return; }
  catch {
    warn(`Missing native binding ${targetPkg}, installing...`);
    run(`npm install ${targetPkg} --no-save --ignore-scripts`, { stdio: 'inherit', timeout: 60000 });
    recordHeal('tailwind_binary');
  }
}

function ensureEnvFile() {
  const envPath = resolve(root, '.env.local');
  if (existsSync(envPath)) {
    // Validate OpenRouter key
    const content = readFileSync(envPath, 'utf-8');
    const keyLine = content.split('\n').find(l => l.startsWith('OPENROUTER_API_KEYS='));
    const hasKey = keyLine && keyLine.split('=')[1]?.trim()?.length > 0;
    if (!hasKey) {
      warn('OPENROUTER_API_KEYS is empty in .env.local');
      warn('Get a key at https://openrouter.ai/keys and add it to .env.local');
    } else {
      ok('API key configured');
    }
    return;
  }

  warn('.env.local missing, creating template...');
  const template = [
    '# Get your API key from https://openrouter.ai/keys',
    'OPENROUTER_API_KEYS=',
    '',
    '# n8n MCP (optional, leave as-is to disable)',
    'N8N_MCP_ENABLED=false',
    'N8N_MCP_SERVER_URL=',
    'NEXT_PUBLIC_N8N_MCP_SERVER_URL=',
    '',
  ].join('\n');
  writeFileSync(envPath, template, 'utf-8');
  recordHeal('missing_env');
  warn('Created .env.local — set OPENROUTER_API_KEYS before generating code');
}

function healNextCache() {
  const cacheDir = resolve(root, '.next');
  if (!existsSync(cacheDir)) return;

  const tracePath = resolve(cacheDir, 'trace');
  if (!existsSync(tracePath)) return;

  try {
    const trace = readFileSync(tracePath, 'utf-8');
    if (trace.includes('FATAL ERROR') || trace.includes('out of memory') || trace.includes('Allocation failed')) {
      warn('Detected corrupted .next cache from previous OOM, clearing...');
      rmSync(cacheDir, { recursive: true, force: true });
      recordHeal('stale_cache');
    }
  } catch {}
}

function freePort() {
  try {
    if (isWin) {
      const result = run(`netstat -ano | findstr ":${PORT} " | findstr LISTENING`);
      if (result) {
        const lines = result.split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0') {
            try { run(`taskkill /F /PID ${pid}`); warn(`Killed old process on port ${PORT} (PID ${pid})`); recordHeal('port_conflict'); } catch {}
          }
        }
      }
    } else {
      const result = run(`lsof -ti:${PORT} 2>/dev/null`);
      if (result) {
        result.split('\n').filter(Boolean).forEach((pid) => {
          try { process.kill(parseInt(pid), 'SIGKILL'); warn(`Killed old process on port ${PORT} (PID ${pid})`); recordHeal('port_conflict'); } catch {}
        });
      }
    }
  } catch {}
}

function discoverModels() {
  try {
    const result = execSync('node scripts/model-discovery.mjs --force', {
      cwd: root,
      timeout: 30000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const lines = result.split('\n').filter(l => l.startsWith('  "'));
    if (lines.length > 0) {
      ok(`Auto-discovered ${lines.length} working model(s)`);
    } else {
      warn('No models discovered — will use fallback list');
    }
  } catch {
    warn('Model discovery skipped (OpenRouter not reachable or no keys)');
  }
}

function checkDiskSpace() {
  try {
    if (isWin) {
      const result = run('wmic logicaldisk where drivetype=3 get freespace /format:value');
      const match = result.match(/FreeSpace=(\d+)/);
      if (match) {
        const freeBytes = parseInt(match[1], 10);
        const freeMB = Math.round(freeBytes / (1024 * 1024));
        if (freeMB < 500) warn(`Low disk space: ${freeMB}MB free (below 500MB)`);
      }
    } else {
      const result = run('df -m . | tail -1');
      const parts = result.split(/\s+/);
      const freeMB = parseInt(parts[3], 10);
      if (!isNaN(freeMB) && freeMB < 500) warn(`Low disk space: ${freeMB}MB free (below 500MB)`);
    }
  } catch {}
}

function checkMemory() {
  try {
    const total = totalmem();
    const free = freemem();
    const totalMB = Math.round(total / (1024 * 1024));
    const freeMB = Math.round(free / (1024 * 1024));
    if (totalMB < 2048) {
      warn(`Low system memory: ${totalMB}MB total, ${freeMB}MB free`);
      warn('Setting reduced memory limit for Node.js');
      process.env.NODE_OPTIONS = '--max-old-space-size=1024';
    } else if (totalMB < 4096) {
      process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || '--max-old-space-size=2048';
    }
    ok(`Memory: ${totalMB}MB total, ${freeMB}MB free`);
  } catch {}
}

function printFirstRunHelp() {
  console.log(`   ${colors.dim('─'.repeat(50))}`);
  console.log(`   ${colors.bold('Welcome to VibeCoder!')}`);
  console.log(`   ${colors.dim('1. Set your OpenRouter key in .env.local')}`);
  console.log(`   ${colors.dim('2. Open')} http://localhost:${PORT} ${colors.dim('in your browser')}`);
  console.log(`   ${colors.dim('3. Type a prompt and click Generate')}`);
  console.log(`   ${colors.dim('─'.repeat(50))}`);
}

function printHealingSummary() {
  const totalHeals = Object.values(health.heals).reduce((a, b) => a + b, 0);
  if (totalHeals > 0) {
    console.log(`   ${colors.dim(`Healing history: ${totalHeals} fix(es) applied across ${health.startups} startup(s)`)}`);
    for (const [key, count] of Object.entries(health.heals)) {
      if (count > 0) console.log(`   ${colors.dim(`  ${key}: ${count}x`)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 3 — Runtime Healing
// ---------------------------------------------------------------------------

function doHealthCheck() {
  return new Promise((resolvePromise) => {
    const req = http.get(`http://localhost:${PORT}/`, { timeout: 5000 }, (res) => {
      res.resume();
      resolvePromise(true);
    });
    req.on('error', () => resolvePromise(false));
    req.on('timeout', () => { req.destroy(); resolvePromise(false); });
  });
}

function startHealthCheckLoop() {
  let consecutiveFailures = 0;

  healthCheckInterval = setInterval(async () => {
    if (isShuttingDown) return;
    const alive = await doHealthCheck();
    if (alive) {
      consecutiveFailures = 0;
    } else {
      consecutiveFailures++;
      warn(`Health check failed (${consecutiveFailures}/3)`);
      if (consecutiveFailures >= 3) {
        warn('Server unresponsive for 3 checks, restarting...');
        consecutiveFailures = 0;
        restartChild();
      }
    }
  }, HEALTH_CHECK_MS);
}

function startNext() {
  const args = ['dev'];
  if (PORT !== 3000) args.push('--port', String(PORT));

  const nextEntry = resolve(root, 'node_modules', 'next', 'dist', 'bin', 'next');
  child = spawn(process.execPath, [nextEntry, ...args], { cwd: root, stdio: 'inherit', env: { ...process.env, PORT: String(PORT) } });

  child.on('exit', (code, signal) => {
    if (isShuttingDown) {
      process.exit(code ?? 0);
      return;
    }

    health.lastCrash = new Date().toISOString();
    saveHealth();

    if (code !== 0 && restartCount < MAX_RESTARTS) {
      restartCount++;
      warn(`Dev server exited (code ${code}), restarting in ${RESTART_DELAY_MS / 1000}s (attempt ${restartCount}/${MAX_RESTARTS})...`);
      // Clean cache before restart if it was a build error
      healNextCache();
      setTimeout(startNext, RESTART_DELAY_MS);
    } else if (code !== 0) {
      fail(`Dev server crashed ${MAX_RESTARTS} times. Run with --no-heal or fix manually.`);
      process.exit(code ?? 1);
    }
  });
}

function restartChild() {
  if (!child || child.killed) return;
  warn('Sending SIGINT for graceful restart...');
  child.kill('SIGINT');
  setTimeout(() => {
    if (child && !child.killed) {
      warn('Force killing unresponsive server...');
      child.kill('SIGKILL');
    }
  }, 5000);
}

function setupGracefulShutdown() {
  const shutdown = (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\n ${colors.yellow('→')} Shutting down...`);
    if (healthCheckInterval) clearInterval(healthCheckInterval);

    if (child && !child.killed) {
      child.kill('SIGINT');
      setTimeout(() => {
        if (child && !child.killed) child.kill('SIGKILL');
        process.exit(0);
      }, 3000);
    } else {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  loadHealth();
  health.startups++;
  health.lastStart = new Date().toISOString();
  const isFirst = getFirstRun();

  console.log(`\n ${colors.blue('⟳')} VibeCoder ${colors.dim('self-healing dev server')} ${colors.dim(`(port ${PORT})`)}\n`);

  try {
    step('node version', checkNodeVersion);
    step('node_modules', checkNodeModules);
    step('tailwind binary', healTailwindBinary);
    step('env file', ensureEnvFile);
    step('cache health', healNextCache);
    step('system memory', checkMemory);
    step('disk space', checkDiskSpace);
    step(`free port ${PORT}`, freePort);
    step('model discovery', discoverModels);

    saveHealth();

    console.log(`\n ${colors.green('✓')} All checks passed, starting Next.js...\n`);

    if (isFirst) printFirstRunHelp();
    printHealingSummary();
    console.log();

    setupGracefulShutdown();
    startNext();
    startHealthCheckLoop();
  } catch (e) {
    console.error(`\n ${colors.red('✗')} Self-healing failed: ${e.message}\n`);
    process.exit(1);
  }
}

main();
