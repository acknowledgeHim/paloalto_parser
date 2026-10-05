import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ProfileSwitcher } from './ProfileSwitcher.js';
import { api } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { useSectionAccess } from '../state/SectionAccess.js';
import { SECTIONS } from '../utils/sections.js';

/** Kids' pending requests for more time / a website, shown on the Internet tab for parents (or for
 *  everyone, before any parent is set up). Checked once a minute. */
function usePendingInternetRequests(): number {
  const { members, activeProfile } = useFamilyMembers();
  const forParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!forParent) {
      setCount(0);
      return;
    }
    const load = () => api.get<number>('/internet/requests/pending-count').then(setCount).catch(() => setCount(0));
    load();
    const t = setInterval(load, 60_000);
    // The Internet page announces when a request is answered, so the badge doesn't lag a minute.
    window.addEventListener('internet-requests-changed', load);
    return () => {
      clearInterval(t);
      window.removeEventListener('internet-requests-changed', load);
    };
  }, [forParent]);
  return count;
}

export function NavBar() {
  const pendingRequests = usePendingInternetRequests();
  // Tabs a parent has turned off for whoever's picked are hidden (Settings → Kids' access).
  const { canSee } = useSectionAccess();
  return (
    <nav className="navbar">
      <div className="navbar__links">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>Home</NavLink>
        {SECTIONS.filter((sec) => sec.path && canSee(sec.key)).map((sec) => (
          <NavLink key={sec.key} to={sec.path!} className={({ isActive }) => (isActive ? 'active' : '')}>
            {sec.label}
            {sec.key === 'internet' && pendingRequests > 0 && <span className="navbar__badge">{pendingRequests}</span>}
          </NavLink>
        ))}
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>Settings</NavLink>
      </div>
      <ProfileSwitcher />
    </nav>
  );
}
