import { useState } from 'react';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';

/** Lets whoever is standing at the screen say "I'm Jamie" without any password — a home kiosk, not a bank. */
export function ProfileSwitcher() {
  const { members, activeProfile, setActiveProfile } = useFamilyMembers();
  const [open, setOpen] = useState(false);

  return (
    <div className="profile-switcher">
      <button className="profile-switcher__current" onClick={() => setOpen((o) => !o)}>
        <span className="avatar-dot" style={{ background: activeProfile?.color ?? '#999' }} />
        {activeProfile ? activeProfile.name : "Who's this?"}
      </button>
      {open && (
        <div className="profile-switcher__menu">
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setActiveProfile(m);
                setOpen(false);
              }}
            >
              <span className="avatar-dot" style={{ background: m.color }} />
              {m.name}
            </button>
          ))}
          <button
            className="profile-switcher__clear"
            onClick={() => {
              setActiveProfile(null);
              setOpen(false);
            }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
