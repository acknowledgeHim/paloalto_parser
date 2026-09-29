import { useEffect, useState } from 'react';
import { api, type Contact } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { ContactFormModal } from '../components/ContactFormModal.js';
import { ConfirmButton } from '../components/ConfirmButton.js';

/** tel:/sms: only want digits (and a leading +) — strip formatting like "(555) 123-4567". */
function phoneHref(scheme: 'tel' | 'sms', phone: string): string {
  return `${scheme}:${phone.replace(/[^\d+]/g, '')}`;
}

function distanceLabel(miles: number): string {
  const rounded = miles < 10 ? Math.round(miles * 10) / 10 : Math.round(miles);
  return `${rounded} mi away`;
}

function ContactCard({
  contact,
  canManage,
  onEdit,
  onChange,
}: {
  contact: Contact;
  canManage: boolean;
  onEdit: () => void;
  onChange: () => void;
}) {
  const [refreshing, setRefreshing] = useState(false);

  const remove = async () => {
    await api.delete(`/contacts/${contact.id}`);
    onChange();
  };

  const refreshDistance = async () => {
    setRefreshing(true);
    try {
      await api.post(`/contacts/${contact.id}/refresh-distance`);
      onChange();
    } catch {
      // best-effort — swallow, the "distance unknown" state below just stays as-is
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <section className="panel contacts-page__card">
      <div className="contacts-page__card-header">
        <div>
          <h2>{contact.full_name}</h2>
          {contact.relationship && <p className="hint">{contact.relationship}</p>}
        </div>
        {canManage && (
          <div className="task-form__row">
            <button type="button" className="task-card__edit" aria-label="Edit" onClick={onEdit}>✎</button>
            <ConfirmButton
              label="✕"
              ariaLabel={`Delete ${contact.full_name}`}
              confirmLabel={`Delete ${contact.full_name}?`}
              onConfirm={remove}
              className="task-card__edit"
            />
          </div>
        )}
      </div>

      {contact.phone && (
        <div className="contacts-page__row">
          <span className="contacts-page__row-label">📞 {contact.phone}</span>
          <div className="task-form__row">
            <a className="secondary contacts-page__link-btn" href={phoneHref('tel', contact.phone)}>Call</a>
            <a className="secondary contacts-page__link-btn" href={phoneHref('sms', contact.phone)}>Text</a>
          </div>
        </div>
      )}
      {contact.email && (
        <div className="contacts-page__row">
          <span className="contacts-page__row-label">✉️ {contact.email}</span>
          <a className="secondary contacts-page__link-btn" href={`mailto:${contact.email}`}>Email</a>
        </div>
      )}
      {contact.address && (
        <div className="contacts-page__row">
          <span className="contacts-page__row-label">📍 {contact.address}</span>
          {contact.distance_miles != null ? (
            <span className="hint">{distanceLabel(contact.distance_miles)}</span>
          ) : canManage ? (
            <button type="button" className="link-button" onClick={refreshDistance} disabled={refreshing}>
              {refreshing ? 'Looking up…' : 'Look up distance'}
            </button>
          ) : (
            <span className="hint">Distance unknown</span>
          )}
        </div>
      )}
    </section>
  );
}

export function ContactsPage() {
  const { activeProfile } = useFamilyMembers();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [modalContact, setModalContact] = useState<Contact | null | undefined>(undefined);

  // Parent-only to add/edit/remove — real enforcement is server-side (requireAdmin) once a
  // password protects it; viewing (and Call/Text/Email) stays open to everyone.
  const canManage = activeProfile?.is_parent === 1;

  const load = () => {
    api.get<Contact[]>('/contacts').then(setContacts).catch(console.error);
  };
  useEffect(load, []);

  return (
    <div className="contacts-page">
      <div className="tasks-page__header">
        {canManage && (
          <button type="button" className="icon-button" aria-label="Add contact" onClick={() => setModalContact(null)}>+</button>
        )}
        <h1>Contacts</h1>
      </div>
      <p className="hint">
        Important numbers everyone can reach — tapping Call/Text uses whatever your phone's default
        calling/texting app is. To route those through Google Voice, set Google Voice as your
        device's default phone/SMS app in its settings (Android supports this; iOS doesn't let a
        third-party app take over that role).
      </p>

      {contacts.length === 0 && <div className="empty-state">No contacts yet{canManage ? ' — add one above.' : '.'}</div>}
      <div className="contacts-page__grid">
        {contacts.map((c) => (
          <ContactCard key={c.id} contact={c} canManage={canManage} onEdit={() => setModalContact(c)} onChange={load} />
        ))}
      </div>

      {modalContact !== undefined && (
        <ContactFormModal
          contact={modalContact}
          onClose={() => setModalContact(undefined)}
          onSaved={() => {
            setModalContact(undefined);
            load();
          }}
        />
      )}
    </div>
  );
}
