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
      // Uncapped on purpose: 15 points = 1000, and strong runs keep climbing.
      rawScore: Math.round((points / 15) * 1000),
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

// Whack-a-mole: torches flare briefly in a 4x4 grid — snuff them fast.
function SnuffTheTorches({ seed, onComplete }: EngineProps) {
  const DURATION = 45;
  const GRID = 16;
  const TARGET_HITS = 30; // hits for a perfect 1000
  const rngRef = useRef(createRng(`snuff:${seed}`));
  const [lit, setLit] = useState(-1);
  const [stats, setStats] = useState({ hits: 0, wrong: 0 });
  const [secondsLeft, setSecondsLeft] = useState(DURATION);
  const litRef = useRef(-1);
  const statsRef = useRef({ hits: 0, wrong: 0 });
  const flareTimer = useRef(0);
  const doneRef = useRef(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    window.clearTimeout(flareTimer.current);
    const { hits, wrong } = statsRef.current;
    onComplete({
      rawScore: Math.max(0, Math.min(1000, Math.round((hits / TARGET_HITS) * 1000) - wrong * 25)),
      summary: `Snuffed ${hits} torch${hits === 1 ? '' : 'es'} in ${DURATION} seconds with ${wrong} wild swing${wrong === 1 ? '' : 's'}.`,
    });
  }, [onComplete]);

  const scheduleFlare = useCallback(() => {
    const gap = 250 + rngRef.current() * 450;
    flareTimer.current = window.setTimeout(() => {
      if (doneRef.current) return;
      let next = Math.floor(rngRef.current() * GRID);
      if (next === litRef.current) next = (next + 1) % GRID;
      litRef.current = next;
      setLit(next);
      const litWindow = 550 + rngRef.current() * 450;
      flareTimer.current = window.setTimeout(() => {
        if (doneRef.current) return;
        litRef.current = -1;
        setLit(-1);
        scheduleFlare();
      }, litWindow);
    }, gap);
  }, []);

  useEffect(() => {
    scheduleFlare();
    return () => window.clearTimeout(flareTimer.current);
  }, [scheduleFlare]);

  useEffect(() => {
    if (secondsLeft <= 0) { finish(); return; }
    const timer = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [finish, secondsLeft]);

  const tap = (cell: number) => {
    if (doneRef.current) return;
    if (cell === litRef.current) {
      window.clearTimeout(flareTimer.current);
      litRef.current = -1;
      setLit(-1);
      statsRef.current = { ...statsRef.current, hits: statsRef.current.hits + 1 };
      setStats(statsRef.current);
      scheduleFlare();
    } else {
      statsRef.current = { ...statsRef.current, wrong: statsRef.current.wrong + 1 };
      setStats(statsRef.current);
    }
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <section className="engine-board engine-board--snuff" aria-labelledby="snuff-title">
      <div className="engine-progress"><span>{stats.hits} snuffed · {stats.wrong} wild</span><span aria-label={`${secondsLeft} seconds left`}>⏱ {mm}:{ss}</span></div>
      <h2 id="snuff-title">Snuff the flaring torch — before it settles.</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, maxWidth: 340, margin: '0 auto', width: '100%' }} role="grid" aria-label="Torch grid">
        {Array.from({ length: GRID }, (_, cell) => (
          <button key={cell} type="button" onClick={() => tap(cell)} aria-label={cell === lit ? 'Flaring torch — snuff it' : 'Dormant torch'}
            style={{ aspectRatio: '1', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 26, background: cell === lit ? 'radial-gradient(circle, rgba(255,160,60,0.85), rgba(200,80,20,0.6))' : 'rgba(255,255,255,0.05)', transition: 'background 120ms' }}>
            {cell === lit ? '🔥' : '·'}
          </button>
        ))}
      </div>
      <p className="engine-penalty">{TARGET_HITS} snuffs is a perfect score. Tapping a dormant torch costs 25 points.</p>
    </section>
  );
}

