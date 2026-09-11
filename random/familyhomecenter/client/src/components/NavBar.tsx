import { NavLink } from 'react-router-dom';
import { ProfileSwitcher } from './ProfileSwitcher.js';

export function NavBar() {
  return (
    <nav className="navbar">
      <div className="navbar__links">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>Home</NavLink>
        <NavLink to="/calendar" className={({ isActive }) => (isActive ? 'active' : '')}>Calendar</NavLink>
        <NavLink to="/tasks" className={({ isActive }) => (isActive ? 'active' : '')}>Chores &amp; Tasks</NavLink>
        <NavLink to="/music" className={({ isActive }) => (isActive ? 'active' : '')}>Music</NavLink>
        <NavLink to="/intercom" className={({ isActive }) => (isActive ? 'active' : '')}>Intercom</NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>Settings</NavLink>
      </div>
      <ProfileSwitcher />
    </nav>
  );
}
