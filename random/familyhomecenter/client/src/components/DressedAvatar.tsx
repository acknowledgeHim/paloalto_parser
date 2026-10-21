import type { FamilyMember, OutfitSlot } from '../api/client.js';
import { outfitOf, useOutfitCatalog, wornItems } from '../utils/outfits.js';
import { MemberAvatar } from './MemberAvatar.js';

type Member = Pick<FamilyMember, 'id' | 'name' | 'color' | 'avatar' | 'avatar_outfit'>;

/**
 * A person's avatar wearing their 👕 Dress up pieces: a hat on top, glasses, something in their
 * hand, a pet at their feet and a bit of magic floating around them. `outfit` overrides what
 * they have on (the Dress up page's try-on).
 */
export function DressedAvatar({ member, size = 24, outfit }: { member: Member | null; size?: number; outfit?: Partial<Record<OutfitSlot, string>> }) {
  const c = useOutfitCatalog();
  const worn = wornItems(outfit ?? outfitOf(member), c);
  if (!member || Object.keys(worn).length === 0) return <MemberAvatar member={member} size={size} />;
  const em = (k: number) => ({ fontSize: Math.max(8, Math.round(size * k)) });
  return (
    <span className="dressed" style={{ width: size, height: size }}>
      <MemberAvatar member={member} size={size} />
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
      {worn.hand && <span className="dressed__hand" style={em(0.42)} aria-hidden="true">{worn.hand.emoji}</span>}
      {worn.pet && <span className="dressed__pet" style={em(0.46)} aria-hidden="true">{worn.pet.emoji}</span>}
    </span>
  );
}
