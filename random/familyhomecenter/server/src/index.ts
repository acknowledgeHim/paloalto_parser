import http from 'node:http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import './db.js'; // ensures schema is created on boot
import { config } from './config.js';
import { familyMembersRouter } from './routes/familyMembers.js';
import { tasksRouter } from './routes/tasks.js';
import { calendarRouter } from './routes/calendar.js';
import { weatherRouter } from './routes/weather.js';
import { photosRouter } from './routes/photos.js';
import { settingsRouter } from './routes/settings.js';
import { musicRouter } from './routes/music.js';
import { authRouter } from './routes/auth.js';
import { mealsRouter } from './routes/meals.js';
import { recipesRouter } from './routes/recipes.js';
import { prizesRouter } from './routes/prizes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { startCalendarSyncSchedule } from './services/calendar/aggregator.js';
import { startThumbnailWarmSchedule } from './services/photos.js';
import { attachIntercomWebSocket } from './services/intercom/wsServer.js';

const app = express();
app.use(cors());
// Default 100kb is too small for a family member's avatar photo or a custom completion-sound
// MP3 (both sent as base64 data URLs) — the avatar is downsized client-side first, but an
// uploaded MP3 isn't, so leave real headroom (base64 inflates ~33% over the raw file size).
app.use(express.json({ limit: '15mb' }));
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api/family-members', familyMembersRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/photos', photosRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/music', musicRouter);
app.use('/api/meals', mealsRouter);
app.use('/api/recipes', recipesRouter);
app.use('/api/prizes', prizesRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Serve the built React app (npm run build in client/) so one process/port runs everything on the Pi.
app.use(express.static(config.clientDistDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile('index.html', { root: config.clientDistDir }, (err) => {
    if (err) next(err);
  });
});

app.use(errorHandler);

const server = http.createServer(app);
attachIntercomWebSocket(server);

server.listen(config.port, config.host, () => {
  console.log(`Family Home Center server listening on http://${config.host}:${config.port}`);
  startCalendarSyncSchedule();
  startThumbnailWarmSchedule();
});
