#!/usr/bin/env node
import { execSync, spawn } from 'child_process';
import { existsSync, writeFileSync, readFileSync, mkdirSync, rmSync, copyFileSync } from 'fs';
import { homedir, platform } from 'os';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const isWin = platform() === 'win32';
const isMac = platform() === 'darwin';
const isLinux = platform() === 'linux';

const colors = {
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { cwd: root, stdio: 'pipe', encoding: 'utf-8', timeout: 120000, ...opts }).trim();
  } catch {
    return '';
  }
}

function log(step, msg) {
  console.log(` ${colors.blue('→')} ${colors.dim(step.padEnd(16))} ${msg}`);
}

function ok(msg) {
  console.log(` ${colors.green('✓')} ${msg}`);
}

function warn(msg) {
  console.log(` ${colors.yellow('⚠')} ${msg}`);
}

function fail(msg) {
  console.log(` ${colors.red('✗')} ${msg}`);
}

function step(label, fn) {
  log(label, '...');
  try {
    fn();
    ok(label);
  } catch (e) {
    fail(`${label}: ${e.message}`);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// 1. Check Node.js version
// ---------------------------------------------------------------------------
function checkNodeVersion() {
  const v = process.version.match(/^v(\d+)/);
  if (!v || parseInt(v[1]) < 18) {
    throw new Error(`Node.js 18+ required, got ${process.version}`);
  }
}

// ---------------------------------------------------------------------------
// 2. Install missing native Tailwind binary
// ---------------------------------------------------------------------------
function healTailwindBinary() {
  const oxideDir = resolve(root, 'node_modules', '@tailwindcss', 'oxide');
  if (!existsSync(oxideDir)) return; // not installed yet, skip

  const pkgPath = resolve(oxideDir, 'package.json');
  if (!existsSync(pkgPath)) return;

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const optionalDeps = pkg.optionalDependencies || {};
  const platformDeps = Object.keys(optionalDeps);

  // Determine the platform package name
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

  if (!targetPkg) return; // no matching platform dep found

  // Check if the binary is already resolvable
  try {
    require.resolve(targetPkg);
    return; // binary is fine
  } catch {
    // binary is missing — install it explicitly
    warn(`Missing native binding ${targetPkg}, installing...`);
    run(`npm install ${targetPkg} --no-save --ignore-scripts`, { stdio: 'inherit', timeout: 60000 });
  }
}

// ---------------------------------------------------------------------------
// 3. Check node_modules
// ---------------------------------------------------------------------------
function checkNodeModules() {
  if (!existsSync(resolve(root, 'node_modules'))) {
    warn('node_modules not found, running npm install...');
    run('npm install', { stdio: 'inherit', timeout: 120000 });
  }
  if (!existsSync(resolve(root, 'node_modules', 'next'))) {
    throw new Error('npm install did not produce node_modules/next. Try deleting package-lock.json and reinstalling.');
  }
}

// ---------------------------------------------------------------------------
// 4. Ensure .env.local exists
// ---------------------------------------------------------------------------
function ensureEnvFile() {
  const envPath = resolve(root, '.env.local');
  if (existsSync(envPath)) return;

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
}

// ---------------------------------------------------------------------------
// 5. Clear stale .next cache if it looks corrupted
// ---------------------------------------------------------------------------
function healNextCache() {
  const cacheDir = resolve(root, '.next');
  if (!existsSync(cacheDir)) return;

  const tracePath = resolve(cacheDir, 'trace');
  if (!existsSync(tracePath)) return;

  try {
    const trace = readFileSync(tracePath, 'utf-8');
    // If trace contains an OOM/fatal error marker, clear cache
    if (trace.includes('FATAL ERROR') || trace.includes('out of memory') || trace.includes('Allocation failed')) {
      warn('Detected corrupted .next cache from previous OOM, clearing...');
      rmSync(cacheDir, { recursive: true, force: true });
    }
  } catch {
    // can't read trace, leave it alone
  }
}

// ---------------------------------------------------------------------------
// 6. Kill anything on port 3000
// ---------------------------------------------------------------------------
function freePort() {
  try {
    if (isWin) {
      const result = run(`netstat -ano | findstr ":3000 " | findstr LISTENING`);
      if (result) {
        const lines = result.split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0') {
            try {
              run(`taskkill /F /PID ${pid}`);
              warn(`Killed old process on port 3000 (PID ${pid})`);
            } catch {}
          }
        }
      }
    } else {
      const result = run(`lsof -ti:3000 2>/dev/null`);
      if (result) {
        result.split('\n').filter(Boolean).forEach((pid) => {
          try {
            process.kill(parseInt(pid), 'SIGKILL');
            warn(`Killed old process on port 3000 (PID ${pid})`);
          } catch {}
        });
      }
    }
  } catch {
    // port already free
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n ${colors.blue('⟳')} VibeCoder ${colors.dim('self-healing dev server')}\n`);

  try {
    step('node version', checkNodeVersion);
    step('node_modules', checkNodeModules);
    step('tailwind binary', healTailwindBinary);
    step('env file', ensureEnvFile);
    step('cache health', healNextCache);
    step('free port 3000', freePort);

    console.log(`\n ${colors.green('✓')} All checks passed, starting Next.js...\n`);

    const nextBin = resolve(root, 'node_modules', '.bin', isWin ? 'next.cmd' : 'next');
    const child = spawn(nextBin, ['dev'], {
      cwd: root,
      stdio: 'inherit',
      shell: false,
      env: {
        ...process.env,
        NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=2048',
      },
    });

    child.on('exit', (code) => {
      process.exit(code ?? 1);
    });

    process.on('SIGINT', () => child.kill('SIGINT'));
    process.on('SIGTERM', () => child.kill('SIGTERM'));
  } catch (e) {
    console.error(`\n ${colors.red('✗')} Self-healing failed: ${e.message}\n`);
    process.exit(1);
  }
}

main();