// --- Shared word bank for the word challenges --------------------------------
const SURVIVOR_WORDS = ['SURVIVOR', 'IMMUNITY', 'ALLIANCE', 'BLINDSIDE', 'CASTAWAY', 'CHALLENGE', 'OUTLAST', 'ISLAND', 'COUNCIL', 'TORCH'];

// Tower of Hanoi: move all six discs to the right peg. Optimal is 63 moves.
function TowerOfIdols({ persistenceKey, onComplete }: EngineProps) {
  const DISCS = 6;
  const OPTIMAL = 63;
  const [state, setState] = useStoredGameState<{ pegs: number[][]; moves: number }>(persistenceKey, {
    pegs: [Array.from({ length: DISCS }, (_, i) => DISCS - i), [], []],
    moves: 0,
  });
  const [from, setFrom] = useState<number | null>(null);

  const tap = (peg: number) => {
    if (from === null) {
      if (state.pegs[peg].length) setFrom(peg);
      return;
    }
    if (from === peg) { setFrom(null); return; }
    const disc = state.pegs[from][state.pegs[from].length - 1];
    const target = state.pegs[peg][state.pegs[peg].length - 1];
    if (target !== undefined && target < disc) { setFrom(null); return; } // bigger on smaller — illegal
    const pegs = state.pegs.map((p) => [...p]);
    pegs[peg].push(pegs[from].pop()!);
    const moves = state.moves + 1;
    setFrom(null);
    if (pegs[2].length === DISCS) {
      onComplete({ rawScore: Math.max(250, 1000 - Math.max(0, moves - OPTIMAL) * 10), summary: `Rebuilt the idol tower in ${moves} moves (optimal is ${OPTIMAL}).` });
      return;
    }
    setState({ pegs, moves });
  };

  return (
    <section className="engine-board engine-board--hanoi" aria-labelledby="hanoi-title">
      <div className="engine-progress"><span>Tower of the Idols</span><span>{state.moves} moves</span></div>
      <h2 id="hanoi-title">Move the whole tower to the right pillar.</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, alignItems: 'end', maxWidth: 480, margin: '0 auto', width: '100%' }}>
        {state.pegs.map((peg, pegIndex) => (
          <button key={pegIndex} type="button" onClick={() => tap(pegIndex)} aria-label={`Pillar ${pegIndex + 1}, ${peg.length} discs`}
            style={{ background: from === pegIndex ? 'rgba(255,160,60,0.12)' : 'rgba(255,255,255,0.03)', border: from === pegIndex ? '1px solid rgba(255,160,60,0.6)' : '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 4px 12px', cursor: 'pointer', minHeight: 190, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
            {[...peg].reverse().map((disc) => (
              <span key={disc} style={{ display: 'block', height: 16, width: `${28 + disc * 12}%`, borderRadius: 8, background: 'linear-gradient(180deg, #f0d9b5, #c9995f)' }} />
            ))}
            <span style={{ width: '85%', height: 4, background: 'rgba(255,255,255,0.25)', borderRadius: 2, marginTop: 6 }} />
          </button>
        ))}
      </div>
      <p className="engine-penalty">Tap a pillar to lift its top disc, then tap another to drop it. A bigger disc never sits on a smaller one. Fewer moves score higher.</p>
      <div className="engine-actions">
        <button type="button" className="button button--ghost" onClick={() => onComplete({ rawScore: 0, summary: 'Skipped the tower.' })}>Skip (no points)</button>
      </div>
    </section>
  );
}

