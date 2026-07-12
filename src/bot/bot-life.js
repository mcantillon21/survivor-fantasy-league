import { getBotResponse, profiles } from './bot-ai.js';

let client = null;
let tribeRedCampChannel = null;
let tribeBlueCampChannel = null;

const GUILD_ID = '1525547231086645409';

export function startBotLife(discordClient) {
  client = discordClient;

  setTimeout(() => {
    findChannels();
    startTribeCampChatter();
    startTribeSchemes();
    startAllianceDMs();
  }, 10000);
}

function findChannels() {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  tribeRedCampChannel = guild.channels.cache.find(c => c.name === 'tribe-red-camp');
  tribeBlueCampChannel = guild.channels.cache.find(c => c.name === 'tribe-blue-camp');
}

function getBotsForTribe(tribe) {
  return profiles.filter(p => p.tribe === tribe);
}

async function getOrCreateWebhook(channel) {
  const webhooks = await channel.fetchWebhooks();
  let webhook = webhooks.find(w => w.name === 'Survivor Bot');
  if (!webhook) webhook = await channel.createWebhook({ name: 'Survivor Bot' });
  return webhook;
}

function startTribeCampChatter() {
  const chatInTribe = async (channel, tribe) => {
    if (!channel) { findChannels(); return; }

    try {
      const tribeBots = getBotsForTribe(tribe);
      const bot = tribeBots[Math.floor(Math.random() * tribeBots.length)];
      const topics = [
        'starting a casual conversation about camp life',
        'commenting on the weather or how tired you are',
        'speculating about who has alliances on your tribe',
        'talking about the last challenge',
        'making a joke or observation about the game',
        'bringing up strategy subtly',
        'complaining about something at camp',
        'hyping yourself up for the next challenge',
      ];
      const topic = topics[Math.floor(Math.random() * topics.length)];

      const text = await getBotResponse(
        bot.id,
        channel.name,
        `[You are ${topic}. Start a conversation naturally. Your tribemates are: ${tribeBots.map(b => b.name).join(', ')}. You do NOT know who is on the other tribe.]`
      );

      if (text) {
        const webhook = await getOrCreateWebhook(channel);
        await webhook.send({
          content: text,
          username: bot.name,
          avatarURL: bot.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(bot.name)}&background=random&size=128&bold=true`,
        });
      }
    } catch (error) {
      console.error('Tribe camp chatter error:', error.message);
    }
  };

  const loopRed = () => {
    chatInTribe(tribeRedCampChannel, 'red');
    setTimeout(loopRed, (180 + Math.random() * 300) * 1000);
  };

  const loopBlue = () => {
    chatInTribe(tribeBlueCampChannel, 'blue');
    setTimeout(loopBlue, (180 + Math.random() * 300) * 1000);
  };

  setTimeout(loopRed, (30 + Math.random() * 60) * 1000);
  setTimeout(loopBlue, (45 + Math.random() * 60) * 1000);
}

function startTribeSchemes() {
  const schemeInTribe = async (channel, tribe) => {
    if (!channel) { findChannels(); return; }

    try {
      const tribeBots = getBotsForTribe(tribe);
      const bot1 = tribeBots[Math.floor(Math.random() * tribeBots.length)];
      const bot2 = tribeBots.filter(b => b !== bot1)[Math.floor(Math.random() * (tribeBots.length - 1))];

      const schemes = [
        `proposing to ${bot2.name} that they vote someone specific out next`,
        `asking ${bot2.name} if they trust another tribe member`,
        `strategizing about who is the weakest player on this tribe`,
        `venting about someone on the tribe being annoying`,
        `trying to form a final 3 deal with ${bot2.name}`,
        `wondering if someone has a hidden immunity idol`,
      ];
      const scheme = schemes[Math.floor(Math.random() * schemes.length)];

      const text1 = await getBotResponse(
        bot1.id,
        channel.name,
        `[You are ${scheme}. Start the conversation. Your tribemates are: ${tribeBots.map(b => b.name).join(', ')}.]`
      );

      if (text1) {
        const webhook = await getOrCreateWebhook(channel);

        await webhook.send({
          content: text1,
          username: bot1.name,
          avatarURL: bot1.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(bot1.name)}&background=random&size=128&bold=true`,
        });

        await new Promise(r => setTimeout(r, 3000 + Math.random() * 5000));

        const text2 = await getBotResponse(
          bot2.id,
          channel.name,
          `${bot1.name}: ${text1}\n\n[Respond naturally to what ${bot1.name} just said. Your tribemates are: ${tribeBots.map(b => b.name).join(', ')}.]`
        );

        if (text2) {
          await webhook.send({
            content: text2,
            username: bot2.name,
            avatarURL: bot2.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(bot2.name)}&background=random&size=128&bold=true`,
          });
        }
      }
    } catch (error) {
      console.error('Tribe scheme error:', error.message);
    }
  };

  const loopRed = () => {
    schemeInTribe(tribeRedCampChannel, 'red');
    setTimeout(loopRed, (300 + Math.random() * 600) * 1000);
  };

  const loopBlue = () => {
    schemeInTribe(tribeBlueCampChannel, 'blue');
    setTimeout(loopBlue, (300 + Math.random() * 600) * 1000);
  };

  setTimeout(loopRed, (60 + Math.random() * 120) * 1000);
  setTimeout(loopBlue, (90 + Math.random() * 120) * 1000);
}

function startAllianceDMs() {
  const loop = async () => {
    try {
      const guild = client.guilds.cache.get(GUILD_ID);
      if (!guild) return;

      const members = await guild.members.fetch();
      const realPlayers = members.filter(m => !m.user.bot && m.id !== guild.ownerId);

      if (realPlayers.size === 0) return;

      const target = realPlayers.random();

      // Figure out which tribe this player is on via role
      const isRed = target.roles.cache.some(r => r.name === 'Tribe Red');
      const isBlue = target.roles.cache.some(r => r.name === 'Tribe Blue');
      const tribe = isRed ? 'red' : isBlue ? 'blue' : null;
      if (!tribe) return;

      // Only DM from a bot on the same tribe
      const tribeBots = getBotsForTribe(tribe);
      const bot = tribeBots[Math.floor(Math.random() * tribeBots.length)];

      const dmTopics = [
        `reaching out to ${target.user.username} to form a secret alliance`,
        `warning ${target.user.username} that someone is targeting them`,
        `asking ${target.user.username} who they are voting for tonight`,
        `proposing a final 2 deal to ${target.user.username}`,
        `telling ${target.user.username} you have info about who found an idol`,
        `checking in with ${target.user.username} about how they are feeling about the game`,
      ];
      const topic = dmTopics[Math.floor(Math.random() * dmTopics.length)];

      const text = await getBotResponse(
        bot.id,
        'dm',
        `[You are privately messaging ${target.user.username}. You are ${topic}. Be direct and strategic. You are on the same tribe.]`
      );

      if (text) {
        const dm = await target.createDM();
        await dm.send(`**${bot.name}:** ${text}`);
      }
    } catch (error) {
      if (!error.message.includes('Cannot send messages to this user')) {
        console.error('Alliance DM error:', error.message);
      }
    }

    const nextDelay = (600 + Math.random() * 1200) * 1000;
    setTimeout(loop, nextDelay);
  };

  const initialDelay = (120 + Math.random() * 180) * 1000;
  setTimeout(loop, initialDelay);
}
