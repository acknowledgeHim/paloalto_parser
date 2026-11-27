import { WebSocketServer } from 'ws';
import { PageSession } from './pageRelay.js';
import { listZoneIds } from '../music/zoneManager.js';
/**
 * Handles /ws/intercom: a phone (or the wall touchscreen) opens this socket, sends a JSON "start"
 * message naming target zones, then streams raw MediaRecorder (webm/opus) chunks as binary frames
 * for as long as the person holds the talk button, then sends "stop" (or just disconnects).
 */
export function attachIntercomWebSocket(server) {
    const wss = new WebSocketServer({ server, path: '/ws/intercom' });
    wss.on('connection', (ws) => {
        let session = null;
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
        async function handleMessage(data, isBinary) {
            if (!isBinary) {
                let msg;
                try {
                    msg = JSON.parse(data.toString('utf8'));
                }
                catch {
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
                }
                else if (msg.type === 'stop') {
                    await session?.end();
                    session = null;
                    ws.send(JSON.stringify({ type: 'stopped' }));
                }
                return;
            }
            // Binary frame: a chunk of recorded audio.
            session?.write(Buffer.isBuffer(data) ? data : Buffer.from(data));
        }
        ws.on('close', () => {
            session?.abort();
            session = null;
        });
    });
}