// Word Unscramble: ten scrambled Survivor words, typed answers.
function TorchScramble({ seed, persistenceKey, onComplete }: EngineProps) {
  const words = useMemo(() => shuffleSeeded(SURVIVOR_WORDS, `scramble:${seed}`), [seed]);
  const scrambles = useMemo(() => words.map((word, index) => {
    let letters = shuffleSeeded(word.split(''), `letters:${seed}:${index}`);
    if (letters.join('') === word) letters = [...letters.slice(1), letters[0]];
    return letters.join(' ');
  }), [seed, words]);
  const [state, setState] = useStoredGameState(persistenceKey, { index: 0, solved: 0, mistakes: 0 });
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const advance = (didSolve: boolean, mistakes = state.mistakes) => {
    const solved = state.solved + (didSolve ? 1 : 0);
    if (state.index === words.length - 1) {
      onComplete({ rawScore: Math.max(0, Math.round((solved / words.length) * 1000) - mistakes * 15), summary: `Unscrambled ${solved} of ${words.length} words with ${mistakes} wrong guesses.` });
      return;
    }
    setState({ index: state.index + 1, solved, mistakes });
    setValue('');
    setError('');
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (value.trim().toUpperCase().replace(/[^A-Z]/g, '') !== words[state.index]) {
      setState({ ...state, mistakes: state.mistakes + 1 });
      setError('Not quite — try again or skip it.');
      return;
    }
    advance(true);
  };

  return (
    <section className="engine-board engine-board--scramble" aria-labelledby="scramble-title">
      <div className="engine-progress"><span>Torch Scramble</span><span>{state.index + 1} / {words.length} · {state.solved} solved</span></div>
      <h2 id="scramble-title">Unscramble the island word.</h2>
      <div className="cipher-strip" aria-label="Scrambled word">{scrambles[state.index]}</div>
      <form className="puzzle-answer" onSubmit={submit} noValidate>
        <label htmlFor="scramble-answer">Your answer</label>
        <div><input id="scramble-answer" value={value} onChange={(event) => { setValue(event.target.value); setError(''); }} autoComplete="off" spellCheck="false" /><button className="button button--primary" type="submit">Unscramble</button></div>
        {error && <p className="field-error" role="alert">{error}</p>}
      </form>
      <div className="engine-actions">
        <button type="button" className="button button--ghost" onClick={() => advance(false)}>Skip this word (no points)</button>
      </div>
      <p className="engine-penalty">Wrong guesses cost 15 points each.</p>
    </section>
  );
}

// Retyping challenge: copy the passage exactly. Paste is blocked.
// Curly quotes/ellipsis normalized to typable characters; newlines count.
const TRANSCRIPTION_PASSAGE = `Now this season's in the hands of the fans
They're calling the shots, it's out of our hands
They picked the buffs you're wearing today
And the rice and supplies, well, they said 'No way'
And now it's time to drop another fan vote
The dangerous kind, this one will cut your throat
So are you ready to drop your plans?
Are you ready to drop your hands?
Are you ready to drop your bluffs?
Because the fans have spoken, it's time to... Drop your buffs`;

function TorchTranscription({ onComplete }: EngineProps) {
  const [value, setValue] = useState('');

  const submit = () => {
    const target = TRANSCRIPTION_PASSAGE;
    let correct = 0;
    for (let i = 0; i < Math.min(value.length, target.length); i++) {
      if (value[i] === target[i]) correct++;
    }
    const overrun = Math.max(0, value.length - target.length);
    const rawScore = Math.max(0, Math.round(((correct - overrun) / target.length) * 1000));
    onComplete({ rawScore, summary: `${correct} of ${target.length} characters matched exactly.` });
  };

  return (
    <section className="engine-board engine-board--transcribe" aria-labelledby="transcribe-title">
      <div className="engine-progress"><span>Camp transcription</span><span>{value.length} / {TRANSCRIPTION_PASSAGE.length} chars</span></div>
      <h2 id="transcribe-title">Retype the message exactly — every letter, space, and comma.</h2>
      <div className="cipher-strip" aria-label="Passage to retype" style={{ userSelect: 'none', whiteSpace: 'pre-wrap', textAlign: 'left' }}>{TRANSCRIPTION_PASSAGE}</div>
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onPaste={(event) => event.preventDefault()}
        onDrop={(event) => event.preventDefault()}
        rows={10}
        autoComplete="off"
        spellCheck="false"
        aria-label="Type the passage here"
        style={{ width: '100%', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: 'inherit', font: 'inherit', padding: '12px 14px', marginTop: 12 }}
      />
      <p className="engine-penalty">Pasting is disabled. Accuracy earns points; the clock eats them — type fast, type true.</p>
      <div className="engine-actions">
        <button type="button" className="button button--primary" onClick={submit}>Submit transcription</button>
      </div>
    </section>
  );
}

