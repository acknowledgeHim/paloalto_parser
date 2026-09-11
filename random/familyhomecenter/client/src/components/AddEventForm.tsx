import { useState, type FormEvent } from 'react';
import { api } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';

interface Props {
  onCreated: () => void;
  onClose: () => void;
}

export function AddEventForm({ onCreated, onClose }: Props) {
  const { activeProfile } = useFamilyMembers();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const start_at = allDay ? `${date}T00:00:00` : `${date}T${startTime}:00`;
    const end_at = allDay ? `${date}T23:59:59` : `${date}T${endTime}:00`;
    await api.post('/calendar/local', {
      title: title.trim(),
      location: location || null,
      start_at,
      end_at,
      all_day: allDay,
      created_by_id: activeProfile?.id ?? null,
    });
    onCreated();
    onClose();
  };

  return (
    <form className="event-form" onSubmit={submit}>
      <input autoFocus placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input placeholder="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} />
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
        <button type="submit">Add event</button>
        <button type="button" className="secondary" onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}
