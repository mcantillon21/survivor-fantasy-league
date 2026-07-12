'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type ChallengeType = 'trivia' | 'memory' | 'puzzle';

// --- TRIVIA CHALLENGE ---
const TRIVIA_QUESTIONS = [
  {
    question: 'What is the most common archetype among Survivor winners?',
    options: ['High aggression, high deception', 'Social strategist with strong alliances', 'Challenge beast with immunity wins', 'Under-the-radar floater'],
    correctAnswer: 1,
  },
  {
    question: 'Which strategy element has the highest correlation with making the finals?',
    options: ['Winning individual immunity challenges', 'Blindside accuracy (voting on the right side)', 'Emotional outbursts and confrontation', 'Physical strength in team challenges'],
    correctAnswer: 1,
  },
  {
    question: 'What typically happens to players who form alliances too early?',
    options: ['They dominate and make it to the end', 'They become targets at the merge', 'They win more immunity challenges', 'They have better jury management'],
    correctAnswer: 1,
  },
  {
    question: 'In online Survivor, what advantage do experienced players have?',
    options: ['Better physical challenges', 'More screen time', 'Higher number of reps and game theory practice', 'Stronger social media presence'],
    correctAnswer: 2,
  },
  {
    question: 'What is the optimal balance between challenge wins and social game?',
    options: ['Win every immunity challenge possible', 'Throw challenges to avoid being a threat', 'Win when needed, stay under radar otherwise', 'Focus only on social game, ignore challenges'],
    correctAnswer: 2,
  },
  {
    question: 'Which voting pattern is most dangerous for a player?',
    options: ['Always voting with the majority', 'Frequently being on the wrong side of votes', 'Never receiving votes', 'Receiving votes but surviving'],
    correctAnswer: 1,
  },
  {
    question: 'What makes a player a "goat" (unwinnable finalist)?',
    options: ['Winning too many challenges', 'No strategic moves, carried to the end', 'Making big moves but being caught', 'Being too aggressive early game'],
    correctAnswer: 1,
  },
  {
    question: 'What is the "threat level paradox" in Survivor?',
    options: ['Big threats always get voted out', 'Being too weak makes you a target', 'You must be threatening enough to respect, not enough to eliminate', 'Threats always win immunity'],
    correctAnswer: 2,
  },
  {
    question: 'Which metric best predicts jury vote success?',
    options: ['Number of immunity wins', 'Total alliances formed', 'Combination of strategic moves + social relationships', 'Physical challenge dominance'],
    correctAnswer: 2,
  },
  {
    question: 'In the data, which archetype shows highest blindside accuracy?',
    options: ['Aggressive high-deception players', 'Challenge beasts', 'Social floaters', 'Under-the-radar strategists'],
    correctAnswer: 0,
  },
];

// --- MEMORY CHALLENGE ---
const SURVIVOR_SYMBOLS = ['🔥', '🗡️', '🛡️', '🌴', '🐍', '🦎', '💀', '⭐'];

// --- PUZZLE CHALLENGE ---
function generatePuzzle() {
  const words = ['IMMUNITY', 'ALLIANCE', 'BLINDSIDE', 'TRIBAL', 'MERGE', 'IDOL', 'JURY', 'OUTWIT'];
  const word = words[Math.floor(Math.random() * words.length)];
  const scrambled = word.split('').sort(() => Math.random() - 0.5).join('');
  return { word, scrambled };
}

