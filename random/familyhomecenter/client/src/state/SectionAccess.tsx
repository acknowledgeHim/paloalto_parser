import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../api/client.js';
import { useFamilyMembers } from './FamilyMemberContext.js';

/** Changed in Settings → tell the rest of the app to re-check right away. */
export const SECTION_ACCESS_CHANGED = 'section-access-changed';

interface SectionAccessValue {
  /** Whether whoever's picked in the profile switcher may use this section right now. */
  canSee: (section: string) => boolean;
  /** { member id | 'guest': allowed section keys } — missing = everything. */
  access: Record<string, string[]>;
}

const Ctx = createContext<SectionAccessValue>({ canSee: () => true, access: {} });

/**
 * Applies the sections a parent has turned off for a kid (Settings → Kids' access;
 * server/src/routes/access.ts): parents see everything; a picked kid sees their allowed list; with
 * nobody picked, the "guest" list applies (so un-picking yourself doesn't get around it). Until
 * the first answer arrives everything shows, rather than flashing locks at a parent.
 */
export function SectionAccessProvider({ children }: { children: ReactNode }) {
  const { activeProfile } = useFamilyMembers();
  const [access, setAccess] = useState<Record<string, string[]> | null>(null);
  // A verified parent login (or the household recovery login) sees everything even with nobody
  // picked in the switcher — limits are for kids, never for a logged-in parent.
  const [parentLoggedIn, setParentLoggedIn] = useState(false);

  useEffect(() => {
    const load = () => {
      api
        .get<{ access: Record<string, string[]> }>('/access')
        .then((r) => setAccess(r.access))
        .catch(() => {});
      api
        .get<{ is_admin: boolean }>('/auth/status')
        .then((r) => setParentLoggedIn(r.is_admin))
        .catch(() => setParentLoggedIn(false));
    };
    load();
    const t = setInterval(load, 60_000);
    window.addEventListener(SECTION_ACCESS_CHANGED, load);
    return () => {
      clearInterval(t);
      window.removeEventListener(SECTION_ACCESS_CHANGED, load);
    };
  }, [activeProfile?.id]);

  const canSee = (section: string) => {
    if (!access) return true;
    if (activeProfile?.is_parent === 1 || parentLoggedIn) return true;
    const allowed = access[activeProfile ? activeProfile.id : 'guest'];
    return !allowed || allowed.includes(section);
  };

  return <Ctx.Provider value={{ canSee, access: access ?? {} }}>{children}</Ctx.Provider>;
}

export function useSectionAccess(): SectionAccessValue {
  return useContext(Ctx);
}

/** Wraps a page: shows it, or a friendly lock if this section is turned off for whoever's picked. */
export function SectionGate({ section, children }: { section: string; children: ReactNode }) {
  const { canSee } = useSectionAccess();
  const { activeProfile } = useFamilyMembers();
  if (canSee(section)) return <>{children}</>;
  return (
    <div className="section-locked panel">
      <div className="section-locked__icon">🔒</div>
      <h2>This part is turned off{activeProfile ? ` for ${activeProfile.name}` : ''} right now</h2>
      <p className="hint">Ask a parent if you'd like it turned back on.</p>
    </div>
  );
}
