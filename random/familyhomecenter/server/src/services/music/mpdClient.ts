import net from 'node:net';

/**
 * Minimal client for MPD's line-based text protocol (https://mpd.readthedocs.io/en/latest/protocol.html).
 * One instance talks to one zone's MPD server. Hand-rolled (rather than an npm client) so we depend on
 * nothing beyond documented protocol behavior: every reply is a sequence of "key: value" lines terminated
 * by either "OK\n" (success) or "ACK [error@pos] {command} message\n" (failure).
 */
export class MpdClient {
  private socket: net.Socket | null = null;
  private connecting: Promise<void> | null = null;
  private buffer = '';
  private pending: Array<{ resolve: (lines: string[]) => void; reject: (err: Error) => void }> = [];

  constructor(private host: string, private port: number) {}

  private connect(): Promise<void> {
    if (this.socket && !this.socket.destroyed) return Promise.resolve();
    if (this.connecting) return this.connecting;

    const connecting: Promise<void> = new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port });
      let gotGreeting = false;

      const onFirstData = (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        if (!text.startsWith('OK MPD')) {
          reject(new Error(`Unexpected MPD greeting: ${text}`));
          socket.destroy();
          return;
        }
        gotGreeting = true;
        socket.off('data', onFirstData);
        socket.on('data', (d) => this.onData(d));
        resolve();
      };

      socket.once('error', (err) => {
        if (!gotGreeting) reject(err);
        this.failAllPending(err);
        this.socket = null;
      });
      socket.once('close', () => {
        this.failAllPending(new Error('MPD connection closed'));
        this.socket = null;
      });
      socket.on('data', onFirstData);
      this.socket = socket;
    }).finally(() => {
      this.connecting = null;
    });

    this.connecting = connecting;
    return connecting;
  }

  private failAllPending(err: Error): void {
    const queued = this.pending;
    this.pending = [];
    for (const p of queued) p.reject(err);
  }

  private onData(chunk: Buffer): void {
    this.buffer += chunk.toString('utf8');
    // A reply is complete once we see a line starting with "OK" or "ACK " (MPD always terminates that way).
    while (true) {
      const okIndex = this.buffer.indexOf('\nOK\n');
      const okAtStart = this.buffer.startsWith('OK\n') ? 0 : -1;
      const ackMatch = this.buffer.match(/(^|\n)ACK .*\n/);

      let end = -1;
      let bodyEnd = -1;
      if (okAtStart === 0) {
        end = 3;
        bodyEnd = 0;
      } else if (okIndex !== -1) {
        end = okIndex + 4;
        bodyEnd = okIndex + 1;
      } else if (ackMatch && ackMatch.index !== undefined) {
        end = ackMatch.index + ackMatch[0].length;
        bodyEnd = ackMatch.index + (ackMatch[1] === '\n' ? 1 : 0);
      }

      if (end === -1) break;

      const body = this.buffer.slice(0, bodyEnd);
      const terminator = this.buffer.slice(bodyEnd, end).trim();
      this.buffer = this.buffer.slice(end);

      const next = this.pending.shift();
      if (!next) continue;

      if (terminator.startsWith('ACK')) {
        next.reject(new Error(terminator));
      } else {
        next.resolve(body.split('\n').filter((l) => l.length > 0));
      }
    }
  }

  /** Send one command, return its reply as raw "key: value" lines (empty array for commands with no output). */
  async command(cmd: string): Promise<string[]> {
    await this.connect();
    return new Promise((resolve, reject) => {
      this.pending.push({ resolve, reject });
      this.socket!.write(cmd + '\n');
    });
  }

  /** Same as command(), parsed into a plain object (later duplicate keys overwrite earlier ones). */
  async commandObject(cmd: string): Promise<Record<string, string>> {
    const lines = await this.command(cmd);
    return linesToObject(lines);
  }

  /** For commands that return a list of same-shaped records (e.g. playlistinfo), split on the given key. */
  async commandList(cmd: string, splitKey: string): Promise<Record<string, string>[]> {
    const lines = await this.command(cmd);
    return splitOnKey(lines, splitKey);
  }

  close(): void {
    this.socket?.end();
    this.socket = null;
  }
}

export function linesToObject(lines: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const line of lines) {
    const idx = line.indexOf(': ');
    if (idx === -1) continue;
    obj[line.slice(0, idx)] = line.slice(idx + 2);
  }
  return obj;
}

export function splitOnKey(lines: string[], splitKey: string): Record<string, string>[] {
  const records: Record<string, string>[] = [];
  let current: Record<string, string> | null = null;
  for (const line of lines) {
    const idx = line.indexOf(': ');
    if (idx === -1) continue;
    const key = line.slice(0, idx);
    const value = line.slice(idx + 2);
    if (key === splitKey) {
      current = {};
      records.push(current);
    }
    if (current) current[key] = value;
  }
  return records;
}

/** Escape a value for use inside a quoted MPD command argument. */
export function mpdQuote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
