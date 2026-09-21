import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type FamilyMember } from '../api/client.js';

interface FamilyMemberContextValue {
  members: FamilyMember[];
  activeProfile: FamilyMember | null;
  setActiveProfile: (m: FamilyMember | null) => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<FamilyMemberContextValue | null>(null);

const ACTIVE_PROFILE_KEY = 'familyhomecenter.activeProfileId';

export function FamilyMemberProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [activeProfile, setActiveProfileState] = useState<FamilyMember | null>(null);

  const refresh = async () => {
    const data = await api.get<FamilyMember[]>('/family-members');
    setMembers(data);
    const savedId = localStorage.getItem(ACTIVE_PROFILE_KEY);
    const match = savedId ? data.find((m) => m.id === savedId) : undefined;
    if (!match) return;

    if (!match.has_password) {
      setActiveProfileState(match);
      return;
    }
    // Password-protected: only restore if the browser still holds a valid server session for
    // exactly this person — otherwise a locally-remembered pick could silently "log in" as them
    // (e.g. after their session cookie expired, or on a browser that never actually verified them).
    try {
      const status = await api.get<{ member_id: string | null }>('/auth/status');
      if (status.member_id === match.id) {
        setActiveProfileState(match);
      } else {
        localStorage.removeItem(ACTIVE_PROFILE_KEY);
      }
    } catch {
      localStorage.removeItem(ACTIVE_PROFILE_KEY);
    }
  };

  useEffect(() => {
    refresh().catch(console.error);
  }, []);

  const setActiveProfile = (m: FamilyMember | null) => {
    setActiveProfileState(m);
    if (m) localStorage.setItem(ACTIVE_PROFILE_KEY, m.id);
    else localStorage.removeItem(ACTIVE_PROFILE_KEY);
  };

  return (
    <Ctx.Provider value={{ members, activeProfile, setActiveProfile, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useFamilyMembers(): FamilyMemberContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFamilyMembers must be used within FamilyMemberProvider');
  return ctx;
}
