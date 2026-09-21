# Backing up your data

Everything the dashboard manages — family members, chores/to-dos, meals, recipes, Prize Bank
balances and prizes, calendar events, uploaded avatar photos and completion-sound MP3s — lives in
`server/data/`: one SQLite file plus two small folders of uploads. `scripts/backup-db.js` copies
all of it to a timestamped folder.

## Run a backup

```bash
cd server
npm run backup
```

This is safe to run **while the server is up** — it uses SQLite's online backup API, which takes a
consistent snapshot regardless of concurrent reads/writes (no need to stop the service first).

Output goes to `server/data/backups/<timestamp>/`:
- `familyhomecenter.db` — the full database, a complete standalone file
- `avatars/`, `sounds/` — uploaded photos and MP3s (only copied if you have any)

Old backups are pruned automatically, keeping the most recent 14 by default. Change that with
`node scripts/backup-db.js --keep 30` (or edit the `backup` script in `package.json` to always
pass a different number).

## Automate it (recommended)

Add a daily cron job on the Pi:

```bash
crontab -e
```

Add a line like (adjust the path to your actual clone location):

```
0 3 * * * cd /home/pi/paloalto_parser/random/familyhomecenter/server && npm run backup >> /home/pi/backup.log 2>&1
```

That runs a backup every night at 3am.

## Restoring from a backup

1. Stop the server: `sudo systemctl stop familyhomecenter`
2. Replace the live files with the backed-up ones:
   ```bash
   cd server/data
   cp backups/<timestamp>/familyhomecenter.db .
   cp -r backups/<timestamp>/avatars .   # if present
   cp -r backups/<timestamp>/sounds .    # if present
   ```
3. Start it again: `sudo systemctl start familyhomecenter`

## Getting a copy off the Pi

The `backups/` folder is just files — copy it anywhere you like for off-device safety, e.g.:

```bash
scp -r pi@familyhub.local:~/paloalto_parser/random/familyhomecenter/server/data/backups/<timestamp> ./
```

or sync the whole `backups/` folder to a NAS/cloud drive on whatever schedule you're comfortable
with.
