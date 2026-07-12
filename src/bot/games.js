import { PermissionFlagsBits } from 'discord.js';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

export const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export function normalizeGameCode(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
}

export function userCanManageGame(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
}

export async function getCurrentGame(guildId, { includeEnded = false } = {}) {
  let query = supabase
    .from('games')
    .select('*')
    .eq('discord_guild_id', guildId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!includeEnded) query = query.in('status', ['setup', 'live']);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (data) return data;

  // Preserve the pre-migration season by letting the first Discord server claim it.
  const { data: legacy } = await supabase
    .from('games')
    .select('*')
    .eq('code', 'main')
    .is('discord_guild_id', null)
    .maybeSingle();

  if (!legacy) return null;
  const { data: claimed, error: claimError } = await supabase
    .from('games')
    .update({ discord_guild_id: guildId })
    .eq('id', legacy.id)
    .select('*')
    .single();
  if (claimError) throw claimError;
  return claimed;
}

export async function requireGame(interaction, { live = false, includeEnded = false } = {}) {
  const game = await getCurrentGame(interaction.guildId, { includeEnded });
  if (!game) {
    await interaction.reply({ content: 'No season exists for this server. A host can use `/newgame`.', ephemeral: true });
    return null;
  }
  if (live && game.status !== 'live') {
    await interaction.reply({ content: 'This season has not started. A host can use `/startgame`.', ephemeral: true });
    return null;
  }
  return game;
}
