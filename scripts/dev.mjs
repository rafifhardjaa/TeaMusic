#!/usr/bin/env node
/**
 * Runs the API (Bun) and the web dev server (pnpm) together so `pnpm run dev`
 * at the root starts the whole stack instead of two terminals.
 */
import { spawn } from 'node:child_process';

const processes = [
  { name: 'api', command: 'bun', args: ['run', '--cwd', 'apps/api', 'dev'], color: '\x1b[33m' },
  { name: 'web', command: 'pnpm', args: ['--dir', 'apps/web', 'dev'], color: '\x1b[36m' },
];

const children = processes.map(({ name, command, args, color }) => {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  const prefix = `${color}[${name}]\x1b[0m`;
  const pipe = (stream, target) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) target.write(`${prefix} ${line}\n`);
    });
  };

  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on('exit', (code) => {
    process.stdout.write(`${prefix} exited with code ${code}\n`);
    shutdown(code ?? 0);
  });

  return child;
});

let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
