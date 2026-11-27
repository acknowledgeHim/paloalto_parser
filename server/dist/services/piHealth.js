import { execFile } from 'node:child_process';
import fsp from 'node:fs/promises';
import os from 'node:os';
import { config } from '../config.js';
const read = (p) => fsp.readFile(p, 'utf8').catch(() => null);
async function netBytes() {
    const out = new Map();
    for (const line of ((await read('/proc/net/dev')) ?? '').split('\n').slice(2)) {
        const [name, rest] = line.split(':');
        if (!rest)
            continue;
        const f = rest.trim().split(/\s+/).map(Number);
        out.set(name.trim(), { rx: f[0], tx: f[8] });
    }
    return out;
}
async function defaultIface() {
    for (const line of ((await read('/proc/net/route')) ?? '').split('\n').slice(1)) {
        const f = line.trim().split(/\s+/);
        if (f[1] === '00000000')
            return f[0];
    }
    return null;
}
function throttled() {
    return new Promise((resolve) => {
        execFile('vcgencmd', ['get_throttled'], { timeout: 3000 }, (err, out) => {
            const m = /0x([0-9a-f]+)/i.exec(out ?? '');
            if (err || !m)
                return resolve(null);
            const v = parseInt(m[1], 16);
            const bits = [
                [0x1, 'not enough power (under-voltage)'],
                [0x2, 'CPU speed capped'],
                [0x4, 'slowed down (throttled)'],
                [0x8, 'too hot (soft limit)'],
            ];
            resolve({
                now: bits.filter(([b]) => v & b).map(([, t]) => t),
                since_boot: bits.filter(([b]) => v & (b << 16)).map(([, t]) => t),
            });
        });
    });
}
async function disk(what, p) {
    try {
        const st = await fsp.statfs(p);
        return { what, path: p, total_gb: Math.round(((st.blocks * st.bsize) / 1e9) * 10) / 10, free_gb: Math.round(((st.bavail * st.bsize) / 1e9) * 10) / 10 };
    }
    catch {
        return null;
    }
}
export async function piHealth() {
    const iface = await defaultIface();
    const before = await netBytes();
    const cpu0 = process.cpuUsage();
    const t0 = Date.now();
    const [temp, thr, meminfo] = await Promise.all([read('/sys/class/thermal/thermal_zone0/temp'), throttled(), read('/proc/meminfo')]);
    await new Promise((r) => setTimeout(r, 1000)); // network: bytes over one second
    const after = await netBytes();
    const cpu = process.cpuUsage(cpu0);
    const cpuPct = Math.round(((cpu.user + cpu.system) / 1000 / Math.max(1, Date.now() - t0)) * 1000) / 10;
    const [dataDisk, rootDisk, dbStat] = await Promise.all([disk('App data', config.dataDir), disk('Main disk', '/'), fsp.stat(config.dbPath).catch(() => null)]);
    const disks = [dataDisk, rootDisk].filter((d) => Boolean(d));
    // Same disk twice? Show it once.
    const uniq = disks.filter((d, i) => disks.findIndex((x) => x.total_gb === d.total_gb && x.free_gb === d.free_gb) === i);
    const avail = /MemAvailable:\s+(\d+)/.exec(meminfo ?? '');
    const speed = iface ? Number((await read(`/sys/class/net/${iface}/speed`))?.trim()) : NaN;
    const b = iface ? before.get(iface) : undefined;
    const a = iface ? after.get(iface) : undefined;
    const h = {
        cpus: os.cpus().length,
        load: os.loadavg().map((x) => Math.round(x * 100) / 100),
        temp_c: temp ? Math.round(Number(temp) / 100) / 10 : null,
        throttled: thr,
        mem_total_mb: Math.round(os.totalmem() / 1048576),
        mem_available_mb: Math.round((avail ? Number(avail[1]) * 1024 : os.freemem()) / 1048576),
        net: iface && a && b
            ? { iface, link_mbit: Number.isFinite(speed) && speed > 0 ? speed : null, rx_mbit: Math.round(((a.rx - b.rx) * 8) / 1e5) / 10, tx_mbit: Math.round(((a.tx - b.tx) * 8) / 1e5) / 10 }
            : null,
        warnings: [],
        disks: uniq,
        uptime_s: Math.round(os.uptime()),
        app: { mem_mb: Math.round(process.memoryUsage().rss / 1048576), cpu_pct: cpuPct, up_s: Math.round(process.uptime()), db_mb: dbStat ? Math.round((dbStat.size / 1048576) * 10) / 10 : null },
    };
    const w = h.warnings;
    if (h.load[0] > h.cpus * 1.5)
        w.push(`The CPU is very busy (load ${h.load[0]} on ${h.cpus} cores).`);
    if (h.temp_c != null && h.temp_c >= 80)
        w.push(`It's hot (${h.temp_c} °C) — a Pi slows itself down above ~80 °C. A fan or heatsink case helps.`);
    if (h.throttled?.now.length)
        w.push(`Right now: ${h.throttled.now.join(', ')}.`);
    else if (h.throttled?.since_boot.length)
        w.push(`Since it started: ${h.throttled.since_boot.join(', ')}.${h.throttled.since_boot.some((t) => t.includes('power')) ? ' Use the official Pi power supply.' : ''}`);
    for (const d of uniq)
        if (d.total_gb > 0 && d.free_gb / d.total_gb < 0.08)
            w.push(`${d.what} is nearly full: ${d.free_gb} GB free of ${d.total_gb} GB.`);
    if (h.mem_available_mb < 150)
        w.push(`Memory is nearly full (${h.mem_available_mb} MB free).`);
    if (h.net?.link_mbit != null && h.net.link_mbit <= 100)
        w.push(`The network link is only ${h.net.link_mbit} Mbit/s${h.net.iface.startsWith('wl') ? ' (Wi-Fi)' : ''}. Every movie comes in from the NAS and goes out again to the viewer, so two big movies can fill it — use a wired gigabit connection if you can.`);
    else if (h.net?.iface.startsWith('wl'))
        w.push('The Pi is on Wi-Fi. Every movie crosses it twice (from the NAS, then to the viewer) — a network cable is much smoother.');
    return h;
}
