import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Commands registration
const commands = [
  {
    name: 'register',
    description: 'Join the Survivor game',
  },
  {
    name: 'challenge',
    description: 'Start the current immunity challenge',
  },
  {
    name: 'vote',
    description: 'Vote someone out at Tribal Council',
    options: [
      {
        name: 'player',
        type: 6, // USER type
        description: 'Who are you voting for?',
        required: true,
      },
    ],
  },
  {
    name: 'standings',
    description: 'View current game standings',
  },
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Register slash commands
async function registerCommands() {
  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands }
    );
    console.log('✓ Slash commands registered');
  } catch (error) {
    console.error('Failed to register commands:', error);
  }
}

client.once('ready', () => {
  console.log(`✓ Bot online as ${client.user.tag}`);
  registerCommands();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    if (commandName === 'register') {
      await handleRegister(interaction);
    } else if (commandName === 'challenge') {
      await handleChallenge(interaction);
    } else if (commandName === 'vote') {
      await handleVote(interaction);
    } else if (commandName === 'standings') {
      await handleStandings(interaction);
    }
  } catch (error) {
    console.error(`Error handling ${commandName}:`, error);
    await interaction.reply({
      content: 'Something went wrong. Try again.',
      ephemeral: true,
    });
  }
});

async function handleRegister(interaction) {
  const userId = interaction.user.id;
  const username = interaction.user.username;

  // Check if already registered
  const { data: existing } = await supabase
    .from('players')
    .select('*')
    .eq('discord_id', userId)
    .single();

  if (existing) {
    await interaction.reply({
      content: 'You're already in the game.',
      ephemeral: true,
    });
    return;
  }

  // Register player
  const { error } = await supabase.from('players').insert({
    discord_id: userId,
    username: username,
    tribe: null,
    is_eliminated: false,
    has_immunity: false,
  });

  if (error) throw error;

  await interaction.reply({
    content: `Welcome to the game, ${username}. The tribe will see you soon.`,
    ephemeral: true,
  });
}

async function handleChallenge(interaction) {
  await interaction.reply({
    content: '🔥 **IMMUNITY CHALLENGE**\n\nHead to the challenge arena:\nhttps://survivor-fantasy.vercel.app/challenge\n\nYou have 10 minutes. Winners are safe at Tribal Council.',
  });
}

async function handleVote(interaction) {
  const voter = interaction.user.id;
  const target = interaction.options.getUser('player');

  // Check if voter is in the game
  const { data: voterData } = await supabase
    .from('players')
    .select('*')
    .eq('discord_id', voter)
    .single();

  if (!voterData || voterData.is_eliminated) {
    await interaction.reply({
      content: 'You're not in the game or already eliminated.',
      ephemeral: true,
    });
    return;
  }

  // Check if target is valid
  const { data: targetData } = await supabase
    .from('players')
    .select('*')
    .eq('discord_id', target.id)
    .single();

  if (!targetData || targetData.is_eliminated) {
    await interaction.reply({
      content: 'That player is not in the game.',
      ephemeral: true,
    });
    return;
  }

  if (targetData.has_immunity) {
    await interaction.reply({
      content: `${target.username} has immunity. You cannot vote for them.`,
      ephemeral: true,
    });
    return;
  }

  // Record vote
  const { error } = await supabase.from('votes').insert({
    voter_id: voter,
    target_id: target.id,
    tribal_council_id: 1, // TODO: track which tribal council
  });

  if (error) throw error;

  await interaction.reply({
    content: `Your vote for ${target.username} has been cast.`,
    ephemeral: true,
  });
}

async function handleStandings(interaction) {
  const { data: players } = await supabase
    .from('players')
    .select('*')
    .order('created_at', { ascending: true });

  if (!players || players.length === 0) {
    await interaction.reply('No players registered yet.');
    return;
  }

  const alive = players.filter((p) => !p.is_eliminated);
  const eliminated = players.filter((p) => p.is_eliminated);

  let message = '**🌴 SURVIVOR STANDINGS**\n\n';
  message += `**Still in the game (${alive.length}):**\n`;
  alive.forEach((p) => {
    const immunity = p.has_immunity ? ' 🛡️' : '';
    message += `• ${p.username}${immunity}\n`;
  });

  if (eliminated.length > 0) {
    message += `\n**Eliminated (${eliminated.length}):**\n`;
    eliminated.forEach((p) => {
      message += `• ${p.username}\n`;
    });
  }

  await interaction.reply(message);
}

client.login(process.env.DISCORD_TOKEN);
