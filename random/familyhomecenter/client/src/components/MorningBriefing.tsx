import { useEffect, useState } from 'react';
import { api, type CalendarEvent, type Meal, type MealPoll, type StickyNote, type Task, type WeatherData } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { isTaskDoneFor, sortForColumn } from '../utils/tasks.js';
import { taskIcon } from '../utils/taskIcons.js';
import { localDate } from '../utils/daylight.js';
import { DressedAvatar } from './DressedAvatar.js';
import { NoteCard } from './StickyNotes.js';

export const OPEN_BRIEFING = 'open-morning-briefing';
const SHOWN_KEY = 'familyhomecenter.briefing.shown';

/** Should the wall screen show the ☀️ morning briefing now? Once a morning, in the hours set. */
export function briefingDue(settings: Record<string, string>): boolean {
  if (settings.morning_briefing !== '1') return false;
  const h = new Date().getHours();
  const start = Number(settings.morning_briefing_start || 5);
  const end = Number(settings.morning_briefing_end || 10);
  if (h < start || h >= end) return false;
  try {
    return localStorage.getItem(SHOWN_KEY) !== localDate();
  } catch {
    return true;
  }
}
export function markBriefingShown() {
  try {
    localStorage.setItem(SHOWN_KEY, localDate());
  } catch {
    /* fine */
  }
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? '☀️ Good morning!' : h < 17 ? '🌤️ Good afternoon!' : '🌙 Good evening!';
};

const WEATHER_ICON = (code?: number) =>
  code == null ? '🌤️' : code === 0 ? '☀️' : code <= 2 ? '🌤️' : code === 3 ? '☁️' : code <= 48 ? '🌫️' : code <= 67 ? '🌧️' : code <= 77 ? '❄️' : code <= 82 ? '🌦️' : code <= 86 ? '🌨️' : '⛈️';

/**
 * ☀️ Good morning! A full-screen start to the day on the wall screen: today's weather (and whether
 * to grab an umbrella or a jacket), everyone's first few jobs, what's on the calendar, today's
 * meals (and any dinner vote), and the notes up. 🔊 reads it out loud. Turned on in Settings.
 */