// Word search: find the hidden words in a seeded 10x10 grid.
const WORD_HUNT_WORDS = ['IMMUNITY', 'ALLIANCE', 'BLINDSIDE', 'CASTAWAY', 'TRIBAL', 'MERGE', 'TORCH', 'JURY'];
const HUNT_SIZE = 10;
const HUNT_DIRS: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1], [0, -1], [-1, 0], [-1, -1], [-1, 1]];

function buildWordHunt(seed: string) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const rng = createRng(`hunt:${seed}:${attempt}`);
    const grid: (string | null)[][] = Array.from({ length: HUNT_SIZE }, () => Array(HUNT_SIZE).fill(null));
    const placed: { word: string; cells: [number, number][] }[] = [];
    let ok = true;
    for (const word of [...WORD_HUNT_WORDS].sort((a, b) => b.length - a.length)) {
      let done = false;
      for (let t = 0; t < 120 && !done; t++) {
        const dir = HUNT_DIRS[Math.floor(rng() * HUNT_DIRS.length)];
        const row = Math.floor(rng() * HUNT_SIZE);
        const col = Math.floor(rng() * HUNT_SIZE);
        const endRow = row + dir[0] * (word.length - 1);
        const endCol = col + dir[1] * (word.length - 1);
        if (endRow < 0 || endRow >= HUNT_SIZE || endCol < 0 || endCol >= HUNT_SIZE) continue;
        const cells: [number, number][] = [];
        let fits = true;
        for (let i = 0; i < word.length; i++) {
          const r = row + dir[0] * i;
          const c = col + dir[1] * i;
          if (grid[r][c] !== null && grid[r][c] !== word[i]) { fits = false; break; }
          cells.push([r, c]);
        }
        if (!fits) continue;
        cells.forEach(([r, c], i) => { grid[r][c] = word[i]; });
        placed.push({ word, cells });
        done = true;
      }
      if (!done) { ok = false; break; }
    }
    if (!ok) continue;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const filled = grid.map((row) => row.map((cell) => cell ?? alphabet[Math.floor(rng() * 26)]));
    return { grid: filled, placed };
  }
  // Practically unreachable — 30 seeded layouts always fit these eight words.
  return { grid: Array.from({ length: HUNT_SIZE }, () => Array(HUNT_SIZE).fill('A')), placed: [] };
}

