import { useEffect, useState } from 'react';
import { WhosHome } from './WhosHome.js';
import { NoteCard, useStickyNotes } from './StickyNotes.js';

/** On the screensaver: who's home along the bottom, and the sticky notes, a few at a time. */
export function ScreensaverExtras() {
  const [notes] = useStickyNotes(30_000);
  const [page, setPage] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPage((p) => p + 1), 12_000);
    return () => clearInterval(t);
  }, []);
  const per = 3;
  const pages = Math.max(1, Math.ceil(notes.length / per));
  const shown = notes.slice((page % pages) * per, (page % pages) * per + per);
  return (
    <>
      {shown.length > 0 && (
        <div className="screensaver-notes" key={page % pages}>
          {shown.map((n, i) => (
            <NoteCard key={n.id} note={n} i={i + 1} />
          ))}
        </div>
      )}
      <div className="screensaver-whos">
        <WhosHome readOnly />
      </div>
    </>
  );
}
