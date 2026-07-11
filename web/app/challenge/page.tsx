'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
}

const QUESTIONS: Question[] = [
  {
    question: 'What is the most common archetype among Survivor winners?',
    options: [
      'High aggression, high deception',
      'Social strategist with strong alliances',
      'Challenge beast with immunity wins',
      'Under-the-radar floater'
    ],
    correctAnswer: 1,
  },
  {
    question: 'Which strategy element has the highest correlation with making the finals?',
    options: [
      'Winning individual immunity challenges',
      'Blindside accuracy (voting on the right side)',
      'Emotional outbursts and confrontation',
      'Physical strength in team challenges'
    ],
    correctAnswer: 1,
  },
  {
    question: 'What typically happens to players who form alliances too early?',
    options: [
      'They dominate and make it to the end',
      'They become targets at the merge',
      'They win more immunity challenges',
      'They have better jury management'
    ],
    correctAnswer: 1,
  },
  {
    question: 'In online Survivor, what advantage do experienced players have over TV show contestants?',
    options: [
      'Better physical challenges',
      'More screen time',
      'Higher number of reps and game theory practice',
      'Stronger social media presence'
    ],
    correctAnswer: 2,
  },
  {
    question: 'What is the optimal balance between challenge wins and social game?',
    options: [
      'Win every immunity challenge possible',
      'Throw challenges to avoid being a threat',
      'Win when needed, stay under radar otherwise',
      'Focus only on social game, ignore challenges'
    ],
    correctAnswer: 2,
  },
  {
    question: 'Which voting pattern is most dangerous for a player?',
    options: [
      'Always voting with the majority',
      'Frequently being on the wrong side of votes',
      'Never receiving votes',
      'Receiving votes but surviving'
    ],
    correctAnswer: 1,
  },
  {
    question: 'What makes a player a "goat" (unwinnable finalist)?',
    options: [
      'Winning too many challenges',
      'No strategic moves, carried to the end',
      'Making big moves but being caught',
      'Being too aggressive early game'
    ],
    correctAnswer: 1,
  },
  {
    question: 'In the data, which archetype shows highest blindside accuracy?',
    options: [
      'Aggressive high-deception players',
      'Challenge beasts',
      'Social floaters',
      'Under-the-radar strategists'
    ],
    correctAnswer: 0,
  },
  {
    question: 'What is the "threat level paradox" in Survivor?',
    options: [
      'Big threats always get voted out',
      'Being too weak makes you a target',
      'You must be threatening enough to respect, not enough to eliminate',
      'Threats always win immunity'
    ],
    correctAnswer: 2,
  },
  {
    question: 'Which metric best predicts jury vote success?',
    options: [
      'Number of immunity wins',
      'Total alliances formed',
      'Combination of strategic moves + social relationships',
      'Physical challenge dominance'
    ],
    correctAnswer: 2,
  },
];

export default function ChallengePage() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [discordId, setDiscordId] = useState('');

  useEffect(() => {
    if (!gameStarted || gameFinished) return;

    if (timeLeft === 0) {
      handleNextQuestion();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, gameStarted, gameFinished]);

  const handleStart = () => {
    if (!discordId.trim()) {
      alert('Enter your Discord username to play');
      return;
    }
    setGameStarted(true);
    setTimeLeft(60);
  };

  const handleAnswer = (answerIndex: number) => {
    setAnswers([...answers, answerIndex]);
    handleNextQuestion();
  };

  const handleNextQuestion = () => {
    if (currentQuestion < QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setTimeLeft(60);
    } else {
      finishGame();
    }
  };

  const finishGame = async () => {
    setGameFinished(true);

    let correctCount = 0;
    let speedBonus = 0;

    QUESTIONS.forEach((q, i) => {
      if (answers[i] === q.correctAnswer) {
        correctCount++;
        // Bonus points for answering quickly
        speedBonus += Math.floor((60 - (i * 5)) / 10);
      }
    });

    const finalScore = correctCount * 10 + speedBonus;
    setScore(finalScore);

    // Save to Supabase
    try {
      await supabase.from('challenges').insert({
        challenge_type: 'trivia',
        player_id: discordId,
        score: finalScore,
      });
    } catch (error) {
      console.error('Failed to save score:', error);
    }
  };

  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-8">
        <div className="bg-zinc-950 border border-orange-500/30 p-10 max-w-lg w-full">
          <h1 className="text-6xl font-survivor font-black text-orange-500 mb-8 text-center tracking-tighter uppercase">
            IMMUNITY<br/>CHALLENGE
          </h1>
          <p className="text-gray-400 mb-8 text-center text-sm leading-relaxed">
            10 questions. 60 seconds each. Speed and accuracy both matter.
          </p>
          <input
            type="text"
            placeholder="Discord username"
            value={discordId}
            onChange={(e) => setDiscordId(e.target.value)}
            className="w-full px-5 py-4 bg-black border border-orange-500/30 text-white placeholder-gray-600 mb-6 focus:outline-none focus:border-orange-500/60"
          />
          <button
            onClick={handleStart}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 transition-all uppercase tracking-wider active:scale-[0.96]"
          >
            Start Challenge
          </button>
        </div>
      </div>
    );
  }

  if (gameFinished) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-8">
        <div className="bg-zinc-950 border border-orange-500/30 p-12 max-w-lg w-full text-center animate-in fade-in duration-500">
          <h1 className="text-5xl font-survivor font-black text-orange-500 mb-10 tracking-tighter uppercase animate-in slide-in-from-top-4 duration-700">
            Challenge<br/>Complete
          </h1>
          <div className="text-9xl font-black text-orange-500 my-12 font-survivor tabular-nums animate-in zoom-in-50 duration-700 delay-200">{score}</div>
          <p className="text-gray-400 mb-6 text-sm leading-relaxed animate-in fade-in duration-700 delay-300">
            {score >= 80
              ? 'Dominant performance. Immunity is yours.'
              : score >= 60
              ? 'Strong showing. You are safe tonight.'
              : 'Not enough. You are vulnerable at Tribal.'}
          </p>
          <p className="text-gray-600 text-xs tracking-wide animate-in fade-in duration-700 delay-500">
            Results posted to Discord
          </p>
        </div>
      </div>
    );
  }

  const question = QUESTIONS[currentQuestion];

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-8">
      <div className="bg-zinc-950 border border-orange-500/30 p-10 max-w-3xl w-full">
        <div className="flex justify-between items-center mb-10 border-b border-orange-500/20 pb-6">
          <span className="text-orange-500 font-bold tracking-wider uppercase text-sm">
            Question {currentQuestion + 1}/{QUESTIONS.length}
          </span>
          <span className="text-orange-500 font-black text-5xl font-survivor tabular-nums">
            {timeLeft}
          </span>
        </div>

        <h2 className="text-2xl text-white font-medium mb-10 leading-relaxed">
          {question.question}
        </h2>

        <div className="space-y-3">
          {question.options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswer(index)}
              className="w-full text-left px-6 py-5 bg-black hover:bg-orange-900/20 border border-orange-500/30 hover:border-orange-500 text-white transition-all text-sm active:scale-[0.98]"
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
