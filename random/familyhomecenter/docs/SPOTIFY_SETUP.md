# Spotify setup

There are two independent, stackable levels of Spotify support here. Most families only need the
first one.

## Level 1: Cast from your own phone (no setup, free accounts work)

Once librespot is running for each zone (see `docs/MUSIC_SETUP.md`), every zone appears as a normal
**Spotify Connect** device — the same mechanism Sonos, smart speakers, etc. use. Any family member:

1. Opens Spotify on their own phone (already logged into their own account).
2. Plays something, taps the **devices/speaker icon**.
3. Picks the zone (e.g. "Family Hub Zone 2 — Kitchen").

Audio streams directly from Spotify's servers to that zone — nothing touches our server or database.
This works with free Spotify accounts (Spotify Connect casting doesn't require Premium), though free
accounts get Spotify's normal shuffle-only/ad restrictions.

## Level 2: In-dashboard playback control (optional, needs Premium)

This lets the **Music** page itself show what's playing and offer play/pause/skip/volume/transfer
controls, via Spotify's Web API. Spotify's playback-control endpoints only work for **Premium**
accounts — Connect casting (Level 1) has no such restriction, only this extra layer does.

### 1. Register an app in the Spotify Developer Dashboard

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) and log in with
   the Spotify account you want the dashboard to control.
2. **Create app**. Any name/description is fine.
3. Add a **Redirect URI**: `http://<pi-hostname-or-ip>:3000/api/music/spotify/callback` (must exactly
   match `SPOTIFY_REDIRECT_URI` below).
4. Under **Settings**, copy the **Client ID** and **Client secret**.

### 2. Configure the app

In `.env`:

```
SPOTIFY_CLIENT_ID=your-client-id
SPOTIFY_CLIENT_SECRET=your-client-secret
SPOTIFY_REDIRECT_URI=http://<pi-hostname-or-ip>:3000/api/music/spotify/callback
```

Restart the server.

### 3. Connect

**Music** page → **Spotify** section → **Connect**. Approve access on Spotify's consent screen. The
dashboard can now show current playback and control it — including "transfer playback" to move
what's already playing on your phone onto a zone.

Tokens live in the local SQLite database on the Pi, same as the Google Calendar integration.
