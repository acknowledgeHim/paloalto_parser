import type { FamilyMember, OutfitSlot } from '../api/client.js';
import { MemberAvatar } from './MemberAvatar.js';

type Member = Pick<FamilyMember, 'id' | 'name' | 'color' | 'avatar' | 'avatar_outfit'>;

/** A person's avatar wearing their 👕 Dress up pieces. Every MemberAvatar does this now; kept as a name for the places that used it. */
export function DressedAvatar({ member, size = 24, outfit }: { member: Member | null; size?: number; outfit?: Partial<Record<OutfitSlot, string>> }) {
  return <MemberAvatar member={member} size={size} outfit={outfit} />;
}
