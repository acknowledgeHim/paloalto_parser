import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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

/** How many kids' check-offs / prize claims are waiting for a parent's OK — for parents only. */
function usePendingApprovals(): number {
  const { members, activeProfile } = useFamilyMembers();
  const forParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!forParent) {
      setCount(0);
      return;
    }
    const load = () => api.get<number>('/approvals/count').then(setCount).catch(() => setCount(0));
    load();
    const t = setInterval(load, 30_000);
    window.addEventListener('approvals-changed', load);
    return () => {
      clearInterval(t);
      window.removeEventListener('approvals-changed', load);
    };
  }, [forParent]);
  return count;
}

export function NavBar() {
  const pendingRequests = usePendingInternetRequests();
  const pendingApprovals = usePendingApprovals();
  const { members, activeProfile } = useFamilyMembers();
  const isParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  // Tabs a parent has turned off for whoever's picked are hidden (Settings → Kids' access).
  const { canSee } = useSectionAccess();
  // On a phone the links fold into ☰ — one slim row with the page you're on.
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  const sections = SECTIONS.filter((sec) => sec.path && canSee(sec.key));
  const here =
    location.pathname === '/' ? 'Home' : location.pathname.startsWith('/settings') ? 'Settings' : location.pathname.startsWith('/approvals') ? '✅ To approve' : sections.find((sec) => location.pathname.startsWith(sec.path!))?.label ?? '';
  return (
    <nav className={`navbar ${open ? 'navbar--open' : ''}`}>
      <button
        type="button"
        className="navbar__toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? 'Close the menu' : 'Open the menu'}
      >
        <span aria-hidden="true">{open ? '✕' : '☰'}</span>
        <span className="navbar__here">{here}</span>
        {!open && pendingRequests + pendingApprovals > 0 && <span className="navbar__badge">{pendingRequests + pendingApprovals}</span>}
      </button>
      <div className="navbar__links">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>Home</NavLink>
        {sections.map((sec) => (
          <NavLink key={sec.key} to={sec.path!} className={({ isActive }) => (isActive ? 'active' : '')}>
            {sec.label}
            {sec.key === 'internet' && pendingRequests > 0 && <span className="navbar__badge">{pendingRequests}</span>}
          </NavLink>
        ))}
        {isParent && (
          <NavLink to="/approvals" className={({ isActive }) => (isActive ? 'active' : '')}>
            ✅ To approve
            {pendingApprovals > 0 && <span className="navbar__badge">{pendingApprovals}</span>}
          </NavLink>
        )}
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>Settings</NavLink>
      </div>
      <ProfileSwitcher />
    </nav>
  );
}
