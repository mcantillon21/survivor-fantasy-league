import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from 'discord.js';
import { config } from 'dotenv';
config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

const GUILD_ID = '1525547231086645409';

client.once('ready', async () => {
  console.log('✓ Bot connected');

  const guild = await client.guilds.fetch(GUILD_ID);
  console.log(`✓ Found guild: ${guild.name}`);

  // Create roles first
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

  // GAME INFO category
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
        {
          id: guild.id,
          deny: [PermissionFlagsBits.SendMessages],
        },
        {
          id: hostRole.id,
          allow: [PermissionFlagsBits.SendMessages],
        },
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
        {
          id: guild.id,
          deny: [PermissionFlagsBits.SendMessages],
        },
        {
          id: hostRole.id,
          allow: [PermissionFlagsBits.SendMessages],
        },
      ],
    });
    console.log('  ✓ Created #standings (read-only)');
  }

  // IN GAME category
  let inGameCat = guild.channels.cache.find(c => c.name === '🏝️ IN GAME' && c.type === ChannelType.GuildCategory);
  if (!inGameCat) {
    inGameCat = await guild.channels.create({
      name: '🏝️ IN GAME',
      type: ChannelType.GuildCategory,
    });
    console.log('✓ Created category: 🏝️ IN GAME');
  }

  if (!guild.channels.cache.find(c => c.name === 'camp')) {
    await guild.channels.create({
      name: 'camp',
      type: ChannelType.GuildText,
      parent: inGameCat.id,
      topic: 'General chat - form alliances, plan strategy',
    });
    console.log('  ✓ Created #camp');
  }

  if (!guild.channels.cache.find(c => c.name === 'challenge-lobby')) {
    await guild.channels.create({
      name: 'challenge-lobby',
      type: ChannelType.GuildText,
      parent: inGameCat.id,
      topic: 'Pre-challenge discussion and challenge links',
    });
    console.log('  ✓ Created #challenge-lobby');
  }

  if (!guild.channels.cache.find(c => c.name === 'tribal-council')) {
    await guild.channels.create({
      name: 'tribal-council',
      type: ChannelType.GuildText,
      parent: inGameCat.id,
      topic: 'Vote players out here using /vote @player',
    });
    console.log('  ✓ Created #tribal-council');
  }

  // TRIBES category
  let tribesCat = guild.channels.cache.find(c => c.name === '👥 TRIBES' && c.type === ChannelType.GuildCategory);
  if (!tribesCat) {
    tribesCat = await guild.channels.create({
      name: '👥 TRIBES',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
      ],
    });
    console.log('✓ Created category: 👥 TRIBES');
  }

  if (!guild.channels.cache.find(c => c.name === 'tribe-red')) {
    await guild.channels.create({
      name: 'tribe-red',
      type: ChannelType.GuildText,
      parent: tribesCat.id,
      topic: 'Red tribe private channel',
    });
    console.log('  ✓ Created #tribe-red (hidden)');
  }

  if (!guild.channels.cache.find(c => c.name === 'tribe-blue')) {
    await guild.channels.create({
      name: 'tribe-blue',
      type: ChannelType.GuildText,
      parent: tribesCat.id,
      topic: 'Blue tribe private channel',
    });
    console.log('  ✓ Created #tribe-blue (hidden)');
  }

  // SPECTATORS category
  let spectatorsCat = guild.channels.cache.find(c => c.name === '👻 SPECTATORS' && c.type === ChannelType.GuildCategory);
  if (!spectatorsCat) {
    spectatorsCat = await guild.channels.create({
      name: '👻 SPECTATORS',
      type: ChannelType.GuildCategory,
    });
    console.log('✓ Created category: 👻 SPECTATORS');
  }

  if (!guild.channels.cache.find(c => c.name === 'jury')) {
    await guild.channels.create({
      name: 'jury',
      type: ChannelType.GuildText,
      parent: spectatorsCat.id,
      topic: 'Eliminated players - discuss and vote for winner',
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: juryRole.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        },
        {
          id: hostRole.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        },
      ],
    });
    console.log('  ✓ Created #jury (jury members only)');
  }

  if (!guild.channels.cache.find(c => c.name === 'eliminated-chat')) {
    await guild.channels.create({
      name: 'eliminated-chat',
      type: ChannelType.GuildText,
      parent: spectatorsCat.id,
      topic: 'Watch and discuss',
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: juryRole.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        },
        {
          id: spectatorRole.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        },
      ],
    });
    console.log('  ✓ Created #eliminated-chat');
  }

  console.log('\n✅ Discord server setup complete!');
  console.log('\nNext steps:');
  console.log('1. Assign yourself the @Host role');
  console.log('2. Pin registration instructions in #announcements');
  console.log('3. Players use /register to join');

  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
