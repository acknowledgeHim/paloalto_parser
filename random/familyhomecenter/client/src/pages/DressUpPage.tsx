import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, type Closet, type OutfitItem, type OutfitSlot } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { useOutfitCatalog } from '../utils/outfits.js';
import { DressedAvatar } from '../components/DressedAvatar.js';
import { MemberAvatar } from '../components/MemberAvatar.js';

/**
 * 👕 Dress up: spend Prize Bank stars on hats, glasses, pets and magic for your avatar — it wears
 * them on the floor plan and the Prize Bank. Tap a piece to try it on; buy it to keep it.
 */
export function DressUpPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { members, activeProfile, refresh } = useFamilyMembers();
  const isParent = activeProfile?.is_parent === 1 || members.every((m) => m.is_parent !== 1);
  const kids = members.filter((m) => m.is_parent !== 1);
  const people = isParent ? members : members.filter((m) => m.id === activeProfile?.id);
  const memberId = id ?? (activeProfile && activeProfile.is_parent !== 1 ? activeProfile.id : kids[0]?.id ?? members[0]?.id);
  const member = members.find((m) => m.id === memberId);
  const catalog = useOutfitCatalog();
  const [closet, setCloset] = useState<Closet | null>(null);
  const [tryOn, setTryOn] = useState<OutfitItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mayChange = isParent || activeProfile?.id === memberId;

  useEffect(() => {
    setCloset(null);
    setTryOn(null);
    if (memberId) api.get<Closet>(`/outfits/${memberId}`).then(setCloset).catch(console.error);
  }, [memberId]);

  const run = async (fn: () => Promise<Closet>) => {
    setError(null);
    setBusy(true);
    try {
      setCloset(await fn());
      setTryOn(null);
      refresh();
    } catch (err) {
      setError((err as Error).message || 'That didn’t work');
    } finally {
      setBusy(false);
    }
  };
  const acting = activeProfile?.id ?? null;
  const buy = (item: OutfitItem) => run(() => api.post<Closet>(`/outfits/${memberId}/buy`, { item_id: item.id, acting_member_id: acting }));
  const wear = (slot: OutfitSlot, item: OutfitItem | null) =>
    run(() => api.put<Closet>(`/outfits/${memberId}/wear`, { slot, item_id: item?.id ?? null, acting_member_id: acting }));
  const refund = (item: OutfitItem) => {
    if (!window.confirm(`Take back the ${item.name} and give ${item.stars} ⭐ back?`)) return;
    void run(() => api.post<Closet>(`/outfits/${memberId}/refund`, { item_id: item.id, acting_member_id: acting }));
  };

  if (!member) return <div className="empty-state">Add your family in Settings first.</div>;
  const preview = { ...(closet?.outfit ?? {}), ...(tryOn ? { [tryOn.slot]: tryOn.id } : {}) };
  const stars = closet?.star_balance ?? member.star_balance ?? 0;

  return (
    <div className="dress-up-page">
      <p>
        <Link to="/prizes">← Prize Bank</Link>
      </p>
      <h1>👕 Dress up</h1>
      {people.length > 1 && (
        <div className="family-board__tabs dress-up__people">
          {people.map((m) => (
            <button key={m.id} type="button" className={`family-board__tab ${m.id === memberId ? 'family-board__tab--active' : ''}`} onClick={() => navigate(`/dress-up/${m.id}`)}>
              <MemberAvatar member={m} size={20} /> {m.name}
            </button>
          ))}
        </div>
      )}
      <section className="panel dress-up__stage">
        <div className="dress-up__mirror">
          <DressedAvatar member={member} size={150} outfit={preview} />
        </div>
        <div className="dress-up__who">
          <h2>{member.name}</h2>
          <div className="dress-up__stars">⭐ {stars} stars to spend</div>
          {tryOn && (
            <div className="dress-up__tryon">
              Trying on the <strong>{tryOn.emoji} {tryOn.name}</strong> · {tryOn.stars} ⭐
              {mayChange && (
                <button type="button" disabled={busy || stars < tryOn.stars} onClick={() => buy(tryOn)}>
                  {stars < tryOn.stars ? `${tryOn.stars - stars} more ⭐ to go` : `Buy it`}
                </button>
              )}
              <button type="button" className="link-button" onClick={() => setTryOn(null)}>Take it off</button>
            </div>
          )}
          {error && <div className="settings-login__error">{error}</div>}
          <p className="hint">Tap a piece to try it on. Earn stars with chores and to-dos.</p>
        </div>
      </section>

      {catalog?.slots.map((slot) => {
        const wearing = closet?.outfit[slot.id];
        return (
          <section key={slot.id} className="panel dress-up__slot">
            <h2>
              {slot.label}
              {wearing && mayChange && (
                <button type="button" className="link-button" disabled={busy} onClick={() => wear(slot.id, null)}>
                  Take off
                </button>
              )}
            </h2>
            <div className="dress-up__items">
              {catalog.items
                .filter((i) => i.slot === slot.id)
                .map((item) => {
                  const owned = closet?.owned.includes(item.id);
                  const on = wearing === item.id;
                  return (
                    <div key={item.id} className={`dress-up__item ${on ? 'dress-up__item--on' : ''} ${owned ? 'dress-up__item--owned' : ''}`}>
                      <button
                        type="button"
                        className="dress-up__piece"
                        title={item.name}
                        disabled={busy}
                        onClick={() => (owned ? mayChange && wear(slot.id, on ? null : item) : setTryOn(tryOn?.id === item.id ? null : item))}
                      >
                        <span className="dress-up__emoji">{item.emoji}</span>
                        <span className="dress-up__name">{item.name}</span>
                        <span className="dress-up__price">{on ? '✓ Wearing' : owned ? 'Yours' : `${item.stars} ⭐`}</span>
                      </button>
                      {owned && isParent && (
                        <button type="button" className="link-button dress-up__refund" onClick={() => refund(item)}>
                          ↶ refund
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
