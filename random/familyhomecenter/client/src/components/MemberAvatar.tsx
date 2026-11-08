import type { FamilyMember, OutfitSlot } from '../api/client.js';
import { useOptionalFamilyMembers } from '../state/FamilyMemberContext.js';
import { outfitOf, useOutfitCatalog, wornItems } from '../utils/outfits.js';

interface Props {
  member: (Pick<FamilyMember, 'id' | 'name' | 'color' | 'avatar'> & { avatar_outfit?: string | null }) | null;
  /** Diameter in px. Defaults to a small inline badge; pass a larger value for a picker preview. */
  size?: number;
}

/** When each member's avatar picture last changed in this browser, so a new one shows straight
 *  away instead of the cached old one (the URL stays the same). */
const changedAt = new Map<string, number>();
export function avatarChanged(id: string) {
  changedAt.set(id, Date.now());
}
const bust = (id: string) => (changedAt.has(id) ? `?v=${changedAt.get(id)}` : '');

/** Smaller than this, a living-photo avatar shows as its still picture. */
const VIDEO_MIN_SIZE = 40;

/**
 * A family member's avatar, wearing their 👕 Dress up pieces — everywhere an avatar shows up: a hat
 * on top, glasses, something in their hand, a pet at their feet, a vehicle they ride and a bit of
 * magic around them. What they have on comes from the family list (so it's the latest, even when a
 * page has an older copy of the person); `outfit` overrides it (Dress up's try-on), `plain` leaves
 * it off.
 */
export function MemberAvatar({ member, size = 24, outfit, plain }: Props & { outfit?: Partial<Record<OutfitSlot, string>>; plain?: boolean }) {
  const family = useOptionalFamilyMembers();
  const c = useOutfitCatalog();
  if (plain || !member) return <PlainAvatar member={member} size={size} />;
  const latest = family?.members.find((m) => m.id === member.id);
  const worn = wornItems(outfit ?? outfitOf(latest ?? member), c);
  if (Object.keys(worn).length === 0) return <PlainAvatar member={member} size={size} />;
  const em = (k: number) => ({ fontSize: Math.max(8, Math.round(size * k)) });
  return (
    <span className={`dressed${size < 28 ? ' dressed--small' : ''}`} style={{ width: size, height: size }}>
      <PlainAvatar member={member} size={size} />
      {worn.magic && (
        <span className="dressed__magic" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`dressed__spark dressed__spark--${i}`} style={em(0.3)}>
              {worn.magic!.emoji}
            </span>
          ))}
        </span>
      )}
      {worn.eyes && <span className="dressed__eyes" style={em(0.5)} aria-hidden="true">{worn.eyes.emoji}</span>}
      {worn.hat && <span className="dressed__hat" style={em(0.58)} aria-hidden="true">{worn.hat.emoji}</span>}
      {worn.vehicle && <span className="dressed__vehicle" style={em(0.72)} aria-hidden="true">{worn.vehicle.emoji}</span>}
      {worn.hand && <span className="dressed__hand" style={em(0.42)} aria-hidden="true">{worn.hand.emoji}</span>}
      {worn.pet && <span className="dressed__pet" style={em(0.46)} aria-hidden="true">{worn.pet.emoji}</span>}
    </span>
  );
}

/** Just the avatar — their uploaded photo, their chosen emoji, or a plain color dot. */
export function PlainAvatar({ member, size = 24 }: Props) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.6) };

  if (!member) {
    return <span className="member-avatar member-avatar--dot" style={{ ...style, background: '#999' }} />;
  }
  // A living photo (Photos → ✨ Animate): plays where it's big enough to see, a still elsewhere —
  // dozens of tiny videos in a list would only load the Pi down.
  if (member.avatar === 'video' && size >= VIDEO_MIN_SIZE) {
    return (
      <video
        className="member-avatar member-avatar--image"
        style={style}
        src={`/api/family-members/${member.id}/avatar-video${bust(member.id)}`}
        poster={`/api/family-members/${member.id}/avatar-image${bust(member.id)}`}
        autoPlay
        muted
        loop
        playsInline
        aria-label={member.name}
      />
    );
  }
  if (member.avatar === 'image' || member.avatar === 'video') {
    return (
      <img
        className="member-avatar member-avatar--image"
        style={style}
        src={`/api/family-members/${member.id}/avatar-image${bust(member.id)}`}
        alt={member.name}
      />
    );
  }
  if (member.avatar) {
    return (
      <span className="member-avatar member-avatar--emoji" style={{ ...style, background: member.color }}>
        {member.avatar}
      </span>
    );
  }
  return <span className="member-avatar member-avatar--dot" style={{ ...style, background: member.color }} />;
}
