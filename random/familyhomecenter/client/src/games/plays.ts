import { api } from '../api/client.js';

/**
 * 🎟️ A game is starting: uses up one of the plays a parent gave (nothing if the game is theirs).
 * Returns the plays left (null = theirs, no limit), or throws "No plays left…".
 */
export async function startPlay(gameId: string, memberId: string): Promise<number | null> {
  const r = await api.post<{ ok: boolean; plays_left: number | null }>(`/games/${gameId}/play/${memberId}/start`, { acting_member_id: memberId });
  return r.plays_left;
}
