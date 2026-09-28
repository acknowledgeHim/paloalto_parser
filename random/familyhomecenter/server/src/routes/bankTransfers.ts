import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import type { BankAccount, BankTransaction } from '../types.js';

// Mounted at /api/bank — separate from bank.ts's /api/family-members/:memberId/bank router
// because a transfer spans two members' accounts, not one, so it doesn't fit that router's
// mergeParams shape. Parent-only, same "open until a password protects Settings-level actions"
// gate as the rest of the family-roster/configuration surface (requireAdmin) — a kid moving
// money between two OTHER people's accounts isn't an everyday action like checking off a chore.
export const bankTransfersRouter = Router();

function accountBalance(accountId: string): number {
  const { total } = db
    .prepare('SELECT COALESCE(SUM(amount), 0) as total FROM bank_transactions WHERE account_id = ?')
    .get(accountId) as { total: number };
  return total;
}

/** GET /accounts — every account across every family member, with its balance, for populating a
 *  "from/to" account picker (a single manual transaction stays scoped to one member's own bank
 *  page, so nothing else needed this cross-member view before). */
bankTransfersRouter.get('/accounts', requireAdmin, (_req, res) => {
  const accounts = db
    .prepare(
      `SELECT ba.*, fm.name as member_name, fm.color as member_color
       FROM bank_accounts ba JOIN family_members fm ON fm.id = ba.family_member_id
       ORDER BY fm.sort_order ASC, ba.sort_order ASC`
    )
    .all() as Array<BankAccount & { member_name: string; member_color: string }>;
  res.json(accounts.map((a) => ({ ...a, balance: accountBalance(a.id) })));
});

/**
 * POST /transfer { from_account_id, to_account_id, amount, comment, created_by_id? } — moves
 * money from one family member's account straight into another's (or a parent's), as a matched
 * pair of transactions (a withdrawal on the source, a deposit on the destination) tagged
 * "Transfer" so they're identifiable in the spending graphs, inserted atomically so the two sides
 * can never land only one of them.
 */
bankTransfersRouter.post('/transfer', requireAdmin, (req, res) => {
  const { from_account_id, to_account_id, amount, comment, created_by_id } = req.body as {
    from_account_id?: string;
    to_account_id?: string;
    amount?: number;
    comment?: string;
    created_by_id?: string | null;
  };

  if (!from_account_id || !to_account_id) return res.status(400).json({ error: 'from_account_id and to_account_id are required' });
  if (from_account_id === to_account_id) return res.status(400).json({ error: 'Pick two different accounts' });

  const fromAccount = db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(from_account_id) as BankAccount | undefined;
  const toAccount = db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(to_account_id) as BankAccount | undefined;
  if (!fromAccount || !toAccount) return res.status(404).json({ error: 'account not found' });

  const amt = Number(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: 'amount must be a positive number' });
  if (!comment || !comment.trim()) return res.status(400).json({ error: 'comment is required — say why' });

  const fromBalance = accountBalance(fromAccount.id);
  if (amt > fromBalance) return res.status(400).json({ error: 'more than that account currently holds' });

  const trimmedComment = comment.trim();
  const now = new Date().toISOString();
  const withdrawal: BankTransaction = {
    id: uuidv4(),
    account_id: fromAccount.id,
    amount: -amt,
    comment: trimmedComment,
    category: 'Transfer',
    created_by_id: created_by_id ?? null,
    created_at: now,
  };
  const deposit: BankTransaction = {
    id: uuidv4(),
    account_id: toAccount.id,
    amount: amt,
    comment: trimmedComment,
    category: 'Transfer',
    created_by_id: created_by_id ?? null,
    created_at: now,
  };

  const insert = db.prepare(
    `INSERT INTO bank_transactions (id, account_id, amount, comment, category, created_by_id, created_at)
     VALUES (@id, @account_id, @amount, @comment, @category, @created_by_id, @created_at)`
  );
  db.transaction(() => {
    insert.run(withdrawal);
    insert.run(deposit);
  })();

  res.status(201).json({ withdrawal, deposit });
});
