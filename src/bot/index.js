import { Client, GatewayIntentBits, REST, Routes, MessageFlags } from 'discord.js';
import { config } from 'dotenv';
import {
  handleRegister,
  handleStart,
  handleChallenge,
  handleResults,
  handleVote,
  handleTribal,
  handleStandings,
} from './commands.js';

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
    name: 'start',
    description: '(Host) Assign tribes and begin the game',
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
    } else if (commandName === 'start') {
      await handleStart(interaction);
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
    }
  } catch (error) {
    console.error(`Error handling ${commandName}:`, error);
    // Never let a failed error-reply crash the process. If the interaction was
    // already acknowledged (e.g. deferred, or a duplicate instance answered it),
    // fall back to followUp, and swallow any further failure.
    try {
      const payload = {
        content: 'Something went wrong. Try again.',
        flags: MessageFlags.Ephemeral,
      };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    } catch (replyError) {
      console.error('Could not deliver error message:', replyError.code || replyError);
    }
  }
});

// Last-resort guards so a stray rejection/exception can't take the bot down.
client.on('error', (err) => console.error('Client error:', err));
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));

client.login(process.env.DISCORD_TOKEN);
