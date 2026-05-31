#!/usr/bin/env node
import { execSync, spawn } from 'child_process';
import { existsSync, writeFileSync, readFileSync, mkdirSync, rmSync, statSync } from 'fs';
import { platform, totalmem, freemem } from 'os';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const isWin = platform() === 'win32';
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
    return execSync(cmd, { cwd: root, stdio: 'pipe', encoding: 'utf-8', timeout: 300000, ...opts }).trim();
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

function checkNodeVersion() {
  const v = process.version.match(/^v(\d+)/);
  if (!v || parseInt(v[1]) < 18) throw new Error(`Node.js 18+ required, got ${process.version}`);
}

function checkNodeModules() {
  const nmDir = resolve(root, 'node_modules');
  if (!existsSync(nmDir)) {
    warn('node_modules not found, running npm install...');
    run('npm install', { stdio: 'inherit', timeout: 180000 });
    if (!existsSync(resolve(nmDir, 'next'))) throw new Error('npm install still missing next');
    return;
  }
  const pkgPath = resolve(root, 'package.json');
  if (existsSync(pkgPath)) {
    const pkgMtime = statSync(pkgPath).mtimeMs;
    const nmMtime = statSync(nmDir).mtimeMs;
    if (pkgMtime > nmMtime + 5000) {
      warn('Dependencies may be stale, running npm install...');
      run('npm install', { stdio: 'inherit', timeout: 180000 });
    }
  }
}

function healTailwindBinary() {
  const oxideDir = resolve(root, 'node_modules', '@tailwindcss', 'oxide');
  if (!existsSync(oxideDir)) return;
  const pkgPath = resolve(oxideDir, 'package.json');
  if (!existsSync(pkgPath)) return;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const deps = Object.keys(pkg.optionalDependencies || {});
  let target = null;
  if (isLinux) target = deps.find(d => d.endsWith(process.arch === 'arm64' ? 'linux-arm64-gnu' : 'linux-x64-gnu'));
  else if (isWin) target = deps.find(d => d.endsWith('win32-x64-msvc'));
  else target = deps.find(d => d.endsWith('darwin-x64'));
  if (!target) return;
  try { require.resolve(target); }
  catch {
    warn(`Missing native binding ${target}, installing...`);
    run(`npm install ${target} --no-save --ignore-scripts`, { stdio: 'inherit', timeout: 60000 });
  }
}

function healNextCache() {
  const cacheDir = resolve(root, '.next');
  if (!existsSync(cacheDir)) return;
  const tracePath = resolve(cacheDir, 'trace');
  if (!existsSync(tracePath)) return;
  try {
    const trace = readFileSync(tracePath, 'utf-8');
    if (trace.includes('FATAL ERROR') || trace.includes('out of memory') || trace.includes('Allocation failed') || trace.includes('Build Error')) {
      warn('Clearing stale cache from previous failed build...');
      rmSync(cacheDir, { recursive: true, force: true });
    }
  } catch {}
}

function checkMemory() {
  const total = totalmem();
  const free = freemem();
  const totalMB = Math.round(total / (1024 * 1024));
  const freeMB = Math.round(free / (1024 * 1024));
  if (totalMB < 2048) {
    warn(`Low memory: ${totalMB}MB total, reducing limit`);
    process.env.NODE_OPTIONS = '--max-old-space-size=1024';
  } else {
    process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || '--max-old-space-size=4096';
  }
  ok(`Memory: ${totalMB}MB total, ${freeMB}MB free`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n ${colors.blue('⟳')} VibeCoder ${colors.dim('self-healing build')}\n`);

  try {
    step('node version', checkNodeVersion);
    step('node_modules', checkNodeModules);
    step('tailwind binary', healTailwindBinary);
    step('build cache', healNextCache);
    step('system memory', checkMemory);

    console.log(`\n ${colors.green('✓')} Pre-flight passed, running next build...\n`);

    const exitCode = await runBuild();

    if (exitCode !== 0) {
      warn(`Build failed (code ${exitCode}), retrying once with clean cache...`);
      rmSync(resolve(root, '.next'), { recursive: true, force: true });
      const retryCode = await runBuild();
      if (retryCode !== 0) {
        fail(`Build failed after retry.`);
        process.exit(retryCode);
      }
    }

    async function runBuild() {
      const nextEntry = resolve(root, 'node_modules', 'next', 'dist', 'bin', 'next');
      return new Promise((resolvePromise) => {
        const proc = spawn(process.execPath, [nextEntry, 'build'], { cwd: root, stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS } });
        proc.on('exit', (code) => resolvePromise(code ?? 1));
      });
    }

    ok('Build succeeded');
    process.exit(0);
  } catch (e) {
    console.error(`\n ${colors.red('✗')} Build failed: ${e.message}\n`);
    process.exit(1);
  }
}

main();
