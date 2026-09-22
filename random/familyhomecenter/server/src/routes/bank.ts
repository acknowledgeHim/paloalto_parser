import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { requireBankAccess, requireBankTransactionAccess } from '../middleware/requireBankAccess.js';
import { addDays, todayStr } from '../utils/recurrence.js';
import type { BankAccount, BankGoal, BankTransaction, FamilyMember } from '../types.js';

// Mounted at /api/family-members/:memberId/bank — see index.ts. mergeParams so every route below
// can read :memberId from the mount path (TS doesn't infer that across the mount boundary, hence
// the `as { memberId: string }` casts below instead of relying on req.params' inferred type).
export const bankRouter = Router({ mergeParams: true });
bankRouter.use(requireBankAccess);

function accountBalance(accountId: string): number {
  const { total } = db
    .prepare('SELECT COALESCE(SUM(amount), 0) as total FROM bank_transactions WHERE account_id = ?')
    .get(accountId) as { total: number };
  return total;
}

function accountsWithBalances(memberId: string) {
  const accounts = db
    .prepare('SELECT * FROM bank_accounts WHERE family_member_id = ? ORDER BY sort_order ASC, created_at ASC')
    .all(memberId) as BankAccount[];
  return accounts.map((account) => {
    const transactions = db
      .prepare('SELECT * FROM bank_transactions WHERE account_id = ? ORDER BY created_at DESC')
      .all(account.id) as BankTransaction[];
    const balance = transactions.reduce((sum, t) => sum + t.amount, 0);
    return { ...account, balance, transactions };
  });
}

function goalsWithProgress(memberId: string) {
  const goals = db
    .prepare('SELECT * FROM bank_goals WHERE family_member_id = ? ORDER BY achieved_at IS NOT NULL ASC, created_at ASC')
    .all(memberId) as BankGoal[];
  return goals.map((goal) => ({ ...goal, saved: Math.max(0, accountBalance(goal.account_id)) }));
}

/** GET / — every account (with running balance + full transaction history) and savings goal for
 *  this member, plus how much unallocated Prize Bank money is still available to transfer in. */
bankRouter.get('/', (req, res) => {
  const { memberId } = req.params as { memberId: string };
  const member = db.prepare('SELECT * FROM family_members WHERE id = ?').get(memberId) as FamilyMember | undefined;
  if (!member) return res.status(404).json({ error: 'not found' });
  res.json({
    accounts: accountsWithBalances(member.id),
    goals: goalsWithProgress(member.id),
    prizeBankMoneyAvailable: member.money_balance,
  });
});

bankRouter.post('/accounts', (req, res) => {
  const { memberId } = req.params as { memberId: string };
  const { name } = req.body as { name?: string };
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

  const { max } = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) as max FROM bank_accounts WHERE family_member_id = ?')
    .get(memberId) as { max: number };
  const account: BankAccount = {
    id: uuidv4(),
    family_member_id: memberId,
    name: name.trim(),
    sort_order: max + 1,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO bank_accounts (id, family_member_id, name, sort_order, created_at)
     VALUES (@id, @family_member_id, @name, @sort_order, @created_at)`
  ).run(account);
  res.status(201).json({ ...account, balance: 0, transactions: [] });
});

bankRouter.delete('/accounts/:accountId', (req, res) => {
  const { memberId, accountId } = req.params as { memberId: string; accountId: string };
  db.prepare('DELETE FROM bank_accounts WHERE id = ? AND family_member_id = ?').run(accountId, memberId);
  res.status(204).end();
});

/** POST /accounts/:accountId/transactions { amount, comment, created_by_id? } — a manual entry:
 *  positive amount = deposit, negative = withdrawal/spend. comment is required so the ledger is
 *  always self-explaining ("why getting the money"). */
bankRouter.post('/accounts/:accountId/transactions', requireBankTransactionAccess, (req, res) => {
  const { memberId, accountId } = req.params as { memberId: string; accountId: string };
  const account = db
    .prepare('SELECT * FROM bank_accounts WHERE id = ? AND family_member_id = ?')
    .get(accountId, memberId) as BankAccount | undefined;
  if (!account) return res.status(404).json({ error: 'not found' });

  const { amount, comment, category, created_by_id } = req.body as {
    amount?: number;
    comment?: string;
    category?: string | null;
    created_by_id?: string | null;
  };
  const amt = Number(amount);
  if (!amt || Number.isNaN(amt)) return res.status(400).json({ error: 'amount is required' });
  if (!comment || !comment.trim()) return res.status(400).json({ error: 'comment is required — say why' });

  const transaction: BankTransaction = {
    id: uuidv4(),
    account_id: account.id,
    amount: amt,
    comment: comment.trim(),
    category: category?.trim() || null,
    created_by_id: created_by_id ?? null,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO bank_transactions (id, account_id, amount, comment, category, created_by_id, created_at)
     VALUES (@id, @account_id, @amount, @comment, @category, @created_by_id, @created_at)`
  ).run(transaction);
  res.status(201).json(transaction);
});

