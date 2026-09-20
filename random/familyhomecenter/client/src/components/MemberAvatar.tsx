import type { FamilyMember } from '../api/client.js';

interface Props {
  member: Pick<FamilyMember, 'id' | 'name' | 'color' | 'avatar'> | null;
  /** Diameter in px. Defaults to a small inline badge; pass a larger value for a picker preview. */
  size?: number;
}

/** Renders a family member's avatar: their uploaded photo, their chosen emoji, or a plain color dot. */
export function MemberAvatar({ member, size = 24 }: Props) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.6) };

  if (!member) {
    return <span className="member-avatar member-avatar--dot" style={{ ...style, background: '#999' }} />;
  }
  if (member.avatar === 'image') {
    return (
      <img
        className="member-avatar member-avatar--image"
        style={style}
        src={`/api/family-members/${member.id}/avatar-image`}
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
