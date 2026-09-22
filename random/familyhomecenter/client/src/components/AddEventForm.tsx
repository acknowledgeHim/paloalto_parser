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
  const [startDate, setStartDate] = useState(event ? toDatePart(event.start_at) : new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(event ? toDatePart(event.end_at) : new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState(event ? toTimePart(event.start_at) : '09:00');
  const [endTime, setEndTime] = useState(event ? toTimePart(event.end_at) : '10:00');
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [location, setLocation] = useState(event?.location ?? '');
  const [forMemberId, setForMemberId] = useState(event?.for_member_id ?? '');
  const [error, setError] = useState<string | null>(null);

  // Keep the end date from ever landing before the start date as you pick a new start.
  const changeStartDate = (v: string) => {
    setStartDate(v);
    if (endDate < v) setEndDate(v);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const effectiveEndDate = endDate < startDate ? startDate : endDate;
    const start_at = allDay ? `${startDate}T00:00:00` : `${startDate}T${startTime}:00`;
    const end_at = allDay ? `${effectiveEndDate}T23:59:59` : `${effectiveEndDate}T${endTime}:00`;
    const body = {
      title: title.trim(),
      location: location || null,
      start_at,
      end_at,
      all_day: allDay,
      for_member_id: forMemberId || null,
    };
    setError(null);
    try {
      if (event) {
        await api.patch(`/calendar/local/${event.id}`, body);
      } else {
        await api.post('/calendar/local', { ...body, created_by_id: activeProfile?.id ?? null });
      }
      onCreated();
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Could not save this event');
    }
  };

  const remove = async () => {
    if (!event) return;
    setError(null);
    try {
      await api.delete(`/calendar/local/${event.id}`);
      onCreated();
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Could not delete this event');
    }
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
        <input type="date" value={startDate} onChange={(e) => changeStartDate(e.target.value)} />
        <span className="hint">to</span>
        <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
      </div>
      <label className="checkbox">
        <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> All day
      </label>
      {!allDay && (
        <div className="task-form__row">
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      )}
      {error && <div className="settings-login__error">{error}</div>}
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
