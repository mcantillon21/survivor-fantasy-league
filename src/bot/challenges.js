export const CHALLENGE_CHOICES = [
  { name: 'Survivor Trivia', value: 'strategy-trivia' },
  { name: 'Memory Totem', value: 'memory-totem' },
  { name: 'Island Coordinates', value: 'island-coordinates' },
  { name: 'Oath of Attention', value: 'oath-of-attention' },
  { name: 'Command From Camp', value: 'command-from-camp' },
  { name: 'Vault Lock', value: 'vault-lock' },
  { name: 'Shipwreck Slide', value: 'slide-puzzle' },
  { name: 'Puzzle Rush', value: 'puzzle-rush' },
];

// Archived challenges: out of the draw, but old rounds may still reference them.
const ARCHIVED_CHALLENGE_NAMES = { 'risk-the-flame': 'Risk the Flame' };

export function getChallengeName(slug) {
  if (ARCHIVED_CHALLENGE_NAMES[slug]) return ARCHIVED_CHALLENGE_NAMES[slug];
  return CHALLENGE_CHOICES.find((challenge) => challenge.value === slug)?.name || slug;
}
