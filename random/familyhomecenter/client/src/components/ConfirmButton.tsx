import { useState } from 'react';

interface Props {
  /** The normal button's label. */
  label: string;
  /** What to ask before actually deleting — be specific ("Delete Kevin's Checking account?"). */
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  /** className for the initial button, before confirming — defaults to match a plain text link. */
  className?: string;
  /** Accessible name for the initial button, when label is just an icon (e.g. "✕"). */
  ariaLabel?: string;
}

/**
 * A delete-style action that requires a second tap before it actually fires — too easy to
 * accidentally delete a family member, bank account, or transaction otherwise, especially on a
 * touchscreen. Expands in place rather than a full modal, to stay quick for the common "yes I
 * meant it" case.
 */
export function ConfirmButton({ label, confirmLabel, onConfirm, className = 'link-button', ariaLabel }: Props) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" className={className} aria-label={ariaLabel} onClick={() => setConfirming(true)}>
        {label}
      </button>
    );
  }

  return (
    <span className="confirm-button">
      <span className="confirm-button__prompt">{confirmLabel}</span>
      <button
        type="button"
        className="confirm-button__yes"
        onClick={() => {
          setConfirming(false);
          onConfirm();
        }}
      >
        Yes, delete
      </button>
      <button type="button" className="secondary" onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </span>
  );
}
