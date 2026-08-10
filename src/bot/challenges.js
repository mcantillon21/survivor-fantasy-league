export const CHALLENGE_CHOICES = [
  { name: 'Survivor Trivia', value: 'strategy-trivia' },
  { name: 'Memory Totem', value: 'memory-totem' },
  { name: 'Island Coordinates', value: 'island-coordinates' },
  { name: 'Oath of Attention', value: 'oath-of-attention' },
  { name: 'Command From Camp', value: 'command-from-camp' },
  { name: 'Vault Lock', value: 'vault-lock' },
  { name: 'Shipwreck Slide', value: 'slide-puzzle' },
  { name: 'Puzzle Rush', value: 'puzzle-rush' },
  { name: 'Snuff the Torches', value: 'snuff-the-torches' },
  { name: 'Torch Scramble', value: 'torch-scramble' },
  { name: 'Camp Transcription', value: 'torch-transcription' },
  { name: 'Jungle Word Hunt', value: 'jungle-word-hunt' },
  { name: 'Coconut 2048', value: 'island-2048' },
  { name: 'Buried Idols', value: 'buried-idols' },
  { name: 'Supply Count', value: 'supply-count' },
];

// Archived challenges: out of the draw, but old rounds may still reference them.
const ARCHIVED_CHALLENGE_NAMES = { 'risk-the-flame': 'Risk the Flame', 'tower-of-idols': 'Tower of the Idols' };

export function getChallengeName(slug) {
  if (ARCHIVED_CHALLENGE_NAMES[slug]) return ARCHIVED_CHALLENGE_NAMES[slug];
  return CHALLENGE_CHOICES.find((challenge) => challenge.value === slug)?.name || slug;
}
