import { useRef, useState, type FormEvent } from 'react';
import { api, type FamilyMember } from '../api/client.js';
import { downscaleImageToDataUrl } from '../utils/images.js';
import { playAudioClip, playCompletionSound, SOUND_OPTIONS } from '../utils/sounds.js';
import { MemberAvatar } from './MemberAvatar.js';

const COLOR_PRESETS = ['#5b8def', '#e2685a', '#3fae66', '#c96fd6', '#e0a638', '#33a3a3'];
const EMOJI_PRESETS = [
  '😀', '😎', '🥳', '🤓', '😇', '🥸', '🤠', '👽',
  '🦄', '🐶', '🐱', '🦊', '🐵', '🐸', '🐻', '🐨',
  '🐯', '🦁', '🐼', '🐰', '🐷', '🐮', '🐔', '🦉',
  '🐢', '🐬', '🦖', '🐙', '🦋', '🐝', '🐞', '🦕',
  '🚀', '🚗', '⚽', '🏀', '🎸', '🎮', '🎨', '🌟',
  '🌈', '🌸', '🍕', '🍩', '🍦', '🎂', '⚡', '🔥',
] as const;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('failed to read file'));
    reader.readAsDataURL(file);
  });
}

interface Props {
  /** null = creating a new family member. */
  member: FamilyMember | null;
  onClose: () => void;
  onSaved: () => void;
}

export function FamilyMemberFormModal({ member, onClose, onSaved }: Props) {
  const [name, setName] = useState(member?.name ?? '');
  const [isParent, setIsParent] = useState(member?.is_parent === 1);
  const [color, setColor] = useState(member?.color ?? COLOR_PRESETS[0]);
  const [emoji, setEmoji] = useState(member && member.avatar !== 'image' ? member.avatar ?? '' : '');
  const [hasImage, setHasImage] = useState(member?.avatar === 'image');
  const [pendingImage, setPendingImage] = useState<string | null>(null);

  const [completeSound, setCompleteSound] = useState(member?.complete_sound ?? 'none');
  const [hasCustomSound, setHasCustomSound] = useState(member?.complete_sound === 'custom');
  const [pendingSound, setPendingSound] = useState<string | null>(null);
  const [pendingSoundName, setPendingSoundName] = useState<string | null>(null);
  const [soundError, setSoundError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const soundInput = useRef<HTMLInputElement>(null);

  const previewMember = {
    id: member?.id ?? 'preview',
    name: name || '?',
    color,
    avatar: pendingImage ? 'image' : hasImage ? 'image' : emoji || null,
  };

  const pickEmoji = (e: string) => {
    setEmoji((cur) => (cur === e ? '' : e));
    setHasImage(false);
    setPendingImage(null);
  };

  const pickFile = async (file: File | null) => {
    if (!file) return;
    const dataUrl = await downscaleImageToDataUrl(file);
    setPendingImage(dataUrl);
    setEmoji('');
  };

  const clearAvatar = () => {
    setEmoji('');
    setHasImage(false);
    setPendingImage(null);
  };

  const pickSoundFile = async (file: File | null) => {
    if (!file) return;
    setSoundError(null);
    if (file.size > 10 * 1024 * 1024) {
      setSoundError('That file is too large (10MB max).');
      return;
    }
    setPendingSound(await readAsDataUrl(file));
    setPendingSoundName(file.name);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        color,
        is_parent: isParent,
        // "custom" is applied via the dedicated /sound endpoint below; any preset is stored directly.
        complete_sound: completeSound === 'none' ? null : completeSound,
        // Custom-image state is applied via the dedicated avatar endpoints below; otherwise this
        // is the emoji (or null for "no avatar").
        avatar: pendingImage || hasImage ? 'image' : emoji || null,
      };
      const saved = member
        ? await api.patch<FamilyMember>(`/family-members/${member.id}`, body)
        : await api.post<FamilyMember>('/family-members', body);

      if (pendingImage) {
        await api.post(`/family-members/${saved.id}/avatar`, { imageDataUrl: pendingImage });
      } else if (member?.avatar === 'image' && !hasImage) {
        await api.delete(`/family-members/${saved.id}/avatar`);
      }

      if (completeSound === 'custom' && pendingSound) {
        await api.post(`/family-members/${saved.id}/sound`, { audioDataUrl: pendingSound });
      } else if (completeSound !== 'custom' && member?.complete_sound === 'custom') {
        await api.delete(`/family-members/${saved.id}/sound`);
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-panel task-form" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{member ? 'Edit family member' : 'Add family member'}</h2>

        <div className="member-form__preview">
          <MemberAvatar member={previewMember} size={72} />
        </div>

        <input autoFocus placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />

        <label className="checkbox">
          <input type="checkbox" checked={isParent} onChange={(e) => setIsParent(e.target.checked)} />
          Parent (can add recurring chores)
        </label>

        <div>
          <label className="member-form__label">Color</label>
          <div className="member-form__swatches">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                className={`member-form__swatch ${color === c ? 'member-form__swatch--selected' : ''}`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
                onClick={() => setColor(c)}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="member-form__color-input"
              aria-label="Custom color"
            />
          </div>
        </div>

        <div>
          <label className="member-form__label">Avatar</label>
          <div className="member-form__swatches">
            {EMOJI_PRESETS.map((em) => (
              <button
                key={em}
                type="button"
                className={`member-form__emoji ${!pendingImage && !hasImage && emoji === em ? 'member-form__emoji--selected' : ''}`}
                onClick={() => pickEmoji(em)}
              >
                {em}
              </button>
            ))}
          </div>
          <div className="task-form__row member-form__photo-row">
            <button type="button" className="secondary" onClick={() => fileInput.current?.click()}>
              Upload photo
            </button>
            {(pendingImage || hasImage || emoji) && (
              <button type="button" className="secondary" onClick={clearAvatar}>
                No avatar
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div>
          <label className="member-form__label">Sound when a task is completed</label>
          <div className="task-form__row">
            <select
              value={completeSound}
              onChange={(e) => {
                setCompleteSound(e.target.value);
                if (e.target.value !== 'custom') {
                  setPendingSound(null);
                  setPendingSoundName(null);
                }
              }}
            >
              {SOUND_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            {completeSound !== 'custom' && (
              <button type="button" className="secondary" onClick={() => playCompletionSound(completeSound)}>
                ▶ Preview
              </button>
            )}
          </div>
          {completeSound === 'custom' && (
            <div className="member-form__custom-sound">
              <p className="hint">Only the first ~4 seconds play, with a quick fade-out — never the whole file.</p>
              <div className="task-form__row">
                <button type="button" className="secondary" onClick={() => soundInput.current?.click()}>
                  {pendingSoundName ? `Chosen: ${pendingSoundName}` : hasCustomSound ? 'Replace MP3' : 'Choose MP3'}
                </button>
                {(pendingSound || hasCustomSound) && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      playAudioClip(pendingSound ?? `/api/family-members/${member?.id}/sound-file`)
                    }
                  >
                    ▶ Preview
                  </button>
                )}
              </div>
              {soundError && <div className="settings-login__error">{soundError}</div>}
              <input
                ref={soundInput}
                type="file"
                accept="audio/mpeg,audio/mp3"
                hidden
                onChange={(e) => {
                  pickSoundFile(e.target.files?.[0] ?? null);
                  setHasCustomSound(true);
                }}
              />
            </div>
          )}
        </div>

        <div className="task-form__row">
          <button type="submit" disabled={saving}>{member ? 'Save' : 'Add'}</button>
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
