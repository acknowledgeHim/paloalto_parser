import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { distanceFromHomeMiles } from '../services/geocodeAddress.js';
import { sendContactText } from '../services/contactText.js';
import { isEmailConfigured } from '../services/email.js';
import type { Contact } from '../types.js';

// Viewing is open to everyone — a family's own contact book isn't something to hide. Adding,
// editing, or removing an entry is parent-only (requireAdmin — same "open until a password
// protects Settings-level actions" gate as the family roster/Prize Bank rewards): this is
// household reference data, not an everyday item any kid should be able to change.
export const contactsRouter = Router();

contactsRouter.get('/', (_req, res) => {
  const contacts = db.prepare('SELECT * FROM contacts ORDER BY full_name COLLATE NOCASE ASC').all() as Contact[];
  res.json(contacts);
});

contactsRouter.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { full_name, relationship, phone, email, address, carrier, created_by_id } = req.body as Partial<Contact> & {
      created_by_id?: string;
    };
    if (!full_name || !full_name.trim()) return res.status(400).json({ error: 'full_name is required' });

    const trimmedAddress = address?.trim() || null;
    const contact: Contact = {
      id: uuidv4(),
      full_name: full_name.trim(),
      relationship: relationship?.trim() || null,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      address: trimmedAddress,
      distance_miles: trimmedAddress ? await distanceFromHomeMiles(trimmedAddress) : null,
      carrier: carrier?.trim() || null,
      created_by_id: created_by_id ?? null,
      created_at: new Date().toISOString(),
    };
    db.prepare(
      `INSERT INTO contacts (id, full_name, relationship, phone, email, address, distance_miles, carrier, created_by_id, created_at)
       VALUES (@id, @full_name, @relationship, @phone, @email, @address, @distance_miles, @carrier, @created_by_id, @created_at)`
    ).run(contact);
    res.status(201).json(contact);
  })
);

/** PATCH /:id — re-geocodes only when the address actually changed, so editing the phone number
 *  or relationship doesn't re-hit Nominatim for no reason. */
contactsRouter.patch(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id) as Contact | undefined;
    if (!existing) return res.status(404).json({ error: 'not found' });

    const { full_name, relationship, phone, email, address, carrier } = req.body as Partial<Contact>;
    const nextAddress = address !== undefined ? address?.trim() || null : existing.address;
    const addressChanged = nextAddress !== existing.address;

    const updated: Contact = {
      ...existing,
      full_name: full_name !== undefined ? full_name.trim() || existing.full_name : existing.full_name,
      relationship: relationship !== undefined ? relationship?.trim() || null : existing.relationship,
      phone: phone !== undefined ? phone?.trim() || null : existing.phone,
      email: email !== undefined ? email?.trim() || null : existing.email,
      address: nextAddress,
      distance_miles: addressChanged ? null : existing.distance_miles,
      carrier: carrier !== undefined ? carrier?.trim() || null : existing.carrier,
    };
    if (addressChanged && nextAddress) {
      updated.distance_miles = await distanceFromHomeMiles(nextAddress);
    }
    db.prepare(
      `UPDATE contacts SET full_name=@full_name, relationship=@relationship, phone=@phone, email=@email,
       address=@address, distance_miles=@distance_miles, carrier=@carrier WHERE id=@id`
    ).run(updated);
    res.json(updated);
  })
);

contactsRouter.delete('/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

/**
 * POST /:id/text { message, created_by_id? } — texts this contact via their carrier's free
 * email-to-SMS gateway (contact.carrier + phone), for a desktop/kiosk browser where a plain sms:
 * link has no app to hand off to. Open to everyone, same as the tel:/sms: Call/Text links — this
 * is a viewing-adjacent everyday action, not an edit to the contact itself.
 */
contactsRouter.post(
  '/:id/text',
  asyncHandler(async (req, res) => {
    if (!isEmailConfigured()) {
      return res.status(400).json({ error: 'SMTP is not configured on the server — see docs/GROCERY_EMAIL_SETUP.md' });
    }
    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id) as Contact | undefined;
    if (!contact) return res.status(404).json({ error: 'not found' });
    if (!contact.phone) return res.status(400).json({ error: 'This contact has no phone number' });
    if (!contact.carrier) return res.status(400).json({ error: 'This contact has no carrier set — pick one from their edit form' });

    const { message } = req.body as { message?: string };
    if (!message || !message.trim()) return res.status(400).json({ error: 'message is required' });

    await sendContactText(contact.phone, contact.carrier, message.trim());
    res.status(204).end();
  })
);

/** POST /:id/refresh-distance — retries geocoding without editing the address itself (e.g. after
 *  a transient failure, or after the home location in Settings changed). Parent-gated along with
 *  everything else that touches a contact, even though it's not itself sensitive — keeps the rule
 *  simple (only viewing is open) rather than carving out one exception. */
contactsRouter.post(
  '/:id/refresh-distance',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id) as Contact | undefined;
    if (!existing) return res.status(404).json({ error: 'not found' });
    if (!existing.address) return res.status(400).json({ error: 'This contact has no address to look up' });

    const distance_miles = await distanceFromHomeMiles(existing.address);
    db.prepare('UPDATE contacts SET distance_miles = ? WHERE id = ?').run(distance_miles, existing.id);
    res.json({ ...existing, distance_miles });
  })
);
