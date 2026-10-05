import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { config } from '../config.js';

/**
 * .docx → .pdf with LibreOffice running headless (`soffice --convert-to pdf`) — a system package
 * this app never installs itself (see docs/PHOTO_DOCUMENTS.md). Conversions run one at a time:
 * LibreOffice locks its profile, so two at once would fail rather than queue.
 */

export class PdfUnavailableError extends Error {}

let queue: Promise<unknown> = Promise.resolve();

function runSoffice(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(config.documents.sofficePath, args);
    let stderr = '';
    proc.stderr.on('data', (c) => (stderr = (stderr + c.toString()).slice(-4000)));
    proc.stdout.resume();
    const timer = setTimeout(() => proc.kill('SIGKILL'), 180_000);
    proc.on('error', (err) => {
      clearTimeout(timer);
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new PdfUnavailableError("PDF download needs LibreOffice on the server — see docs/PHOTO_DOCUMENTS.md (Word download works without it)"));
      } else {
        reject(err);
      }
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `LibreOffice exited with code ${code}`));
    });
  });
}

export function convertDocxToPdf(docx: Buffer): Promise<Buffer> {
  const run = async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-pdf-'));
    try {
      const input = path.join(dir, `${crypto.randomUUID()}.docx`);
      await fs.writeFile(input, docx);
      await runSoffice([
        '--headless',
        '--norestore',
        // A profile of its own, so this never collides with (or depends on) a desktop session's.
        `-env:UserInstallation=file://${path.join(os.tmpdir(), 'familyhomecenter-lo-profile')}`,
        '--convert-to',
        'pdf',
        '--outdir',
        dir,
        input,
      ]);
      return await fs.readFile(input.replace(/\.docx$/, '.pdf'));
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  };
  const result = queue.then(run, run);
  queue = result.catch(() => {});
  return result;
}
