#!/usr/bin/env node
import { execSync } from 'child_process';
import { existsSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const RECOVERY_DIR = resolve(root, '.heal-recovery');

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------
const colors = {
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function log(step, msg) { console.log(` ${colors.blue('→')} ${colors.dim(step.padEnd(18))} ${msg}`); }
function ok(msg) { console.log(` ${colors.green('✓')} ${msg}`); }
function warn(msg) { console.log(` ${colors.yellow('⚠')} ${msg}`); }
function fail(msg) { console.log(` ${colors.red('✗')} ${msg}`); }

// ---------------------------------------------------------------------------
// Run helper
// ---------------------------------------------------------------------------
function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { cwd: root, stdio: 'pipe', encoding: 'utf-8', timeout: 120000, ...opts }).trim();
  } catch (e) {
    return { error: e.message, stdout: e.stdout?.trim?.() || '', stderr: e.stderr?.trim?.() || '' };
  }
}

function runSafe(cmd, opts = {}) {
  try {
    return execSync(cmd, { cwd: root, stdio: 'pipe', encoding: 'utf-8', timeout: 120000, ...opts }).trim();
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// 1. Collect diagnostics
// ---------------------------------------------------------------------------
function collectDiagnostics() {
  log('diagnostics', 'Collecting build, lint, and system info...');
  const diag = { errors: [], warnings: [], config: {}, git: {}, deps: {} };

  // Build error: check .next/trace and build log
  const tracePath = resolve(root, '.next', 'trace');
  if (existsSync(tracePath)) {
    try {
      const trace = readFileSync(tracePath, 'utf-8');
      if (trace.includes('FATAL ERROR') || trace.includes('Error:')) {
        diag.errors.push({ source: 'build_trace', text: trace.slice(0, 2000) });
      }
    } catch {}
  }

  // Lint
  const lintResult = run('npx eslint . --format compact 2>&1', { timeout: 30000 });
  if (typeof lintResult !== 'string' && lintResult.stdout) {
    diag.warnings.push({ source: 'eslint', text: lintResult.stdout.slice(0, 3000) });
  } else if (typeof lintResult === 'string' && lintResult.length > 0) {
    diag.warnings.push({ source: 'eslint', text: lintResult.slice(0, 3000) });
  }

  // TypeScript
  const tsResult = run('npx tsc --noEmit 2>&1', { timeout: 30000 });
  if (typeof tsResult !== 'string' && tsResult.stdout) {
    diag.errors.push({ source: 'typescript', text: tsResult.stdout.slice(0, 3000) });
  } else if (typeof tsResult === 'string' && tsResult.length > 0) {
    // tsc outputs to stderr
    diag.errors.push({ source: 'typescript', text: tsResult.slice(0, 3000) });
  }

  // Git info
  diag.git.recentCommits = runSafe('git log --oneline -10 2>&1');
  diag.git.branch = runSafe('git branch --show-current 2>&1');

  // Config files
  const configFiles = ['package.json', 'next.config.ts', 'tsconfig.json', 'eslint.config.mjs', 'postcss.config.mjs'];
  for (const f of configFiles) {
    const fp = resolve(root, f);
    if (existsSync(fp)) {
      diag.config[f] = readFileSync(fp, 'utf-8').slice(0, 1000);
    }
  }

  // Dependencies
  try {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));
    diag.deps = { all: { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies } };
  } catch {}

  // Log summary
  if (diag.errors.length === 0 && diag.warnings.length === 0) {
    ok('No issues found');
    return null;
  }
  warn(`${diag.errors.length} error(s), ${diag.warnings.length} warning(s)`);
  return diag;
}

// ---------------------------------------------------------------------------
// 2. Send to AI (OpenRouter)
// ---------------------------------------------------------------------------
function getApiKeys() {
  const envVal = process.env.OPENROUTER_API_KEYS;
  if (!envVal) return [];
  return envVal.split(',').map((k) => k.trim()).filter(Boolean);
}

