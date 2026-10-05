import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ProfileSwitcher } from './ProfileSwitcher.js';
import { api } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';

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
  return (
    <nav className="navbar">
      <div className="navbar__links">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>Home</NavLink>
        <NavLink to="/calendar" className={({ isActive }) => (isActive ? 'active' : '')}>Calendar</NavLink>
        <NavLink to="/tasks" className={({ isActive }) => (isActive ? 'active' : '')}>Chores &amp; Tasks</NavLink>
        <NavLink to="/meals" className={({ isActive }) => (isActive ? 'active' : '')}>Meals</NavLink>
        <NavLink to="/contacts" className={({ isActive }) => (isActive ? 'active' : '')}>Contacts</NavLink>
        <NavLink to="/knowledge-base" className={({ isActive }) => (isActive ? 'active' : '')}>Knowledge Base</NavLink>
        <NavLink to="/prizes" className={({ isActive }) => (isActive ? 'active' : '')}>Prize Bank</NavLink>
        <NavLink to="/board" className={({ isActive }) => (isActive ? 'active' : '')}>Family Board</NavLink>
        <NavLink to="/music" className={({ isActive }) => (isActive ? 'active' : '')}>Music</NavLink>
        <NavLink to="/photos" className={({ isActive }) => (isActive ? 'active' : '')}>Photos</NavLink>
        <NavLink to="/intercom" className={({ isActive }) => (isActive ? 'active' : '')}>Intercom</NavLink>
        <NavLink to="/internet" className={({ isActive }) => (isActive ? 'active' : '')}>
          Internet{pendingRequests > 0 && <span className="navbar__badge">{pendingRequests}</span>}
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>Settings</NavLink>
      </div>
      <ProfileSwitcher />
    </nav>
  );
}
