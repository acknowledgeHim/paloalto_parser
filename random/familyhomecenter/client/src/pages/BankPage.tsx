import { useEffect, useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, type BankSummary, type FamilyMember } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { MemberAvatar } from '../components/MemberAvatar.js';

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

function whoAdded(members: FamilyMember[], id: string | null): string {
  if (!id) return 'someone';
  return members.find((m) => m.id === id)?.name ?? 'someone';
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

function TransactionForm({ onAdd }: { onAdd: (amount: number, comment: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
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
    await onAdd(kind === 'deposit' ? n : -n, comment.trim());
    setAmount('');
    setComment('');
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

export function BankPage() {
  const { id } = useParams<{ id: string }>();
  const { members, activeProfile } = useFamilyMembers();
  const [member, setMember] = useState<FamilyMember | null>(null);
  const [summary, setSummary] = useState<BankSummary | null>(null);
  const [denied, setDenied] = useState(false);
  const [transferAccountId, setTransferAccountId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferComment, setTransferComment] = useState('');
  const [transferError, setTransferError] = useState<string | null>(null);

  const load = () => {
    if (!id) return;
    setDenied(false);
    api
      .get<BankSummary>(`/family-members/${id}/bank`)
      .then(setSummary)
      .catch(() => setDenied(true));
  };
  useEffect(load, [id]);
  useEffect(() => {
    if (!id) return;
    api.get<FamilyMember[]>('/family-members').then((all) => setMember(all.find((m) => m.id === id) ?? null));
  }, [id, members]);

  if (!id || !member) return null;

  const addAccount = async (name: string) => {
    await api.post(`/family-members/${id}/bank/accounts`, { name });
    load();
  };

  const removeAccount = async (accountId: string) => {
    await api.delete(`/family-members/${id}/bank/accounts/${accountId}`);
    load();
  };

  const addTransaction = async (accountId: string, amount: number, comment: string) => {
    await api.post(`/family-members/${id}/bank/accounts/${accountId}/transactions`, {
      amount,
      comment,
      created_by_id: activeProfile?.id ?? null,
    });
    load();
  };

  const removeTransaction = async (txId: string) => {
    await api.delete(`/family-members/${id}/bank/transactions/${txId}`);
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

      {denied && (
        <div className="empty-state">
          This is private — ask a parent, or log in as {member.name} (🔑 next to their name up top) to see it.
        </div>
      )}

      {summary && (
        <>
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

          {summary.accounts.map((account) => (
            <section key={account.id} className="panel bank-page__account">
              <div className="bank-page__account-header">
                <div>
                  <h2>{account.name}</h2>
                  <div className="bank-page__balance">{money(account.balance)}</div>
                </div>
                <button type="button" className="secondary" onClick={() => removeAccount(account.id)}>
                  Delete account
                </button>
              </div>

              <TransactionForm onAdd={(amount, comment) => addTransaction(account.id, amount, comment)} />

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
                      <span className="bank-page__tx-comment">{tx.comment}</span>
                      <span className="hint bank-page__tx-meta">
                        {new Date(tx.created_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}{' '}
                        · {whoAdded(members, tx.created_by_id)}
                      </span>
                      <button
                        type="button"
                        className="task-card__edit"
                        aria-label="Delete transaction"
                        onClick={() => removeTransaction(tx.id)}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <NewAccountForm onAdd={addAccount} />
        </>
      )}
    </div>
  );
}
