import { useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { SECTION_ACCESS_CHANGED, useSectionAccess } from '../state/SectionAccess.js';
import { SECTIONS } from '../utils/sections.js';

/**
 * Settings → Kids' access: per kid (and for "nobody picked"), which parts of the app they can use
 * right now. Off stays off until a parent turns it back on. Parents always see everything.
 */
export function KidsAccessSettings() {
  const { members } = useFamilyMembers();
  const { access } = useSectionAccess();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  // Changes show instantly (and quick taps in a row build on each other) rather than waiting for
  // the server round trip; `null` = back to everything.
  const [local, setLocal] = useState<Record<string, string[] | null>>({});
  const localRef = useRef(local);
  localRef.current = local;
  const kids = members.filter((m) => m.is_parent !== 1);
  const rows = [...kids.map((k) => ({ id: k.id, name: k.name })), { id: 'guest', name: 'Nobody picked' }];

  const save = async (target: string, sections: string[] | null) => {
    setError(null);
    setSaving(target);
    const next = { ...localRef.current, [target]: sections };
    localRef.current = next;
    setLocal(next);
    try {
      await api.put(`/access/${target}`, { sections });
      window.dispatchEvent(new Event(SECTION_ACCESS_CHANGED));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(null);
    }
  };

  const effective = (id: string): string[] | null => (id in localRef.current ? localRef.current[id] : access[id] ?? null);
  const allowedFor = (id: string) => effective(id) ?? SECTIONS.map((s) => s.key);

  return (
    <section className="panel">
      <h2>Kids' access</h2>
      <p className="hint">
        Turn parts of the app off for a kid — e.g. no movie making for a while — and back on later.
        Turned-off tabs disappear for them (Home always stays). "Nobody picked" applies when no one's
        chosen in the switcher, so a kid can't get around it by un-picking themselves; give kids
        passwords so they can't switch to each other either. Parents always see everything.
      </p>
      {error && <div className="settings-login__error">{error}</div>}
      {kids.length === 0 && <p className="empty-state">No kids in the family list yet.</p>}
      <div className="kids-access">
        {rows.map((row) => {
          const allowed = allowedFor(row.id);
          const limited = effective(row.id) !== null && allowedFor(row.id).length < SECTIONS.length;
          return (
            <div key={row.id} className="kids-access__row">
              <div className="kids-access__head">
                <strong>{row.name}</strong>
                <span className={`badge ${limited ? 'internet-badge--off' : 'internet-badge--on'}`}>
                  {limited ? `${allowed.length} of ${SECTIONS.length} on` : 'Everything'}
                </span>
                {saving === row.id && <span className="hint">Saving…</span>}
                <span className="kids-access__quick">
                  <button type="button" className="link-button" onClick={() => save(row.id, null)} disabled={!limited}>All on</button>
                  <button type="button" className="link-button" onClick={() => save(row.id, [])}>All off</button>
                </span>
              </div>
              <div className="kids-access__sections">
                {SECTIONS.map((sec) => (
                  <label key={sec.key}>
                    <input
                      type="checkbox"
                      checked={allowed.includes(sec.key)}
                      onChange={(e) => {
                        const current = allowedFor(row.id);
                        save(row.id, e.target.checked ? [...current, sec.key] : current.filter((k) => k !== sec.key));
                      }}
                    />
                    {sec.label}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
