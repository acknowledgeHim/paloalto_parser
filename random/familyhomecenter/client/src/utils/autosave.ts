import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';

/**
 * 💾 Learning auto-save: where someone is in a round, a lesson or a typing lesson, kept on the
 * server (routes/learning.ts /drafts) so closing the tab, tapping away or another screen picks up
 * from the same spot. Kept 3 days.
 *
 * `draft` is undefined while loading, null when nothing's saved. `save(x)` stores it now;
 * `saveSoon(x)` within a second or so (for typing — and right away if the page is closed);
 * `save(null)` means done with it.
 */
export function useDraft<T>(memberId: string | undefined, key: string) {
  const [draft, setDraft] = useState<T | null | undefined>(undefined);
  const pending = useRef<{ data: T | null } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const where = memberId ? `/learning/drafts/${memberId}/${encodeURIComponent(key)}` : null;

  const put = useCallback(
    (data: T | null, keepalive = false) => {
      if (!where) return;
      const body = JSON.stringify({ data, acting_member_id: memberId });
      if (keepalive) {
        // The page is going away: this still gets sent.
        void fetch(`/api${where}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body, keepalive: body.length < 60_000 }).catch(() => {});
      } else void api.put(where, { data, acting_member_id: memberId }).catch(() => {});
    },
    [where, memberId]
  );
  const flush = useCallback(
    (keepalive = false) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      const p = pending.current;
      pending.current = null;
      if (p) put(p.data, keepalive);
    },
    [put]
  );

  useEffect(() => {
    setDraft(undefined);
    if (!where) return setDraft(null);
    let live = true;
    api
      .get<{ data: T | null }>(where)
      .then((r) => live && setDraft(r.data ?? null))
      .catch(() => live && setDraft(null));
    const away = () => flush(true);
    const hidden = () => document.visibilityState === 'hidden' && flush(true);
    window.addEventListener('pagehide', away);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      live = false;
      window.removeEventListener('pagehide', away);
      document.removeEventListener('visibilitychange', hidden);
      flush();
    };
  }, [where, flush]);

  const save = useCallback(
    (data: T | null) => {
      pending.current = null;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      setDraft(data);
      put(data);
    },
    [put]
  );
  const saveSoon = useCallback(
    (data: T | null) => {
      pending.current = { data };
      setDraft(data);
      if (!timer.current) timer.current = setTimeout(() => flush(), 1200);
    },
    [flush]
  );
  return { draft, save, saveSoon, setLocal: setDraft };
}
