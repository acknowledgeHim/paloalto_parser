import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ProfileSwitcher } from './ProfileSwitcher.js';
import { api } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { useSectionAccess } from '../state/SectionAccess.js';
import { useOpenMealPolls } from '../pages/MealsPage.js';

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

interface NavItem {
  /** The section a parent can turn off for a kid (utils/sections.ts); none = always there. */
  section?: string;
  label: string;
  path: string;
  badge?: number;
  /** Parents only. */
  parent?: boolean;
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * The menu, grouped so it fits on one line: each group opens a small dropdown (a group with just
 * one thing left in it — after Kids' access — is a plain link). On a phone ☰ shows everything.
 */
function navGroups(pendingRequests: number, pendingApprovals: number, openVotes: number): NavGroup[] {
  return [
    {
      label: '🏡 Family',
      items: [
        { section: 'board', label: '👥 Family Board', path: '/board' },
        { section: 'calendar', label: '📅 Calendar', path: '/calendar' },
        { section: 'board', label: '📝 Notes', path: '/notes' },
        { section: 'board', label: '📔 Journal & gratitude', path: '/journal' },
        { section: 'board', label: '📏 Height chart', path: '/heights' },
        { section: 'contacts', label: '📇 Contacts', path: '/contacts' },
        { section: 'intercom', label: '📞 Intercom', path: '/intercom' },
      ],
    },
    {
      label: '🧹 Chores',
      items: [
        { section: 'tasks', label: '🧹 Chores & Tasks', path: '/tasks' },
        { section: 'prizes', label: '🎁 Prize Bank', path: '/prizes' },
        { section: 'prizes', label: '👕 Dress up', path: '/dress-up' },
        { label: '✅ To approve', path: '/approvals', badge: pendingApprovals, parent: true },
      ],
    },
    { label: '🍽️ Meals', items: [{ section: 'meals', label: '🍽️ Meals', path: '/meals', badge: openVotes }] },
    {
      label: '🎵 Fun',
      items: [
        { section: 'photos', label: '📷 Photos', path: '/photos' },
        { section: 'music', label: '🎵 Music', path: '/music' },
        { section: 'board', label: '🎞️ This week', path: '/recap' },
      ],
    },
    {
      label: '🛠️ More',
      items: [
        { section: 'knowledge-base', label: '📚 Knowledge Base', path: '/knowledge-base' },
        { section: 'internet', label: '🌐 Internet', path: '/internet', badge: pendingRequests },
        { label: '⚙️ Settings', path: '/settings' },
      ],
    },
  ];
}

export function NavBar() {
  const pendingRequests = usePendingInternetRequests();
  const pendingApprovals = usePendingApprovals();
  const openVotes = useOpenMealPolls();
  const { members, activeProfile } = useFamilyMembers();
  const isParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  // Tabs a parent has turned off for whoever's picked are hidden (Settings → Kids' access).
  const { canSee } = useSectionAccess();
  // On a phone the links fold into ☰ — one slim row with the page you're on.
  const [open, setOpen] = useState(false);
  // Which group's dropdown is open (on a big screen).
  const [dropped, setDropped] = useState<string | null>(null);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
    setDropped(null);
  }, [location.pathname]);
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!dropped) return;
    const away = (e: PointerEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setDropped(null);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setDropped(null);
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [dropped]);
  const groups = navGroups(pendingRequests, pendingApprovals, openVotes)
    .map((g) => ({ ...g, items: g.items.filter((i) => (!i.section || canSee(i.section)) && (!i.parent || isParent)) }))
    .filter((g) => g.items.length > 0);
  const isHere = (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`);
  const hereItem = groups.flatMap((g) => g.items).find((i) => isHere(i.path));
  const here = location.pathname === '/' ? 'Home' : hereItem?.label ?? (location.pathname.startsWith('/person') ? '👥 Family Board' : '');
  const totalBadge = pendingRequests + pendingApprovals + openVotes;
  const badge = (n?: number) => (n ? <span className="navbar__badge">{n}</span> : null);
  return (
    <nav ref={navRef} className={`navbar ${open ? 'navbar--open' : ''}`}>
      <button
        type="button"
        className="navbar__toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? 'Close the menu' : 'Open the menu'}
      >
        <span aria-hidden="true">{open ? '✕' : '☰'}</span>
        <span className="navbar__here">{here}</span>
        {!open && badge(totalBadge)}
      </button>
      <div className="navbar__links">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>🏠 Home</NavLink>
        {groups.map((g) => {
          if (g.items.length === 1) {
            const i = g.items[0];
            return (
              <NavLink key={g.label} to={i.path} className={({ isActive }) => (isActive ? 'active' : '')}>
                {i.label}
                {badge(i.badge)}
              </NavLink>
            );
          }
          const active = g.items.some((i) => isHere(i.path));
          const sum = g.items.reduce((n, i) => n + (i.badge ?? 0), 0);
          return (
            <div key={g.label} className={`navbar__group ${dropped === g.label ? 'navbar__group--open' : ''}`}>
              <button
                type="button"
                className={`navbar__group-btn ${active ? 'active' : ''}`}
                aria-expanded={dropped === g.label}
                onClick={() => setDropped(dropped === g.label ? null : g.label)}
              >
                {g.label}
                {badge(sum)}
                <span className="navbar__caret" aria-hidden="true">▾</span>
              </button>
              <div className="navbar__menu" role="menu">
                {g.items.map((i) => (
                  <NavLink key={i.path} to={i.path} role="menuitem" className={() => (isHere(i.path) ? 'active' : '')}>
                    {i.label}
                    {badge(i.badge)}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <ProfileSwitcher />
    </nav>
  );
}
