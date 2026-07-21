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
}

export const OFFICIAL_CHALLENGE_SLUG = 'fire-signal-cipher';

export const CHALLENGES: ChallengeDefinition[] = [
  {
    slug: 'fire-signal-cipher',
    name: 'Fire Signal Cipher',
    number: '01',
    tagline: 'Read the smoke. Break the code.',
    description: 'Decode three increasingly difficult transmissions before the fire burns out.',
    category: 'Puzzle',
    difficulty: 'Medium',
    duration: '6–10 min',
    speedWeight: 2,
    rules: ['Use the supplied signal alphabet.', 'Capitalization does not matter.', 'Wrong attempts cost points.'],
  },
  {
    slug: 'strategy-trivia',
    name: 'Survivor Trivia',
    number: '02',
    tagline: 'How well do you REALLY know the island?',
    description: 'Ten hard questions on season numbers, winners, twist debuts, and deep-cut show history.',
    category: 'Knowledge',
    difficulty: 'Hard',
    duration: '5–8 min',
    speedWeight: 1,
    rules: ['Ten multiple-choice questions.', 'Distractors are deliberately close.', 'Every answer locks immediately.'],
  },
  {
    slug: 'idol-lockbox',
    name: 'Idol Lockbox',
    number: '03',
    tagline: 'Three locks. One hidden idol.',
    description: 'Solve a cipher, a number pattern, and a final combination to claim the idol.',
    category: 'Puzzle',
    difficulty: 'Hard',
    duration: '8–12 min',
    speedWeight: 2,
    rules: ['Open the locks in order.', 'Each wrong combination costs points.', 'Earlier answers unlock later clues.'],
  },
  {
    slug: 'torchlight-labyrinth',
    name: 'Torchlight Labyrinth',
    number: '04',
    tagline: 'Find a path through the dark.',
    description: 'Navigate a seeded maze and reach the immunity flame with as few moves as possible.',
    category: 'Puzzle',
    difficulty: 'Medium',
    duration: '4–7 min',
    speedWeight: 1,
    rules: ['Move one space at a time.', 'Walls cannot be crossed.', 'Every extra move lowers the score.'],
  },
  {
    slug: 'memory-totem',
    name: 'Memory Totem',
    number: '05',
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
    number: '06',
    tagline: 'Pinpoint the hidden landing site.',
    description: 'Use exact and misplaced symbol clues to deduce a four-symbol coordinate.',
    category: 'Puzzle',
    difficulty: 'Hard',
    duration: '6–10 min',
    speedWeight: 1,
    rules: ['Build a four-symbol guess.', 'Exact means correct symbol and position.', 'Present means correct symbol, wrong position.'],
  },
  {
    slug: 'chain-reaction',
    name: 'Chain Reaction',
    number: '07',
    tagline: 'Every answer changes the next.',
    description: 'Carry each solution forward through a linked sequence of logic and word puzzles.',
    category: 'Puzzle',
    difficulty: 'Hard',
    duration: '7–11 min',
    speedWeight: 2,
    rules: ['Solve stages in order.', 'Use earlier answers in later clues.', 'Wrong attempts cost points.'],
  },
  {
    slug: 'supply-drop',
    name: 'Supply Drop',
    number: '08',
    tagline: 'Take only what keeps you alive.',
    description: 'Pack the highest-value camp loadout without exceeding the weight limit.',
    category: 'Strategy',
    difficulty: 'Medium',
    duration: '4–7 min',
    speedWeight: 1,
    rules: ['Your bag holds 15 weight units.', 'Water is mandatory.', 'Some items unlock a set bonus.'],
  },
  {
    slug: 'risk-the-flame',
    name: 'Risk the Flame',
    number: '09',
    tagline: 'Push your luck without burning out.',
    description: 'Draw fire tokens toward 21 across three rounds, choosing when to hold.',
    category: 'Strategy',
    difficulty: 'Easy',
    duration: '3–5 min',
    speedWeight: 0,
    rules: ['Get as close to 21 as possible.', 'A total over 21 scores zero that round.', 'Three rounds determine the result.'],
  },
  {
    slug: 'tribal-pulse',
    name: 'Tribal Pulse',
    number: '10',
    tagline: 'Read the room before it reads you.',
    description: 'Predict the majority response to eight social-strategy questions.',
    category: 'Strategy',
    difficulty: 'Medium',
    duration: '4–6 min',
    speedWeight: 1,
    rules: ['Choose the response most players would select.', 'Questions avoid targeting named castaways.', 'Each majority match earns equal points.'],
  },
  {
    slug: 'oath-of-attention',
    name: 'Oath of Attention',
    number: '11',
    tagline: 'Wait. Watch. Strike.',
    description: 'Hold focus through false signals and respond only when the flame turns live.',
    category: 'Endurance',
    difficulty: 'Medium',
    duration: '1–2 min',
    speedWeight: 0,
    rules: ['Respond only to a live flame.', 'Early taps cost points.', 'Five successful signals complete the oath.'],
  },
  {
    slug: 'survivor-gauntlet',
    name: 'Survivor Gauntlet',
    number: '12',
    tagline: 'Four disciplines. No reset.',
    description: 'Race through cipher, pattern, memory, and deduction stages in one continuous run.',
    category: 'Endurance',
    difficulty: 'Hard',
    duration: '8–12 min',
    speedWeight: 2,
    rules: ['Four stages run back-to-back.', 'Wrong attempts add penalties.', 'The clock never stops between stages.'],
  },
  {
    slug: 'command-from-camp',
    name: 'Command From Camp',
    number: '13',
    tagline: 'Follow every word. Ignore every trap.',
    description: 'Memorize the orders, then execute them from memory while lookalike items try to pull you off course.',
    category: 'Memory',
    difficulty: 'Medium',
    duration: '3–5 min',
    speedWeight: 2,
    rules: ['Memorize the orders — they hide once you begin.', 'Lookalikes (lantern, sundial, cord) are traps.', 'Mistakes reset the sequence and cost points.'],
  },
  {
    slug: 'vault-lock',
    name: 'Vault Lock',
    number: '14',
    tagline: 'Time each pin. Pop the lock.',
    description: 'Stop the spinning dial on the glowing notch to pop each pin. It speeds up and switches direction — one miss ends the run.',
    category: 'Endurance',
    difficulty: 'Hard',
    duration: '1–2 min',
    speedWeight: 0,
    rules: ['Tap Pop (or press Space) when the dial reaches the notch.', 'Each pin makes the dial faster.', 'One miss ends the run.'],
  },
  {
    slug: 'riddle-trials',
    name: 'Riddle Trials',
    number: '15',
    tagline: 'Outwit the island one riddle at a time.',
    description: 'Solve a gauntlet of riddles and logic puzzles, entering each answer to advance to the next trial.',
    category: 'Puzzle',
    difficulty: 'Hard',
    duration: '3–6 min',
    speedWeight: 1,
    rules: ['Answer each riddle to unlock the next.', 'One or two words, or a number.', 'Wrong attempts cost points.'],
  },
  {
    slug: 'puzzle-rush',
    name: 'Puzzle Rush',
    number: '16',
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