bankRouter.delete('/transactions/:txId', requireBankTransactionAccess, (req, res) => {
  const { memberId, txId } = req.params as { memberId: string; txId: string };
  const tx = db
    .prepare(
      `SELECT bt.* FROM bank_transactions bt JOIN bank_accounts ba ON ba.id = bt.account_id
       WHERE bt.id = ? AND ba.family_member_id = ?`
    )
    .get(txId, memberId) as BankTransaction | undefined;
  if (!tx) return res.status(404).json({ error: 'not found' });
  db.prepare('DELETE FROM bank_transactions WHERE id = ?').run(tx.id);
  res.status(204).end();
});

/**
 * POST /transfer-from-rewards { account_id, amount, comment, created_by_id? } — moves already-
 * earned Prize Bank money (member.money_balance, auto-credited when a money-reward task is
 * completed — see routes/tasks.ts's creditReward) into a named bank account as a deliberate,
 * commented, timestamped entry. Debits money_balance and inserts the transaction atomically so the
 * two money pools can never double-count.
 */
bankRouter.post('/transfer-from-rewards', (req, res) => {
  const { memberId } = req.params as { memberId: string };
  const member = db.prepare('SELECT * FROM family_members WHERE id = ?').get(memberId) as FamilyMember | undefined;
  if (!member) return res.status(404).json({ error: 'not found' });

  const { account_id, amount, comment, created_by_id } = req.body as {
    account_id?: string;
    amount?: number;
    comment?: string;
    created_by_id?: string | null;
  };
  const account = db
    .prepare('SELECT * FROM bank_accounts WHERE id = ? AND family_member_id = ?')
    .get(account_id, memberId) as BankAccount | undefined;
  if (!account) return res.status(404).json({ error: 'account not found' });

  const amt = Number(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: 'amount must be a positive number' });
  if (amt > member.money_balance) return res.status(400).json({ error: 'more than the available Prize Bank money' });
  if (!comment || !comment.trim()) return res.status(400).json({ error: 'comment is required — say why' });

  const transaction: BankTransaction = {
    id: uuidv4(),
    account_id: account.id,
    amount: amt,
    comment: comment.trim(),
    category: 'Savings',
    created_by_id: created_by_id ?? null,
    created_at: new Date().toISOString(),
  };

  db.transaction(() => {
    db.prepare('UPDATE family_members SET money_balance = money_balance - ? WHERE id = ?').run(amt, member.id);
    db.prepare(
      `INSERT INTO bank_transactions (id, account_id, amount, comment, category, created_by_id, created_at)
       VALUES (@id, @account_id, @amount, @comment, @category, @created_by_id, @created_at)`
    ).run(transaction);
  })();

  res.status(201).json(transaction);
});

// ---- Savings goals ("save for a Lego set", $60) ----

bankRouter.post('/goals', (req, res) => {
  const { memberId } = req.params as { memberId: string };
  const { account_id, title, target_amount, category } = req.body as {
    account_id?: string;
    title?: string;
    target_amount?: number;
    category?: string | null;
  };
  if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });
  const amt = Number(target_amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: 'target_amount must be a positive number' });
  const account = db
    .prepare('SELECT * FROM bank_accounts WHERE id = ? AND family_member_id = ?')
    .get(account_id, memberId) as BankAccount | undefined;
  if (!account) return res.status(404).json({ error: 'account not found' });

  const goal: BankGoal = {
    id: uuidv4(),
    family_member_id: memberId,
    account_id: account.id,
    title: title.trim(),
    target_amount: amt,
    category: category?.trim() || null,
    created_at: new Date().toISOString(),
    achieved_at: null,
  };
  db.prepare(
    `INSERT INTO bank_goals (id, family_member_id, account_id, title, target_amount, category, created_at, achieved_at)
     VALUES (@id, @family_member_id, @account_id, @title, @target_amount, @category, @created_at, @achieved_at)`
  ).run(goal);
  res.status(201).json({ ...goal, saved: Math.max(0, accountBalance(account.id)) });
});

