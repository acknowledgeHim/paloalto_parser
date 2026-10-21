import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { addDays, todayStr } from '../utils/recurrence.js';
import { isParentRequest, isSelfOrParent } from '../services/rewards.js';

/**
 * 🗳️ What's for dinner: a parent offers a few choices (recipes or anything typed in) for a meal,
 * everyone votes once (and can change it), and closing the vote puts the winner on the meal plan.
 */
export const mealPollsRouter = Router();

interface Poll {
  id: string;
  date: string;
  slot: string;
  question: string | null;
  created_by_id: string | null;
  created_at: string;
  closed_at: string | null;
  winner_option_id: string | null;
  meal_id: string | null;
}
interface Option {
  id: string;
  poll_id: string;
  title: string;
  recipe_id: string | null;
  emoji: string | null;
  sort_order: number;
}

function fullPoll(poll: Poll) {
  const options = db
    .prepare(
      `SELECT o.*, r.thumbnail_url FROM meal_poll_options o LEFT JOIN recipes r ON r.id = o.recipe_id
       WHERE o.poll_id = ? ORDER BY o.sort_order ASC`
    )
    .all(poll.id) as Array<Option & { thumbnail_url: string | null }>;
  const votes = db.prepare('SELECT family_member_id, option_id, voted_at FROM meal_poll_votes WHERE poll_id = ?').all(poll.id) as Array<{
    family_member_id: string;
    option_id: string;
  }>;
  return {
    ...poll,
    options: options.map((o) => ({ ...o, votes: votes.filter((v) => v.option_id === o.id).length })),
    votes,
  };
}

const getPoll = (id: string) => db.prepare('SELECT * FROM meal_polls WHERE id = ?').get(id) as Poll | undefined;

/** GET / — open votes, plus ones closed in the last few days (to see what won). */
mealPollsRouter.get('/', (_req, res) => {
  const since = addDays(todayStr(), -3);
  const polls = db
    .prepare('SELECT * FROM meal_polls WHERE closed_at IS NULL OR date >= ? ORDER BY closed_at IS NOT NULL, date ASC, created_at ASC')
    .all(since) as Poll[];
  res.json(polls.map(fullPoll));
});

