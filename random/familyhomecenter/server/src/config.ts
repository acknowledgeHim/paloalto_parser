import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '0.0.0.0',
  dataDir: path.join(__dirname, '..', 'data'),
  dbPath: path.join(__dirname, '..', 'data', 'familyhomecenter.db'),
  thumbsDir: path.join(__dirname, '..', 'data', 'thumbs'),
  avatarsDir: path.join(__dirname, '..', 'data', 'avatars'),
  soundsDir: path.join(__dirname, '..', 'data', 'sounds'),
  kbMediaDir: path.join(__dirname, '..', 'data', 'kb-media'),
  moviesDir: path.join(__dirname, '..', 'data', 'movies'),
  clientDistDir: path.join(__dirname, '..', '..', 'client', 'dist'),

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3000/api/calendar/google/callback',
  },

  apple: {
    appleId: process.env.APPLE_ID ?? '',
    appSpecificPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD ?? '',
  },

  weather: {
    lat: Number(process.env.WEATHER_LAT ?? 37.4419),
    lon: Number(process.env.WEATHER_LON ?? -122.143),
    locationName: process.env.WEATHER_LOCATION_NAME ?? 'Home',
  },

  photosDir: process.env.PHOTOS_DIR ?? path.join(__dirname, '..', '..', 'sample-photos'),

  music: {
    libraryDir: process.env.MUSIC_LIBRARY_DIR ?? path.join(__dirname, '..', '..', 'sample-music'),
    zoneCount: Number(process.env.MUSIC_ZONE_COUNT ?? 4),
    // Each zone N runs its own MPD instance on 127.0.0.1:mpdBasePort+N (see docs/MUSIC_SETUP.md).
    mpdHost: process.env.MPD_HOST ?? '127.0.0.1',
    mpdBasePort: Number(process.env.MPD_BASE_PORT ?? 6600),
    // Shared secret the librespot --onevent hook script must send so randoms on the LAN can't spoof "now playing".
    internalApiToken: process.env.INTERNAL_API_TOKEN ?? '',
  },

  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID ?? '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? '',
    redirectUri: process.env.SPOTIFY_REDIRECT_URI ?? 'http://localhost:3000/api/music/spotify/callback',
  },

  intercom: {
    // ALSA device name prefix for each zone's output, as set up in docs/MUSIC_SETUP.md (zone1..zoneN).
    alsaDevicePrefix: process.env.INTERCOM_ALSA_PREFIX ?? 'zone',
    duckVolumePercent: Number(process.env.INTERCOM_DUCK_VOLUME ?? 20),
  },

  admin: {
    // Gates the Settings page + configuration-changing endpoints (family member roster, calendar/
    // Spotify connect, timing settings). Left unset, Settings stays open like everything else —
    // see docs/SETTINGS_LOGIN.md.
    password: process.env.ADMIN_PASSWORD ?? '',
  },

  smtp: {
    // Any SMTP account works, e.g. a Gmail account with an App Password. See docs/GROCERY_EMAIL_SETUP.md.
    // Leave SMTP_HOST blank to disable the nightly grocery-list digest entirely.
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? '',
  },

  movies: {
    // Path/command to invoke ffmpeg with — a system binary this app never installs itself, see
    // docs/MOVIES_SETUP.md. Left at the bare command name, resolved via PATH, unless overridden.
    ffmpegPath: process.env.FFMPEG_PATH ?? 'ffmpeg',
  },

  twilio: {
    // Real click-to-call from a desktop/kiosk browser (paid Twilio account) — see
    // docs/TWILIO_CALLING_SETUP.md. Leave TWILIO_ACCOUNT_SID blank to disable the feature entirely;
    // everything else in Contacts (tel:/sms: links, email-to-SMS) works regardless.
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    apiKeySid: process.env.TWILIO_API_KEY_SID ?? '',
    apiKeySecret: process.env.TWILIO_API_KEY_SECRET ?? '',
    twimlAppSid: process.env.TWILIO_TWIML_APP_SID ?? '',
    // The Twilio phone number (E.164, e.g. +15551234567) calls are placed from.
    callerNumber: process.env.TWILIO_CALLER_NUMBER ?? '',
  },
};
