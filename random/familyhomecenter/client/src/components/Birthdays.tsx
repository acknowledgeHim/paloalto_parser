import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { ThumbYear } from './ThumbYear.js';

/** 🎂 A relative's birthday (server: routes/relatives.ts GET /relatives/birthdays). */
export interface Birthday {
  id: string;
  name: string;
  relation: string | null;
  living: boolean;
  /** this is the person looking (their own profile is linked to this relative) */
  is_you: boolean;
  days: number;
  /** the age they turn (null when the year isn't known) */
  turns: number | null;
}
interface Birthdays {
  today: Birthday[];
  soon: Birthday[];
  greet: boolean;
}

/** "Grandma Jo turns 80 today!" / "Grandpa Al would have been 95 today" / "Happy birthday — you're 9!" */
export function birthdayLine(b: Birthday, when: 'today' | 'soon' = 'today'): string {
  const on = when === 'today' ? 'today' : b.days === 1 ? 'tomorrow' : `in ${b.days} days`;
  if (b.is_you && when === 'today') return b.turns ? `🎉 Happy birthday — you're ${b.turns} today!` : '🎉 Happy birthday to you!';
  if (!b.living) return b.turns ? `🕊️ ${b.name} would have been ${b.turns} ${on}` : `🕊️ ${b.name}'s birthday is ${on}`;
  return b.turns ? `🎂 ${b.name} turns ${b.turns} ${on}!` : `🎂 ${b.name}'s birthday is ${on}!`;
}