bankRouter.delete('/goals/:goalId', (req, res) => {
  const { memberId, goalId } = req.params as { memberId: string; goalId: string };
  db.prepare('DELETE FROM bank_goals WHERE id = ? AND family_member_id = ?').run(goalId, memberId);
  res.status(204).end();
});

/**
 * POST /goals/:goalId/achieve { created_by_id? } — marks a goal purchased: requires the linked
 * account to actually hold the target amount, then withdraws it as a real transaction (comment =
 * goal title, category = the goal's category) so the spend shows up in the category graphs, and
 * stamps achieved_at. Atomic so a goal can never be marked achieved without the matching withdrawal.
 */
bankRouter.post('/goals/:goalId/achieve', (req, res) => {
  const { memberId, goalId } = req.params as { memberId: string; goalId: string };
  const goal = db.prepare('SELECT * FROM bank_goals WHERE id = ? AND family_member_id = ?').get(goalId, memberId) as
    | BankGoal
    | undefined;
  if (!goal) return res.status(404).json({ error: 'not found' });
  if (goal.achieved_at) return res.status(400).json({ error: 'already achieved' });

  const balance = accountBalance(goal.account_id);
  if (balance < goal.target_amount) {
    return res.status(400).json({ error: 'Not saved up enough yet' });
  }

  const { created_by_id } = req.body as { created_by_id?: string | null };
  const achievedAt = new Date().toISOString();
  const transaction: BankTransaction = {
    id: uuidv4(),
    account_id: goal.account_id,
    amount: -goal.target_amount,
    comment: goal.title,
    category: goal.category,
    created_by_id: created_by_id ?? null,
    created_at: achievedAt,
  };

  db.transaction(() => {
    db.prepare(
      `INSERT INTO bank_transactions (id, account_id, amount, comment, category, created_by_id, created_at)
       VALUES (@id, @account_id, @amount, @comment, @category, @created_by_id, @created_at)`
    ).run(transaction);
    db.prepare('UPDATE bank_goals SET achieved_at = ? WHERE id = ?').run(achievedAt, goal.id);
  })();

  res.status(201).json({ goal: { ...goal, achieved_at: achievedAt, saved: balance }, transaction });
});

// ---- Spending-by-category graphs ----

const PERIOD_DAYS: Record<string, number> = { week: 7, month: 30, year: 365 };

/**
 * GET /spending?period=week|month|year — total spent (negative-amount transactions only, across
 * every account) grouped by category, over a trailing window ending today. Deposits aren't
 * included — this answers "what are they spending on", not net cash flow.
 */
bankRouter.get('/spending', (req, res) => {
  const { memberId } = req.params as { memberId: string };
  const period = (req.query.period as string) || 'month';
  const days = PERIOD_DAYS[period] ?? PERIOD_DAYS.month;
  const startDate = addDays(todayStr(), -(days - 1));

  const rows = db
    .prepare(
      `SELECT bt.category as category, bt.amount as amount
       FROM bank_transactions bt
       JOIN bank_accounts ba ON ba.id = bt.account_id
       WHERE ba.family_member_id = ? AND bt.amount < 0 AND date(bt.created_at) >= ?`
    )
    .all(memberId, startDate) as Array<{ category: string | null; amount: number }>;

  const totalsByCategory = new Map<string, number>();
  for (const row of rows) {
    const key = row.category?.trim() || 'Other';
    totalsByCategory.set(key, (totalsByCategory.get(key) ?? 0) + Math.abs(row.amount));
  }
  const byCategory = Array.from(totalsByCategory, ([category, total]) => ({ category, total })).sort(
    (a, b) => b.total - a.total
  );
  const total = byCategory.reduce((sum, c) => sum + c.total, 0);

  res.json({ period, days, byCategory, total });
});
