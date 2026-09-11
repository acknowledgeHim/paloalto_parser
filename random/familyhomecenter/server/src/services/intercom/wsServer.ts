import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { PageSession } from './pageRelay.js';
import { listZoneIds } from '../music/zoneManager.js';

interface StartMessage {
  type: 'start';
  zones: number[];
}
interface StopMessage {
  type: 'stop';
}

/**
 * Handles /ws/intercom: a phone (or the wall touchscreen) opens this socket, sends a JSON "start"
 * message naming target zones, then streams raw MediaRecorder (webm/opus) chunks as binary frames
 * for as long as the person holds the talk button, then sends "stop" (or just disconnects).
 */
export function attachIntercomWebSocket(server: HttpServer): void {
  const wss = new WebSocketServer({ server, path: '/ws/intercom' });

  wss.on('connection', (ws: WebSocket) => {
    let session: PageSession | null = null;

    // A rejected promise inside a `ws` "message" listener isn't caught by anything upstream — it would
    // otherwise become an unhandled rejection and crash the whole server, so every await here is guarded.
    ws.on('message', (data, isBinary) => {
      handleMessage(data, isBinary).catch((err) => {
        console.error('[intercom] error handling message:', err);
        session?.abort();
        session = null;
        ws.send(JSON.stringify({ type: 'error', message: 'internal error, page aborted' }));
      });
    });

    async function handleMessage(data: unknown, isBinary: boolean): Promise<void> {
      if (!isBinary) {
        let msg: StartMessage | StopMessage;
        try {
          msg = JSON.parse((data as Buffer).toString('utf8'));
        } catch {
          return;
        }

        if (msg.type === 'start') {
          const zones = msg.zones.filter((z) => listZoneIds().includes(z));
          if (zones.length === 0) {
            ws.send(JSON.stringify({ type: 'error', message: 'no valid target zones' }));
            return;
          }
          session?.abort();
          session = new PageSession(zones);
          await session.duck();
          ws.send(JSON.stringify({ type: 'started', zones }));
        } else if (msg.type === 'stop') {
          await session?.end();
          session = null;
          ws.send(JSON.stringify({ type: 'stopped' }));
        }
        return;
      }

      // Binary frame: a chunk of recorded audio.
      session?.write(Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer));
    }

    ws.on('close', () => {
      session?.abort();
      session = null;
    });
  });
}
