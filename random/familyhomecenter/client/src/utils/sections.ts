/** The parts of the app a parent can turn off per kid (server/src/routes/access.ts). Home and
 *  Settings are always on (Settings is parent-only anyway). Movies and Documents live on the Photos
 *  page but have their own switches, so a kid can browse photos without making movies. */
export interface AppSection {
  key: string;
  label: string;
  /** Nav tab path; none for the Photos sub-sections. */
  path?: string;
}

export const SECTIONS: AppSection[] = [
  { key: 'calendar', label: 'Calendar', path: '/calendar' },
  { key: 'tasks', label: 'Chores & Tasks', path: '/tasks' },
  { key: 'meals', label: 'Meals', path: '/meals' },
  { key: 'contacts', label: 'Contacts', path: '/contacts' },
  { key: 'knowledge-base', label: 'Knowledge Base', path: '/knowledge-base' },
  { key: 'prizes', label: 'Prize Bank', path: '/prizes' },
  { key: 'board', label: 'Family Board', path: '/board' },
  { key: 'music', label: 'Music', path: '/music' },
  { key: 'photos', label: 'Photos', path: '/photos' },
  { key: 'movies', label: 'Movies (making/editing)' },
  { key: 'documents', label: 'Documents (making/editing)' },
  { key: 'intercom', label: 'Intercom', path: '/intercom' },
  { key: 'internet', label: 'Internet', path: '/internet' },
];
