import { useEffect, useRef, useState } from 'react';
import type { FamilyMember, Task } from '../api/client.js';
import { taskIcon } from '../utils/taskIcons.js';
import { MemberAvatar } from './MemberAvatar.js';

interface Props {
  member: FamilyMember;
  /** One per checkpoint, in display order — same list the done/total count is derived from. */
  items: Task[];
  done: number;
  total: number;
  /** Resolved per-kind (Chores vs. To-dos each have their own — see FamilyMemberFormModal); null
   *  falls back to 🏠/🏰. */
  startIcon: string | null;
  endIcon: string | null;
}

/**
 * The "Adventure Map" progress bar style: the person's avatar travels a path from a start icon to
 * an end icon (both configurable per-person, independently for Chores and To-dos — see
 * FamilyMemberFormModal), hopping over one checkpoint icon per completed chore/to-do. Purely
 * positional — "the avatar sits at done/total along the path, and the first `done` checkpoints
 * (in list order) read as cleared" — not tied to *which* specific task is done, so it always stays
 * visually consistent with the 2/5-style count shown above it, the same number this reads
 * `done`/`total` from.
 */
export function AdventureProgressBar({ member, items, done, total, startIcon: startIconProp, endIcon: endIconProp }: Props) {
  const startIcon = startIconProp || '🏠';
  const endIcon = endIconProp || '🏰';
  const pct = total > 0 ? (done / total) * 100 : 0;
  const finished = total > 0 && done >= total;

  // Briefly "hop" the avatar whenever done changes (either direction — completing or un-completing
  // still deserves a little motion, not just forward progress).
  const [hopping, setHopping] = useState(false);
  const prevDone = useRef(done);
  useEffect(() => {
    if (done === prevDone.current) return;
    prevDone.current = done;
    setHopping(true);
    const t = setTimeout(() => setHopping(false), 650);
    return () => clearTimeout(t);
  }, [done]);

  return (
    <div className={`adventure-bar ${finished ? 'adventure-bar--finished' : ''}`}>
      <span className="adventure-bar__end" aria-hidden="true">{startIcon}</span>
      <div className="adventure-bar__path">
        <div className="adventure-bar__path-fill" style={{ width: `${pct}%`, background: member.color }} />
        {items.map((item, i) => (
          <span
            key={item.id}
            className={`adventure-bar__checkpoint ${i < done ? 'adventure-bar__checkpoint--cleared' : ''} ${
              hopping && i === done - 1 ? 'adventure-bar__checkpoint--pop' : ''
            }`}
            style={{ left: `${total > 0 ? ((i + 1) / total) * 100 : 0}%` }}
            title={item.title}
          >
            {taskIcon(item)}
          </span>
        ))}
        <div className={`adventure-bar__avatar ${hopping ? 'adventure-bar__avatar--hop' : ''}`} style={{ left: `${pct}%` }}>
          <MemberAvatar member={member} size={30} />
        </div>
      </div>
      <span className={`adventure-bar__end ${finished ? 'adventure-bar__end--celebrate' : ''}`} aria-hidden="true">
        {endIcon}
      </span>
    </div>
  );
}
