#!/usr/bin/env node
// Clears a family member's password directly in the database — the escape hatch for when the
// only parent (or everyone) forgets their password and there's no ADMIN_PASSWORD recovery
// password configured in .env (or that's forgotten too). Needs shell access to the machine
// running the server, same trust level as editing .env or the database file directly.
//
// Run with `npm run reset-password -- <name or id>` from server/, or straight:
//   node scripts/reset-password.js <name or id>
//   node scripts/reset-password.js            (lists everyone and whether they have a password)
//
// After running, that person has NO password — open the app, tap their name in the profile
// switcher (no password needed now), then the 🔑 icon next to their name to set a new one.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'familyhomecenter.db');
const query = process.argv.slice(2).join(' ').trim();

function listMembers(db) {
  const members = db
    .prepare('SELECT id, name, is_parent, password_hash FROM family_members ORDER BY sort_order ASC, created_at ASC')
    .all();
  console.log('Family members:');
  for (const m of members) {
    console.log(
      `  ${m.name}${m.is_parent ? ' (parent)' : ''} — id ${m.id} — ${m.password_hash ? 'has a password' : 'no password set'}`
    );
  }
}

function main() {
  if (!fs.existsSync(dbPath)) {
    console.error(`No database found at ${dbPath}.`);
    process.exit(1);
  }
  const db = new Database(dbPath);

  if (!query) {
    listMembers(db);
    console.log('\nUsage: node scripts/reset-password.js <name or id>');
    db.close();
    return;
  }

  const matches = db
    .prepare('SELECT id, name, is_parent, password_hash FROM family_members WHERE id = ? OR name = ? COLLATE NOCASE')
    .all(query, query);

  if (matches.length === 0) {
    console.error(`No family member matches "${query}".\n`);
    listMembers(db);
    db.close();
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(`"${query}" matches more than one family member — use the id instead:\n`);
    for (const m of matches) console.error(`  ${m.name} — id ${m.id}`);
    db.close();
    process.exit(1);
  }

  const member = matches[0];
  if (!member.password_hash) {
    console.log(`${member.name} doesn't have a password set — nothing to clear.`);
    db.close();
    return;
  }

  db.prepare('UPDATE family_members SET password_hash = NULL WHERE id = ?').run(member.id);
  // Drop any live sessions logged in as this person so a stale cookie can't linger past the reset.
  db.prepare('DELETE FROM admin_sessions WHERE family_member_id = ?').run(member.id);
  db.close();

  console.log(`Cleared ${member.name}'s password.`);
  console.log(`Open the app, tap "${member.name}" in the profile switcher (no password needed now),`);
  console.log(`then the 🔑 icon next to their name to set a new one.`);
}

main();
