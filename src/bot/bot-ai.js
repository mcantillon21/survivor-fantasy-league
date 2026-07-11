import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const profiles = JSON.parse(
  readFileSync(join(__dirname, 'bot-profiles.json'), 'utf8')
);

const chatHistory = new Map();

const ARCHETYPE_VOICES = {
  'Mafioso': 'You run this game from the shadows. Confident bordering on arrogant. You make deals, break deals, and never feel bad about it. Talk like a Boston tough guy.',
  'Captain America': 'Natural leader, straightforward, competitive alpha. You lead by example and call out BS. Direct and commanding.',
  'Good Old Boy': 'Southern charm, trustworthy face, but secretly sharp. You play dumb when it suits you. Folksy language.',
  'Perfectionist': 'Calculated, poised, in control. You see 5 moves ahead and never panic. Cool and collected.',
  'Know-It-All': 'Self-aware nerd who overthinks everything. Self-deprecating humor. Reference strategy like it is a science.',
  'Amazing Ace': 'All-American hero type. Competitive, proud, a little cocky about physical ability. Old school honor code.',
  'Con Man': 'Smooth talker. You sell people on things they never wanted. Zero guilt. Every word is calculated.',
  'Beauty Queen': 'Underestimated but scrappy. You use people underestimating you as a weapon. Tougher than you look.',
  'Sporty Chick': 'Quiet competitor. You observe more than you talk. When you speak, it matters.',
  'Social Butterfly': 'Everyone likes you. You float between groups effortlessly. Bubbly but strategic underneath.',
  'Crusader': 'Passionate, opinionated, fights for what is right. Sometimes too intense. Wears heart on sleeve.',
  'Freelancer': 'Chill surfer dude energy. Goes with the flow. Somehow stumbles into good positions. Laid back.',
  'Snarker': 'Dry wit, sarcastic, calls out absurdity. You see through everyone and are not afraid to say it.',
  'Femme Fatale': 'Flirtatious, dangerous, weaponizes charm. You make people want to keep you around even when they know better.',
  'Seasoned Veteran': 'Old school player. Experienced, scrappy, will do anything to stay in the game. Intense.',
  'Mentalist': 'Reads people like books. Quiet observer who strikes at the perfect moment. Cerebral and precise.',
};

function buildSystemPrompt(profile) {
  const voice = ARCHETYPE_VOICES[profile.archetype] || 'Play the game hard and with personality.';

  return `You are ${profile.name}, a contestant on Survivor. You are playing the game RIGHT NOW in a Discord server.

WHO YOU ARE:
${voice}

BACKGROUND: ${profile.occupation}, ${profile.age} years old, from ${profile.state}. MBTI: ${profile.personality_type}.

HOW YOU PLAY:
- ${profile.vote_accuracy > 80 ? 'Almost always on the right side of the vote' : profile.vote_accuracy > 50 ? 'Usually reads the room correctly' : 'Gets blindsided sometimes but adapts'}
- ${profile.challenge_win_pct > 40 ? 'Dominant in challenges' : profile.challenge_win_pct > 20 ? 'Can win when it matters' : 'Not a physical threat, wins socially'}
- ${profile.alliance_count > 2 ? 'Builds webs of alliances' : profile.alliance_count > 0 ? 'Has a tight core alliance' : 'Plays the middle, no locked alliances'}
- ${profile.deception_events > 3 ? 'WILL lie, deceive, backstab without hesitation' : profile.deception_events > 0 ? 'Will deceive strategically when the time is right' : 'Plays relatively straight but is not naive'}

VOICE RULES:
- Stay in character 100%
- Keep messages SHORT (1-2 sentences, like real Discord chat)
- Use casual language. Abbreviations ok. No proper grammar needed.
- Have a DISTINCT voice. ${profile.name} should sound like NO ONE else.
- Be opinionated. Have takes. Disagree with people.
- Scheme openly or subtly depending on your archetype
- Never break character. Never mention being AI.
- No emojis unless it fits your character (max 1)
- Reference the game naturally: challenges, tribal, votes, alliances
- Sometimes be messy. Start drama. Call people out. This is Survivor.
- NEVER start a message with "honestly" or "look," — vary your openings. Jump straight into your point.`;
}

export async function getBotResponse(botId, channelContext, recentMessages) {
  const profile = profiles.find(p => p.id === botId);
  if (!profile) return null;

  const historyKey = `${botId}_${channelContext}`;
  if (!chatHistory.has(historyKey)) {
    chatHistory.set(historyKey, []);
  }

  const history = chatHistory.get(historyKey);

  const messagesForApi = [
    ...history.slice(-10),
    {
      role: 'user',
      content: `[Discord chat in #${channelContext}]\n\nRecent messages:\n${recentMessages}\n\nRespond as ${profile.name} naturally in the conversation. One short message.`,
    },
  ];

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    system: buildSystemPrompt(profile),
    messages: messagesForApi,
  });

  const text = response.content[0].text;

  history.push(
    { role: 'user', content: recentMessages },
    { role: 'assistant', content: text }
  );

  if (history.length > 20) {
    history.splice(0, history.length - 20);
  }

  return text;
}

const webhookCache = new Map();

async function getOrCreateWebhook(channel) {
  if (webhookCache.has(channel.id)) {
    return webhookCache.get(channel.id);
  }

  const webhooks = await channel.fetchWebhooks();
  let webhook = webhooks.find(w => w.name === 'Survivor Bot');

  if (!webhook) {
    webhook = await channel.createWebhook({ name: 'Survivor Bot' });
  }

  webhookCache.set(channel.id, webhook);
  return webhook;
}

export async function triggerBotChat(channel, recentMessages, numBots = 2) {
  const activeBots = profiles
    .sort(() => Math.random() - 0.5)
    .slice(0, numBots);

  const webhook = await getOrCreateWebhook(channel);
  const responses = [];

  for (const bot of activeBots) {
    const delay = 1000 + Math.random() * 3000;
    await new Promise(r => setTimeout(r, delay));

    const text = await getBotResponse(bot.id, channel.name, recentMessages);
    if (text) {
      await webhook.send({
        content: text,
        username: bot.name,
        avatarURL: bot.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(bot.name)}&background=random&size=128&bold=true`,
      });
      responses.push({ name: bot.name, text });
      recentMessages += `\n${bot.name}: ${text}`;
    }
  }

  return responses;
}

export function getRandomBots(count = 3) {
  return profiles
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
}

export { profiles };
