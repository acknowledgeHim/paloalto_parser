import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

interface Health {
  cpus: number;
  load: number[];
  temp_c: number | null;
  throttled: { now: string[]; since_boot: string[] } | null;
  mem_total_mb: number;
  mem_available_mb: number;
  net: { iface: string; link_mbit: number | null; rx_mbit: number; tx_mbit: number } | null;
  warnings: string[];
  disks?: Array<{ what: string; path: string; total_gb: number; free_gb: number }>;
  uptime_s?: number;
  app?: { mem_mb: number; cpu_pct: number; up_s: number; db_mb: number | null };
  watching: Array<{ title: string; open: number }>;
  copy_paused: boolean;
}

const ago = (s: number) => {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
};

/** A bar that fills: how much of something is used. */
function Meter({ used, of, warn = 0.85 }: { used: number; of: number; warn?: number }) {
  const f = of > 0 ? Math.min(1, Math.max(0, used / of)) : 0;
  return (
    <div className="resource-meter" role="meter" aria-valuemin={0} aria-valuemax={of} aria-valuenow={used}>
      <div className={`resource-meter__fill${f >= warn ? ' is-high' : ''}`} style={{ width: `${f * 100}%` }} />
    </div>
  );
}

/**
 * 📊 HomeCenter Resource Usage (🛠️ More): how the Family Home Center's computer is doing, refreshed
 * every few seconds — CPU, temperature, memory, disk, network, who's watching a movie, and the app
 * itself. For "it's slow" or "it froze while two of us watched a movie".
 */
export function ResourceUsagePage() {
  const [h, setH] = useState<Health | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const get = () =>
      api
        .get<Health>('/resources')
        .then((x) => live && (setH(x), setErr(null)))
        .catch((e) => live && setErr((e as Error).message));
    void get();
    const t = setInterval(get, 5000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="resource-page">
      <h1>📊 HomeCenter Resource Usage</h1>
      <p className="hint">How the Family Home Center's computer is doing right now. Updates every 5 seconds.</p>
      {err && <div className="settings-login__error">{err}</div>}
      {!h ? (
        <p className="hint">Looking…</p>
      ) : (
        <>
          {h.warnings.map((w) => (
            <div key={w} className="settings-login__error">
              ⚠️ {w}
            </div>
          ))}
          {h.warnings.length === 0 && <p>✅ Nothing looks wrong right now.</p>}
          <div className="resource-grid">
            <section className="panel">
              <h2>🧠 CPU</h2>
              <p>
                Load <strong>{h.load[0]}</strong> on {h.cpus} cores <span className="hint">(up to {h.cpus} is fine · 5 min {h.load[1]} · 15 min {h.load[2]})</span>
              </p>
              <Meter used={h.load[0]} of={h.cpus} warn={1} />
              {h.temp_c != null && (
                <p>
                  🌡️ <strong>{h.temp_c} °C</strong> <span className="hint">(a Pi slows itself down above ~80 °C)</span>
                </p>
              )}
              {h.temp_c != null && <Meter used={h.temp_c} of={85} warn={0.88} />}
              {h.throttled && (
                <p>
                  ⚡ Power / heat: {h.throttled.now.length ? h.throttled.now.join(', ') : 'OK'}
                  {h.throttled.since_boot.length && !h.throttled.now.length ? <span className="hint"> (earlier: {h.throttled.since_boot.join(', ')})</span> : null}
                </p>
              )}
            </section>
            <section className="panel">
              <h2>💾 Memory</h2>
              <p>
                <strong>{h.mem_total_mb - h.mem_available_mb} MB</strong> used of {h.mem_total_mb} MB <span className="hint">({h.mem_available_mb} MB free)</span>
              </p>
              <Meter used={h.mem_total_mb - h.mem_available_mb} of={h.mem_total_mb} />
            </section>
            {(h.disks ?? []).map((d) => (
              <section key={d.path} className="panel">
                <h2>🗄️ {d.what}</h2>
                <p>
                  <strong>{Math.round((d.total_gb - d.free_gb) * 10) / 10} GB</strong> used of {d.total_gb} GB <span className="hint">({d.free_gb} GB free)</span>
                </p>
                <Meter used={d.total_gb - d.free_gb} of={d.total_gb} warn={0.9} />
                <p className="hint">
                  <code>{d.path}</code>
                </p>
              </section>
            ))}
            {h.net && (
              <section className="panel">
                <h2>🌐 Network</h2>
                <p>
                  ⬇️ in <strong>{h.net.rx_mbit}</strong> Mbit/s · ⬆️ out <strong>{h.net.tx_mbit}</strong> Mbit/s
                </p>
                {h.net.link_mbit && <Meter used={Math.max(h.net.rx_mbit, h.net.tx_mbit)} of={h.net.link_mbit} warn={0.7} />}
                <p className="hint">
                  {h.net.iface}
                  {h.net.iface.startsWith('wl') ? ' (Wi-Fi)' : ''}
                  {h.net.link_mbit ? ` · ${h.net.link_mbit} Mbit/s link` : ''}
                </p>
              </section>
            )}
            <section className="panel">
              <h2>🍿 Movies</h2>
              <p>Watching now: {h.watching.length ? h.watching.map((w) => w.title).join(', ') : 'nobody'}</p>
              {h.copy_paused && <p className="hint">The .mp4 copier is paused until they finish.</p>}
            </section>
            {h.app && (
              <section className="panel">
                <h2>🏠 The app</h2>
                <p>
                  Memory <strong>{h.app.mem_mb} MB</strong> · CPU <strong>{h.app.cpu_pct}%</strong>
                </p>
                <p className="hint">
                  Running {ago(h.app.up_s)}
                  {h.uptime_s ? ` · computer on for ${ago(h.uptime_s)}` : ''}
                  {h.app.db_mb != null ? ` · database ${h.app.db_mb} MB` : ''}
                </p>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
