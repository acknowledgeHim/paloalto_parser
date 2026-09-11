import express from 'express';
import cors from 'cors';
import './db.js'; // ensures schema is created on boot
import { config } from './config.js';
import { familyMembersRouter } from './routes/familyMembers.js';
import { tasksRouter } from './routes/tasks.js';
import { calendarRouter } from './routes/calendar.js';
import { weatherRouter } from './routes/weather.js';
import { photosRouter } from './routes/photos.js';
import { settingsRouter } from './routes/settings.js';
import { errorHandler } from './middleware/errorHandler.js';
import { startCalendarSyncSchedule } from './services/calendar/aggregator.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/family-members', familyMembersRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/photos', photosRouter);
app.use('/api/settings', settingsRouter);

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

app.listen(config.port, config.host, () => {
  console.log(`Family Home Center server listening on http://${config.host}:${config.port}`);
  startCalendarSyncSchedule();
});
