export const CHALLENGE_CHOICES = [
  { name: 'Fire Signal Cipher', value: 'fire-signal-cipher' },
  { name: 'Survivor Trivia', value: 'strategy-trivia' },
  { name: 'Idol Lockbox', value: 'idol-lockbox' },
  { name: 'Torchlight Labyrinth', value: 'torchlight-labyrinth' },
  { name: 'Memory Totem', value: 'memory-totem' },
  { name: 'Island Coordinates', value: 'island-coordinates' },
  { name: 'Chain Reaction', value: 'chain-reaction' },
  { name: 'Supply Drop', value: 'supply-drop' },
  { name: 'Risk the Flame', value: 'risk-the-flame' },
  { name: 'Tribal Pulse', value: 'tribal-pulse' },
  { name: 'Oath of Attention', value: 'oath-of-attention' },
  { name: 'Survivor Gauntlet', value: 'survivor-gauntlet' },
  { name: 'Command From Camp', value: 'command-from-camp' },
  { name: 'Vault Lock', value: 'vault-lock' },
  { name: 'Riddle Trials', value: 'riddle-trials' },
];

export function getChallengeName(slug) {
  return CHALLENGE_CHOICES.find((challenge) => challenge.value === slug)?.name || slug;
}
