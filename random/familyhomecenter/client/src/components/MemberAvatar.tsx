import type { FamilyMember } from '../api/client.js';

interface Props {
  member: Pick<FamilyMember, 'id' | 'name' | 'color' | 'avatar'> | null;
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

/** Renders a family member's avatar: their uploaded photo, their chosen emoji, or a plain color dot. */
export function MemberAvatar({ member, size = 24 }: Props) {
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