function JungleWordHunt({ seed, persistenceKey, onComplete }: EngineProps) {
  const { grid, placed } = useMemo(() => buildWordHunt(seed), [seed]);
  const [found, setFound] = useStoredGameState<string[]>(persistenceKey, []);
  const [anchor, setAnchor] = useState<[number, number] | null>(null);

  const foundCells = useMemo(() => {
    const set = new Set<string>();
    placed.filter((p) => found.includes(p.word)).forEach((p) => p.cells.forEach(([r, c]) => set.add(`${r},${c}`)));
    return set;
  }, [found, placed]);

  const finish = (words: string[]) => {
    onComplete({ rawScore: Math.round((words.length / WORD_HUNT_WORDS.length) * 1000), summary: `Found ${words.length} of ${WORD_HUNT_WORDS.length} hidden words.` });
  };

  const tap = (row: number, col: number) => {
    if (!anchor) { setAnchor([row, col]); return; }
    const [ar, ac] = anchor;
    setAnchor(null);
    if (ar === row && ac === col) return;
    const dr = Math.sign(row - ar);
    const dc = Math.sign(col - ac);
    const steps = Math.max(Math.abs(row - ar), Math.abs(col - ac));
    if (!((ar + dr * steps === row) && (ac + dc * steps === col))) return; // not a straight line
    let text = '';
    for (let i = 0; i <= steps; i++) text += grid[ar + dr * i][ac + dc * i];
    const reversed = [...text].reverse().join('');
    const hit = placed.find((p) => (p.word === text || p.word === reversed) && !found.includes(p.word));
    if (!hit) return;
    const words = [...found, hit.word];
    setFound(words);
    if (words.length === WORD_HUNT_WORDS.length) finish(words);
  };

  return (
    <section className="engine-board engine-board--hunt" aria-labelledby="hunt-title">
      <div className="engine-progress"><span>Jungle word hunt</span><span>{found.length} / {WORD_HUNT_WORDS.length} found</span></div>
      <h2 id="hunt-title">Find the hidden words.</h2>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${HUNT_SIZE}, 1fr)`, gap: 3, maxWidth: 420, margin: '0 auto', width: '100%' }} role="grid" aria-label="Word search grid">
        {grid.flatMap((rowCells, row) => rowCells.map((letter, col) => {
          const key = `${row},${col}`;
          const isAnchor = anchor?.[0] === row && anchor?.[1] === col;
          const isFound = foundCells.has(key);
          return (
            <button key={key} type="button" onClick={() => tap(row, col)} aria-label={`${letter} at row ${row + 1} column ${col + 1}`}
              style={{ aspectRatio: '1', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 15, background: isAnchor ? '#f4f169' : isFound ? 'rgba(120,220,140,0.35)' : 'rgba(255,255,255,0.06)', color: isAnchor ? '#222' : 'inherit' }}>
              {letter}
            </button>
          );
        }))}
      </div>
      <div className="engine-actions">
        <button type="button" className="button button--ghost" onClick={() => finish(found)}>Finish with what I found</button>
      </div>
    </section>
  );
}

// 2048, island edition. Seeded spawns; bank your score any time.
function Island2048({ seed, onComplete }: EngineProps) {
  const rngRef = useRef(createRng(`2048:${seed}`));
  const spawn = useCallback((board: number[]) => {
    const empty = board.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
    if (!empty.length) return board;
    const next = [...board];
    next[empty[Math.floor(rngRef.current() * empty.length)]] = rngRef.current() < 0.9 ? 2 : 4;
    return next;
  }, []);
  const [board, setBoard] = useState<number[]>(() => spawn(spawn(Array(16).fill(0))));
  const [score, setScore] = useState(0);
  const doneRef = useRef(false);

  const finish = useCallback((finalScore: number, why: string) => {
    if (doneRef.current) return;
    doneRef.current = true;
    onComplete({ rawScore: Math.min(1000, Math.round((finalScore / 20000) * 1000)), summary: `${why} with ${finalScore} points (20,000 points = a perfect score).` });
  }, [onComplete]);

  const move = useCallback((dir: 'up' | 'down' | 'left' | 'right') => {
    if (doneRef.current) return;
    const get = (r: number, c: number) => {
      if (dir === 'left') return board[r * 4 + c];
      if (dir === 'right') return board[r * 4 + (3 - c)];
      if (dir === 'up') return board[c * 4 + r];
      return board[(3 - c) * 4 + r];
    };
    const set = (next: number[], r: number, c: number, v: number) => {
      if (dir === 'left') next[r * 4 + c] = v;
      else if (dir === 'right') next[r * 4 + (3 - c)] = v;
      else if (dir === 'up') next[c * 4 + r] = v;
      else next[(3 - c) * 4 + r] = v;
    };
    const next = Array(16).fill(0);
    let gained = 0;
    let changed = false;
    for (let r = 0; r < 4; r++) {
      const line = [0, 1, 2, 3].map((c) => get(r, c)).filter((v) => v !== 0);
      const merged: number[] = [];
      for (let i = 0; i < line.length; i++) {
        if (i + 1 < line.length && line[i] === line[i + 1]) {
          merged.push(line[i] * 2);
          gained += line[i] * 2;
          i++;
        } else merged.push(line[i]);
      }
      merged.forEach((v, c) => set(next, r, c, v));
      for (let c = 0; c < 4; c++) if (get(r, c) !== next[(dir === 'left') ? r * 4 + c : (dir === 'right') ? r * 4 + (3 - c) : (dir === 'up') ? c * 4 + r : (3 - c) * 4 + r]) changed = true;
    }
    if (!changed) return;
    const spawned = spawn(next);
    const total = score + gained;
    setBoard(spawned);
    setScore(total);
    const anyMove = spawned.includes(0) || spawned.some((v, i) => {
      const r = Math.floor(i / 4); const c = i % 4;
      return (c < 3 && spawned[i + 1] === v) || (r < 3 && spawned[i + 4] === v);
    });
    if (!anyMove) finish(total, 'No moves left');
  }, [board, finish, score, spawn]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const map: Record<string, 'up' | 'down' | 'left' | 'right'> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
      const dir = map[event.key];
      if (dir) { event.preventDefault(); move(dir); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move]);

  const TILE_BG: Record<number, string> = { 2: '#efe4d2', 4: '#ecd9b3', 8: '#f2b179', 16: '#f59563', 32: '#f67c5f', 64: '#f65e3b', 128: '#edcf72', 256: '#edcc61', 512: '#edc850', 1024: '#edc53f', 2048: '#edc22e' };

  return (
    <section className="engine-board engine-board--2048" aria-labelledby="c2048-title">
      <div className="engine-progress"><span>Coconut 2048</span><span>{score} points</span></div>
      <h2 id="c2048-title">Merge the tiles. Bank before you jam the board.</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, maxWidth: 340, margin: '0 auto', width: '100%' }} role="grid" aria-label="2048 board">
        {board.map((v, i) => (
          <span key={i} style={{ aspectRatio: '1', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: v >= 1024 ? 16 : 20, background: v ? (TILE_BG[v] ?? '#3c3a32') : 'rgba(255,255,255,0.05)', color: v >= 8 ? '#fff' : '#494036' }}>
            {v || ''}
          </span>
        ))}
      </div>
      <div className="maze-controls" aria-label="Movement controls" style={{ marginTop: 12 }}>
        <button type="button" aria-label="Up" onClick={() => move('up')}>↑</button>
        <button type="button" aria-label="Left" onClick={() => move('left')}>←</button>
        <button type="button" aria-label="Down" onClick={() => move('down')}>↓</button>
        <button type="button" aria-label="Right" onClick={() => move('right')}>→</button>
      </div>
      <p className="engine-penalty">Arrow keys or buttons. Equal tiles merge and score their sum. 20,000 points is a perfect 1000.</p>
      <div className="engine-actions">
        <button type="button" className="button button--primary" onClick={() => finish(score, 'Banked')}>Bank my score</button>
      </div>
    </section>
  );
}

// Minesweeper: clear the beach without digging up a trapped idol.
function BuriedIdols({ seed, onComplete }: EngineProps) {
  const SIZE = 9;
  const MINES = 10;
  const { mines, counts, start } = useMemo(() => {
    const rng = createRng(`mines:${seed}`);
    const mineSet = new Set<number>();
    while (mineSet.size < MINES) mineSet.add(Math.floor(rng() * SIZE * SIZE));
    const neighbourList = (i: number) => {
      const r = Math.floor(i / SIZE); const c = i % SIZE;
      const out: number[] = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = r + dr; const nc = c + dc;
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) out.push(nr * SIZE + nc);
      }
      return out;
    };
    const countArr = Array.from({ length: SIZE * SIZE }, (_, i) => mineSet.has(i) ? -1 : neighbourList(i).filter((n) => mineSet.has(n)).length);
    const startCell = countArr.findIndex((v) => v === 0);
    return { mines: mineSet, counts: countArr, start: startCell >= 0 ? startCell : countArr.findIndex((v) => v >= 0) };
  }, [seed]);

  const flood = useCallback((cell: number, revealed: Set<number>) => {
    const queue = [cell];
    while (queue.length) {
      const i = queue.pop()!;
      if (revealed.has(i) || mines.has(i)) continue;
      revealed.add(i);
      if (counts[i] === 0) {
        const r = Math.floor(i / SIZE); const c = i % SIZE;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr; const nc = c + dc;
          if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) queue.push(nr * SIZE + nc);
        }
      }
    }
    return revealed;
  }, [counts, mines]);

  const [revealed, setRevealed] = useState<Set<number>>(() => flood(start, new Set()));
  const [flags, setFlags] = useState<Set<number>>(new Set());
  const [flagMode, setFlagMode] = useState(false);
  const doneRef = useRef(false);
  const SAFE_TOTAL = SIZE * SIZE - MINES;

  const finish = useCallback((cleared: number, won: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    onComplete({
      rawScore: won ? 1000 : Math.round((cleared / SAFE_TOTAL) * 700),
      summary: won ? 'The whole beach cleared — every idol avoided.' : `Dug up a trapped idol after clearing ${cleared} of ${SAFE_TOTAL} safe squares.`,
    });
  }, [SAFE_TOTAL, onComplete]);

  const tap = (i: number) => {
    if (doneRef.current || revealed.has(i)) return;
    if (flagMode) {
      const next = new Set(flags);
      if (next.has(i)) next.delete(i); else next.add(i);
      setFlags(next);
      return;
    }
    if (flags.has(i)) return;
    if (mines.has(i)) { finish(revealed.size, false); return; }
    const next = flood(i, new Set(revealed));
    setRevealed(next);
    if (next.size === SAFE_TOTAL) finish(next.size, true);
  };

  const NUM_COLORS = ['', '#7fb2ff', '#8fd18f', '#ff9d7a', '#c99cff', '#ffd23f', '#7adfd4', '#eee', '#aaa'];

  return (
    <section className="engine-board engine-board--mines" aria-labelledby="mines-title">
      <div className="engine-progress"><span>Buried idols</span><span>{revealed.size} / {SAFE_TOTAL} cleared</span></div>
      <h2 id="mines-title">Clear the beach — ten trapped idols are buried.</h2>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${SIZE}, 1fr)`, gap: 3, maxWidth: 400, margin: '0 auto', width: '100%' }} role="grid" aria-label="Minesweeper board">
        {counts.map((count, i) => {
          const isOpen = revealed.has(i);
          return (
            <button key={i} type="button" onClick={() => tap(i)} aria-label={isOpen ? `Cleared, ${count} adjacent` : flags.has(i) ? 'Flagged' : 'Buried'}
              style={{ aspectRatio: '1', border: 'none', borderRadius: 5, cursor: isOpen ? 'default' : 'pointer', fontWeight: 800, fontSize: 15, background: isOpen ? 'rgba(255,255,255,0.10)' : 'rgba(240,217,181,0.22)', color: isOpen && count > 0 ? NUM_COLORS[count] : 'inherit' }}>
              {isOpen ? (count > 0 ? count : '') : flags.has(i) ? '🚩' : ''}
            </button>
          );
        })}
      </div>
      <div className="engine-actions">
        <button type="button" className={`button ${flagMode ? 'button--primary' : 'button--ghost'}`} onClick={() => setFlagMode((f) => !f)} aria-pressed={flagMode}>
          {flagMode ? '🚩 Flag mode ON' : '🚩 Flag mode off'}
        </button>
        <button type="button" className="button button--ghost" onClick={() => finish(revealed.size, false)}>Stop digging (keep progress)</button>
      </div>
      <p className="engine-penalty">Numbers count the idols in the surrounding squares. Clear every safe square for 1000; hitting an idol keeps partial credit.</p>
    </section>
  );
}

