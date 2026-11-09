import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { GRADE_SHORT, noTokensWhy, tiersText, useLearning, type Tier } from '../utils/learning.js';
import { say, stopSpeaking } from '../utils/speech.js';

interface Word {
  word: string;
  sentence: string;
  meaning: string;
}
interface Start {
  round_id: string;
  grade: number;
  words: Word[];
  tokens: Tier[] | null;
  no_tokens_why: string | null;
}
interface Finish {
  correct: number;
  total: number;
  pct: number;
  passed: boolean;
  tokens: number;
  no_tokens_why: string | null;
  items: Array<{ right: string; given: string; ok: boolean }>;
}

const SECONDS = 90;

/**
 * 🔤 Spelling (📚 Learning): 10 random words at a grade. Each is said, used in a sentence, and said
 * again; type it within 90 seconds. 🔊 / 🗣️ / 📖 say the word, the sentence or the meaning again.
 * Tokens for your grade or higher, by the parent's "% right" levels.
 */
export function SpellingPage() {
  const { activeProfile } = useFamilyMembers();
  const { settings, person, reload } = useLearning(activeProfile?.id);
  const [grade, setGrade] = useState<number | null>(null);
  const [round, setRound] = useState<Start | null>(null);
  const [result, setResult] = useState<Finish | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (person && grade === null) setGrade(person.grade ?? 0);
  }, [person, grade]);

  const g = grade ?? 0;
  const rewards = settings?.rewards.spelling;
  const why = settings ? noTokensWhy(person, rewards, g, settings.grades) : null;

  const start = async () => {
    if (!activeProfile) return;
    setError(null);
    setResult(null);
    try {
      setRound(await api.post<Start>('/learning/spelling/start', { member_id: activeProfile.id, grade: g, acting_member_id: activeProfile.id }));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (round) {
    return (
      <SpellingRound
        round={round}
        gradeName={settings?.grades[round.grade] ?? ''}
        onDone={async (answers) => {
          try {
            const r = await api.post<Finish>(`/learning/round/${round.round_id}/finish`, { answers, acting_member_id: activeProfile?.id });
            setResult(r);
            reload();
          } catch (e) {
            setError((e as Error).message);
          }
          setRound(null);
        }}
        onQuit={() => setRound(null)}
      />
    );
  }

  const sub = person?.subjects.spelling;
  return (
    <div className="learning-page">
      <h1>🔤 Spelling</h1>
      {!activeProfile && <p className="hint">Pick who you are up top first.</p>}

      {result && (
        <section className="panel learning-result">
          <h2>
            {result.pct === 100 ? '🌟 Perfect!' : result.passed ? '🎉 Passed!' : '💪 Keep practising!'} {result.correct} / {result.total} right ({result.pct}%)
          </h2>
          {result.tokens > 0 ? <p className="learning-result__tokens">+{result.tokens} 💎 tokens</p> : result.no_tokens_why ? <p className="hint">{result.no_tokens_why}</p> : null}
          <ul className="learning-result__list">
            {result.items.map((it, i) => (
              <li key={i} className={it.ok ? 'is-ok' : 'is-wrong'}>
                {it.ok ? '✅' : '❌'} <strong>{it.right}</strong>
                {!it.ok && <span className="hint"> — you typed “{it.given || '(nothing)'}”</span>}
                <button type="button" className="link-button" onClick={() => void say(it.right).catch(() => {})} aria-label={`Say ${it.right}`}>
                  🔊
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeProfile && settings && (
        <section className="panel">
          <h2>Pick a grade</h2>
          <div className="learning-grades" role="radiogroup" aria-label="Grade">
            {settings.grades.map((name, i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={g === i}
                title={name}
                className={`learning-grade${g === i ? ' is-on' : ''}${person?.grade === i ? ' is-mine' : ''}`}
                onClick={() => setGrade(i)}
              >
                {GRADE_SHORT[i]}
              </button>
            ))}
          </div>
          <p>
            <strong>{settings.grades[g]}</strong>
            {person?.grade != null && !person.is_parent ? <span className="hint"> · your grade: {settings.grades[person.grade]}</span> : null}
          </p>
          <p className={why ? 'hint' : 'learning-earn'}>
            {why ?? (
              <>
                💎 Earn: {tiersText(rewards!.tiers)} · {Math.max(0, rewards!.per_day - (sub?.paid_today ?? 0))} of {rewards!.per_day} paying round{rewards!.per_day === 1 ? '' : 's'} left today
              </>
            )}
          </p>
          <button type="button" className="learning-go" onClick={() => void start()}>
            ▶ Start 10 words
          </button>
          {error && <div className="settings-login__error">{error}</div>}
        </section>
      )}

      {sub && sub.recent.length > 0 && settings && (
        <section className="panel">
          <h2>Lately</h2>
          <ul className="hint">
            {sub.recent.map((r, i) => (
              <li key={i}>
                {new Date(r.at).toLocaleDateString()} · {settings.grades[r.grade]} · {r.correct}/{r.total}
                {r.tokens ? ` · +${r.tokens} 💎` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel">
        <h2>How it works</h2>
        <ul className="hint">
          <li>Each word is said, used in a sentence, then said again. Type it and press Enter — you have {SECONDS} seconds.</li>
          <li>🔊 says the word again, 🗣️ the sentence, 📖 what it means.</li>
          <li>Try any grade. Tokens come from your own grade or higher (a parent sets your grade).</li>
          <li>
            Also try <Link to="/spelling/spot">🔍 Spot the misspellings</Link>: tap the words spelled wrong in a paragraph.
          </li>
        </ul>
        {person?.is_parent && <Link to="/learning/settings">⚙️ Grades & tokens</Link>}
      </section>
    </div>
  );
}

export function SpellingRound({ round, gradeName, onDone, onQuit }: { round: Start; gradeName: string; onDone: (answers: string[]) => void; onQuit: () => void }) {
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');
  const [left, setLeft] = useState(SECONDS);
  const [shown, setShown] = useState<{ ok: boolean; right: string; given: string } | null>(null);
  const [meaning, setMeaning] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const answers = useRef<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const w = round.words[i];

  const speak = (pieces: string[], slow = false) => {
    input.current?.focus(); // keep typing in the box after tapping a button
    return say(pieces, { slow })
      .then(() => setVoiceError(null))
      .catch((e) => setVoiceError((e as Error).message));
  };

  // A new word: say it, use it in a sentence, say it again; the clock starts.
  useEffect(() => {
    setTyped('');
    setLeft(SECONDS);
    setShown(null);
    setMeaning(false);
    void speak([w.word, w.sentence, w.word]);
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  // The typing box is back (a new word): put the cursor in it.
  useEffect(() => {
    if (!shown) input.current?.focus();
  }, [shown, i]);

  // ⏱️ the timer (stops while showing right/wrong)
  useEffect(() => {
    if (shown) return;
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [shown, i]);
  useEffect(() => {
    if (left <= 0 && !shown) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  const submit = () => {
    if (shown) return;
    stopSpeaking();
    const given = typed.trim();
    answers.current[i] = given;
    setShown({ ok: given.toLowerCase() === w.word.toLowerCase(), right: w.word, given });
  };
  const next = () => {
    if (i + 1 >= round.words.length) onDone(round.words.map((_, k) => answers.current[k] ?? ''));
    else setI(i + 1);
  };
  // After showing right/wrong, Enter (or the button) goes on.
  useEffect(() => {
    if (!shown) return;
    const k = (e: KeyboardEvent) => e.key === 'Enter' && next();
    const t = setTimeout(() => window.addEventListener('keydown', k), 300);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', k);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  return (
    <div className="learning-page">
      <section className="panel spelling-round">
        <div className="spelling-round__top">
          <span>
            🔤 {gradeName} · word <strong>{i + 1}</strong> of {round.words.length}
          </span>
          <button
            type="button"
            className="link-button"
            onClick={() => {
              stopSpeaking();
              onQuit();
            }}
          >
            ✕ Stop
          </button>
        </div>
        <div className={`spelling-timer${left <= 15 ? ' is-low' : ''}`} aria-label={`${left} seconds left`}>
          <div className="spelling-timer__bar" style={{ width: `${(Math.max(0, left) / SECONDS) * 100}%` }} />
          <span>⏱️ {Math.max(0, left)} s</span>
        </div>
        <div className="spelling-round__buttons">
          <button type="button" className="secondary" onClick={() => void speak([w.word])}>
            🔊 Word
          </button>
          <button type="button" className="secondary" onClick={() => void speak([w.sentence])}>
            🗣️ Sentence
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setMeaning(true);
              void speak([w.meaning]);
            }}
          >
            📖 Meaning
          </button>
          <button type="button" className="secondary" onClick={() => void speak([w.word], true)}>
            🐢 Slowly
          </button>
        </div>
        {meaning && <p className="spelling-round__meaning">📖 {w.meaning}</p>}
        {voiceError && <div className="settings-login__error">{voiceError}</div>}
        {!shown ? (
          <form
            className="spelling-round__form"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input
              ref={input}
              className="spelling-round__input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label="Type the word"
              placeholder="Type the word…"
              maxLength={40}
            />
            <button type="submit">✓ Check</button>
          </form>
        ) : (
          <div className={`spelling-round__shown ${shown.ok ? 'is-ok' : 'is-wrong'}`}>
            <div className="spelling-round__verdict">{shown.ok ? '✅ Right!' : left <= 0 && !shown.given ? '⏱️ Time’s up' : '❌ Not quite'}</div>
            <div className="spelling-round__word">{shown.right}</div>
            {!shown.ok && shown.given && <div className="hint">You typed: {shown.given}</div>}
            <button type="button" onClick={next} autoFocus>
              {i + 1 >= round.words.length ? 'See how I did ›' : 'Next word ›'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
