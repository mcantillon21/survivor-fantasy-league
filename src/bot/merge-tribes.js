import { ChannelType, PermissionFlagsBits } from 'discord.js';

export async function handleMerge(interaction) {
  const guild = interaction.guild;

  try {
    await interaction.deferReply();

    // Find tribe channels
    const tribeRed = guild.channels.cache.find(c => c.name === 'tribe-red');
    const tribeBlue = guild.channels.cache.find(c => c.name === 'tribe-blue');

    // Archive tribe channels (rename and lock)
    if (tribeRed) {
      await tribeRed.edit({
        name: 'tribe-red-archived',
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.SendMessages],
          },
        ],
      });
    }

    if (tribeBlue) {
      await tribeBlue.edit({
        name: 'tribe-blue-archived',
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.SendMessages],
          },
        ],
      });
    }

    // Find IN GAME category
    const inGameCat = guild.channels.cache.find(
      c => c.name === '🏝️ IN GAME' && c.type === ChannelType.GuildCategory
    );

    // Create merged tribe channel if it doesn't exist
    let mergedChannel = guild.channels.cache.find(c => c.name === 'merged-tribe');
    if (!mergedChannel && inGameCat) {
      mergedChannel = await guild.channels.create({
        name: 'merged-tribe',
        type: ChannelType.GuildText,
        parent: inGameCat.id,
        topic: 'The tribes have merged! Everyone is now one tribe.',
      });
    }

    await interaction.editReply(
      '🔥 **THE TRIBES HAVE MERGED!**\n\n' +
      'Individual tribe channels have been archived.\n' +
      'All remaining players are now one tribe.\n\n' +
      'Good luck in the individual game!'
    );

    // Post announcement in merged channel
    if (mergedChannel) {
      await mergedChannel.send(
        '🏝️ **MERGE TIME!**\n\n' +
        'The tribes are no more. You are now competing as individuals.\n\n' +
        'From here on out, it is every person for themselves.\n\n' +
        'The game has changed.'
      );
    }
  } catch (error) {
    console.error('Error merging tribes:', error);
    await interaction.editReply('Failed to merge tribes. Check bot permissions.');
  }
}