// Count It Out: a supply pile flashes briefly — count one item type.
const SUPPLY_TYPES = ['🥥', '🐚', '🔥', '🍌'];

function SupplyCount({ seed, persistenceKey, onComplete }: EngineProps) {
  const ROUNDS = 5;
  const [state, setState] = useStoredGameState(persistenceKey, { round: 0, points: 0, phase: 'look' as 'look' | 'guess' });
  const [value, setValue] = useState('');

  const round = useMemo(() => {
    const rng = createRng(`count:${seed}:${state.round}`);
    const total = 34 + state.round * 8;
    const items = Array.from({ length: total }, () => SUPPLY_TYPES[Math.floor(rng() * SUPPLY_TYPES.length)]);
    const target = SUPPLY_TYPES[Math.floor(rng() * SUPPLY_TYPES.length)];
    return { items, target, actual: items.filter((item) => item === target).length };
  }, [seed, state.round]);

  useEffect(() => {
    if (state.phase !== 'look') return;
    const timer = window.setTimeout(() => setState((current) => ({ ...current, phase: 'guess' })), 5000);
    return () => window.clearTimeout(timer);
  }, [setState, state.phase, state.round]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const guess = Number(value);
    if (!Number.isFinite(guess)) return;
    const off = Math.abs(guess - round.actual);
    const gained = off === 0 ? 200 : off === 1 ? 140 : off === 2 ? 90 : off === 3 ? 40 : 0;
    const points = state.points + gained;
    setValue('');
    if (state.round === ROUNDS - 1) {
      onComplete({ rawScore: points, summary: `${points} counting points across ${ROUNDS} supply drops.` });
      return;
    }
    setState({ round: state.round + 1, points, phase: 'look' });
  };

  return (
    <section className="engine-board engine-board--count" aria-labelledby="count-title">
      <div className="engine-progress"><span>Supply drop {state.round + 1} / {ROUNDS}</span><span>{state.points} points</span></div>
      {state.phase === 'look' ? (
        <>
          <h2 id="count-title">Count the {round.target} — five seconds.</h2>
          <div aria-label="Supply pile" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: 440, margin: '0 auto', fontSize: 24 }}>
            {round.items.map((item, index) => <span key={index}>{item}</span>)}
          </div>
        </>
      ) : (
        <>
          <h2 id="count-title">How many {round.target} were in the pile?</h2>
          <form className="puzzle-answer" onSubmit={submit} noValidate>
            <label htmlFor="count-answer">Your count</label>
            <div><input id="count-answer" value={value} onChange={(event) => setValue(event.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" autoComplete="off" /><button className="button button--primary" type="submit">Lock it in</button></div>
          </form>
          <p className="engine-penalty">Exact = 200 · off by 1 = 140 · by 2 = 90 · by 3 = 40 · further = 0.</p>
        </>
      )}
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
    case 'tower-of-idols': return <TowerOfIdols {...props} />;
    case 'snuff-the-torches': return <SnuffTheTorches {...props} />;
    case 'torch-scramble': return <TorchScramble {...props} />;
    case 'torch-transcription': return <TorchTranscription {...props} />;
    case 'jungle-word-hunt': return <JungleWordHunt {...props} />;
    case 'island-2048': return <Island2048 {...props} />;
    case 'buried-idols': return <BuriedIdols {...props} />;
    case 'supply-count': return <SupplyCount {...props} />;
    default: return null;
  }
}