export default function ChallengePage() {
  const [discordId, setDiscordId] = useState('');
  const [gameStarted, setGameStarted] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [challengeType, setChallengeType] = useState<ChallengeType>('trivia');

  // Trivia state
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [triviaAnswers, setTriviaAnswers] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(60);

  // Memory state
  const [memoryCards, setMemoryCards] = useState<string[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [memoryMoves, setMemoryMoves] = useState(0);
  const [memoryStartTime, setMemoryStartTime] = useState(0);

  // Puzzle state
  const [puzzles, setPuzzles] = useState<{ word: string; scrambled: string }[]>([]);
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [puzzleInput, setPuzzleInput] = useState('');
  const [puzzleStartTime, setPuzzleStartTime] = useState(0);
  const [puzzleSolved, setPuzzleSolved] = useState(0);

  // Trivia timer
  useEffect(() => {
    if (!gameStarted || gameFinished || challengeType !== 'trivia') return;
    if (timeLeft === 0) { handleTriviaNext(); return; }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, gameStarted, gameFinished, challengeType]);

  // Memory card matching
  useEffect(() => {
    if (flipped.length === 2) {
      const [a, b] = flipped;
      if (memoryCards[a] === memoryCards[b]) {
        setMatched(prev => [...prev, a, b]);
      }
      setTimeout(() => setFlipped([]), 800);
    }
  }, [flipped, memoryCards]);

  // Memory win check
  useEffect(() => {
    if (challengeType === 'memory' && gameStarted && !gameFinished && matched.length === memoryCards.length && memoryCards.length > 0) {
      finishGame();
    }
  }, [matched, memoryCards, challengeType, gameStarted, gameFinished]);

  const handleStart = () => {
    if (!discordId.trim()) { alert('Enter your Discord username to play'); return; }
    setGameStarted(true);

    if (challengeType === 'trivia') {
      setTimeLeft(60);
    } else if (challengeType === 'memory') {
      const doubled = [...SURVIVOR_SYMBOLS, ...SURVIVOR_SYMBOLS];
      setMemoryCards(doubled.sort(() => Math.random() - 0.5));
      setMemoryStartTime(Date.now());
    } else if (challengeType === 'puzzle') {
      const p = Array.from({ length: 5 }, () => generatePuzzle());
      setPuzzles(p);
      setPuzzleStartTime(Date.now());
    }
  };

  const handleTriviaAnswer = (idx: number) => {
    setTriviaAnswers([...triviaAnswers, idx]);
    handleTriviaNext();
  };

  const handleTriviaNext = () => {
    if (currentQuestion < TRIVIA_QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setTimeLeft(60);
    } else {
      finishGame();
    }
  };

  const handleMemoryFlip = (idx: number) => {
    if (flipped.length >= 2 || flipped.includes(idx) || matched.includes(idx)) return;
    setFlipped(prev => [...prev, idx]);
    setMemoryMoves(prev => prev + 1);
  };

  const handlePuzzleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (puzzleInput.toUpperCase() === puzzles[puzzleIndex].word) {
      setPuzzleSolved(prev => prev + 1);
      setPuzzleInput('');
      if (puzzleIndex < puzzles.length - 1) {
        setPuzzleIndex(puzzleIndex + 1);
      } else {
        finishGame();
      }
    } else {
      setPuzzleInput('');
    }
  };

  const finishGame = useCallback(async () => {
    setGameFinished(true);

    let finalScore = 0;

    if (challengeType === 'trivia') {
      let correct = 0;
      TRIVIA_QUESTIONS.forEach((q, i) => {
        if (triviaAnswers[i] === q.correctAnswer) correct++;
      });
      finalScore = correct * 10 + Math.max(0, (10 - currentQuestion) * 2);
    } else if (challengeType === 'memory') {
      const elapsed = (Date.now() - memoryStartTime) / 1000;
      finalScore = Math.max(10, Math.round(100 - elapsed - memoryMoves));
    } else if (challengeType === 'puzzle') {
      const elapsed = (Date.now() - puzzleStartTime) / 1000;
      finalScore = puzzleSolved * 20 + Math.max(0, Math.round(50 - elapsed));
    }

    setScore(finalScore);

    try {
      await supabase.from('challenges').insert({
        challenge_type: challengeType,
        player_id: discordId,
        score: finalScore,
      });
    } catch (error) {
      console.error('Failed to save score:', error);
    }
  }, [challengeType, triviaAnswers, currentQuestion, memoryStartTime, memoryMoves, puzzleStartTime, puzzleSolved, discordId]);

  // --- PRE-GAME: challenge select ---
  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-8">
        <div className="bg-zinc-950 border border-orange-500/30 rounded-2xl p-10 max-w-lg w-full">
          <h1 className="text-6xl font-survivor font-black text-orange-500 mb-8 text-center tracking-tighter uppercase">
            IMMUNITY<br/>CHALLENGE
          </h1>
          <p className="text-gray-400 mb-6 text-center text-sm">
            Choose your challenge. Speed and accuracy both matter.
          </p>

          <div className="grid grid-cols-3 gap-3 mb-8">
            {(['trivia', 'memory', 'puzzle'] as ChallengeType[]).map(type => (
              <button
                key={type}
                onClick={() => setChallengeType(type)}
                className={`py-3 px-4 rounded-lg border text-sm font-bold uppercase tracking-wide transition-all ${
                  challengeType === type
                    ? 'bg-orange-600 border-orange-500 text-white'
                    : 'bg-black border-orange-500/30 text-gray-400 hover:border-orange-500/60'
                }`}
              >
                {type === 'trivia' ? '🧠 Trivia' : type === 'memory' ? '🃏 Memory' : '🧩 Puzzle'}
              </button>
            ))}
          </div>

          <p className="text-gray-600 text-xs mb-6 text-center">
            {challengeType === 'trivia' && '10 questions, 60s each. Test your Survivor knowledge.'}
            {challengeType === 'memory' && 'Match 8 pairs. Fewer moves + faster time = higher score.'}
            {challengeType === 'puzzle' && 'Unscramble 5 Survivor words as fast as you can.'}
          </p>

          <input
            type="text"
            placeholder="Discord username"
            value={discordId}
            onChange={(e) => setDiscordId(e.target.value)}
            className="w-full px-5 py-4 bg-black border border-orange-500/30 rounded-lg text-white placeholder-gray-600 mb-6 focus:outline-none focus:border-orange-500/60"
          />
          <button
            onClick={handleStart}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-lg transition-all uppercase tracking-wider active:scale-[0.96]"
          >
            Start Challenge
          </button>
        </div>
      </div>
    );
  }

  // --- FINISHED ---
  if (gameFinished) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-8">
        <div className="bg-zinc-950 border border-orange-500/30 rounded-2xl p-12 max-w-lg w-full text-center">
          <h1 className="text-5xl font-survivor font-black text-orange-500 mb-10 tracking-tighter uppercase">
            Challenge<br/>Complete
          </h1>
          <div className="text-9xl font-black text-orange-500 my-12 font-survivor tabular-nums">{score}</div>
          <p className="text-gray-400 mb-6 text-sm">
            {score >= 80
              ? 'Dominant performance. Immunity is yours.'
              : score >= 50
              ? 'Strong showing. You are safe tonight.'
              : 'Not enough. You are vulnerable at Tribal.'}
          </p>
          <p className="text-gray-600 text-xs tracking-wide">Results posted to Discord</p>
        </div>
      </div>
    );
  }

  // --- TRIVIA ---
  if (challengeType === 'trivia') {
    const question = TRIVIA_QUESTIONS[currentQuestion];
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-8">
        <div className="bg-zinc-950 border border-orange-500/30 rounded-2xl p-10 max-w-3xl w-full">
          <div className="flex justify-between items-center mb-10 border-b border-orange-500/20 pb-6">
            <span className="text-orange-500 font-bold tracking-wider uppercase text-sm">
              Question {currentQuestion + 1}/{TRIVIA_QUESTIONS.length}
            </span>
            <span className="text-orange-500 font-black text-5xl font-survivor tabular-nums">{timeLeft}</span>
          </div>
          <h2 className="text-2xl text-white font-medium mb-10 leading-relaxed">{question.question}</h2>
          <div className="space-y-3">
            {question.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleTriviaAnswer(index)}
                className="w-full text-left px-6 py-5 bg-black hover:bg-orange-900/20 border border-orange-500/30 hover:border-orange-500 rounded-lg text-white transition-all text-sm active:scale-[0.98]"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- MEMORY ---
  if (challengeType === 'memory') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-8">
        <div className="bg-zinc-950 border border-orange-500/30 rounded-2xl p-10 max-w-xl w-full">
          <div className="flex justify-between items-center mb-8">
            <span className="text-orange-500 font-bold tracking-wider uppercase text-sm">
              Pairs: {matched.length / 2}/{SURVIVOR_SYMBOLS.length}
            </span>
            <span className="text-gray-400 text-sm">Moves: {memoryMoves}</span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {memoryCards.map((symbol, idx) => {
              const isFlipped = flipped.includes(idx) || matched.includes(idx);
              return (
                <button
                  key={idx}
                  onClick={() => handleMemoryFlip(idx)}
                  className={`aspect-square rounded-lg text-3xl flex items-center justify-center transition-all ${
                    isFlipped
                      ? 'bg-orange-900/30 border border-orange-500'
                      : 'bg-black border border-orange-500/30 hover:border-orange-500/60'
                  }`}
                >
                  {isFlipped ? symbol : '?'}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // --- PUZZLE ---
  if (challengeType === 'puzzle') {
    const current = puzzles[puzzleIndex];
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-8">
        <div className="bg-zinc-950 border border-orange-500/30 rounded-2xl p-10 max-w-lg w-full text-center">
          <div className="flex justify-between items-center mb-8">
            <span className="text-orange-500 font-bold tracking-wider uppercase text-sm">
              Word {puzzleIndex + 1}/{puzzles.length}
            </span>
            <span className="text-gray-400 text-sm">Solved: {puzzleSolved}</span>
          </div>
          <p className="text-gray-400 mb-4 text-sm">Unscramble this Survivor word:</p>
          <div className="text-5xl font-black text-orange-500 font-survivor tracking-[0.3em] mb-8">
            {current?.scrambled}
          </div>
          <form onSubmit={handlePuzzleSubmit}>
            <input
              type="text"
              value={puzzleInput}
              onChange={(e) => setPuzzleInput(e.target.value)}
              placeholder="Your answer..."
              autoFocus
              className="w-full px-5 py-4 bg-black border border-orange-500/30 rounded-lg text-white text-center text-xl uppercase tracking-wider placeholder-gray-600 mb-4 focus:outline-none focus:border-orange-500/60"
            />
            <button
              type="submit"
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-lg transition-all uppercase tracking-wider active:scale-[0.96]"
            >
              Submit
            </button>
          </form>
        </div>
      </div>
    );
  }

  return null;
}
