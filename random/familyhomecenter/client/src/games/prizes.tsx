import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

/**
 * 🏆 Prize powers (server: routes/games.ts prizesFor): earned — never bought — by passing every
 * lesson in a subject at the kid's grade. Each earning gives a parent-set number of uses (or
 * unlimited); parents can use them free to show the kids what they're working for.
 */
export interface PrizeStatus {
  name: string;
  blurb: string;
  /** one use is one of these: drive, game, visit */
  unit: string;
  subject: 'grammar' | 'math' | 'history' | 'science' | 'handson' | 'any' | 'all';
  uses_per: number;
  parents_free: boolean;
  free: boolean;
  earned: boolean;
  unlimited: boolean;
  left: number | null;
  ready: boolean;
  progress: Array<{ subject: string; label: string; grade: string; passed: number; total: number; done: boolean }>;
  note: string | null;
}
export type Prizes = Record<string, PrizeStatus>;

export const SUBJECT_TEXT: Record<PrizeStatus['subject'], string> = {
  math: '➗ Math',
  grammar: '📝 Grammar',
  history: '🇺🇸 History',
  science: '🔬 Science',
  handson: '🔧 Hands-on',
  any: 'any one subject',
  all: 'all four subjects',
};
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** "every ➗ Math lesson" / "every lesson in any one subject" … */
export function earnText(p: PrizeStatus): string {
  const per = p.uses_per ? plural(p.uses_per, p.unit) : 'unlimited';
  if (p.subject === 'any') return `Pass every lesson at your grade in any subject (each subject earns it again) — ${per}`;
  if (p.subject === 'all') return `Pass every lesson at your grade in all four subjects — ${per}`;
  if (p.subject === 'handson') return `Pass every 🔧 Hands-on lesson — ${per}`;
  return `Pass every ${SUBJECT_TEXT[p.subject]} lesson at your grade — ${per}`;
}

/** Use one go of a prize power (a drive, a game, a visit): the new statuses, or throws why not. */
export async function spendPrize(gameId: string, memberId: string, prize: string): Promise<Prizes> {
  const r = await api.post<{ prizes: Prizes }>(`/games/${gameId}/play/${memberId}/prize`, { prize, acting_member_id: memberId });
  return r.prizes;
}

export function prizeLeftText(p: PrizeStatus): string {
  if (p.free) return '👑 Free for parents — show the kids!';
  if (p.unlimited) return '✅ Yours — unlimited';
  if (p.earned) return p.left ? `✅ ${plural(p.left, p.unit)} left` : `Used up — earn more by finishing another subject, or next grade’s lessons`;
  return '🔒 Not earned yet';
}

/**
 * The 🏆 panel in a game's garage: each prize power, how to earn it, the kid's lesson progress, and
 * (with `on`/`toggle`) a switch to bring it on the next go.
 */
export function PrizePanel({ prizes, on, toggle, hint }: { prizes: Prizes | undefined; on?: string[]; toggle?: (id: string, v: boolean) => void; hint?: string }) {
  const list = Object.entries(prizes ?? {});
  if (!list.length) return null;
  return (
    <section className="panel prize-panel">
      <h2>🏆 Prize powers</h2>
      <p className="hint">
        These can’t be bought — you earn them by finishing lessons in <Link to="/learning">📚 Learning</Link>. {hint ?? ''}
      </p>
      {list.map(([id, p]) => {
        const checked = (on ?? []).includes(id);
        return (
          <div key={id} className={`prize-power${p.ready ? ' is-ready' : ' is-locked'}`}>
            <div className="prize-power__head">
              {toggle ? (
                <label className="privacy-toggle">
                  <input type="checkbox" checked={p.ready && checked} disabled={!p.ready} onChange={(e) => toggle(id, e.target.checked)} />
                  <strong>{p.name}</strong>
                </label>
              ) : (
                <strong>{p.name}</strong>
              )}
              <span className="prize-power__left">{prizeLeftText(p)}</span>
            </div>
            <div className="hint">{p.blurb}</div>
            <div className="hint">🎯 {earnText(p)}.</div>
            {p.note && <div className="hint">{p.note}</div>}
            {!p.free && p.progress.length > 0 && (
              <div className="prize-power__progress">
                {p.progress.map((x) => (
                  <div key={x.subject} className="prize-power__bar" title={`${x.passed} of ${x.total} lessons passed`}>
                    <span>
                      {x.done ? '✅' : '📖'} {x.label} ({x.grade}): {x.total ? `${x.passed} of ${x.total}` : 'no lessons yet'}
                    </span>
                    <span className="prize-power__track">
                      <span style={{ width: `${x.total ? Math.round((100 * x.passed) / x.total) : 0}%` }} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
