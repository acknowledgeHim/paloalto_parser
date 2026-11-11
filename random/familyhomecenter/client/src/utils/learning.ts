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
  /** 🎯 times each topic pays per 🔁 lap (1 = once) */
  topic_pay_times?: number;
}
/** 🎯 Where a kid is in their topic lap: their grade's topics, and how many have paid this lap. */
export interface TopicLap {
  number: number;
  started_at: string | null;
  grade: number;
  total: number;
  paid: number;
}
/** 🎯 One topic they've practised at one grade. */
export interface TopicStat {
  grade: number;
  topic: string;
  rounds: number;
  best: number;
  total: number;
  last_at: string;
  /** times it paid this lap, how many it can, and whether that's used up */
  paid_lap: number;
  pay_times: number;
  paid_out: boolean;
  tokens: number;
}
/** 🎁 Parent-set: extra tokens once a day for maxing out every picked subject's paying rounds. */
export interface LearningBonus {
  tokens: number;
  subjects: string[];
}
export interface LearningSettings {
  rewards: Record<string, SubjectRewards>;
  grades: string[];
  bonus: LearningBonus;
}
/** Someone's bonus today: the subjects that count (and which are maxed), and what was paid (null = not yet). */
export interface BonusStatus {
  tokens: number;
  subjects: Array<{ subject: string; name: string; done: boolean }>;
  paid_today: number | null;
}
export interface LearningPerson {
  grade: number | null;
  is_parent: boolean;
  token_balance: number;
  subjects: Record<
    string,
    {
      best: Array<{ grade: number; correct: number; rounds: number }>;
      recent: Array<{ grade: number; at: string; correct: number; total: number; tokens: number; topic?: string | null }>;
      paid_today: number;
      /** 🎯 subjects with topics (math) */
      topic_lap?: TopicLap | null;
      topics?: TopicStat[];
    }
  >;
  bonus?: BonusStatus;
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
