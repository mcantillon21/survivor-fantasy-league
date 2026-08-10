'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  SYMBOLS,
  createCoordinateSecret,
  createRng,
  createSymbolSequence,
  scoreCoordinateGuess,
  shuffleSeeded,
} from '@/lib/challenges/logic';
import { Chess, type Square } from 'chess.js';
import { PUZZLES_BY_TIER, defenderIsLost, toughestDefence } from '@/lib/challenges/chess-puzzles';
import type { EngineProps } from './engine-types';

function useStoredGameState<T>(key: string, initialState: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return initialState;
    try {
      const stored = window.localStorage.getItem(key);
      return stored ? JSON.parse(stored) as T : initialState;
    } catch {
      return initialState;
    }
  });

  const setStoredState = useCallback<Dispatch<SetStateAction<T>>>((nextState) => {
    setState((previous) => {
      const resolved = typeof nextState === 'function'
        ? (nextState as (value: T) => T)(previous)
        : nextState;
      window.localStorage.setItem(key, JSON.stringify(resolved));
      return resolved;
    });
  }, [key]);

  return [state, setStoredState];
}

interface ChoiceQuestion {
  prompt: string;
  options: string[];
  answer: number;
}

function ChoiceEngine({
  questions,
  persistenceKey,
  onComplete,
  kicker,
  timeLimitSeconds,
}: EngineProps & { questions: ChoiceQuestion[]; kicker: string; timeLimitSeconds?: number }) {
  const [state, setState] = useStoredGameState(persistenceKey, { index: 0, correct: 0 });
  const [secondsLeft, setSecondsLeft] = useState(timeLimitSeconds ?? 0);
  const doneRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const question = questions[state.index];

  const finish = useCallback((correct: number, answered: number, timedOut: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    onComplete({
      rawScore: Math.round((correct / questions.length) * 1000),
      summary: timedOut
        ? `Time! ${correct} correct out of ${answered} answered.`
        : `${correct} of ${questions.length} answers were correct.`,
    });
  }, [onComplete, questions.length]);

  // Optional countdown: when it hits zero the run ends with the answers so far.
  useEffect(() => {
    if (!timeLimitSeconds) return;
    if (secondsLeft <= 0) { finish(stateRef.current.correct, stateRef.current.index, true); return; }
    const timer = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [finish, secondsLeft, timeLimitSeconds]);

  const choose = (answer: number) => {
    if (doneRef.current) return;
    const correct = state.correct + (answer === question.answer ? 1 : 0);
    if (state.index === questions.length - 1) {
      finish(correct, questions.length, false);
      return;
    }
    setState({ index: state.index + 1, correct });
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <section className="engine-board engine-board--choice" aria-labelledby="engine-question">
      <div className="engine-progress"><span>{kicker}</span><span>{timeLimitSeconds ? <span aria-label={`${secondsLeft} seconds left`}>⏱ {mm}:{ss} · </span> : null}{state.index + 1} / {questions.length}</span></div>
      <div className="progress-track"><span style={{ transform: `scaleX(${(state.index + 1) / questions.length})` }} /></div>
      <h2 id="engine-question">{question.prompt}</h2>
      <div className="answer-grid">
        {question.options.map((option, index) => (
          <button key={option} type="button" className="answer-option" onClick={() => choose(index)}>
            <span className="answer-option__letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
            <span>{option}</span>
            <span className="answer-option__arrow" aria-hidden="true">↗</span>
          </button>
        ))}
      </div>
    </section>
  );
}

// Ported from the host's Kahoot ("Survivor Trivia Seasons 1-40"), minus the
// picture-identification and audio questions that cannot work as text.
const TRIVIA_QUESTIONS: ChoiceQuestion[] = [
  { prompt: 'Who notoriously flipped a split alliance in season 23?', options: ['Tyson', 'Cochran', 'Joe Anglim', 'Andrea'], answer: 1 },
  { prompt: 'By episode 7 of Winners at War, which castaway had the most confessionals?', options: ['Tony', 'Michele', 'Rob', 'Adam'], answer: 3 },
  { prompt: 'Which of the following players featured in exactly two seasons?', options: ['Sandra Diaz-Twine', 'Johnny Fairplay', 'Tony Vlachos', 'Jeremy Collins'], answer: 1 },
  { prompt: 'Who of the following did not return for season 38?', options: ['Wentworth', 'Wardog', 'Joe', 'Aubry'], answer: 1 },
  { prompt: 'What season of Survivor is the only one to feature both a gravedigger and an ice cream scooper?', options: ['13', '14', '16', '17'], answer: 2 },
  { prompt: 'Upolu was the name of a tribe in what season?', options: ['13', '14', '20', '23'], answer: 3 },
  { prompt: 'Who was voted by the Winners at War cast to be the best player to never win a season?', options: ['Colby', 'Cirie', 'Russell', 'Rick Devens'], answer: 1 },
  { prompt: 'Who holds the record for most career individual immunity challenges won?', options: ['Ozzy Lusth', 'Joe Anglim', 'Colby Donaldson', 'Boston Rob'], answer: 3 },
  { prompt: 'What does Survivor refer to its soundtrack as?', options: ['New Frontier', 'Ancient Voices', 'The Strong Will Survive', 'Survivor Yell'], answer: 1 },
  { prompt: 'Who was Gary Hogeboom?', options: ['The name of the contestant that had left the game before it even started.', 'The husband of Sandra Diaz-Twine.', 'The finder of the first ever hidden immunity idol.', 'A producer of the show.'], answer: 2 },
  { prompt: 'Who holds a record for receiving 36 votes total in one season?', options: ['Andrea', 'Wentworth', 'Ciera', 'Ozzy'], answer: 0 },
  { prompt: 'Who is the oldest Survivor winner in history?', options: ['Tom', 'Bob', 'Tony (second win)', 'Cochran'], answer: 1 },
  { prompt: 'Who said "Be the wizard"?', options: ['Coach', 'Tyson', 'Cirie', 'Taj'], answer: 0 },
  { prompt: 'Ciera Eastin...', options: ['played the most hidden immunity idols in one season.', 'played the game 4 times.', 'quit the game because she didn\'t want to go to the bathroom in the water.', 'voted out her mother.'], answer: 3 },
  { prompt: 'Which one has a different occupation than the rest?', options: ['Tony Vlachos', 'Sarah Lacina', 'Boston Rob'], answer: 2 },
  { prompt: 'What season was circulated around notorious mistakes made by players from previous seasons?', options: ['28', '31', '34', '36'], answer: 3 },
  { prompt: 'Cambodia Second Chance is the name of what season?', options: ['29', '30', '31', '32'], answer: 2 },
  { prompt: 'What season did not divide tribes by fans and favorites?', options: ['16', '21', '26'], answer: 1 },
  { prompt: 'What season included 3 players that were medically evacuated from a previous season?', options: ['Philippines', 'Caramoan', 'Blood vs. Water', 'Worlds Apart'], answer: 0 },
  { prompt: 'Tribes from season 32 were divided by brains, brawn, and beauty.', options: ['True', 'False'], answer: 0 },
  { prompt: 'Dean Kowalski earned how many votes at final tribal council in season 39?', options: ['8', '4', '3', '2'], answer: 3 },
  { prompt: 'Which season is the only season the player who received 0 votes at final tribal selected the winner?', options: ['Heroes vs. Healers vs. Hustlers', 'Ghost Island', 'David vs. Goliath', 'Edge of Extinction'], answer: 1 },
  { prompt: 'What is the name of the alliance built by Sarah Lacina and Tony Vlachos?', options: ['Toys R Us', 'Widows R Us', 'Cops R Us', 'Mason Dixon'], answer: 2 },
  { prompt: 'Which season did the reading of the final tribal votes take place in Jeff Probst\'s garage?', options: ['Caramoan', 'Edge of Extinction', 'Micronesia', 'Winners at War'], answer: 3 },
  { prompt: 'Which of the following seasons did NOT take place in Pearl Islands, Panama?', options: ['5', '7', '8', '12'], answer: 0 },
  { prompt: 'Which season aired the show on Thursdays instead of Wednesdays?', options: ['1', '17', '25', '29'], answer: 1 },
  { prompt: 'The winner of Survivor is deemed the "__________ Survivor".', options: ['Sole', 'Ultimate', 'Surviving', 'Cool'], answer: 0 },
  { prompt: 'Who got really mad at their own family member due to their lack in skill at the "family visit"?', options: ['Rupert', 'Colby', 'Andrea', 'Taj'], answer: 1 },
  { prompt: 'The "Exile Alliance"...', options: ['occurred in season 10.', 'came after the Mason Dixon alliance.', 'included Coach and Tyson.', 'held two idols at one point.'], answer: 3 },
  { prompt: 'Chris _____ was deemed Sole Survivor of season ___.', options: ['Underworth, 38', 'Underwood, 38', 'Underworth, 39', 'Underwood, 39'], answer: 1 },
  { prompt: 'What "David" became victorious in a modern season?', options: ['Jeremy Collins', 'Sarah Lacina', 'Mike White', 'Nick Wilson'], answer: 3 },
  { prompt: 'Who created the merged tribe name for Survivor: Micronesia?', options: ['James', 'Amanda', 'Cirie', 'Erik'], answer: 3 },
  { prompt: 'He claimed the name was Micronesian for ____. He lied.', options: ['Good', 'Survivor', 'Peace', 'Love'], answer: 0 },
  { prompt: 'Borneo is...', options: ['Richard Hatch\'s first and only season.', 'Richard Hatch\'s last season.', 'the first season of Survivor.', 'a season where all first vote-outs returned.'], answer: 2 },
  { prompt: 'Who is Russell Hantz\'s nephew?', options: ['Brendon', 'Brendan', 'Brandon', 'Branden'], answer: 2 },
  { prompt: 'Who had to skip a season of running in college to play the game?', options: ['Erik', 'Sandra', 'Tyson', 'Sundra'], answer: 0 },
  { prompt: 'Parvati is...', options: ['a villain', 'a hero', 'not from Heroes vs. Villains'], answer: 0 },
  { prompt: 'Jerri is...', options: ['a villain', 'a hero', 'not from Heroes vs. Villains'], answer: 0 },
  { prompt: 'Boston Rob is married to ______.', options: ['Andrea', 'Nicole', 'J\'tia', 'Amber'], answer: 3 },
  { prompt: 'Who likes Applebee\'s as their favorite sit-down restaurant?', options: ['Tyson', 'Coach', 'Karishma', 'Tony'], answer: 2 },
  { prompt: 'Who was removed from Season 39 due to being too touchy behind the scenes?', options: ['Wardog', 'Dan', 'Wentworth', 'Larry'], answer: 1 },
  { prompt: 'Which winner\'s twin was voted out first in the same season?', options: ['Parvati', 'Natalia', 'Natalie', 'Mike'], answer: 2 },
  { prompt: 'Sarah Lacina is the winner of...', options: ['Heroes vs. Healers vs. Hustlers', 'Second Chance Cambodia', 'Game Changers', 'Ghost Island'], answer: 2 },
];









interface MemoryState {
  round: number;
  phase: 'study' | 'recall';
  guess: string[];
  points: number;
}

function MemoryTotem({ seed, persistenceKey, onComplete }: EngineProps) {
  const [state, setState] = useStoredGameState<MemoryState>(persistenceKey, { round: 0, phase: 'study', guess: [], points: 0 });
  const sequence = useMemo(() => createSymbolSequence(`${seed}:${state.round}`, state.round + 3), [seed, state.round]);

  useEffect(() => {
    if (state.phase !== 'study') return;
    const timer = window.setTimeout(() => setState((current) => ({ ...current, phase: 'recall', guess: [] })), 2400);
    return () => window.clearTimeout(timer);
  }, [setState, state.phase]);

  const choose = (symbol: string) => {
    if (state.phase !== 'recall') return;
    const guess = [...state.guess, symbol];
    if (guess.length < sequence.length) {
      setState({ ...state, guess });
      return;
    }
    const correctPositions = guess.filter((item, index) => item === sequence[index]).length;
    const roundPoints = Math.round((correctPositions / sequence.length) * 250);
    const points = state.points + roundPoints;
    if (state.round === 3) {
      onComplete({ rawScore: points, summary: `${points} memory points earned across four expanding totems.` });
      return;
    }
    setState({ round: state.round + 1, phase: 'study', guess: [], points });
  };

  return (
    <section className="engine-board engine-board--memory" aria-labelledby="memory-title">
      <div className="engine-progress"><span>Totem {state.round + 1} / 4</span><span>{state.points} points</span></div>
      <h2 id="memory-title">{state.phase === 'study' ? 'Memorize the order.' : 'Rebuild the totem.'}</h2>
      {state.phase === 'study' ? (
        <div className="totem-sequence" aria-label={`Sequence: ${sequence.join(' ')}`}>{sequence.map((symbol, index) => <span key={`${symbol}-${index}`}>{symbol}</span>)}</div>
      ) : (
        <>
          <div className="totem-sequence totem-sequence--guess" aria-label={`${state.guess.length} of ${sequence.length} symbols selected`}>
            {Array.from({ length: sequence.length }, (_, index) => <span key={index}>{state.guess[index] || '·'}</span>)}
          </div>
          <div className="symbol-palette">{SYMBOLS.map((symbol) => <button key={symbol} type="button" onClick={() => choose(symbol)} aria-label={`Add ${symbol}`}>{symbol}</button>)}</div>
        </>
      )}
    </section>
  );
}

function IslandCoordinates({ seed, persistenceKey, onComplete }: EngineProps) {
  const secret = useMemo(() => createCoordinateSecret(seed), [seed]);
  const [state, setState] = useStoredGameState<{ guesses: string[][]; current: string[] }>(persistenceKey, { guesses: [], current: [] });
  const addSymbol = (symbol: string) => state.current.length < 4 && setState({ ...state, current: [...state.current, symbol] });

  const MAX_GUESSES = 8;
  const submitGuess = () => {
    if (state.current.length !== 4) return;
    const feedback = scoreCoordinateGuess(secret, state.current);
    if (feedback.exact === 4) {
      onComplete({ rawScore: Math.max(230, 1000 - state.guesses.length * 110), summary: `The landing coordinates were solved in ${state.guesses.length + 1} guesses.` });
      return;
    }
    const guesses = [...state.guesses, state.current];
    if (guesses.length >= MAX_GUESSES) {
      onComplete({ rawScore: 0, summary: 'Ran out of guesses — the coordinates were not cracked.' });
      return;
    }
    setState({ guesses, current: [] });
  };
  const giveUp = () => onComplete({ rawScore: 0, summary: 'Skipped the coordinates puzzle.' });

  return (
    <section className="engine-board engine-board--coordinates" aria-labelledby="coordinates-title">
      <div className="engine-progress"><span>Deduction board</span><span>{state.guesses.length + 1} / 8 guesses</span></div>
      <h2 id="coordinates-title">Locate the four-symbol landing site.</h2>
      <div className="coordinate-history">
        {state.guesses.map((guess, index) => {
          const feedback = scoreCoordinateGuess(secret, guess);
          return <div key={index}><span>{guess.join(' ')}</span><small>{feedback.exact} exact · {feedback.present} present</small></div>;
        })}
      </div>
      <div className="coordinate-current">{Array.from({ length: 4 }, (_, index) => <span key={index}>{state.current[index] || '·'}</span>)}</div>
      <div className="symbol-palette">{SYMBOLS.map((symbol) => <button key={symbol} type="button" onClick={() => addSymbol(symbol)}>{symbol}</button>)}</div>
      <div className="engine-actions"><button type="button" className="button button--ghost" onClick={() => setState({ ...state, current: state.current.slice(0, -1) })}>Undo</button><button type="button" className="button button--primary" disabled={state.current.length !== 4} onClick={submitGuess}>Test coordinates</button><button type="button" className="button button--ghost" onClick={giveUp}>Skip (no points)</button></div>
    </section>
  );
}



interface RiskState { round: number; deck: number[]; index: number; hand: number[]; banked: number; }

function RiskTheFlame({ seed, persistenceKey, onComplete }: EngineProps) {
  const deck = useMemo(() => shuffleSeeded([1,2,3,4,5,6,7,8,9,10,10,10,11,1,2,3,4,5,6,7,8,9,10,10,11], seed), [seed]);
  const [state, setState] = useStoredGameState<RiskState>(persistenceKey, { round: 1, deck, index: 2, hand: deck.slice(0, 2), banked: 0 });
  const total = state.hand.reduce((sum, card) => sum + card, 0);

  const finishRound = (roundScore: number, nextIndex = state.index) => {
    const banked = state.banked + roundScore;
    if (state.round === 3) {
      onComplete({ rawScore: Math.round((banked / 63) * 1000), summary: `Banked ${banked} safe flame points across three rounds.` });
      return;
    }
    setState({ round: state.round + 1, deck: state.deck, index: nextIndex + 2, hand: state.deck.slice(nextIndex, nextIndex + 2), banked });
  };

  const draw = () => {
    const hand = [...state.hand, state.deck[state.index]];
    const nextTotal = hand.reduce((sum, card) => sum + card, 0);
    if (nextTotal > 21) { finishRound(0, state.index + 1); return; }
    setState({ ...state, hand, index: state.index + 1 });
  };

  return (
    <section className="engine-board engine-board--risk" aria-labelledby="risk-title">
      <div className="engine-progress"><span>Round {state.round} / 3</span><span>{state.banked} banked</span></div>
      <h2 id="risk-title">Reach 21 without burning out.</h2>
      <div className="fire-total"><span>Current flame</span><strong>{total}</strong><small>/ 21</small></div>
      <div className="fire-cards">{state.hand.map((card, index) => <span key={`${card}-${index}`}>{card}</span>)}</div>
      <div className="engine-actions"><button type="button" className="button button--primary" onClick={draw}>Draw flame</button><button type="button" className="button button--ghost" onClick={() => finishRound(total)}>Hold</button></div>
    </section>
  );
}

interface OathState { round: number; hits: number; falseTaps: number; phase: 'wait' | 'live' | 'done'; }

const OATH_ROUNDS = 8;

function OathOfAttention({ seed, persistenceKey, onComplete }: EngineProps) {
  const [state, setState] = useStoredGameState<OathState>(persistenceKey, { round: 0, hits: 0, falseTaps: 0, phase: 'wait' });
  // Wide spread between flames (0.5s–3.5s) so the rhythm never becomes predictable.
  const delay = useMemo(() => 500 + Math.floor(createRng(`${seed}:${state.round}`)() * 3000), [seed, state.round]);

  const advance = useCallback((hit: boolean) => {
    const hits = state.hits + (hit ? 1 : 0);
    if (state.round === OATH_ROUNDS - 1) {
      setState({ round: OATH_ROUNDS, hits, falseTaps: state.falseTaps, phase: 'done' });
      onComplete({ rawScore: Math.max(0, hits * 125 - state.falseTaps * 60), summary: `${hits} of ${OATH_ROUNDS} live flames caught with ${state.falseTaps} early taps.` });
      return;
    }
    setState({ ...state, round: state.round + 1, hits, phase: 'wait' });
  }, [onComplete, setState, state]);

  useEffect(() => {
    if (state.phase === 'wait') {
      const timer = window.setTimeout(() => setState((current) => ({ ...current, phase: 'live' })), delay);
      return () => window.clearTimeout(timer);
    }
    if (state.phase === 'live') {
      const timer = window.setTimeout(() => advance(false), 600);
      return () => window.clearTimeout(timer);
    }
  }, [advance, delay, setState, state.phase]);

  const tap = () => {
    if (state.phase === 'live') { advance(true); return; }
    if (state.phase === 'wait') setState({ ...state, falseTaps: state.falseTaps + 1 });
  };

  return (
    <section className="engine-board engine-board--oath" aria-labelledby="oath-title">
      <div className="engine-progress"><span>Signal {Math.min(state.round + 1, OATH_ROUNDS)} / {OATH_ROUNDS}</span><span>{state.hits} caught · {state.falseTaps} early</span></div>
      <h2 id="oath-title">Wait for the flame to turn live.</h2>
      <button type="button" className={`oath-flame ${state.phase === 'live' ? 'oath-flame--live' : ''}`} onClick={tap} aria-label={state.phase === 'live' ? 'Live flame — tap now' : 'Dormant flame — wait'}>
        <span aria-hidden="true">{state.phase === 'live' ? '✦' : '·'}</span><strong>{state.phase === 'live' ? 'Strike now' : 'Hold your focus'}</strong>
      </button>
    </section>
  );
}

const COMMAND_SEQUENCE = ['torch', 'compass', 'compass', 'rope'];
// Decoys are NOT labelled "decoy" — they are near-lookalikes of the real items
// (lantern≈torch, sundial≈compass, cord≈rope) to tempt a hasty tap.
const COMMAND_ITEMS = [
  { id: 'torch', label: 'Torch', symbol: '✦' },
  { id: 'lantern', label: 'Lantern', symbol: '✧' },
  { id: 'compass', label: 'Compass', symbol: '⌖' },
  { id: 'sundial', label: 'Sundial', symbol: '⊗' },
  { id: 'rope', label: 'Rope', symbol: '∞' },
  { id: 'cord', label: 'Cord', symbol: '≈' },
];
const COMMAND_BRIEFING = 'Tap the Torch once, the Compass twice, then the Rope. Trust nothing that only looks similar — a Lantern is not a Torch, a Sundial is not a Compass, a Cord is not a Rope.';

interface CommandState { phase: 'briefing' | 'command'; index: number; mistakes: number; }

function CommandFromCamp({ persistenceKey, onComplete }: EngineProps) {
  const [state, setState] = useStoredGameState<CommandState>(persistenceKey, { phase: 'briefing', index: 0, mistakes: 0 });

  const act = (id: string) => {
    if (id !== COMMAND_SEQUENCE[state.index]) {
      setState({ ...state, index: 0, mistakes: state.mistakes + 1 });
      return;
    }
    if (state.index === COMMAND_SEQUENCE.length - 1) {
      onComplete({ rawScore: Math.max(200, 1000 - state.mistakes * 140), summary: `The command was executed with ${state.mistakes} sequence resets.` });
      return;
    }
    setState({ ...state, index: state.index + 1 });
  };

  // Briefing phase: show ONLY the instruction (no items on screen to tap yet).
  if (state.phase === 'briefing') {
    return (
      <section className="engine-board engine-board--command" aria-labelledby="command-title">
        <div className="engine-progress"><span>Command briefing</span><span>Memorize the order</span></div>
        <h2 id="command-title">Read your orders from camp.</h2>
        <div className="cipher-strip" aria-label="Command briefing">{COMMAND_BRIEFING}</div>
        <button type="button" className="button button--primary" onClick={() => setState({ ...state, phase: 'command' })}>
          Hide orders &amp; begin
        </button>
      </section>
    );
  }

  // Command phase: instruction is hidden; only the items (images) are shown.
  return (
    <section className="engine-board engine-board--command" aria-labelledby="command-title">
      <div className="engine-progress"><span>Execute from memory</span><span>{state.index} / {COMMAND_SEQUENCE.length} correct</span></div>
      <h2 id="command-title">Carry out the command.</h2>
      <div className="command-items">{COMMAND_ITEMS.map((item) => <button key={item.id} type="button" onClick={() => act(item.id)}><span aria-hidden="true">{item.symbol}</span><strong>{item.label}</strong></button>)}</div>
      <p className="engine-penalty">Sequence resets: {state.mistakes}</p>
    </section>
  );
}

function VaultLock({ seed, onComplete }: EngineProps) {
  const TARGET_PINS = 10;
  const ZONE = 15; // degrees of tolerance on either side of the notch
  const rng = useMemo(() => createRng(`vault:${seed}`), [seed]);
  const angleRef = useRef(0);
  const dirRef = useRef(1);
  const speedRef = useRef(150); // degrees per second
  const [angle, setAngle] = useState(0);
  const [target, setTarget] = useState(() => 40 + rng() * 280);
  const [opened, setOpened] = useState(0);
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');

  const arc = (a: number, b: number) => {
    const raw = Math.abs(a - b) % 360;
    return Math.min(raw, 360 - raw);
  };

  useEffect(() => {
    if (status !== 'playing') return;
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      if (!last) last = now;
      const dt = (now - last) / 1000;
      last = now;
      angleRef.current = (angleRef.current + dirRef.current * speedRef.current * dt + 360) % 360;
      setAngle(angleRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status]);

  const pop = useCallback(() => {
    if (status !== 'playing') return;
    if (arc(angleRef.current, target) <= ZONE) {
      const nextOpened = opened + 1;
      setOpened(nextOpened);
      if (nextOpened >= TARGET_PINS) {
        setStatus('won');
        onComplete({ rawScore: 1000, summary: `All ${TARGET_PINS} pins popped — the vault is open.` });
        return;
      }
      // Speed up, sometimes reverse, and drop the next notch away from the dial.
      speedRef.current = Math.min(430, speedRef.current + 24);
      if (rng() < 0.5) dirRef.current *= -1;
      let next = rng() * 360;
      while (arc(next, angleRef.current) < 70) next = rng() * 360;
      setTarget(next);
    } else {
      setStatus('lost');
      onComplete({ rawScore: Math.round((opened / TARGET_PINS) * 1000), summary: `${opened} of ${TARGET_PINS} pins popped before a miss.` });
    }
  }, [onComplete, opened, rng, status, target]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault();
        pop();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pop]);

  const C = 130;
  const R = 104;
  const point = (deg: number, radius = R): [number, number] => [
    C + radius * Math.cos(((deg - 90) * Math.PI) / 180),
    C + radius * Math.sin(((deg - 90) * Math.PI) / 180),
  ];
  const [px, py] = point(angle);
  const [tx, ty] = point(target);
  const live = status === 'playing' && arc(angle, target) <= ZONE;

  return (
    <section className="engine-board engine-board--vault" aria-labelledby="vault-title">
      <div className="engine-progress"><span>Pins popped</span><span>{opened} / {TARGET_PINS}</span></div>
      <h2 id="vault-title">Stop the dial on the glowing notch.</h2>
      <svg viewBox="0 0 260 260" width="100%" style={{ maxWidth: 260, margin: '0 auto', display: 'block' }} role="img" aria-label={`Vault dial, ${opened} of ${TARGET_PINS} pins popped`}>
        <circle cx={C} cy={C} r={R} fill="none" stroke="#3f3f46" strokeWidth={12} />
        <circle cx={tx} cy={ty} r={13} fill={live ? '#f97316' : '#facc15'} stroke="#000" strokeWidth={2} />
        <line x1={C} y1={C} x2={px} y2={py} stroke="#ffffff" strokeWidth={4} strokeLinecap="round" />
        <circle cx={px} cy={py} r={9} fill="#ffffff" />
        <circle cx={C} cy={C} r={20} fill="#18181b" stroke="#3f3f46" strokeWidth={3} />
      </svg>
      <div className="engine-actions">
        <button type="button" className="button button--primary" onClick={pop} disabled={status !== 'playing'}>
          Pop the lock
        </button>
      </div>
      <p className="engine-penalty">Tap the button or press Space when the dial reaches the notch. One miss ends the run.</p>
    </section>
  );
}

// 4×4 sliding puzzle (the classic 15-puzzle). The board is scrambled by playing
// random legal moves backward from the solved state, so it is always solvable.
function SlidePuzzle({ seed, persistenceKey, onComplete }: EngineProps) {
  const scrambled = useMemo(() => {
    const rng = createRng(`slide:${seed}`);
    const tiles = Array.from({ length: 16 }, (_, index) => (index + 1) % 16); // 1..15, 0 = gap
    let gap = 15;
    let previous = -1;
    for (let step = 0; step < 220; step++) {
      const column = gap % 4;
      const candidates = [
        gap - 4,
        gap + 4,
        column > 0 ? gap - 1 : -1,
        column < 3 ? gap + 1 : -1,
      ].filter((cell) => cell >= 0 && cell <= 15 && cell !== previous);
      const pick = candidates[Math.floor(rng() * candidates.length)];
      tiles[gap] = tiles[pick];
      tiles[pick] = 0;
      previous = gap;
      gap = pick;
    }
    return tiles;
  }, [seed]);
  const [state, setState] = useStoredGameState(persistenceKey, { tiles: scrambled, moves: 0 });

  const slide = (index: number) => {
    const gap = state.tiles.indexOf(0);
    const rowDistance = Math.abs(Math.floor(index / 4) - Math.floor(gap / 4));
    const columnDistance = Math.abs((index % 4) - (gap % 4));
    if (rowDistance + columnDistance !== 1) return; // not adjacent to the gap
    const tiles = [...state.tiles];
    tiles[gap] = tiles[index];
    tiles[index] = 0;
    const moves = state.moves + 1;
    if (tiles.every((tile, cell) => tile === (cell + 1) % 16)) {
      onComplete({ rawScore: Math.max(250, 1000 - Math.max(0, moves - 80) * 5), summary: `Rebuilt the 4×4 puzzle in ${moves} moves.` });
      return;
    }
    setState({ tiles, moves });
  };

  return (
    <section className="engine-board engine-board--slide" aria-labelledby="slide-title">
      <div className="engine-progress"><span>Shipwreck slide</span><span>{state.moves} moves</span></div>
      <h2 id="slide-title">Slide the tiles back into order.</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, width: '100%', maxWidth: 340, margin: '0 auto' }} role="grid" aria-label="Sliding puzzle board">
        {state.tiles.map((tile, index) => tile === 0 ? (
          <span key="gap" aria-label="Empty space" style={{ aspectRatio: '1', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.15)' }} />
        ) : (
          <button key={tile} type="button" onClick={() => slide(index)} aria-label={`Tile ${tile}`}
            style={{ aspectRatio: '1', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 24, fontWeight: 700, background: 'linear-gradient(180deg, #f0d9b5, #d9b98c)', color: '#3a2a1a' }}>
            {tile}
          </button>
        ))}
      </div>
      <p className="engine-penalty">Arrange 1–15 in reading order with the gap in the last corner. Fewer moves score higher.</p>
      <div className="engine-actions">
        <button type="button" className="button button--ghost" onClick={() => onComplete({ rawScore: 0, summary: 'Skipped the sliding puzzle.' })}>Skip (no points)</button>
      </div>
    </section>
  );
}

