'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
}

interface RecordedAnswer {
  answerIndex: number | null;
  timeRemaining: number;
}

interface ScoreBreakdown {
  correctCount: number;
  accuracyScore: number;
  speedBonus: number;
  total: number;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'unavailable' | 'error';

const QUESTION_TIME = 60;
const ANSWER_LETTERS = ['A', 'B', 'C', 'D'];

const QUESTIONS: Question[] = [
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
    question: 'In online Survivor, what advantage do experienced players have over TV show contestants?',
    options: ['Better physical challenges', 'More screen time', 'More reps and game theory practice', 'Stronger social media presence'],
    correctAnswer: 2,
  },
  {
    question: 'What is the optimal balance between challenge wins and social game?',
    options: ['Win every immunity challenge possible', 'Throw challenges to avoid being a threat', 'Win when needed, stay under the radar otherwise', 'Focus only on social game'],
    correctAnswer: 2,
  },
  {
    question: 'Which voting pattern is most dangerous for a player?',
    options: ['Always voting with the majority', 'Frequently being on the wrong side of votes', 'Never receiving votes', 'Receiving votes but surviving'],
    correctAnswer: 1,
  },
  {
    question: 'What makes a player a “goat” — an unwinnable finalist?',
    options: ['Winning too many challenges', 'Making no strategic moves and being carried', 'Making big moves but being caught', 'Playing too aggressively early'],
    correctAnswer: 1,
  },
  {
    question: 'Which archetype shows the highest blindside accuracy?',
    options: ['Aggressive, high-deception players', 'Challenge beasts', 'Social floaters', 'Under-the-radar strategists'],
    correctAnswer: 0,
  },
  {
    question: 'What is the “threat level paradox” in Survivor?',
    options: ['Big threats always get voted out', 'Being too weak makes you a target', 'Be respected as a threat, but not urgent to eliminate', 'Threats always win immunity'],
    correctAnswer: 2,
  },
  {
    question: 'Which combination best predicts jury-vote success?',
    options: ['Immunity wins alone', 'Total alliances formed', 'Strategic moves and social relationships', 'Physical challenge dominance'],
    correctAnswer: 2,
  },
];

function calculateScore(answers: RecordedAnswer[]): ScoreBreakdown {
  return answers.reduce<ScoreBreakdown>(
    (score, answer, index) => {
      if (answer.answerIndex === QUESTIONS[index].correctAnswer) {
        score.correctCount += 1;
        score.accuracyScore += 10;
        score.speedBonus += Math.floor(answer.timeRemaining / 10);
      }
      score.total = score.accuracyScore + score.speedBonus;
      return score;
    },
    { correctCount: 0, accuracyScore: 0, speedBonus: 0, total: 0 },
  );
}

