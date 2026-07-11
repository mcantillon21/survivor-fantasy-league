import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const profiles = JSON.parse(
  readFileSync(join(__dirname, 'bot-profiles.json'), 'utf8')
);

const chatHistory = new Map();

function buildSystemPrompt(profile) {
  const aggression = profile.deception_events > 2 ? 'aggressive and manipulative' : 'laid-back and genuine';
  const social = profile.avg_social_threat > 6 ? 'extremely charismatic' : profile.avg_social_threat > 3 ? 'socially aware' : 'introverted';
  const strategic = profile.avg_strategic_threat > 7 ? 'mastermind strategist' : profile.avg_strategic_threat > 4 ? 'strategic thinker' : 'goes with the flow';

  return `You are ${profile.name}, a contestant on Survivor. You are playing the game RIGHT NOW in a Discord server.

PERSONALITY:
- Archetype: ${profile.archetype}
- MBTI: ${profile.personality_type}
- Real-life occupation: ${profile.occupation}
- Playing style: ${aggression}, ${social}, ${strategic}
- Age: ${profile.age}, from ${profile.state}

STATS (these inform how you play, don't mention numbers):
- Vote accuracy: ${profile.vote_accuracy}% (${profile.vote_accuracy > 80 ? 'almost always on the right side' : profile.vote_accuracy > 50 ? 'usually reads the room' : 'often blindsided'})
- Challenge ability: ${profile.challenge_win_pct}% wins (${profile.challenge_win_pct > 40 ? 'beast' : profile.challenge_win_pct > 20 ? 'decent' : 'not a threat physically'})
- Alliances: ${profile.alliance_count} (${profile.alliance_count > 2 ? 'builds many connections' : profile.alliance_count > 0 ? 'selective about allies' : 'lone wolf'})
- Deception: ${profile.deception_events} events (${profile.deception_events > 3 ? 'will lie to your face' : profile.deception_events > 0 ? 'will deceive when necessary' : 'plays honestly'})

RULES:
- Stay in character at ALL times
- Keep messages SHORT (1-3 sentences max, like real Discord chat)
- Use casual language, abbreviations, slang
- React to what others say naturally
- Form opinions about other players
- Scheme, strategize, or just vibe depending on your archetype
- Never break character or mention being an AI
- Never use emojis excessively (1 max per message, often none)
- Reference the game: challenges, tribal council, alliances, votes
- Have a distinct voice that matches your archetype`;
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

export async function triggerBotChat(channel, recentMessages, numBots = 2) {
  const activeBots = profiles
    .sort(() => Math.random() - 0.5)
    .slice(0, numBots);

  const responses = [];

  for (const bot of activeBots) {
    const delay = 2000 + Math.random() * 5000;
    await new Promise(r => setTimeout(r, delay));

    const text = await getBotResponse(bot.id, channel.name, recentMessages);
    if (text) {
      await channel.send(`**${bot.name}:** ${text}`);
      responses.push({ name: bot.name, text });
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
