import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import {
  handleRegister,
  handleChallenge,
  handleResults,
  handleVote,
  handleTribal,
  handleStandings,
} from './commands.js';
import { handleMerge } from './merge-tribes.js';
import { triggerBotChat } from './bot-ai.js';
import { startBotLife } from './bot-life.js';

config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const commands = [
  {
    name: 'register',
    description: 'Join the Survivor game',
  },
  {
    name: 'challenge',
    description: 'Post the immunity challenge link',
  },
  {
    name: 'results',
    description: 'Show challenge results and grant immunity',
  },
  {
    name: 'vote',
    description: 'Vote someone out at Tribal Council',
    options: [
      {
        name: 'player',
        type: 6,
        description: 'Who are you voting for?',
        required: true,
      },
    ],
  },
  {
    name: 'tribal',
    description: 'Reveal votes and eliminate a player',
  },
  {
    name: 'standings',
    description: 'View current game standings',
  },
  {
    name: 'merge',
    description: 'Merge the tribes (host only)',
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
  startBotLife(client);
  console.log('✓ Bot life simulation started');
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    if (commandName === 'register') {
      await handleRegister(interaction);
    } else if (commandName === 'challenge') {
      await handleChallenge(interaction);
    } else if (commandName === 'results') {
      await handleResults(interaction);
    } else if (commandName === 'vote') {
      await handleVote(interaction);
    } else if (commandName === 'tribal') {
      await handleTribal(interaction);
    } else if (commandName === 'standings') {
      await handleStandings(interaction);
    } else if (commandName === 'merge') {
      await handleMerge(interaction);
    }
  } catch (error) {
    console.error(`Error handling ${commandName}:`, error);
    await interaction.reply({
      content: 'Something went wrong. Try again.',
      ephemeral: true,
    });
  }
});

// Bot players respond to messages in game channels
const CHAT_CHANNELS = ['camp', 'challenge-lobby', 'tribal-council', 'merged-tribe'];
let messageBuffer = [];
let chatCooldown = false;

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!CHAT_CHANNELS.includes(message.channel.name)) return;

  messageBuffer.push(`${message.author.username}: ${message.content}`);

  if (messageBuffer.length > 10) messageBuffer.shift();

  if (chatCooldown) return;
  chatCooldown = true;

  setTimeout(async () => {
    try {
      const recentChat = messageBuffer.join('\n');
      const numBots = 1 + Math.floor(Math.random() * 8);
      await triggerBotChat(message.channel, recentChat, numBots);
    } catch (error) {
      console.error('Bot chat error:', error.message);
    }
    chatCooldown = false;
  }, 2000 + Math.random() * 3000);
});

client.login(process.env.DISCORD_TOKEN);