export function useBirthdays(memberId: string | undefined) {
  const [data, setData] = useState<Birthdays | null>(null);
  const load = () =>
    api
      .get<Birthdays>(`/relatives/birthdays${memberId ? `?member_id=${memberId}` : ''}`)
      .then(setData)
      .catch(() => {});
  useEffect(() => {
    void load();
    const t = setInterval(load, 30 * 60_000); // a screen left on all day picks up midnight
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);
  return { data, reload: load };
}

/** Home: today's birthdays (big) and the next few weeks'. Nothing at all when there are none. */
export function BirthdayCard() {
  const { activeProfile } = useFamilyMembers();
  const { data } = useBirthdays(activeProfile?.id);
  if (!data || (data.today.length === 0 && data.soon.length === 0)) return null;
  return (
    <section className="panel birthdays">
      <h2>🎂 Birthdays</h2>
      {data.today.map((b) => (
        <Link key={b.id} to={`/relatives/${b.id}`} className="birthdays__today">
          {birthdayLine(b)}
          {b.relation && <span className="hint"> · {b.relation}</span>}
        </Link>
      ))}
      {data.soon.slice(0, 5).map((b) => (
        <Link key={b.id} to={`/relatives/${b.id}`} className="birthdays__soon">
          {birthdayLine(b, 'soon')}
        </Link>
      ))}
    </section>
  );
}

/**
 * 🎂 The hello on someone's first visit of the day when it's a relative's birthday (or theirs).
 * The server keeps track, so it's once a day per person on whichever screen they use.
 */
export function BirthdayHello({ paused }: { paused: boolean }) {
  const { activeProfile } = useFamilyMembers();
  const { data } = useBirthdays(activeProfile?.id);
  const [closed, setClosed] = useState<string | null>(null);
  const id = activeProfile?.id;
  if (!id || paused || !data?.greet || closed === id) return null;
  const close = () => {
    setClosed(id);
    void api.post('/relatives/birthdays/seen', { member_id: id }).catch(() => {});
  };
  return (
    <div className="birthday-hello" role="dialog" aria-label="Birthdays today" onClick={close}>
      <div className="birthday-hello__card" onClick={(e) => e.stopPropagation()}>
        <div className="birthday-hello__cake">🎂</div>
        <h2>Good {new Date().getHours() < 12 ? 'morning' : 'day'}, {activeProfile!.name}!</h2>
        {data.today.map((b) => (
          <p key={b.id} className="birthday-hello__line">
            {birthdayLine(b)}
          </p>
        ))}
        <div className="birthday-hello__actions">
          {data.today.length === 1 && !data.today[0].is_you && (
            <Link className="button secondary" to={`/relatives/${data.today[0].id}`} onClick={close}>
              👪 See {data.today[0].name}
            </Link>
          )}
          <button type="button" onClick={close} autoFocus>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

interface MyPhoto {
  id: string;
  taken_at: string;
  years_ago: number;
}
interface MyPhotos {
  on: boolean;
  years: number[];
  linked: boolean;
  has_face: boolean;
  photos: MyPhoto[];
}

/**
 * 📸 Home: photos with you in them from about today, 1 / 3 / … years ago (whichever you picked on
 * your profile page). Shown even when Photos is switched off for you — they're pictures of you.
 */
export function MyPhotoMemories() {
  const { activeProfile } = useFamilyMembers();
  const [data, setData] = useState<MyPhotos | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  useEffect(() => {
    setData(null);
    if (!activeProfile) return;
    api.get<MyPhotos>(`/relatives/my-photos?member_id=${activeProfile.id}`).then(setData).catch(() => {});
  }, [activeProfile?.id]);
  if (!data?.on || data.photos.length === 0) return null;
  const ago = (n: number) => (n === 1 ? '1 year ago' : `${n} years ago`);
  const p = viewing !== null ? data.photos[viewing] : null;
  return (
    <section className="panel on-this-day">
      <h2>📸 You, around this day</h2>
      <div className="on-this-day__strip">
        {data.photos.map((ph, i) => (
          <button key={ph.id} type="button" className="on-this-day__photo" onClick={() => setViewing(i)}>
            <img src={`/api/photos/${ph.id}/image`} alt="" loading="lazy" />
            <ThumbYear photoId={ph.id} />
            <span>{ago(ph.years_ago)}</span>
          </button>
        ))}
      </div>
      {p && viewing !== null && (
        <div className="photo-lightbox" onClick={() => setViewing(null)}>
          <img src={`/api/photos/${p.id}/image`} alt="" />
          <div className="on-this-day__caption">
            {ago(p.years_ago)} · {new Date(p.taken_at).toLocaleDateString()}
          </div>
          <button className="photo-lightbox__close" onClick={() => setViewing(null)}>
            ✕
          </button>
          {data.photos.length > 1 && (
            <>
              <button
                className="photo-lightbox__nav photo-lightbox__nav--prev"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewing((viewing - 1 + data.photos.length) % data.photos.length);
                }}
              >
                ‹
              </button>
              <button
                className="photo-lightbox__nav photo-lightbox__nav--next"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewing((viewing + 1) % data.photos.length);
                }}
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

const YEAR_CHOICES = [1, 2, 3, 4, 5, 10, 15, 20, 25];

/** Profile page: turn 📸 "photos of me from years ago" on for Home, and pick which years. */
export function MyPhotoMemorySettings({ memberId, canEdit }: { memberId: string; canEdit: boolean }) {
  const { activeProfile } = useFamilyMembers();
  const [data, setData] = useState<MyPhotos | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const load = () => api.get<MyPhotos>(`/relatives/my-photos?member_id=${memberId}`).then(setData).catch(() => {});
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);
  if (!data) return null;
  const save = async (on: boolean, years: number[]) => {
    setNote(null);
    try {
      await api.put('/relatives/my-photos/settings', { member_id: memberId, on, years, acting_member_id: activeProfile?.id ?? null });
      await load();
      setNote('Saved ✓');
    } catch (e) {
      setNote((e as Error).message);
    }
  };
  const every = data.years.length === 0;
  return (
    <section className="panel">
      <h2>📸 Photos of me from years ago</h2>
      <p className="hint">
        Shows photos with you in them from around today’s date on your Home screen — 1 year ago, 3 years ago, and so on. It works even if Photos is switched off
        for you.
      </p>
      {!data.linked ? (
        <p className="hint">
          First a parent links this profile to you in <Link to="/relatives">👪 Relatives</Link> (and links your face from 👥 People there), so it knows which photos
          you’re in.
        </p>
      ) : !data.has_face ? (
        <p className="hint">
          Your <Link to="/relatives">👪 Relatives</Link> page isn’t linked to a face in 👥 People yet — only photos tagged to you there will show.
        </p>
      ) : null}
      <label className="checkbox-row">
        <input type="checkbox" checked={data.on} disabled={!canEdit} onChange={(e) => void save(e.target.checked, data.years)} /> Show them on my Home screen
      </label>
      {data.on && (
        <div className="relatives__years">
          <label className="checkbox-row">
            <input type="checkbox" checked={every} disabled={!canEdit} onChange={(e) => void save(true, e.target.checked ? [] : [1, 3, 5, 10])} /> Every year
          </label>
          {!every &&
            YEAR_CHOICES.map((y) => (
              <label key={y} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={data.years.includes(y)}
                  disabled={!canEdit}
                  onChange={(e) => void save(true, e.target.checked ? [...data.years, y] : data.years.filter((x) => x !== y))}
                />{' '}
                {y} year{y === 1 ? '' : 's'} ago
              </label>
            ))}
        </div>
      )}
      {note && <span className="hint">{note}</span>}
    </section>
  );
}
