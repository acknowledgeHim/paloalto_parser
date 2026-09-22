import { useEffect, useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, type BankAccount, type BankGoal, type BankSummary, type FamilyMember, type SpendingSummary } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { MemberAvatar } from '../components/MemberAvatar.js';
import { CategorySpendChart } from '../components/CategorySpendChart.js';
import { ConfirmButton } from '../components/ConfirmButton.js';
import { SPENDING_CATEGORIES } from '../utils/spendingCategories.js';

const SPEND_PERIODS: Array<{ value: SpendingSummary['period']; label: string }> = [
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
  { value: 'year', label: 'Last year' },
];

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

function whoAdded(members: FamilyMember[], id: string | null): string {
  if (!id) return 'someone';
  return members.find((m) => m.id === id)?.name ?? 'someone';
}

const PRESET_CATEGORIES = SPENDING_CATEGORIES.slice(0, -1); // all but the "Other" catch-all

function CategoryPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [mode, setMode] = useState<'none' | 'preset' | 'custom'>(
    value === '' ? 'none' : PRESET_CATEGORIES.includes(value) ? 'preset' : 'custom'
  );

  const handleSelect = (v: string) => {
    if (v === '') {
      setMode('none');
      onChange('');
    } else if (v === 'Other') {
      setMode('custom');
      onChange('');
    } else {
      setMode('preset');
      onChange(v);
    }
  };

  return (
    <div className="task-form__row">
      <select value={mode === 'preset' ? value : mode === 'custom' ? 'Other' : ''} onChange={(e) => handleSelect(e.target.value)}>
        <option value="">No category</option>
        {PRESET_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        <option value="Other">Other</option>
      </select>
      {mode === 'custom' && <input placeholder="Category name" value={value} onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
}

function NewAccountForm({ onAdd }: { onAdd: (name: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onAdd(name.trim());
    setName('');
    setOpen(false);
  };
  if (!open) {
    return (
      <button type="button" className="secondary" onClick={() => setOpen(true)}>
        + New account
      </button>
    );
  }
  return (
    <form className="bank-page__inline-form" onSubmit={submit}>
      <input
        autoFocus
        placeholder='Account name, e.g. "Checking"'
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit">Add</button>
      <button type="button" className="secondary" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </form>
  );
}

function TransactionForm({ onAdd }: { onAdd: (amount: number, comment: string, category: string | null) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!n || n <= 0) {
      setError('Enter an amount greater than 0');
      return;
    }
    if (!comment.trim()) {
      setError('Say why — a comment is required');
      return;
    }
    setError(null);
    await onAdd(kind === 'deposit' ? n : -n, comment.trim(), kind === 'withdraw' ? category.trim() || null : null);
    setAmount('');
    setComment('');
    setCategory('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button type="button" className="secondary" onClick={() => setOpen(true)}>
        + Add transaction
      </button>
    );
  }
  return (
    <form className="bank-page__tx-form" onSubmit={submit}>
      <div className="task-form__row">
        <select value={kind} onChange={(e) => setKind(e.target.value as 'deposit' | 'withdraw')}>
          <option value="deposit">Deposit (+)</option>
          <option value="withdraw">Withdraw / spend (−)</option>
        </select>
        <input
          type="number"
          step="0.01"
          min="0.01"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <input placeholder="Why? (e.g. Birthday gift from Grandma)" value={comment} onChange={(e) => setComment(e.target.value)} />
      {kind === 'withdraw' && (
        <div>
          <label className="member-form__label">Category (for the spending graphs)</label>
          <CategoryPicker value={category} onChange={setCategory} />
        </div>
      )}
      {error && <div className="settings-login__error">{error}</div>}
      <div className="task-form__row">
        <button type="submit">Save</button>
        <button type="button" className="secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function NewGoalForm({ onAdd }: { onAdd: (title: string, targetAmount: number, category: string | null) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [category, setCategory] = useState('Toys');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const amt = Number(targetAmount);
    if (!title.trim()) {
      setError('Give it a name, e.g. "Lego set"');
      return;
    }
    if (!amt || amt <= 0) {
      setError('Enter a cost greater than 0');
      return;
    }
    setError(null);
    await onAdd(title.trim(), amt, category.trim() || null);
    setTitle('');
    setTargetAmount('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button type="button" className="secondary" onClick={() => setOpen(true)}>
        + New savings goal
      </button>
    );
  }
  return (
    <form className="bank-page__tx-form" onSubmit={submit}>
      <input autoFocus placeholder='What for? (e.g. "Lego set")' value={title} onChange={(e) => setTitle(e.target.value)} />
      <input
        type="number"
        step="0.01"
        min="0.01"
        placeholder="Cost"
        value={targetAmount}
        onChange={(e) => setTargetAmount(e.target.value)}
      />
      <div>
        <label className="member-form__label">Category (tagged on the purchase once you get it)</label>
        <CategoryPicker value={category} onChange={setCategory} />
      </div>
      {error && <div className="settings-login__error">{error}</div>}
      <div className="task-form__row">
        <button type="submit">Add goal</button>
        <button type="button" className="secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function GoalRow({ goal, onAchieve, onDelete }: { goal: BankGoal; onAchieve: () => void; onDelete: () => void }) {
  const pct = Math.min(100, Math.round((Math.max(0, goal.saved) / goal.target_amount) * 100));
  const ready = goal.saved >= goal.target_amount;
  return (
    <div className="bank-page__goal">
      <div className="bank-page__goal-header">
        <span className="bank-page__goal-title">
          {goal.achieved_at ? '✅ ' : '🎯 '}
          {goal.title}
        </span>
        <span className="hint">
          {money(Math.max(0, goal.saved))} / {money(goal.target_amount)}
        </span>
      </div>
      {!goal.achieved_at && (
        <>
          <div className="progress-bar">
            <div className="progress-bar__fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="task-form__row">
            <button type="button" disabled={!ready} onClick={onAchieve}>
              {ready ? 'Mark purchased' : `${pct}% saved`}
            </button>
            <button type="button" className="secondary" onClick={onDelete}>
              Remove
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function BankPage() {
  const { id } = useParams<{ id: string }>();
  const { members, activeProfile } = useFamilyMembers();
  const [member, setMember] = useState<FamilyMember | null>(null);
  const [summary, setSummary] = useState<BankSummary | null>(null);
  const [spending, setSpending] = useState<SpendingSummary | null>(null);
  const [spendPeriod, setSpendPeriod] = useState<SpendingSummary['period']>('month');
  const [denied, setDenied] = useState(false);
  const [transferAccountId, setTransferAccountId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferComment, setTransferComment] = useState('');
  const [transferError, setTransferError] = useState<string | null>(null);

  // Household-trust-level rule, same spirit as PersonPage's canEditProfile — don't even ask the
  // server for another kid's bank unless the picked profile is that person or a parent. Real
  // enforcement is server-side (requireBankAccess) once a password protects it; this just keeps
  // the client from offering the data/controls at all before that point.
  const canView = Boolean(activeProfile && (activeProfile.id === id || activeProfile.is_parent === 1));
  // Manual transactions (add/delete) are parent-only — a kid can still track goals and transfer
  // their own earned Prize Bank money, but shouldn't be able to hand-credit/debit their account.
  // Same household-trust-level client check as Settings; real enforcement is server-side
  // (requireBankTransactionAccess) once a password protects this.
  const canManageTransactions = Boolean(activeProfile?.is_parent === 1);

  const load = () => {
    if (!id || !canView) return;
    setDenied(false);
    api
      .get<BankSummary>(`/family-members/${id}/bank`)
      .then(setSummary)
      .catch(() => setDenied(true));
  };
  useEffect(load, [id, canView]);
  useEffect(() => {
    if (!id) return;
    api.get<FamilyMember[]>('/family-members').then((all) => setMember(all.find((m) => m.id === id) ?? null));
  }, [id, members]);
  useEffect(() => {
    if (!id || !canView || denied) return;
    api.get<SpendingSummary>(`/family-members/${id}/bank/spending?period=${spendPeriod}`).then(setSpending).catch(() => {});
  }, [id, canView, spendPeriod, denied, summary]);

  if (!id || !member) return null;

  const addAccount = async (name: string) => {
    await api.post(`/family-members/${id}/bank/accounts`, { name });
    load();
  };

  const removeAccount = async (accountId: string) => {
    await api.delete(`/family-members/${id}/bank/accounts/${accountId}`);
    load();
  };

  const addTransaction = async (accountId: string, amount: number, comment: string, category: string | null) => {
    await api.post(`/family-members/${id}/bank/accounts/${accountId}/transactions`, {
      amount,
      comment,
      category,
      created_by_id: activeProfile?.id ?? null,
    });
    load();
  };

  const removeTransaction = async (txId: string) => {
    await api.delete(`/family-members/${id}/bank/transactions/${txId}`);
    load();
  };

  const addGoal = async (accountId: string, title: string, targetAmount: number, category: string | null) => {
    await api.post(`/family-members/${id}/bank/goals`, {
      account_id: accountId,
      title,
      target_amount: targetAmount,
      category,
    });
    load();
  };

  const achieveGoal = async (goalId: string) => {
    await api.post(`/family-members/${id}/bank/goals/${goalId}/achieve`, { created_by_id: activeProfile?.id ?? null });
    load();
  };

  const removeGoal = async (goalId: string) => {
    await api.delete(`/family-members/${id}/bank/goals/${goalId}`);
    load();
  };

  const submitTransfer = async (e: FormEvent) => {
    e.preventDefault();
    const amt = Number(transferAmount);
    if (!transferAccountId) {
      setTransferError('Pick an account');
      return;
    }
    if (!amt || amt <= 0) {
      setTransferError('Enter an amount greater than 0');
      return;
    }
    if (!transferComment.trim()) {
      setTransferError('Say why — a comment is required');
      return;
    }
    setTransferError(null);
    try {
      await api.post(`/family-members/${id}/bank/transfer-from-rewards`, {
        account_id: transferAccountId,
        amount: amt,
        comment: transferComment.trim(),
        created_by_id: activeProfile?.id ?? null,
      });
      setTransferAmount('');
      setTransferComment('');
      load();
    } catch (err) {
      setTransferError((err as Error).message || 'Could not transfer that');
    }
  };

  const goalsFor = (account: BankAccount) => (summary?.goals ?? []).filter((g) => g.account_id === account.id);

  return (
    <div className="bank-page">
      <Link to={`/person/${id}`} className="link-button">
        ‹ Back to {member.name}'s page
      </Link>

      <header className="person-page__header">
        <MemberAvatar member={member} size={64} />
        <div>
          <h1>🏦 {member.name}'s Bank</h1>
          <p className="hint">Private to {member.name} and parents.</p>
        </div>
      </header>

      {!canView && (
        <div className="empty-state">
          This is private to {member.name} and parents — pick {member.name}'s profile, or a parent's, up top to see
          it.
        </div>
      )}

      {canView && denied && (
        <div className="empty-state">
          This is private — ask a parent, or log in as {member.name} (🔑 next to their name up top) to see it.
        </div>
      )}

      {canView && summary && (
        <>
          {spending && (
            <section className="panel">
              <h2>Spending by category</h2>
              <div className="task-form__row bank-page__period-toggle">
                {SPEND_PERIODS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className={p.value === spendPeriod ? '' : 'secondary'}
                    onClick={() => setSpendPeriod(p.value)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {spending.byCategory.length === 0 ? (
                <div className="empty-state">No spending recorded in this window.</div>
              ) : (
                <>
                  <CategorySpendChart data={spending.byCategory} color={member.color} />
                  <p className="hint">Total spent: {money(spending.total)}</p>
                </>
              )}
            </section>
          )}

          {summary.prizeBankMoneyAvailable > 0 && (
            <section className="panel">
              <h2>Transfer from Prize Bank earnings</h2>
              <p className="hint">
                {member.name} has {money(summary.prizeBankMoneyAvailable)} in earned (but not yet banked) Prize Bank
                money. Move some into an account below.
              </p>
              <form className="bank-page__tx-form" onSubmit={submitTransfer}>
                <div className="task-form__row">
                  <select value={transferAccountId} onChange={(e) => setTransferAccountId(e.target.value)}>
                    <option value="">Which account?</option>
                    {summary.accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={summary.prizeBankMoneyAvailable}
                    placeholder="Amount"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                  />
                </div>
                <input
                  placeholder="Why? (e.g. Reward for finishing yard work)"
                  value={transferComment}
                  onChange={(e) => setTransferComment(e.target.value)}
                />
                {transferError && <div className="settings-login__error">{transferError}</div>}
                <button type="submit" disabled={summary.accounts.length === 0}>
                  Transfer
                </button>
                {summary.accounts.length === 0 && <p className="hint">Add an account first.</p>}
              </form>
            </section>
          )}

          {summary.accounts.length === 0 && (
            <div className="empty-state">No accounts yet — add one below (e.g. Checking, Savings).</div>
          )}

          <div className="bank-page__accounts-grid">
          {summary.accounts.map((account) => (
            <section key={account.id} className="panel bank-page__account">
              <div className="bank-page__account-header">
                <div>
                  <h2>{account.name}</h2>
                  <div className="bank-page__balance">{money(account.balance)}</div>
                </div>
                <ConfirmButton
                  label="Delete account"
                  confirmLabel={`Delete "${account.name}" and its ${account.transactions.length} transaction${account.transactions.length === 1 ? '' : 's'}?`}
                  onConfirm={() => removeAccount(account.id)}
                  className="secondary"
                />
              </div>

              {goalsFor(account).length > 0 && (
                <div className="bank-page__goals">
                  {goalsFor(account).map((goal) => (
                    <GoalRow key={goal.id} goal={goal} onAchieve={() => achieveGoal(goal.id)} onDelete={() => removeGoal(goal.id)} />
                  ))}
                </div>
              )}

              <div className="task-form__row">
                {canManageTransactions && (
                  <TransactionForm onAdd={(amount, comment, category) => addTransaction(account.id, amount, comment, category)} />
                )}
                <NewGoalForm onAdd={(title, targetAmount, category) => addGoal(account.id, title, targetAmount, category)} />
              </div>

              {account.transactions.length === 0 ? (
                <div className="empty-state">No transactions yet.</div>
              ) : (
                <ul className="bank-page__tx-list">
                  {account.transactions.map((tx) => (
                    <li key={tx.id} className="bank-page__tx">
                      <span className={`bank-page__tx-amount ${tx.amount >= 0 ? 'bank-page__tx-amount--pos' : 'bank-page__tx-amount--neg'}`}>
                        {tx.amount >= 0 ? '+' : '−'}
                        {money(Math.abs(tx.amount))}
                      </span>
                      <span className="bank-page__tx-comment">
                        {tx.comment}
                        {tx.category && <span className="badge bank-page__tx-category">{tx.category}</span>}
                      </span>
                      <span className="hint bank-page__tx-meta">
                        {new Date(tx.created_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}{' '}
                        · {whoAdded(members, tx.created_by_id)}
                      </span>
                      {canManageTransactions && (
                        <ConfirmButton
                          label="✕"
                          ariaLabel="Delete transaction"
                          confirmLabel={`Delete this ${money(Math.abs(tx.amount))} transaction?`}
                          onConfirm={() => removeTransaction(tx.id)}
                          className="task-card__edit"
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          </div>

          <NewAccountForm onAdd={addAccount} />
        </>
      )}
    </div>
  );
}
