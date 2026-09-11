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
};