const PIECE_GLYPH: Record<string, string> = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };

// Chess.com Puzzle Rush–style challenge: 5 minutes to solve as many mate
// puzzles as you can. Puzzles ramp in difficulty — all mate-in-1s first, then
// mate-in-2s, then mate-in-3s. On the longer puzzles the engine plays the
// toughest defence between your moves; a puzzle counts only if every one of
// your moves keeps the mate forced, ending in checkmate.
function ChessPuzzleRush({ seed, onComplete }: EngineProps) {
  const DURATION = 300; // 5 minutes
  // Ramp difficulty: shuffled mate-in-1s, then mate-in-2s, then mate-in-3s.
  const order = useMemo(
    () => ([1, 2, 3] as const).flatMap((tier) => shuffleSeeded([...PUZZLES_BY_TIER[tier]], `chess:${tier}:${seed}`)),
    [seed],
  );

  // Position within the current puzzle. `pos` indexes `order`; `fen` is the live
  // board (which the engine mutates between moves); `movesMade` counts the
  // player's attacker moves so far. All three reset together in `advance()`, so
  // no state-syncing effect is needed.
  const [board, setBoard] = useState(() => ({ pos: 0, fen: order[0].fen, movesMade: 0 }));
  const active = order[board.pos % order.length];
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); // engine is replying — block input
  const [counts, setCounts] = useState({ m1: 0, m2: 0, m3: 0 });
  const [feedback, setFeedback] = useState<'idle' | 'solved' | 'wrong' | 'progress'>('idle');
  const [secondsLeft, setSecondsLeft] = useState(DURATION);
  const doneRef = useRef(false);
  const statsRef = useRef({ m1: 0, m2: 0, m3: 0 });

  const attackerColor = useMemo(() => new Chess(active.fen).turn(), [active.fen]);
  const game = useMemo(() => new Chess(board.fen), [board.fen]);
  const solvedTotal = counts.m1 + counts.m2 + counts.m3;

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    const s = statsRef.current;
    const points = s.m1 + s.m2 * 2 + s.m3 * 3;
    const total = s.m1 + s.m2 + s.m3;
    onComplete({
      rawScore: Math.min(1000, Math.round((points / 15) * 1000)),
      summary: `${total} puzzle${total === 1 ? '' : 's'} solved in 5 minutes (${s.m1}× mate-in-1, ${s.m2}× mate-in-2, ${s.m3}× mate-in-3).`,
    });
  }, [onComplete]);

  useEffect(() => {
    if (secondsLeft <= 0) { finish(); return; }
    const t = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [secondsLeft, finish]);

  const advance = () => {
    setSelected(null);
    setBusy(false);
    setBoard((b) => {
      const next = b.pos + 1;
      return { pos: next, fen: order[next % order.length].fen, movesMade: 0 };
    });
  };

  const recordSolve = () => {
    const key = `m${active.mateIn}` as 'm1' | 'm2' | 'm3';
    statsRef.current = { ...statsRef.current, [key]: statsRef.current[key] + 1 };
    setCounts(statsRef.current);
  };

  const flashThenAdvance = (kind: 'solved' | 'wrong') => {
    setFeedback(kind);
    window.setTimeout(() => setFeedback('idle'), 500);
    advance();
  };

  const attempt = (from: string, to: string) => {
    const probe = new Chess(board.fen);
    let move = null;
    try { move = probe.move({ from: from as Square, to: to as Square, promotion: 'q' }); } catch { move = null; }
    if (!move) { setSelected(null); return; } // illegal move — ignore

    if (probe.isCheckmate()) { recordSolve(); flashThenAdvance('solved'); return; }

    // Not mate yet: the move only counts if it keeps the mate forced within the
    // remaining budget. attackerLeft = attacker moves still allowed after this one.
    const attackerLeft = active.mateIn - (board.movesMade + 1);
    if (attackerLeft >= 1 && defenderIsLost(probe, attackerLeft)) {
      // On track — show the player's move, then let the engine defend.
      const after = probe.fen();
      setBoard((b) => ({ ...b, fen: after, movesMade: b.movesMade + 1 }));
      setSelected(null);
      setFeedback('progress');
      setBusy(true);
      window.setTimeout(() => {
        if (doneRef.current) return;
        const g = new Chess(after);
        const defence = toughestDefence(g, attackerLeft);
        if (defence) g.move(defence);
        setBoard((b) => ({ ...b, fen: g.fen() }));
        setBusy(false);
      }, 450);
      return;
    }

    flashThenAdvance('wrong'); // wrong move — the mate is no longer forced
  };

  const clickSquare = (square: string) => {
    if (secondsLeft <= 0 || doneRef.current || busy) return;
    const piece = game.get(square as Square);
    if (selected) {
      if (square === selected) { setSelected(null); return; }
      if (piece && piece.color === attackerColor) { setSelected(square); return; }
      attempt(selected, square);
    } else if (piece && piece.color === attackerColor) {
      setSelected(square);
    }
  };

  const grid = game.board();
  const flip = attackerColor === 'b'; // put the side to move at the bottom
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  const cells = [];
  for (let dr = 0; dr < 8; dr++) {
    const r = flip ? 7 - dr : dr;
    for (let dc = 0; dc < 8; dc++) {
      const f = flip ? 7 - dc : dc;
      const square = `${String.fromCharCode(97 + f)}${8 - r}`;
      const piece = grid[r][f];
      const light = (r + f) % 2 === 0;
      const bg = selected === square ? '#f4f169' : light ? '#f0d9b5' : '#b58863';
      cells.push(
        <button key={square} type="button" onClick={() => clickSquare(square)} aria-label={square}
          style={{ aspectRatio: '1', background: bg, border: 'none', padding: 0, cursor: 'pointer', fontSize: 26, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: piece?.color === 'w' ? '#fafafa' : '#111', textShadow: piece?.color === 'w' ? '0 0 2px #000, 0 0 1px #000' : 'none' }}>
          {piece ? PIECE_GLYPH[piece.type] : ''}
        </button>
      );
    }
  }

  return (
    <section className="engine-board engine-board--chess" aria-labelledby="chess-title">
      <div className="engine-progress"><span>Solved {solvedTotal}</span><span aria-label={`${secondsLeft} seconds left`}>⏱ {mm}:{ss}</span></div>
      <h2 id="chess-title">{attackerColor === 'w' ? 'White' : 'Black'} to move — mate in {active.mateIn}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', width: '100%', maxWidth: 360, margin: '0 auto', border: '3px solid #3a2a1a', borderRadius: 6, overflow: 'hidden' }} role="grid" aria-label="Chess board">
        {cells}
      </div>
      <p className="engine-penalty" aria-live="polite">
        {feedback === 'solved'
          ? '✅ Checkmate! Next puzzle…'
          : feedback === 'wrong'
            ? '❌ The mate is no longer forced — next puzzle.'
            : feedback === 'progress' || busy
              ? '↪ Good move — now finish the mate.'
              : active.mateIn === 1
                ? 'Click a piece, then its target square. Solve as many as you can.'
                : 'Find the forcing line — the engine will answer with its best defence.'}
      </p>
      <div className="engine-actions">
        <button type="button" className="button button--ghost" onClick={advance}>Skip</button>
      </div>
    </section>
  );
}

export function GameEngine({ slug, ...props }: EngineProps & { slug: string }) {
  switch (slug) {
    case 'strategy-trivia': return <ChoiceEngine {...props} questions={TRIVIA_QUESTIONS} kicker="Survivor history" timeLimitSeconds={300} />;
    case 'memory-totem': return <MemoryTotem {...props} />;
    case 'island-coordinates': return <IslandCoordinates {...props} />;
    case 'risk-the-flame': return <RiskTheFlame {...props} />;
    case 'oath-of-attention': return <OathOfAttention {...props} />;
    case 'command-from-camp': return <CommandFromCamp {...props} />;
    case 'vault-lock': return <VaultLock {...props} />;
    case 'slide-puzzle': return <SlidePuzzle {...props} />;
    case 'puzzle-rush': return <ChessPuzzleRush {...props} />;
    default: return null;
  }
}
