import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import {
  handleRegister,
  handleChallenge,
  handleResults,
  handleVote,
  handleTribal,
  handleStandings,
  handleNewSeason,
} from './commands.js';
import { handleMerge } from './merge-tribes.js';
import { triggerBotChat } from './bot-ai.js';
import { startBotLife } from './bot-life.js';

config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
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
  {
    name: 'newseason',
    description: 'Reset the game for a new season (host only)',
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
  // startBotLife(client);
  // console.log('✓ Bot life simulation started');
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
    } else if (commandName === 'newseason') {
      await handleNewSeason(interaction);
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
const CHAT_CHANNELS = [
  'tribe-red-camp', 'tribe-red-challenges', 'tribe-red-tribal',
  'tribe-blue-camp', 'tribe-blue-challenges', 'tribe-blue-tribal',
  'merged-camp', 'merged-challenges', 'merged-tribal',
];
let messageBuffer = [];
let chatCooldown = false;

import { profiles, getBotResponse } from './bot-ai.js';

const BOT_NAMES = profiles.map(p => p.name.toLowerCase());

function findTaggedBots(content) {
  const lower = content.toLowerCase();
  return profiles.filter(p => lower.includes(p.name.toLowerCase()));
}

client.on('messageCreate', async (message) => {
  // Ignore the main bot's own messages but allow webhook messages through
  if (message.author.id === client.user.id) return;
  if (!CHAT_CHANNELS.includes(message.channel.name)) return;

  // Check if this is a webhook bot message that tags another bot
  const isWebhook = message.webhookId != null;
  const taggedBots = findTaggedBots(message.content);

  const senderName = isWebhook ? message.author.username : message.author.username;
  messageBuffer.push(`${senderName}: ${message.content}`);
  if (messageBuffer.length > 10) messageBuffer.shift();

  // If specific bots were tagged, those bots respond first
  if (taggedBots.length > 0) {
    setTimeout(async () => {
      try {
        const webhooks = await message.channel.fetchWebhooks();
        let webhook = webhooks.find(w => w.name === 'Survivor Bot');
        if (!webhook) webhook = await message.channel.createWebhook({ name: 'Survivor Bot' });

        const recentChat = messageBuffer.join('\n');

        for (const bot of taggedBots) {
          const delay = 1000 + Math.random() * 2000;
          await new Promise(r => setTimeout(r, delay));

          const text = await getBotResponse(
            bot.id,
            message.channel.name,
            `${recentChat}\n\n[${senderName} is talking directly to YOU. Respond to them.]`
          );

          if (text) {
            await webhook.send({
              content: text,
              username: bot.name,
              avatarURL: bot.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(bot.name)}&background=random&size=128&bold=true`,
            });
            messageBuffer.push(`${bot.name}: ${text}`);
            if (messageBuffer.length > 10) messageBuffer.shift();
          }
        }

        // A few others might chime in too
        const numExtras = Math.floor(Math.random() * 3);
        if (numExtras > 0) {
          const extras = profiles
            .filter(p => !taggedBots.includes(p))
            .sort(() => Math.random() - 0.5)
            .slice(0, numExtras);

          for (const bot of extras) {
            const delay = 2000 + Math.random() * 3000;
            await new Promise(r => setTimeout(r, delay));

            const text = await getBotResponse(bot.id, message.channel.name, messageBuffer.join('\n'));
            if (text) {
              await webhook.send({
                content: text,
                username: bot.name,
                avatarURL: bot.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(bot.name)}&background=random&size=128&bold=true`,
              });
              messageBuffer.push(`${bot.name}: ${text}`);
              if (messageBuffer.length > 10) messageBuffer.shift();
            }
          }
        }
      } catch (error) {
        console.error('Tagged bot error:', error.message);
      }
    }, 1000 + Math.random() * 2000);
    return;
  }

  // Skip bot-to-bot messages unless tagged (prevent infinite loops)
  if (isWebhook) return;

  // Normal response: random bots chime in
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
