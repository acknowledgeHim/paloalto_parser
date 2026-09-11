const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${resp.status}`);
  }
  if (resp.status === 204) return undefined as T;
  return resp.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export interface FamilyMember {
  id: string;
  name: string;
  color: string;
  avatar: string | null;
  is_parent: 0 | 1;
}

export interface TaskCompletion {
  id: string;
  task_id: string;
  completed_on: string;
  completed_by_id: string | null;
  completed_at: string;
}

export interface Task {
  id: string;
  kind: 'chore' | 'todo';
  title: string;
  notes: string | null;
  assignee_id: string | null;
  created_by_id: string | null;
  recurrence: string;
  due_date: string | null;
  active: 0 | 1;
  completion: TaskCompletion | null;
}

export interface CalendarEvent {
  id: string;
  source: 'local' | 'google' | 'apple';
  title: string;
  description?: string | null;
  location?: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  color: string;
}

export interface WeatherData {
  location: string;
  current: { temperature: number; humidity: number; windSpeed: number; code: number; description: string };
  daily: Array<{ date: string; code: number; description: string; high: number; low: number; precipChance: number | null }>;
}
