import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';

/**
 * Settings → 📬 Weekly report: each kid's week by email, Sunday at 6pm, to every parent with an
 * email (and the kid, if they have one). Turn it off, peek at this week's, or send it now.
 */
export function WeeklyReportSettings() {
  const { members } = useFamilyMembers();
  const kids = members.filter((m) => m.is_parent !== 1);
  const withEmail = members.filter((m) => m.is_parent === 1 && m.email);
  const [on, setOn] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api
      .get<Record<string, string>>('/settings')
      .then((s) => setOn(s.weekly_report_off !== '1'))
      .catch(() => setOn(true));
  }, []);
  const save = async (next: boolean) => {
    setOn(next);
    try {
      await api.patch('/settings', { weekly_report_off: next ? '' : '1' });
    } catch (err) {
      setStatus((err as Error).message);
      setOn(!next);
    }
  };
  const sendNow = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const r = await api.post<{ message: string }>('/reports/weekly/send', {});
      setStatus(r.message);
    } catch (err) {
      setStatus((err as Error).message || 'Could not send');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel">
      <h2>📬 Weekly report</h2>
      <label className="privacy-toggle">
        <input type="checkbox" checked={Boolean(on)} disabled={on === null} onChange={(e) => save(e.target.checked)} />
        <span>
          <strong>Email each kid's week every Sunday at 6pm</strong>
          <span className="hint">
            {' '}— jobs done each day, what slipped, stars, money and prizes earned, and their bank. Goes to{' '}
            {withEmail.length ? withEmail.map((m) => m.name).join(', ') : 'parents with an email (none set yet — add one under Family members)'}
            , plus a kid who has their own email.
          </span>
        </span>
      </label>
      {kids.length > 0 && (
        <p>
          See this week's:{' '}
          {kids.map((k, i) => (
            <span key={k.id}>
              {i > 0 && ' · '}
              <a href={`/api/reports/weekly/${k.id}`} target="_blank" rel="noreferrer">
                {k.name}
              </a>
            </span>
          ))}
        </p>
      )}
      <button type="button" className="secondary" disabled={busy} onClick={sendNow}>
        {busy ? 'Sending…' : '📬 Send them now'}
      </button>
      {status && <p className="hint">{status}</p>}
    </section>
  );
}
