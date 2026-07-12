import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from 'discord.js';
import { config } from 'dotenv';
config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

const GUILD_ID = '1525547231086645409';

client.once('ready', async () => {
  console.log('✓ Bot connected');

  const guild = await client.guilds.fetch(GUILD_ID);
  console.log(`✓ Found guild: ${guild.name}`);

  // Create roles
  console.log('\nCreating roles...');

  let hostRole = guild.roles.cache.find(r => r.name === 'Host');
  if (!hostRole) {
    hostRole = await guild.roles.create({
      name: 'Host',
      color: 0xFFA500,
      permissions: [PermissionFlagsBits.Administrator],
    });
    console.log('✓ Created @Host role');
  }

  let playerRole = guild.roles.cache.find(r => r.name === 'Player');
  if (!playerRole) {
    playerRole = await guild.roles.create({
      name: 'Player',
      color: 0x00FF00,
    });
    console.log('✓ Created @Player role');
  }

  let tribeRedRole = guild.roles.cache.find(r => r.name === 'Tribe Red');
  if (!tribeRedRole) {
    tribeRedRole = await guild.roles.create({
      name: 'Tribe Red',
      color: 0xE74C3C,
      hoist: true,
    });
    console.log('✓ Created @Tribe Red role');
  }

  let tribeBlueRole = guild.roles.cache.find(r => r.name === 'Tribe Blue');
  if (!tribeBlueRole) {
    tribeBlueRole = await guild.roles.create({
      name: 'Tribe Blue',
      color: 0x3498DB,
      hoist: true,
    });
    console.log('✓ Created @Tribe Blue role');
  }

  let juryRole = guild.roles.cache.find(r => r.name === 'Jury');
  if (!juryRole) {
    juryRole = await guild.roles.create({
      name: 'Jury',
      color: 0x808080,
    });
    console.log('✓ Created @Jury role');
  }

  let spectatorRole = guild.roles.cache.find(r => r.name === 'Spectator');
  if (!spectatorRole) {
    spectatorRole = await guild.roles.create({
      name: 'Spectator',
      color: 0x888888,
    });
    console.log('✓ Created @Spectator role');
  }

  // Create categories and channels
  console.log('\nCreating channels...');

  // GAME INFO category - visible to all
  let gameInfoCat = guild.channels.cache.find(c => c.name === '📢 GAME INFO' && c.type === ChannelType.GuildCategory);
  if (!gameInfoCat) {
    gameInfoCat = await guild.channels.create({
      name: '📢 GAME INFO',
      type: ChannelType.GuildCategory,
    });
    console.log('✓ Created category: 📢 GAME INFO');
  }

  if (!guild.channels.cache.find(c => c.name === 'announcements')) {
    await guild.channels.create({
      name: 'announcements',
      type: ChannelType.GuildText,
      parent: gameInfoCat.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.SendMessages] },
        { id: hostRole.id, allow: [PermissionFlagsBits.SendMessages] },
      ],
    });
    console.log('  ✓ Created #announcements (read-only)');
  }

  if (!guild.channels.cache.find(c => c.name === 'standings')) {
    await guild.channels.create({
      name: 'standings',
      type: ChannelType.GuildText,
      parent: gameInfoCat.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.SendMessages] },
        { id: hostRole.id, allow: [PermissionFlagsBits.SendMessages] },
      ],
    });
    console.log('  ✓ Created #standings (read-only)');
  }

  // TRIBE RED category - ONLY visible to Tribe Red
  let tribeRedCat = guild.channels.cache.find(c => c.name === '🔴 TRIBE RED' && c.type === ChannelType.GuildCategory);
  if (!tribeRedCat) {
    tribeRedCat = await guild.channels.create({
      name: '🔴 TRIBE RED',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: tribeRedRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: hostRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ],
    });
    console.log('✓ Created category: 🔴 TRIBE RED (isolated)');
  }

  const redChannels = ['tribe-red-camp', 'tribe-red-challenges', 'tribe-red-tribal'];
  for (const name of redChannels) {
    if (!guild.channels.cache.find(c => c.name === name)) {
      await guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: tribeRedCat.id,
      });
      console.log(`  ✓ Created #${name}`);
    }
  }

  // TRIBE BLUE category - ONLY visible to Tribe Blue
  let tribeBlueCat = guild.channels.cache.find(c => c.name === '🔵 TRIBE BLUE' && c.type === ChannelType.GuildCategory);
  if (!tribeBlueCat) {
    tribeBlueCat = await guild.channels.create({
      name: '🔵 TRIBE BLUE',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: tribeBlueRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: hostRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ],
    });
    console.log('✓ Created category: 🔵 TRIBE BLUE (isolated)');
  }

  const blueChannels = ['tribe-blue-camp', 'tribe-blue-challenges', 'tribe-blue-tribal'];
  for (const name of blueChannels) {
    if (!guild.channels.cache.find(c => c.name === name)) {
      await guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: tribeBlueCat.id,
      });
      console.log(`  ✓ Created #${name}`);
    }
  }

  // POST-MERGE category - hidden until merge
  let mergeCat = guild.channels.cache.find(c => c.name === '🏝️ MERGED TRIBE' && c.type === ChannelType.GuildCategory);
  if (!mergeCat) {
    mergeCat = await guild.channels.create({
      name: '🏝️ MERGED TRIBE',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: hostRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ],
    });
    console.log('✓ Created category: 🏝️ MERGED TRIBE (hidden until merge)');
  }

  const mergeChannels = ['merged-camp', 'merged-challenges', 'merged-tribal'];
  for (const name of mergeChannels) {
    if (!guild.channels.cache.find(c => c.name === name)) {
      await guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: mergeCat.id,
      });
      console.log(`  ✓ Created #${name}`);
    }
  }

  // SPECTATORS category
  let spectatorsCat = guild.channels.cache.find(c => c.name === '👻 SPECTATORS' && c.type === ChannelType.GuildCategory);
  if (!spectatorsCat) {
    spectatorsCat = await guild.channels.create({
      name: '👻 SPECTATORS',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: juryRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: spectatorRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: hostRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ],
    });
    console.log('✓ Created category: 👻 SPECTATORS');
  }

  if (!guild.channels.cache.find(c => c.name === 'jury')) {
    await guild.channels.create({
      name: 'jury',
      type: ChannelType.GuildText,
      parent: spectatorsCat.id,
      topic: 'Eliminated players discuss and vote for winner',
    });
    console.log('  ✓ Created #jury');
  }

  if (!guild.channels.cache.find(c => c.name === 'eliminated-chat')) {
    await guild.channels.create({
      name: 'eliminated-chat',
      type: ChannelType.GuildText,
      parent: spectatorsCat.id,
      topic: 'Watch and discuss the game',
    });
    console.log('  ✓ Created #eliminated-chat');
  }

  console.log('\n✅ Discord server setup complete!');
  console.log('\n🔒 TRIBE ISOLATION ENFORCED:');
  console.log('   • Tribe Red can ONLY see 🔴 TRIBE RED channels');
  console.log('   • Tribe Blue can ONLY see 🔵 TRIBE BLUE channels');
  console.log('   • Neither tribe can see the other\'s members in the sidebar');
  console.log('   • Merged channels hidden until /merge is called');
  console.log('\nNext steps:');
  console.log('1. Assign yourself the @Host role');
  console.log('2. Assign players to @Tribe Red or @Tribe Blue');
  console.log('3. Players cannot see or contact the other tribe');
  console.log('4. Use /merge when ready to reveal everyone');

  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
