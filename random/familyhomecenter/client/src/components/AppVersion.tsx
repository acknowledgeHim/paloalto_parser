import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

declare const __APP_BUILD__: string;

/**
 * Settings → App version: the commit this screen was built from, and the one the server is running.
 * After `git pull` on the Pi, both should show the newest commit — if the screen is older, the client
 * wasn't rebuilt (or the browser kept the old page); if the server is older, it wasn't rebuilt/restarted.
 */
export function AppVersion() {
  const [server, setServer] = useState<{ server: string; started: string } | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    api
      .get<{ server: string; started: string }>('/version')
      .then(setServer)
      .catch(() => setErr(true));
  }, []);
  const client = typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : 'unknown';
  const same = server && server.server === client;
  return (
    <p className="hint app-version">
      🏷️ App version — screen: <code>{client}</code> · server: <code>{err ? 'older than this screen (no version yet)' : (server?.server ?? '…')}</code>
      {server && ` · server started ${new Date(server.started).toLocaleString()}`}
      {server && !same && ' · ⚠️ these differ: rebuild both (server and client), restart the service, then refresh this page.'}
    </p>
  );
}
