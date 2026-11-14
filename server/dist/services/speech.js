import { execFile, spawn } from 'node:child_process';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
/**
 * 🗣️ Text → spoken audio (WAV) on the Family Home Center itself, for browsers with no voices of their
 * own (Chromium on a Pi often has none). Uses pico2wave (nicer: sudo apt install -y libttspico-utils)
 * or espeak-ng (sudo apt install -y espeak-ng). Small cache, since the same words come up again.
 */
const cache = new Map();
let engine;
const has = (cmd) => new Promise((r) => execFile('which', [cmd], (err) => r(!err)));
export async function speechEngine() {
    if (engine === undefined)
        engine = (await has('pico2wave')) ? 'pico' : (await has('espeak-ng')) ? 'espeak' : null;
    return engine;
}
export async function speak(text, slow = false) {
    const key = `${slow ? 's' : 'n'}|${text}`;
    const hit = cache.get(key);
    if (hit)
        return hit;
    const e = await speechEngine();
    if (!e)
        throw new Error('No speech on the Family Home Center — install it with: sudo apt install -y libttspico-utils (or espeak-ng)');
    let wav;
    if (e === 'pico') {
        // pico2wave can only write to a file: our own temp file, removed straight after.
        const file = path.join(os.tmpdir(), `fhc-say-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
        const say = slow ? `<speed level="75">${text.replace(/[<>&]/g, ' ')}</speed>` : text;
        await new Promise((resolve, reject) => execFile('pico2wave', ['-l', 'en-US', '-w', file, say], { timeout: 15000 }, (err) => (err ? reject(err) : resolve())));
        wav = await fsp.readFile(file);
        await fsp.unlink(file).catch(() => { });
    }
    else {
        wav = await new Promise((resolve, reject) => {
            const p = spawn('espeak-ng', ['-v', 'en-us', '-s', slow ? '120' : '150', '--stdout', text]);
            const chunks = [];
            p.stdout.on('data', (c) => chunks.push(c));
            p.on('error', reject);
            p.on('close', (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`espeak-ng exited ${code}`))));
        });
    }
    cache.set(key, wav);
    if (cache.size > 400)
        cache.delete(cache.keys().next().value);
    return wav;
}
