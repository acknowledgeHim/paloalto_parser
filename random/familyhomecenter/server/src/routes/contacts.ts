import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { distanceFromHomeMiles } from '../services/geocodeAddress.js';
import type { Contact } from '../types.js';

// Open to everyone, same household-trust default as the rest of this app's everyday lists — a
// family's own contact book isn't something to gate behind a password.
export const contactsRouter = Router();

contactsRouter.get('/', (_req, res) => {
  const contacts = db.prepare('SELECT * FROM contacts ORDER BY full_name COLLATE NOCASE ASC').all() as Contact[];
  res.json(contacts);
});

contactsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { full_name, relationship, phone, email, address, created_by_id } = req.body as Partial<Contact> & {
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
      created_by_id: created_by_id ?? null,
      created_at: new Date().toISOString(),
    };
    db.prepare(
      `INSERT INTO contacts (id, full_name, relationship, phone, email, address, distance_miles, created_by_id, created_at)
       VALUES (@id, @full_name, @relationship, @phone, @email, @address, @distance_miles, @created_by_id, @created_at)`
    ).run(contact);
    res.status(201).json(contact);
  })
);

/** PATCH /:id — re-geocodes only when the address actually changed, so editing the phone number
 *  or relationship doesn't re-hit Nominatim for no reason. */
contactsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id) as Contact | undefined;
    if (!existing) return res.status(404).json({ error: 'not found' });

    const { full_name, relationship, phone, email, address } = req.body as Partial<Contact>;
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
    };
    if (addressChanged && nextAddress) {
      updated.distance_miles = await distanceFromHomeMiles(nextAddress);
    }
    db.prepare(
      `UPDATE contacts SET full_name=@full_name, relationship=@relationship, phone=@phone, email=@email,
       address=@address, distance_miles=@distance_miles WHERE id=@id`
    ).run(updated);
    res.json(updated);
  })
);

contactsRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

/** POST /:id/refresh-distance — retries geocoding without editing the address itself (e.g. after
 *  a transient failure, or after the home location in Settings changed). */
contactsRouter.post(
  '/:id/refresh-distance',
  asyncHandler(async (req, res) => {
    const existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id) as Contact | undefined;
    if (!existing) return res.status(404).json({ error: 'not found' });
    if (!existing.address) return res.status(400).json({ error: 'This contact has no address to look up' });

    const distance_miles = await distanceFromHomeMiles(existing.address);
    db.prepare('UPDATE contacts SET distance_miles = ? WHERE id = ?').run(distance_miles, existing.id);
    res.json({ ...existing, distance_miles });
  })
);