function callAI(prompt) {
  const keys = getApiKeys();
  if (keys.length === 0) {
    warn('No OPENROUTER_API_KEYS set, skipping AI analysis');
    return null;
  }

  const apiKey = keys[0];
  const body = JSON.stringify({
    model: 'openai/gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an expert debugging AI for a Next.js/TypeScript project called VibeCoder.
Analyze the errors below and return a JSON array of fix actions.
Only return the JSON array, nothing else.

Each action must have:
- "type": "FILE_WRITE" | "FILE_EDIT" | "FILE_DELETE" | "RUN" | "INFO"
- For FILE_WRITE: { "type": "FILE_WRITE", "path": "relative/file.ts", "content": "full new file content" }
- For FILE_EDIT: { "type": "FILE_EDIT", "path": "relative/file.ts", "old": "exact text to replace", "new": "replacement text" }
- For FILE_DELETE: { "type": "FILE_DELETE", "path": "relative/file.ts" }
- For RUN: { "type": "RUN", "command": "npm install some-package" }
- For INFO: { "type": "INFO", "message": "description of what needs manual fix" }`,
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 4000,
  });

  return new Promise((resolvePromise) => {
    const req = https.request(
      {
        hostname: 'openrouter.ai',
        path: '/api/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 60000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            const text = parsed.choices?.[0]?.message?.content || '';
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              resolvePromise(JSON.parse(jsonMatch[0]));
            } else {
              warn('AI response did not contain valid JSON');
              resolvePromise(null);
            }
          } catch (e) {
            warn(`AI parse error: ${e.message}`);
            resolvePromise(null);
          }
        });
      },
    );
    req.on('error', (e) => {
      warn(`AI request failed: ${e.message}`);
      resolvePromise(null);
    });
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// 3. Apply AI-suggested fixes
// ---------------------------------------------------------------------------
function applyFixes(actions) {
  if (!actions || actions.length === 0) {
    warn('No fix actions from AI');
    return false;
  }

  ok(`AI returned ${actions.length} action(s)`);
  let applied = false;

  // Backup original files before editing
  if (!existsSync(RECOVERY_DIR)) mkdirSync(RECOVERY_DIR, { recursive: true });

  for (const action of actions) {
    switch (action.type) {
      case 'FILE_WRITE': {
        const absPath = resolve(root, action.path);
        const dir = dirname(absPath);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        // Backup
        if (existsSync(absPath)) {
          const rel = dirname(RECOVERY_DIR);
          const backupDir = resolve(RECOVERY_DIR, dirname(action.path));
          if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
          writeFileSync(resolve(RECOVERY_DIR, action.path), readFileSync(absPath));
        }
        writeFileSync(absPath, action.content, 'utf-8');
        log('write', action.path);
        applied = true;
        break;
      }
      case 'FILE_EDIT': {
        const absPath = resolve(root, action.path);
        if (!existsSync(absPath)) {
          warn(`File not found for edit: ${action.path}`);
          continue;
        }
        const content = readFileSync(absPath, 'utf-8');
        if (!content.includes(action.old)) {
          warn(`Pattern not found in ${action.path}`);
          continue;
        }
        // Backup
        const backupDir = resolve(RECOVERY_DIR, dirname(action.path));
        if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
        writeFileSync(resolve(RECOVERY_DIR, action.path), content);
        writeFileSync(absPath, content.replace(action.old, action.new), 'utf-8');
        log('edit', action.path);
        applied = true;
        break;
      }
      case 'FILE_DELETE': {
        const absPath = resolve(root, action.path);
        if (existsSync(absPath)) {
          const backupDir = resolve(RECOVERY_DIR, dirname(action.path));
          if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
          writeFileSync(resolve(RECOVERY_DIR, action.path), readFileSync(absPath));
          rmSync(absPath, { force: true });
          log('delete', action.path);
          applied = true;
        }
        break;
      }
      case 'RUN': {
        log('run', action.command);
        try {
          execSync(action.command, { cwd: root, stdio: 'inherit', timeout: 60000 });
          applied = true;
        } catch (e) {
          warn(`Command failed: ${e.message}`);
        }
        break;
      }
      case 'INFO': {
        warn(`Manual action needed: ${action.message}`);
        break;
      }
    }
  }

  return applied;
}

// ---------------------------------------------------------------------------
// 4. Rollback if build still fails
// ---------------------------------------------------------------------------
function rollback() {
  if (!existsSync(RECOVERY_DIR)) return;
  warn('Rolling back changes...');
  const walk = (dir) => {
    const entries = readFileSync?.(dir) ? [dir] : [];
    try {
      const files = execSync(`dir /s /b "${dir}"`, { encoding: 'utf-8', timeout: 5000 }).trim().split('\n');
      for (const file of files) {
        const trimmed = file.trim();
        if (!trimmed) continue;
        const relative = trimmed.slice(RECOVERY_DIR.length + 1);
        const target = resolve(root, relative);
        const dir = dirname(target);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(target, readFileSync(trimmed));
      }
    } catch {}
  };
  walk(RECOVERY_DIR);
  rmSync(RECOVERY_DIR, { recursive: true, force: true });
  ok('Rolled back to original files');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n ${colors.bold(colors.blue('⟳'))} VibeCoder ${colors.dim('AI auto-heal')}\n`);

  // 1. Collect diagnostics
  const diag = collectDiagnostics();
  if (!diag) {
    process.exit(0);
  }

  // 2. Build AI analysis prompt
  const promptLines = [
    '## Project Errors\n',
  ];

  for (const err of diag.errors) {
    promptLines.push(`### ${err.source}\n\`\`\`\n${err.text}\n\`\`\`\n`);
  }
  for (const warn of diag.warnings) {
    promptLines.push(`### ${warn.source}\n\`\`\`\n${warn.text}\n\`\`\`\n`);
  }

  promptLines.push('\n## Config Files\n');
  for (const [name, content] of Object.entries(diag.config)) {
    promptLines.push(`### ${name}\n\`\`\`\n${content}\n\`\`\`\n`);
  }

  promptLines.push('\n## Dependencies\n');
  promptLines.push(JSON.stringify(diag.deps, null, 2));

  promptLines.push('\n## Recent Commits\n');
  promptLines.push(diag.git.recentCommits);

  const prompt = promptLines.join('\n');

  // 3. Call AI
  log('AI analysis', 'Sending diagnostics to OpenRouter...');
  const actions = await callAI(prompt);
  if (!actions) {
    warn('AI could not analyze or returned no fix actions');
    process.exit(1);
  }

  // 4. Apply fixes
  const applied = applyFixes(actions);
  if (!applied) {
    warn('No fixes were applied');
    process.exit(1);
  }

  // 5. Verify
  log('verify', 'Running build to verify fix...');
  const verifyResult = run('npx next build 2>&1', { timeout: 120000 });
  const buildOk = typeof verifyResult === 'string' && (verifyResult.includes('Compiled successfully') || verifyResult.includes('✓'));

  if (buildOk) {
    ok('Build passes after AI fix');
    // Clean up recovery dir
    if (existsSync(RECOVERY_DIR)) rmSync(RECOVERY_DIR, { recursive: true, force: true });
    process.exit(0);
  } else {
    fail('Build still failing, rolling back...');
    rollback();
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`AI heal fatal error: ${e.message}`);
  process.exit(1);
});
