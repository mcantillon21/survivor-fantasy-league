import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { getCurrentGame, supabase, userCanManageGame } from './games.js';

export async function handleMerge(interaction) {
  const guild = interaction.guild;

  try {
    if (!userCanManageGame(interaction)) {
      await interaction.reply({ content: 'Only a server manager can merge tribes.', ephemeral: true });
      return;
    }
    const game = await getCurrentGame(interaction.guildId);
    if (!game || game.status !== 'live') {
      await interaction.reply({ content: 'No live season exists for this server.', ephemeral: true });
      return;
    }
    await interaction.deferReply();

    const tribeRedRole = guild.roles.cache.find(r => r.name === 'Tribe Red');
    const tribeBlueRole = guild.roles.cache.find(r => r.name === 'Tribe Blue');

    // Lock tribe categories (read-only archive)
    const tribeRedCat = guild.channels.cache.find(c => c.name === '🔴 TRIBE RED' && c.type === ChannelType.GuildCategory);
    const tribeBlueCat = guild.channels.cache.find(c => c.name === '🔵 TRIBE BLUE' && c.type === ChannelType.GuildCategory);

    if (tribeRedCat) {
      await tribeRedCat.edit({
        name: '🔴 TRIBE RED (ARCHIVED)',
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: tribeRedRole.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
        ],
      });
      for (const [, ch] of tribeRedCat.children.cache) {
        await ch.permissionOverwrites.edit(tribeRedRole.id, { SendMessages: false });
      }
    }

    if (tribeBlueCat) {
      await tribeBlueCat.edit({
        name: '🔵 TRIBE BLUE (ARCHIVED)',
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: tribeBlueRole.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
        ],
      });
      for (const [, ch] of tribeBlueCat.children.cache) {
        await ch.permissionOverwrites.edit(tribeBlueRole.id, { SendMessages: false });
      }
    }

    // Unlock merged tribe category for both tribes
    const mergeCat = guild.channels.cache.find(c => c.name === '🏝️ MERGED TRIBE' && c.type === ChannelType.GuildCategory);
    if (mergeCat) {
      await mergeCat.edit({
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: tribeRedRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: tribeBlueRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        ],
      });
      // Sync child channels
      for (const [, ch] of mergeCat.children.cache) {
        await ch.lockPermissions();
      }
    }

    // Post merge announcement in merged-camp
    const mergedCamp = guild.channels.cache.find(c => c.name === 'merged-camp');
    if (mergedCamp) {
      await mergedCamp.send(
        '🔥 **THE TRIBES HAVE MERGED!**\n\n' +
        'You are now seeing each other for the first time.\n' +
        'From here on out, it is every player for themselves.\n\n' +
        'Old tribe channels are archived. All game activity happens here now.\n\n' +
        '**The individual game begins.**'
      );
    }

    const { error: stateError } = await supabase
      .from('game_state')
      .update({ phase: 'merged', updated_at: new Date().toISOString() })
      .eq('game_id', game.id);
    if (stateError) throw stateError;

    await interaction.editReply(
      '🔥 **THE TRIBES HAVE MERGED!**\n\n' +
      '• Tribe channels archived (read-only)\n' +
      '• Merged channels unlocked for all players\n' +
      '• Both tribes can now see and message each other\n\n' +
      'The game has changed.'
    );
  } catch (error) {
    console.error('Error merging tribes:', error);
    await interaction.editReply('Failed to merge tribes. Check bot permissions.');
  }
}