export function MorningBriefing({ onClose }: { onClose: () => void }) {
  const { members } = useFamilyMembers();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [polls, setPolls] = useState<MealPoll[]>([]);
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const today = localDate();

  useEffect(() => {
    api.get<WeatherData | null>('/weather').then((w) => setWeather(w || null)).catch(() => {});
    api.get<Task[]>('/tasks').then(setTasks).catch(() => {});
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 86400_000);
    api.get<CalendarEvent[]>(`/calendar/events?start=${start.toISOString()}&end=${end.toISOString()}`).then(setEvents).catch(() => {});
    api.get<Meal[]>(`/meals?start=${today}&end=${today}`).then(setMeals).catch(() => {});
    api.get<MealPoll[]>('/meal-polls').then((p) => setPolls(p.filter((x) => !x.closed_at))).catch(() => {});
    api.get<StickyNote[]>('/notes').then((n) => setNotes(n.slice(0, 3))).catch(() => {});
    return () => window.speechSynthesis?.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const day = weather?.daily?.find((d) => d.date === today) ?? weather?.daily?.[0];
  const tips = [
    ...(day?.precipChance != null && day.precipChance >= 50 ? ['☔ Grab an umbrella'] : []),
    ...(day && day.low < 45 ? ['🧥 Wear a warm jacket'] : day && day.low < 58 ? ['🧥 Bring a jacket'] : []),
    ...(day && day.high >= 85 ? ['🧴 Sunscreen and water'] : []),
  ];
  const people = members.map((m) => {
    const mine = sortForColumn(
      tasks.filter((t) => t.assignee_ids.includes(m.id)),
      m.id
    );
    const left = mine.filter((t) => !isTaskDoneFor(t, m.id));
    return { member: m, left, first: left.slice(0, 3) };
  });
  const slotMeal = (slot: string) => meals.filter((m) => m.slot === slot).map((m) => m.title).join(', ');
  const timeOf = (e: CalendarEvent) =>
    e.all_day ? 'All day' : new Date(e.start_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  const speak = () => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const parts = [
      `${greeting().replace(/^\S+\s/, '')} It's ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}.`,
      day ? `Today will be ${day.description.toLowerCase()}, with a high of ${Math.round(day.high)} and a low of ${Math.round(day.low)}.` : '',
      ...tips.map((t) => t.replace(/^\S+\s/, '') + '.'),
      ...people
        .filter((p) => p.first.length)
        .map((p) => `${p.member.name}, first up: ${p.first.map((t) => t.title).join(', then ')}.`),
      events.length ? `On the calendar: ${events.map((e) => `${e.title}${e.all_day ? '' : ` at ${timeOf(e)}`}`).join(', ')}.` : '',
      slotMeal('dinner') ? `For dinner: ${slotMeal('dinner')}.` : polls.length ? `Don't forget to vote for dinner!` : '',
      'Have a great day!',
    ].filter(Boolean);
    const u = new SpeechSynthesisUtterance(parts.join(' '));
    u.rate = 0.95;
    u.onend = () => setSpeaking(false);
    synth.cancel();
    synth.speak(u);
    setSpeaking(true);
  };

  return (
    <div className="briefing" role="dialog" aria-label="Morning briefing">
      <header className="briefing__head">
        <div>
          <div className="briefing__hello">{greeting()}</div>
          <div className="briefing__date">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        </div>
        {day && (
          <div className="briefing__weather">
            <span className="briefing__wicon">{WEATHER_ICON(day.code)}</span>
            <div>
              <div className="briefing__temps">
                {Math.round(day.high)}° <span>/ {Math.round(day.low)}°</span>
              </div>
              <div>
                {day.description}
                {day.precipChance != null && day.precipChance > 0 ? ` · ${day.precipChance}% rain` : ''}
              </div>
            </div>
          </div>
        )}
      </header>
      {tips.length > 0 && (
        <div className="briefing__tips">
          {tips.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      )}
      <div className="briefing__grid">
        <section className="briefing__card briefing__people">
          <h2>🧹 First up</h2>
          {people.map(({ member, left, first }) => (
            <div key={member.id} className="briefing__person">
              <DressedAvatar member={member} size={44} />
              <div>
                <strong>{member.name}</strong>
                {first.length === 0 ? (
                  <div className="briefing__muted">Nothing to do — enjoy! 🎉</div>
                ) : (
                  <div className="briefing__jobs">
                    {first.map((t) => (
                      <span key={t.id}>
                        {taskIcon(t)} {t.title}
                      </span>
                    ))}
                    {left.length > first.length && <span className="briefing__muted">+{left.length - first.length} more</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>
        <div className="briefing__side">
          <section className="briefing__card">
            <h2>📅 Today</h2>
            {events.length === 0 && <div className="briefing__muted">Nothing on the calendar</div>}
            {events.map((e) => (
              <div key={e.id} className="briefing__event">
                <span className="briefing__time">{timeOf(e)}</span> {e.title}
              </div>
            ))}
          </section>
          <section className="briefing__card">
            <h2>🍽️ Meals</h2>
            {['breakfast', 'lunch', 'dinner'].map((s) =>
              slotMeal(s) ? (
                <div key={s}>
                  {s === 'breakfast' ? '🌅' : s === 'lunch' ? '☀️' : '🌙'} {slotMeal(s)}
                </div>
              ) : null
            )}
            {!meals.length && !polls.length && <div className="briefing__muted">Nothing planned yet</div>}
            {polls.length > 0 && (
              <a className="briefing__vote" href="#/meals?vote" onClick={onClose}>
                🗳️ Vote: {polls[0].question || `what's for ${polls[0].slot}?`}
              </a>
            )}
          </section>
          {notes.length > 0 && (
            <section className="briefing__notes">
              {notes.map((n, i) => (
                <NoteCard key={n.id} note={n} i={i} />
              ))}
            </section>
          )}
        </div>
      </div>
      <footer className="briefing__foot">
        {'speechSynthesis' in window && (
          <button type="button" className="secondary" onClick={speak}>
            {speaking ? '⏹ Stop' : '🔊 Read it to me'}
          </button>
        )}
        <button type="button" onClick={onClose}>
          Let's go! →
        </button>
      </footer>
    </div>
  );
}
