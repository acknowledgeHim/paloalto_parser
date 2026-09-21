import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { requireBankAccess } from '../middleware/requireBankAccess.js';
import type { BankAccount, BankTransaction, FamilyMember } from '../types.js';

// Mounted at /api/family-members/:memberId/bank — see index.ts. mergeParams so every route below
// can read :memberId from the mount path (TS doesn't infer that across the mount boundary, hence
// the `as { memberId: string }` casts below instead of relying on req.params' inferred type).
export const bankRouter = Router({ mergeParams: true });
bankRouter.use(requireBankAccess);

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

/** GET / — every account (with running balance + full transaction history) for this member, plus
 *  how much unallocated Prize Bank money is still available to transfer in. */
bankRouter.get('/', (req, res) => {
  const { memberId } = req.params as { memberId: string };
  const member = db.prepare('SELECT * FROM family_members WHERE id = ?').get(memberId) as FamilyMember | undefined;
  if (!member) return res.status(404).json({ error: 'not found' });
  res.json({ accounts: accountsWithBalances(member.id), prizeBankMoneyAvailable: member.money_balance });
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
bankRouter.post('/accounts/:accountId/transactions', (req, res) => {
  const { memberId, accountId } = req.params as { memberId: string; accountId: string };
  const account = db
    .prepare('SELECT * FROM bank_accounts WHERE id = ? AND family_member_id = ?')
    .get(accountId, memberId) as BankAccount | undefined;
  if (!account) return res.status(404).json({ error: 'not found' });

  const { amount, comment, created_by_id } = req.body as {
    amount?: number;
    comment?: string;
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
    created_by_id: created_by_id ?? null,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO bank_transactions (id, account_id, amount, comment, created_by_id, created_at)
     VALUES (@id, @account_id, @amount, @comment, @created_by_id, @created_at)`
  ).run(transaction);
  res.status(201).json(transaction);
});

bankRouter.delete('/transactions/:txId', (req, res) => {
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
    created_by_id: created_by_id ?? null,
    created_at: new Date().toISOString(),
  };

  db.transaction(() => {
    db.prepare('UPDATE family_members SET money_balance = money_balance - ? WHERE id = ?').run(amt, member.id);
    db.prepare(
      `INSERT INTO bank_transactions (id, account_id, amount, comment, created_by_id, created_at)
       VALUES (@id, @account_id, @amount, @comment, @created_by_id, @created_at)`
    ).run(transaction);
  })();

  res.status(201).json(transaction);
});
