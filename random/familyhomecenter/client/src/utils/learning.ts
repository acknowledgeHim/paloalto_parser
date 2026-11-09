import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

/** 📚 Learning: shared bits for Spelling (and the subjects that follow). */
export interface Tier {
  pct: number;
  tokens: number;
}
export interface SubjectRewards {
  tiers: Tier[];
  per_day: number;
}
export interface LearningSettings {
  rewards: Record<string, SubjectRewards>;
  grades: string[];
}
export interface LearningPerson {
  grade: number | null;
  is_parent: boolean;
  token_balance: number;
  subjects: Record<
    string,
    {
      best: Array<{ grade: number; correct: number; rounds: number }>;
      recent: Array<{ grade: number; at: string; correct: number; total: number; tokens: number }>;
      paid_today: number;
    }
  >;
}

export const GRADE_SHORT = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

export function useLearning(memberId: string | undefined) {
  const [settings, setSettings] = useState<LearningSettings | null>(null);
  const [person, setPerson] = useState<LearningPerson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = () => {
    api.get<LearningSettings>('/learning/settings').then(setSettings).catch((e) => setError((e as Error).message));
    if (memberId) api.get<LearningPerson>(`/learning/people/${memberId}`).then(setPerson).catch((e) => setError((e as Error).message));
    else setPerson(null);
  };
  useEffect(reload, [memberId]); // eslint-disable-line react-hooks/exhaustive-deps
  return { settings, person, error, reload };
}

/** "80% = 1 💎 · 100% = 2 💎" */
export const tiersText = (tiers: Tier[]) => tiers.filter((t) => t.tokens > 0).map((t) => `${t.pct}% = ${t.tokens} 💎`).join(' · ');

/** Why a round at this grade wouldn't pay (same rules as the server), or null. */
export function noTokensWhy(person: LearningPerson | null, rewards: SubjectRewards | undefined, grade: number, grades: string[]): string | null {
  if (!person) return 'Pick who you are up top to earn tokens';
  if (person.is_parent) return 'Parents practise just for fun';
  if (person.grade === null) return 'A parent needs to set your grade first (📚 Learning → ⚙️ Grades & tokens)';
  if (grade < person.grade) return `Below your grade (${grades[person.grade]}) — just for practice, no tokens`;
  if (!rewards || !rewards.per_day || !rewards.tiers.some((t) => t.tokens > 0)) return 'No tokens for this game right now';
  return null;
}