export default function ChallengePage() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<RecordedAnswer[]>([]);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [score, setScore] = useState<ScoreBreakdown | null>(null);
  const [discordId, setDiscordId] = useState('');
  const [validationError, setValidationError] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const completeGame = useCallback(async (completedAnswers: RecordedAnswer[]) => {
    const finalScore = calculateScore(completedAnswers);
    setScore(finalScore);
    setGameFinished(true);
    setSaveStatus('saving');

    const supabase = getSupabaseClient();
    if (!supabase) {
      setSaveStatus('unavailable');
      return;
    }

    try {
      const { error } = await supabase.from('challenges').insert({
        challenge_type: 'trivia',
        player_id: discordId.trim(),
        score: finalScore.total,
      });

      setSaveStatus(error ? 'error' : 'saved');
      if (error) console.error('Failed to save challenge score:', error.message);
    } catch (error) {
      console.error('Failed to save challenge score:', error);
      setSaveStatus('error');
    }
  }, [discordId]);

  useEffect(() => {
    if (!gameStarted || gameFinished || selectedAnswer !== null) return;

    const timer = window.setTimeout(() => {
      if (timeLeft > 1) {
        setTimeLeft((seconds) => seconds - 1);
        return;
      }

      const completedAnswers = [...answers, { answerIndex: null, timeRemaining: 0 }];
      setAnswers(completedAnswers);

      if (currentQuestion === QUESTIONS.length - 1) {
        void completeGame(completedAnswers);
      } else {
        setCurrentQuestion((question) => question + 1);
        setTimeLeft(QUESTION_TIME);
      }
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [answers, completeGame, currentQuestion, gameFinished, gameStarted, selectedAnswer, timeLeft]);

  const handleStart = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!discordId.trim()) {
      setValidationError('Enter your Discord username to enter the arena.');
      return;
    }

    setValidationError('');
    setGameStarted(true);
    setTimeLeft(QUESTION_TIME);
  };

  const handleAnswer = (answerIndex: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(answerIndex);

    const completedAnswers = [...answers, { answerIndex, timeRemaining: timeLeft }];
    window.setTimeout(() => {
      setAnswers(completedAnswers);
      setSelectedAnswer(null);

      if (currentQuestion === QUESTIONS.length - 1) {
        void completeGame(completedAnswers);
      } else {
        setCurrentQuestion((question) => question + 1);
        setTimeLeft(QUESTION_TIME);
      }
    }, 220);
  };

  const restartChallenge = () => {
    setCurrentQuestion(0);
    setAnswers([]);
    setTimeLeft(QUESTION_TIME);
    setGameStarted(false);
    setGameFinished(false);
    setScore(null);
    setSelectedAnswer(null);
    setSaveStatus('idle');
  };

  if (!gameStarted) {
    return (
      <div className="challenge-page challenge-page--briefing page-enter">
        <div className="ambient-fire ambient-fire--challenge" aria-hidden="true" />
        <section className="briefing-layout">
          <div className="briefing-copy">
            <p className="eyebrow"><span /> Immunity challenge</p>
            <h1 className="display-title">Outthink<br />the island.</h1>
            <p className="hero-copy">
              Ten questions. Sixty seconds on each. Correct answers build your
              score; quick decisions separate the safe from the vulnerable.
            </p>
            <dl className="briefing-stats">
              <div><dt>Questions</dt><dd>10</dd></div>
              <div><dt>Per question</dt><dd>60 sec</dd></div>
              <div><dt>Scoring</dt><dd>Accuracy + speed</dd></div>
            </dl>
          </div>

          <form className="entry-card glass-panel" onSubmit={handleStart} noValidate>
            <div>
              <p className="section-kicker">Player check-in</p>
              <h2>Claim your spot.</h2>
              <p>Use the Discord username registered with the league.</p>
            </div>
            <div className="field-group">
              <label htmlFor="discord-username">Discord username</label>
              <input
                id="discord-username"
                name="discord-username"
                type="text"
                autoComplete="username"
                spellCheck="false"
                placeholder="e.g. ParvatiFan"
                value={discordId}
                aria-invalid={Boolean(validationError)}
                aria-describedby={validationError ? 'username-error' : 'username-help'}
                onChange={(event) => {
                  setDiscordId(event.target.value);
                  if (validationError) setValidationError('');
                }}
              />
              <p id="username-help" className="field-help">Your score will be linked to this name.</p>
              {validationError && <p id="username-error" className="field-error" role="alert">{validationError}</p>}
            </div>
            <button type="submit" className="button button--primary button--full">
              Start the challenge <span aria-hidden="true">→</span>
            </button>
            <p className="entry-card__warning">The clock starts as soon as you enter.</p>
          </form>
        </section>
      </div>
    );
  }

  if (gameFinished && score) {
    const resultMessage = score.total >= 120
      ? 'A dominant performance. You made your case for immunity.'
      : score.total >= 80
        ? 'A strong showing. The rest of the tribe felt that one.'
        : 'The votes could be coming your way. Keep your allies close.';

    return (
      <div className="challenge-page challenge-page--result page-enter">
        <div className="ambient-fire ambient-fire--result" aria-hidden="true" />
        <section className="result-card glass-panel" aria-labelledby="result-title">
          <p className="eyebrow"><span /> Challenge complete</p>
          <h1 id="result-title">The score<br />is final.</h1>
          <div className="result-score" aria-label={`${score.total} total points`}>
            <strong>{score.total}</strong><span>points</span>
          </div>
          <p className="result-message">{resultMessage}</p>
          <dl className="score-breakdown">
            <div><dt>Correct</dt><dd>{score.correctCount} / {QUESTIONS.length}</dd></div>
            <div><dt>Accuracy</dt><dd>{score.accuracyScore}</dd></div>
            <div><dt>Speed bonus</dt><dd>+{score.speedBonus}</dd></div>
          </dl>
          <p className={`save-status save-status--${saveStatus}`} aria-live="polite">
            {saveStatus === 'saving' && 'Sending your result to camp…'}
            {saveStatus === 'saved' && 'Result saved. The host has your score.'}
            {saveStatus === 'unavailable' && 'Your result is shown here, but score saving is not configured.'}
            {saveStatus === 'error' && 'Your result is safe on screen, but could not be sent. Take a screenshot for the host.'}
          </p>
          <div className="result-actions">
            <Link href="/standings" className="button button--primary">View standings <span aria-hidden="true">→</span></Link>
            <button type="button" className="button button--ghost" onClick={restartChallenge}>Play again</button>
          </div>
        </section>
      </div>
    );
  }

  const question = QUESTIONS[currentQuestion];
  const progress = ((currentQuestion + 1) / QUESTIONS.length) * 100;
  const timerUrgent = timeLeft <= 10;

  return (
    <div className="challenge-page challenge-page--active page-enter">
      <div className="ambient-fire ambient-fire--active" aria-hidden="true" />
      <section className="question-shell glass-panel" aria-labelledby="question-title">
        <div className="question-scorebug">
          <div>
            <p className="section-kicker">Immunity challenge</p>
            <span className="question-count">Question {currentQuestion + 1} <i>/</i> {QUESTIONS.length}</span>
          </div>
          <div className={`timer ${timerUrgent ? 'timer--urgent' : ''}`} role="timer" aria-label={`${timeLeft} seconds remaining`}>
            <strong>{timeLeft}</strong><span>sec</span>
          </div>
        </div>
        <div className="progress-track" aria-hidden="true">
          <span style={{ transform: `scaleX(${progress / 100})` }} />
        </div>
        <p className="sr-only">Question {currentQuestion + 1} of {QUESTIONS.length}</p>
        <h1 id="question-title" className="question-title">{question.question}</h1>
        <div className="answer-grid">
          {question.options.map((option, index) => (
            <button
              key={option}
              type="button"
              disabled={selectedAnswer !== null}
              className={`answer-option ${selectedAnswer === index ? 'answer-option--selected' : ''}`}
              onClick={() => handleAnswer(index)}
            >
              <span className="answer-option__letter" aria-hidden="true">{ANSWER_LETTERS[index]}</span>
              <span>{option}</span>
              <span className="answer-option__arrow" aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
        <p className="question-footnote">Choose once. Your answer locks immediately.</p>
      </section>
    </div>
  );
}
