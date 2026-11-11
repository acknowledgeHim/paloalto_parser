import { Link, useSearchParams } from 'react-router-dom';
import { BRANCH_NAMES, LABS, labInfo, type Branch } from '../labs/catalog.js';
import { LabSlot } from './LessonsPage.js';

/**
 * 🧪 Science labs: every lab, to play with any time (the 🔬 Science lessons show them too, next to
 * the reading and the quiz). Labs are practice — they don't pay tokens; a lesson's quiz does.
 */
export function ScienceLabsPage() {
  const [params, setParams] = useSearchParams();
  const open = params.get('lab');
  const info = open ? labInfo(open) : undefined;
  if (info)
    return (
      <div className="learning-page">
        <div className="lesson-top">
          <button type="button" className="link-button" onClick={() => setParams({})}>
            ‹ All labs
          </button>
        </div>
        <section className="panel">
          <p className="hint">
            {BRANCH_NAMES[info.branch]} · {info.about}
          </p>
          <LabSlot id={info.id} />
        </section>
      </div>
    );
  return (
    <div className="learning-page">
      <section className="panel">
        <h1>🧪 Science labs</h1>
        <p className="hint">
          Try things out and see what happens! Each lab has 🎯 goals to try. The <Link to="/science">🔬 Science lessons</Link> explain the ideas and have
          quizzes that earn 💎 tokens.
        </p>
        {(Object.keys(BRANCH_NAMES) as Branch[]).map((b) => (
          <div key={b}>
            <h2>{BRANCH_NAMES[b]}</h2>
            <div className="lab-grid">
              {LABS.filter((l) => l.branch === b).map((l) => (
                <button key={l.id} type="button" className="lab-card" onClick={() => setParams({ lab: l.id })}>
                  <strong>{l.name}</strong>
                  <span>{l.about}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
