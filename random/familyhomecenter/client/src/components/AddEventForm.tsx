import { useState, type FormEvent } from 'react';
import { api, type CalendarEvent } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';
import { ConfirmButton } from './ConfirmButton.js';

interface Props {
  /** When set, edits this existing local event instead of creating a new one. */
  event?: CalendarEvent | null;
  onCreated: () => void;
  onClose: () => void;
}

function toDatePart(iso: string): string {
  return iso.slice(0, 10);
}

function toTimePart(iso: string): string {
  return iso.slice(11, 16);
}

export function AddEventForm({ event, onCreated, onClose }: Props) {
  const { activeProfile, members } = useFamilyMembers();
  const [title, setTitle] = useState(event?.title ?? '');
  const [date, setDate] = useState(event ? toDatePart(event.start_at) : new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState(event ? toTimePart(event.start_at) : '09:00');
  const [endTime, setEndTime] = useState(event ? toTimePart(event.end_at) : '10:00');
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [location, setLocation] = useState(event?.location ?? '');
  const [forMemberId, setForMemberId] = useState(event?.for_member_id ?? '');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const start_at = allDay ? `${date}T00:00:00` : `${date}T${startTime}:00`;
    const end_at = allDay ? `${date}T23:59:59` : `${date}T${endTime}:00`;
    const body = {
      title: title.trim(),
      location: location || null,
      start_at,
      end_at,
      all_day: allDay,
      for_member_id: forMemberId || null,
    };
    if (event) {
      await api.patch(`/calendar/local/${event.id}`, body);
    } else {
      await api.post('/calendar/local', { ...body, created_by_id: activeProfile?.id ?? null });
    }
    onCreated();
    onClose();
  };

  const remove = async () => {
    if (!event) return;
    await api.delete(`/calendar/local/${event.id}`);
    onCreated();
    onClose();
  };

  return (
    <form className="event-form" onSubmit={submit}>
      <input autoFocus placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input placeholder="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} />
      <select value={forMemberId} onChange={(e) => setForMemberId(e.target.value)}>
        <option value="">Whole family</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>For {m.name}</option>
        ))}
      </select>
      <div className="task-form__row">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <label className="checkbox">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> All day
        </label>
      </div>
      {!allDay && (
        <div className="task-form__row">
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      )}
      <div className="task-form__row">
        <button type="submit">{event ? 'Save changes' : 'Add event'}</button>
        <button type="button" className="secondary" onClick={onClose}>Cancel</button>
        {event && (
          <ConfirmButton
            label="Delete"
            confirmLabel={`Delete "${event.title}"?`}
            className="secondary"
            onConfirm={remove}
          />
        )}
      </div>
    </form>
  );
}
