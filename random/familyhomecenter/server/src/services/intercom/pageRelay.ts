import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { config } from '../../config.js';
import { zoneTransport, getZoneStatus } from '../music/zoneManager.js';
import * as spotify from '../music/spotify.js';

interface ActiveDuck {
  zoneId: number;
  previousVolume: number;
  wasPlayingLocal: boolean;
  spotifyDeviceId: string | null;
}

/**
 * One push-to-talk "page": decodes the browser's incoming audio (webm/opus from MediaRecorder) with
 * ffmpeg into raw PCM, then fans that PCM out to one `aplay` process per target zone, writing straight
 * to that zone's ALSA device (see docs/MUSIC_SETUP.md for the zone1..N device setup on the DAC8x).
 */
/** Resolves once a child process's "close" event fires — captured from the moment it's spawned. A
 *  process that fails fast (bad device, missing binary) closes almost immediately, and attaching a
 *  `.once('close', ...)` listener *later* (e.g. only once end() is called) would miss that already-fired
 *  event and wait forever, so every process's close-promise is wired up right at spawn time instead. */
function closePromise(proc: ChildProcessWithoutNullStreams): Promise<void> {
  return new Promise((resolve) => proc.once('close', () => resolve()));
}

export class PageSession {
  private ffmpeg: ChildProcessWithoutNullStreams;
  private players = new Map<number, ChildProcessWithoutNullStreams>();
  private playerClosed = new Map<number, Promise<void>>();
  private ducked: ActiveDuck[] = [];
  private ended = false;

  constructor(private zoneIds: number[]) {
    this.ffmpeg = spawn('ffmpeg', [
      '-loglevel', 'error',
      '-i', 'pipe:0',
      '-f', 's16le',
      '-ar', '44100',
      '-ac', '2',
      'pipe:1',
    ]);
    this.ffmpeg.on('error', (err) => console.error('[intercom] ffmpeg failed to start (is it installed?):', err));
    this.ffmpeg.stderr.on('data', (d) => console.warn('[intercom] ffmpeg:', d.toString().trim()));

    for (const zoneId of zoneIds) {
      const device = `${config.intercom.alsaDevicePrefix}${zoneId}`;
      const aplay = spawn('aplay', ['-q', '-D', device, '-f', 'S16_LE', '-r', '44100', '-c', '2', '-t', 'raw']);
      aplay.on('error', (err) => console.error(`[intercom] aplay failed for zone ${zoneId} (is alsa-utils installed?):`, err));
      aplay.stderr.on('data', (d) => console.warn(`[intercom] aplay zone ${zoneId}:`, d.toString().trim()));
      this.ffmpeg.stdout.pipe(aplay.stdin);
      this.players.set(zoneId, aplay);
      this.playerClosed.set(zoneId, closePromise(aplay));
    }
  }

  /** Lower each target zone's volume and pause whatever's playing so the page is easy to hear. */
  async duck(): Promise<void> {
    const devices = await spotify.listDevices().catch(() => [] as spotify.SpotifyDevice[]);

    await Promise.all(
      this.zoneIds.map(async (zoneId) => {
        const status = await getZoneStatus(zoneId);
        const previousVolume = status.volume;
        const wasPlayingLocal = status.source === 'local' && status.state === 'play';

        let spotifyDeviceId: string | null = null;
        if (status.source === 'spotify') {
          const match = devices.find((d) => d.name === `Family Hub Zone ${zoneId}`);
          spotifyDeviceId = match?.id ?? null;
        }

        this.ducked.push({ zoneId, previousVolume, wasPlayingLocal, spotifyDeviceId });

        await zoneTransport.setVolume(zoneId, config.intercom.duckVolumePercent).catch(() => {});
        if (wasPlayingLocal) await zoneTransport.pause(zoneId).catch(() => {});
        if (spotifyDeviceId) await spotify.pause(spotifyDeviceId).catch(() => {});
      })
    );
  }

  /** Feed a chunk of browser-recorded audio (webm/opus) into the decode pipeline. */
  write(chunk: Buffer): void {
    if (this.ended || this.ffmpeg.stdin.destroyed) return;
    this.ffmpeg.stdin.write(chunk);
  }

  /** Stop recording, let buffered audio finish playing, restore volume/playback state. */
  async end(): Promise<void> {
    if (this.ended) return;
    this.ended = true;
    this.ffmpeg.stdin.end();

    // Wait for every player to finish flushing, but never longer than a few seconds — a wedged
    // aplay process (or a genuinely absent/misbehaving ALSA device) must not hang the talk button forever.
    const allClosed = Promise.all(Array.from(this.playerClosed.values()));
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 4000));
    await Promise.race([allClosed, timeout]);
    for (const p of this.players.values()) {
      if (p.exitCode === null && p.signalCode === null) p.kill();
    }

    await Promise.all(
      this.ducked.map(async (d) => {
        await zoneTransport.setVolume(d.zoneId, d.previousVolume).catch(() => {});
        if (d.wasPlayingLocal) await zoneTransport.play(d.zoneId).catch(() => {});
        if (d.spotifyDeviceId) await spotify.play(d.spotifyDeviceId).catch(() => {});
      })
    );
  }

  abort(): void {
    if (this.ended) return;
    this.ended = true;
    this.ffmpeg.kill();
    for (const p of this.players.values()) p.kill();
  }
}
