export const CHALLENGE_CHOICES = [
  { name: 'Survivor Trivia', value: 'strategy-trivia' },
  { name: 'Memory Totem', value: 'memory-totem' },
  { name: 'Island Coordinates', value: 'island-coordinates' },
  { name: 'Risk the Flame', value: 'risk-the-flame' },
  { name: 'Oath of Attention', value: 'oath-of-attention' },
  { name: 'Command From Camp', value: 'command-from-camp' },
  { name: 'Vault Lock', value: 'vault-lock' },
  { name: 'Shipwreck Slide', value: 'slide-puzzle' },
  { name: 'Puzzle Rush', value: 'puzzle-rush' },
];

export function getChallengeName(slug) {
  return CHALLENGE_CHOICES.find((challenge) => challenge.value === slug)?.name || slug;
}
