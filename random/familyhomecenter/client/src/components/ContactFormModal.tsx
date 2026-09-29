import { useState, type FormEvent } from 'react';
import { api, type Contact } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { SMS_GATEWAYS } from '../utils/smsGateways.js';

interface Props {
  /** null = adding a new contact. */
  contact: Contact | null;
  onClose: () => void;
  onSaved: () => void;
}

const KNOWN_DOMAINS = new Set<string>(SMS_GATEWAYS.map((g) => g.domain));

export function ContactFormModal({ contact, onClose, onSaved }: Props) {
  const { activeProfile } = useFamilyMembers();
  const [fullName, setFullName] = useState(contact?.full_name ?? '');
  const [relationship, setRelationship] = useState(contact?.relationship ?? '');
  const [phone, setPhone] = useState(contact?.phone ?? '');
  const [email, setEmail] = useState(contact?.email ?? '');
  const [address, setAddress] = useState(contact?.address ?? '');
  const [carrierMode, setCarrierMode] = useState<'none' | 'known' | 'custom'>(
    !contact?.carrier ? 'none' : KNOWN_DOMAINS.has(contact.carrier) ? 'known' : 'custom'
  );
  const [carrier, setCarrier] = useState(contact?.carrier ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        full_name: fullName.trim(),
        relationship: relationship.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        carrier: carrierMode === 'none' ? null : carrier.trim() || null,
      };
      if (contact) {
        await api.patch(`/contacts/${contact.id}`, body);
      } else {
        await api.post('/contacts', { ...body, created_by_id: activeProfile?.id ?? null });
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message || 'Could not save this contact');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-panel task-form" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{contact ? 'Edit contact' : 'Add contact'}</h2>
        <input autoFocus placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <input
          placeholder="Relationship (e.g. Grandma, Pediatrician, Neighbor)"
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
        />
        <input type="tel" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        {phone.trim() && (
          <div>
            <label className="member-form__label">Carrier (lets you text them by email from a desktop/kiosk)</label>
            <div className="task-form__row">
              <select
                value={carrierMode === 'known' ? carrier : carrierMode}
                onChange={(e) => {
                  if (e.target.value === 'none') {
                    setCarrierMode('none');
                  } else if (e.target.value === 'custom') {
                    setCarrierMode('custom');
                    setCarrier('');
                  } else {
                    setCarrierMode('known');
                    setCarrier(e.target.value);
                  }
                }}
              >
                <option value="none">Not set</option>
                {SMS_GATEWAYS.map((g) => (
                  <option key={g.domain} value={g.domain}>{g.label}</option>
                ))}
                <option value="custom">Other (enter gateway domain)</option>
              </select>
              {carrierMode === 'custom' && (
                <input placeholder="e.g. mycarrier.com" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
              )}
            </div>
          </div>
        )}
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
        {address.trim() && (
          <p className="hint">
            Looks up roughly how far this address is from home the next time it's saved — may take a moment.
          </p>
        )}
        {error && <div className="settings-login__error">{error}</div>}
        <div className="task-form__row">
          <button type="submit" disabled={saving}>{contact ? 'Save' : 'Add'}</button>
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
