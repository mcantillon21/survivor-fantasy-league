import { getSupabaseClient } from '@/lib/supabase';

export type GameStatus = 'setup' | 'live' | 'ended';

export interface Game {
  id: string;
  code: string;
  name: string;
  discord_guild_id: string | null;
  status: GameStatus;
  official_challenge_slug: string;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
}

export const GAME_CODE_PATTERN = /^[a-z0-9][a-z0-9-]{2,31}$/;

export function normalizeGameCode(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
}

export async function getGameByCode(code: string): Promise<Game | null> {
  const normalized = normalizeGameCode(code);
  if (!GAME_CODE_PATTERN.test(normalized)) return null;

  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('games')
    .select('id, code, name, discord_guild_id, status, official_challenge_slug, created_at, started_at, ended_at')
    .eq('code', normalized)
    .maybeSingle();

  if (error) {
    console.error('Failed to load game:', error.message);
    return null;
  }

  return data as Game | null;
}