/** POST / { date, slot, question?, options: [{title, recipe_id?, emoji?}], acting_member_id } — parents. */
mealPollsRouter.post('/', (req, res) => {
  const { date, slot, question, options, acting_member_id } = req.body ?? {};
  if (!isParentRequest(req, acting_member_id)) return res.status(403).json({ error: 'Only a parent can start a vote' });
  if (!date) return res.status(400).json({ error: 'Pick a day' });
  const s = ['breakfast', 'lunch', 'dinner'].includes(slot) ? slot : 'dinner';
  const opts = (Array.isArray(options) ? options : [])
    .map((o: { title?: string; recipe_id?: string | null; emoji?: string | null }) => {
      let title = String(o?.title ?? '').trim();
      const recipeId = o?.recipe_id || null;
      if (!title && recipeId) title = (db.prepare('SELECT title FROM recipes WHERE id = ?').get(recipeId) as { title: string } | undefined)?.title ?? '';
      return { title, recipe_id: recipeId, emoji: o?.emoji || null };
    })
    .filter((o: { title: string }) => o.title);
  if (opts.length < 2) return res.status(400).json({ error: 'Give at least 2 choices' });
  const poll: Poll = {
    id: uuidv4(),
    date,
    slot: s,
    question: question?.trim() || null,
    created_by_id: typeof acting_member_id === 'string' ? acting_member_id : null,
    created_at: new Date().toISOString(),
    closed_at: null,
    winner_option_id: null,
    meal_id: null,
  };
  db.transaction(() => {
    db.prepare(
      `INSERT INTO meal_polls (id, date, slot, question, created_by_id, created_at) VALUES (@id, @date, @slot, @question, @created_by_id, @created_at)`
    ).run(poll);
    const ins = db.prepare('INSERT INTO meal_poll_options (id, poll_id, title, recipe_id, emoji, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
    opts.forEach((o: { title: string; recipe_id: string | null; emoji: string | null }, i: number) =>
      ins.run(uuidv4(), poll.id, o.title, o.recipe_id, o.emoji, i)
    );
  })();
  res.status(201).json(fullPoll(poll));
});

/** POST /:id/vote { family_member_id, option_id (null = take my vote back), acting_member_id } */
mealPollsRouter.post('/:id/vote', (req, res) => {
  const poll = getPoll(req.params.id);
  if (!poll) return res.status(404).json({ error: 'not found' });
  if (poll.closed_at) return res.status(400).json({ error: 'Voting is over' });
  const { family_member_id, option_id, acting_member_id } = req.body ?? {};
  if (!family_member_id) return res.status(400).json({ error: 'Pick who is voting up top first' });
  if (!isSelfOrParent(req, family_member_id, acting_member_id)) return res.status(403).json({ error: 'Everyone votes for themselves' });
  if (!option_id) {
    db.prepare('DELETE FROM meal_poll_votes WHERE poll_id = ? AND family_member_id = ?').run(poll.id, family_member_id);
    return res.json(fullPoll(poll));
  }
  if (!db.prepare('SELECT 1 FROM meal_poll_options WHERE id = ? AND poll_id = ?').get(option_id, poll.id)) {
    return res.status(400).json({ error: 'Not one of the choices' });
  }
  db.prepare(
    `INSERT INTO meal_poll_votes (poll_id, family_member_id, option_id, voted_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(poll_id, family_member_id) DO UPDATE SET option_id = excluded.option_id, voted_at = excluded.voted_at`
  ).run(poll.id, family_member_id, option_id, new Date().toISOString());
  res.json(fullPoll(poll));
});

/**
 * POST /:id/close { option_id?, acting_member_id } — parents. The most votes wins (a tie is a coin
 * flip), or the parent's pick; it goes on the meal plan, with its recipe.
 */
mealPollsRouter.post('/:id/close', (req, res) => {
  const poll = getPoll(req.params.id);
  if (!poll) return res.status(404).json({ error: 'not found' });
  const { option_id, acting_member_id } = req.body ?? {};
  if (!isParentRequest(req, acting_member_id)) return res.status(403).json({ error: 'Only a parent can close the vote' });
  if (poll.closed_at) return res.status(400).json({ error: 'Already closed' });
  const full = fullPoll(poll);
  let winner = full.options.find((o) => o.id === option_id);
  if (!winner) {
    const top = Math.max(...full.options.map((o) => o.votes));
    const tied = full.options.filter((o) => o.votes === top);
    winner = tied[Math.floor(Math.random() * tied.length)];
  }
  const mealId = uuidv4();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO meals (id, date, slot, assignee_id, title, notes, created_by_id, created_at) VALUES (?, ?, ?, NULL, ?, ?, ?, ?)`
    ).run(mealId, poll.date, poll.slot, winner!.title, '🗳️ Picked by family vote', poll.created_by_id, new Date().toISOString());
    if (winner!.recipe_id) db.prepare('INSERT INTO meal_recipes (meal_id, recipe_id, sort_order) VALUES (?, ?, 0)').run(mealId, winner!.recipe_id);
    db.prepare('UPDATE meal_polls SET closed_at = ?, winner_option_id = ?, meal_id = ? WHERE id = ?').run(
      new Date().toISOString(),
      winner!.id,
      mealId,
      poll.id
    );
  })();
  res.json(fullPoll(getPoll(poll.id)!));
});

/** DELETE /:id — parents: drop the vote (a meal it already put on the plan stays). */
mealPollsRouter.delete('/:id', (req, res) => {
  if (!isParentRequest(req, req.query.acting_member_id)) return res.status(403).json({ error: 'Only a parent can do that' });
  db.prepare('DELETE FROM meal_polls WHERE id = ?').run(req.params.id);
  res.status(204).end();
});
