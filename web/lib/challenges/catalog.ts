export type ChallengeCategory = 'Knowledge' | 'Puzzle' | 'Memory' | 'Strategy' | 'Endurance';
export type ChallengeDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface ChallengeDefinition {
  slug: string;
  name: string;
  number: string;
  tagline: string;
  description: string;
  category: ChallengeCategory;
  difficulty: ChallengeDifficulty;
  duration: string;
  speedWeight: number;
  rules: string[];
  /** Archived challenges keep their engine but are hidden from the practice
   *  gallery and excluded from the bot's random draw. */
  archived?: boolean;
}

export const OFFICIAL_CHALLENGE_SLUG = 'strategy-trivia';

export const CHALLENGES: ChallengeDefinition[] = [
  {
    slug: 'strategy-trivia',
    name: 'Survivor Trivia',
    number: '01',
    tagline: 'How well do you REALLY know the island?',
    description: 'Forty-three deep-cut questions on seasons 1–40: records, alliances, twists, and the history only a superfan remembers.',
    category: 'Knowledge',
    difficulty: 'Hard',
    duration: '5 min',
    speedWeight: 0,
    rules: ['A 5-minute timer runs — answer as many of the 43 questions as you can.', 'Most correct answers wins; every question is worth the same.', 'One answer per question — no going back.'],
  },
  {
    slug: 'memory-totem',
    name: 'Memory Totem',
    number: '02',
    tagline: 'What the island shows, remember.',
    description: 'Study expanding symbol sequences, then rebuild each totem from memory.',
    category: 'Memory',
    difficulty: 'Medium',
    duration: '4–6 min',
    speedWeight: 1,
    rules: ['Study each sequence before it disappears.', 'Rebuild symbols in exact order.', 'Four rounds increase in length.'],
  },
  {
    slug: 'island-coordinates',
    name: 'Island Coordinates',
    number: '03',
    tagline: 'Pinpoint the hidden landing site.',
    description: 'Use exact and misplaced symbol clues to deduce a four-symbol coordinate.',
    category: 'Puzzle',
    difficulty: 'Hard',
    duration: '6–10 min',
    speedWeight: 1,
    rules: ['Build a four-symbol guess.', 'Exact means correct symbol and position.', 'Present means correct symbol, wrong position.'],
  },
  {
    slug: 'risk-the-flame',
    name: 'Risk the Flame',
    number: '04',
    tagline: 'Push your luck without burning out.',
    description: 'Draw fire tokens toward 21 across three rounds, choosing when to hold.',
    category: 'Strategy',
    difficulty: 'Easy',
    duration: '3–5 min',
    speedWeight: 0,
    rules: ['Get as close to 21 as possible.', 'A total over 21 scores zero that round.', 'Three rounds determine the result.'],
    archived: true,
  },
  {
    slug: 'oath-of-attention',
    name: 'Oath of Attention',
    number: '05',
    tagline: 'Wait. Watch. Strike.',
    description: 'Hold focus through unpredictable pauses and respond only when the flame turns live.',
    category: 'Endurance',
    difficulty: 'Medium',
    duration: '2–3 min',
    speedWeight: 0,
    rules: ['Respond only to a live flame.', 'Early taps cost points.', 'Eight successful signals complete the oath.'],
  },
  {
    slug: 'command-from-camp',
    name: 'Command From Camp',
    number: '06',
    tagline: 'Follow every word. Ignore every trap.',
    description: 'Memorize the orders, then execute them from memory while lookalike items try to pull you off course.',
    category: 'Memory',
    difficulty: 'Medium',
    duration: '3–5 min',
    speedWeight: 2,
    rules: ['Memorize the orders — they hide once you begin.', 'Mistakes reset the sequence and cost points.'],
  },
  {
    slug: 'vault-lock',
    name: 'Vault Lock',
    number: '07',
    tagline: 'Time each pin. Pop the lock.',
    description: 'Stop the spinning dial on the glowing notch to pop each pin. It speeds up and switches direction — one miss ends the run.',
    category: 'Endurance',
    difficulty: 'Hard',
    duration: '1–2 min',
    speedWeight: 0,
    rules: ['Tap Pop (or press Space) when the dial reaches the notch.', 'Each pin makes the dial faster.', 'One miss ends the run.'],
  },
  {
    slug: 'slide-puzzle',
    name: 'Shipwreck Slide',
    number: '08',
    tagline: 'Order from chaos, one slide at a time.',
    description: 'A classic 4×4 sliding puzzle: restore the scrambled tiles to order in as few moves as you can.',
    category: 'Puzzle',
    difficulty: 'Medium',
    duration: '3–6 min',
    speedWeight: 1,
    rules: ['Tap a tile next to the gap to slide it.', 'Arrange tiles 1–15 in order with the gap last.', 'Fewer moves score higher.'],
  },
  {
    slug: 'puzzle-rush',
    name: 'Puzzle Rush',
    number: '09',
    tagline: 'Five minutes. As many mates as you can.',
    description: 'A chess.com Puzzle Rush–style sprint: mate-in-1, then mate-in-2, then mate-in-3 puzzles ramp up in difficulty. Solve as many as you can before the clock runs out.',
    category: 'Puzzle',
    difficulty: 'Hard',
    duration: '5 min',
    speedWeight: 0,
    rules: ['Click a piece, then its target square.', 'Puzzles ramp up: mate-in-1 → mate-in-2 → mate-in-3.', 'On longer mates the engine answers with its best defence.', 'Harder mates are worth more; solve as many as you can in 5 minutes.'],
  },
];

export function getChallenge(slug: string) {
  return CHALLENGES.find((challenge) => challenge.slug === slug);
}

export function isOfficialChallenge(slug: string) {
  return slug === OFFICIAL_CHALLENGE_SLUG;
}
