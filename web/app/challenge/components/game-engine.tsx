'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  SYMBOLS,
  caesarEncode,
  createCoordinateSecret,
  createMaze,
  createRng,
  createSymbolSequence,
  normalizeAnswer,
  scoreCoordinateGuess,
  shuffleSeeded,
} from '@/lib/challenges/logic';
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
}: EngineProps & { questions: ChoiceQuestion[]; kicker: string }) {
  const [state, setState] = useStoredGameState(persistenceKey, { index: 0, correct: 0 });
  const question = questions[state.index];

  const choose = (answer: number) => {
    const correct = state.correct + (answer === question.answer ? 1 : 0);
    if (state.index === questions.length - 1) {
      onComplete({ rawScore: Math.round((correct / questions.length) * 1000), summary: `${correct} of ${questions.length} answers were correct.` });
      return;
    }
    setState({ index: state.index + 1, correct });
  };

  return (
    <section className="engine-board engine-board--choice" aria-labelledby="engine-question">
      <div className="engine-progress"><span>{kicker}</span><span>{state.index + 1} / {questions.length}</span></div>
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

const TRIVIA_QUESTIONS: ChoiceQuestion[] = [
  { prompt: 'Which season was the first to end with a Final Three at the last Tribal Council?', options: ['Panama', 'Cook Islands', 'Fiji', 'Micronesia'], answer: 1 },
  { prompt: 'Who was the first castaway to win the title of Sole Survivor twice?', options: ['Parvati Shallow', 'Sandra Diaz-Twine', 'Amber Mariano', 'Tony Vlachos'], answer: 1 },
  { prompt: 'The Hidden Immunity Idol was introduced in which season?', options: ['Palau', 'Guatemala', 'Panama', 'Vanuatu'], answer: 1 },
  { prompt: 'Exile Island first appeared in which season?', options: ['Panama', 'Palau', 'Cook Islands', 'Fiji'], answer: 0 },
  { prompt: 'Which season was the FIRST to split tribes by Brains, Brawn, and Beauty?', options: ['Kaôh Rōng', 'Cagayan', 'Worlds Apart', 'San Juan del Sur'], answer: 1 },
  { prompt: 'What season number was Winners at War?', options: ['38', '39', '40', '41'], answer: 2 },
  { prompt: 'Who won Winners at War?', options: ['Sarah Lacina', 'Tony Vlachos', 'Michele Fitzgerald', 'Ben Driebergen'], answer: 1 },
  { prompt: 'Who won Survivor: Redemption Island?', options: ['Russell Hantz', 'Rob Mariano', 'Phillip Sheppard', 'Grant Mattos'], answer: 1 },
  { prompt: 'How many days does a classic pre-Season-41 full season last?', options: ['36', '39', '42', '26'], answer: 1 },
  { prompt: 'Parvati Shallow won which season?', options: ['Cook Islands', 'Micronesia', 'Heroes vs. Villains', 'Caramoan'], answer: 1 },
];

const TRIBAL_PULSE_QUESTIONS: ChoiceQuestion[] = [
  { prompt: 'Which trait would most players value in a close ally?', options: ['Predictability', 'Challenge strength', 'Entertainment', 'Mystery'], answer: 0 },
  { prompt: 'Which mistake feels most dangerous after the merge?', options: ['Losing reward', 'Being caught in two alliances', 'Voting early', 'Sharing food'], answer: 1 },
  { prompt: 'Which player earns the most trust?', options: ['The loudest strategist', 'The person whose actions match their promises', 'The challenge winner', 'The newest number'], answer: 1 },
  { prompt: 'What would the tribe most likely protect first?', options: ['Camp comfort', 'A loyal vote', 'A funny story', 'A risky idol clue'], answer: 1 },
  { prompt: 'Which behavior raises suspicion fastest?', options: ['Asking questions', 'A sudden change in routine', 'Helping at camp', 'Losing a puzzle'], answer: 1 },
  { prompt: 'What matters most in a tied vote?', options: ['Volume', 'Reliable numbers', 'Past challenge scores', 'Random chance'], answer: 1 },
  { prompt: 'Which reward is most strategically useful?', options: ['Food', 'Private information', 'Comfort', 'A souvenir'], answer: 1 },
  { prompt: 'What should a player do after making a visible move?', options: ['Celebrate publicly', 'Lower their threat and rebuild trust', 'Stop strategizing', 'Demand credit'], answer: 1 },
];

interface TextStage {
  label: string;
  prompt: string;
  answer: string;
  detail?: string;
}

function TextStageEngine({
  stages,
  persistenceKey,
  onComplete,
}: EngineProps & { stages: TextStage[] }) {
  const [state, setState] = useStoredGameState(persistenceKey, { index: 0, mistakes: 0, solved: 0 });
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const stage = stages[state.index];
  const solvedSoFar = state.solved || 0;
  const mistakesSoFar = state.mistakes || 0;

  const finish = (solved: number) => {
    const skipped = stages.length - solved;
    const rawScore = Math.max(0, Math.round((solved / stages.length) * 1000) - mistakesSoFar * 25);
    const summary = `Solved ${solved} of ${stages.length}${skipped ? `, skipped ${skipped}` : ''}${mistakesSoFar ? `, ${mistakesSoFar} wrong ${mistakesSoFar === 1 ? 'attempt' : 'attempts'}` : ''}.`;
    onComplete({ rawScore, summary });
  };

  // Advance to the next stage, or finish. `didSolve` says whether this stage was solved (vs skipped).
  const advance = (didSolve: boolean) => {
    const solved = solvedSoFar + (didSolve ? 1 : 0);
    if (state.index === stages.length - 1) { finish(solved); return; }
    setState({ index: state.index + 1, mistakes: mistakesSoFar, solved });
    setValue('');
    setError('');
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!value.trim()) {
      setError('Enter an answer, or skip this puzzle.');
      return;
    }
    if (normalizeAnswer(value) !== normalizeAnswer(stage.answer)) {
      setState({ ...state, mistakes: mistakesSoFar + 1 });
      setError('That is not right. Try again, or skip it for no points.');
      return;
    }
    advance(true);
  };

  return (
    <section className="engine-board engine-board--text" aria-labelledby="text-stage-title">
      <div className="engine-progress"><span>{stage.label}</span><span>Lock {state.index + 1} / {stages.length}</span></div>
      <h2 id="text-stage-title">{stage.prompt}</h2>
      {stage.detail && <div className="cipher-strip" aria-label="Encoded transmission">{stage.detail}</div>}
      <form className="puzzle-answer" onSubmit={submit} noValidate>
        <label htmlFor="puzzle-answer">Your answer</label>
        <div><input id="puzzle-answer" value={value} onChange={(event) => { setValue(event.target.value); setError(''); }} autoComplete="off" spellCheck="false" /><button className="button button--primary" type="submit">Test answer</button></div>
        {error && <p className="field-error" role="alert">{error}</p>}
      </form>
      <div className="engine-actions">
        <button type="button" className="button button--ghost" onClick={() => advance(false)}>Skip this puzzle (no points)</button>
      </div>
      <p className="engine-penalty">Solved {solvedSoFar} / {stages.length} · Wrong attempts: {mistakesSoFar}</p>
    </section>
  );
}

function FireSignalCipher(props: EngineProps) {
  const shift = (Math.floor(createRng(props.seed)() * 5) + 2);
  const stages: TextStage[] = [
    { label: 'Signal one', prompt: `Every letter moved ${shift} places forward. Decode the transmission.`, detail: caesarEncode('TRIBE', shift), answer: 'TRIBE' },
    { label: 'Signal two', prompt: 'The same shift still holds. Spaces are preserved.', detail: caesarEncode('HIDDEN IDOL', shift), answer: 'HIDDEN IDOL' },
    { label: 'Signal three', prompt: 'Final transmission. Bring the message home.', detail: caesarEncode('THE FLAME STAYS LIT', shift), answer: 'THE FLAME STAYS LIT' },
  ];
  return <TextStageEngine {...props} stages={stages} />;
}

function IdolLockbox(props: EngineProps) {
  const shift = Math.floor(createRng(`idol:${props.seed}`)() * 4) + 2;
  const finalCode = String((21 + shift) * 3);
  const stages: TextStage[] = [
    { label: 'Outer lock', prompt: `Shift each letter backward ${shift} places.`, detail: caesarEncode('TORCH', shift), answer: 'TORCH' },
    { label: 'Middle lock', prompt: 'Continue the sequence: 2, 3, 5, 8, 13, …', detail: 'The next number is your key.', answer: '21' },
    { label: 'Idol seal', prompt: `Add ${shift} to the middle-lock answer, then multiply by 3.`, detail: 'Enter the final numeric combination.', answer: finalCode },
  ];
  return <TextStageEngine {...props} stages={stages} />;
}

function ChainReaction(props: EngineProps) {
  const stages: TextStage[] = [
    { label: 'Link one', prompt: 'How many letters are in IMMUNITY?', answer: '8' },
    { label: 'Link two', prompt: 'Square the previous answer.', answer: '64' },
    { label: 'Link three', prompt: 'Add the number of players in a final three.', answer: '67' },
    { label: 'Link four', prompt: 'Convert 67 to a letter using repeated A–Z cycles.', detail: '1=A, 26=Z, 27=A…', answer: 'O' },
    { label: 'Final link', prompt: 'Complete the phrase: Outwit. Outplay. _____.', answer: 'Outlast' },
  ];
  return <TextStageEngine {...props} stages={stages} />;
}

function RiddleTrials(props: EngineProps) {
  const stages: TextStage[] = [
    { label: 'Trial one', prompt: 'The more you take away from me, the bigger I become. What am I?', answer: 'hole' },
    { label: 'Trial two', prompt: 'Forward I am heavy, but backward I am not. What am I?', answer: 'ton' },
    { label: 'Trial three', prompt: 'I am not alive, yet I grow; I have no lungs, yet I need air; I have no mouth, yet water kills me. What am I?', answer: 'fire' },
    { label: 'Trial four', prompt: 'What English word is always spelled incorrectly?', answer: 'incorrectly' },
    { label: 'Final trial', prompt: 'A man shows a photo and says: “Brothers and sisters I have none, but this man’s father is my father’s son.” Who is in the photo? (one word)', answer: 'son' },
  ];
  return <TextStageEngine {...props} stages={stages} />;
}

function SurvivorGauntlet(props: EngineProps) {
  const stages: TextStage[] = [
    { label: 'Cipher gate', prompt: 'Shift KHOOR backward by three.', answer: 'HELLO' },
    { label: 'Pattern gate', prompt: 'Complete the pattern: 3, 6, 12, 24, …', answer: '48' },
    { label: 'Memory gate', prompt: 'Read once: FLAME–ROPE–MOON. Enter the middle item.', answer: 'ROPE' },
    { label: 'Deduction gate', prompt: 'I protect one player, expire after a vote, and hang around your neck. What am I?', answer: 'IMMUNITY' },
  ];
  return <TextStageEngine {...props} stages={stages} />;
}

function TorchlightLabyrinth({ seed, persistenceKey, onComplete }: EngineProps) {
  const maze = useMemo(() => createMaze(seed), [seed]);
  const [state, setState] = useStoredGameState(persistenceKey, { position: maze.start, moves: 0 });

  const move = (rowStep: number, columnStep: number) => {
    const next: [number, number] = [state.position[0] + rowStep, state.position[1] + columnStep];
    if (maze.grid[next[0]]?.[next[1]] !== 0) return;
    const moves = state.moves + 1;
    if (next[0] === maze.goal[0] && next[1] === maze.goal[1]) {
      onComplete({ rawScore: Math.max(250, 1000 - Math.max(0, moves - 16) * 18), summary: `The immunity flame was reached in ${moves} moves.` });
      return;
    }
    setState({ position: next, moves });
  };

  return (
    <section className="engine-board engine-board--maze" aria-labelledby="maze-title">
      <div className="engine-progress"><span>Find the immunity flame</span><span>{state.moves} moves</span></div>
      <h2 id="maze-title">Navigate the torch through the labyrinth.</h2>
      <div className="maze-grid" style={{ gridTemplateColumns: `repeat(${maze.grid.length}, 1fr)` }} aria-label="Maze board">
        {maze.grid.flatMap((row, rowIndex) => row.map((cell, columnIndex) => {
          const player = state.position[0] === rowIndex && state.position[1] === columnIndex;
          const goal = maze.goal[0] === rowIndex && maze.goal[1] === columnIndex;
          return <span key={`${rowIndex}-${columnIndex}`} className={`maze-cell ${cell ? 'maze-cell--wall' : ''} ${player ? 'maze-cell--player' : ''} ${goal ? 'maze-cell--goal' : ''}`} aria-label={player ? 'Current position' : goal ? 'Goal' : undefined}>{player ? '●' : goal ? '✦' : ''}</span>;
        }))}
      </div>
      <div className="maze-controls" aria-label="Movement controls">
        <button type="button" aria-label="Move up" onClick={() => move(-1, 0)}>↑</button>
        <button type="button" aria-label="Move left" onClick={() => move(0, -1)}>←</button>
        <button type="button" aria-label="Move down" onClick={() => move(1, 0)}>↓</button>
        <button type="button" aria-label="Move right" onClick={() => move(0, 1)}>→</button>
      </div>
      <div className="engine-actions">
        <button type="button" className="button button--ghost" onClick={() => onComplete({ rawScore: 0, summary: 'Skipped the labyrinth.' })}>Skip (no points)</button>
      </div>
    </section>
  );
}

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

const SUPPLIES = [
  { id: 'water', name: 'Fresh water', weight: 4, value: 10 },
  { id: 'rice', name: 'Rice sack', weight: 3, value: 7 },
  { id: 'tarp', name: 'Weather tarp', weight: 4, value: 8 },
  { id: 'rope', name: 'Rope coil', weight: 2, value: 6 },
  { id: 'flint', name: 'Flint', weight: 1, value: 5 },
  { id: 'medkit', name: 'Medical kit', weight: 3, value: 9 },
  { id: 'fishing', name: 'Fishing kit', weight: 4, value: 10 },
  { id: 'comfort', name: 'Comfort item', weight: 2, value: 3 },
];

function SupplyDrop({ persistenceKey, onComplete }: EngineProps) {
  const [selected, setSelected] = useStoredGameState<string[]>(persistenceKey, []);
  const [error, setError] = useState('');
  const chosen = SUPPLIES.filter((item) => selected.includes(item.id));
  const weight = chosen.reduce((total, item) => total + item.weight, 0);
  const baseValue = chosen.reduce((total, item) => total + item.value, 0);
  const setBonus = selected.includes('tarp') && selected.includes('rope') ? 5 : 0;

  const toggle = (id: string) => {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setError('');
  };

  const lockLoadout = () => {
    if (!selected.includes('water')) { setError('Fresh water is mandatory.'); return; }
    if (weight > 15) { setError(`Your bag is ${weight - 15} weight units over capacity.`); return; }
    const value = baseValue + setBonus;
    onComplete({ rawScore: Math.round((value / 43) * 1000), summary: `Packed ${chosen.length} items at ${weight}/15 weight for ${value} survival value.` });
  };

  return (
    <section className="engine-board engine-board--supply" aria-labelledby="supply-title">
      <div className="engine-progress"><span>Camp supply manifest</span><span className={weight > 15 ? 'text-danger' : ''}>{weight} / 15 weight</span></div>
      <h2 id="supply-title">Build the strongest legal loadout.</h2>
      <div className="supply-grid">{SUPPLIES.map((item) => <button key={item.id} type="button" aria-pressed={selected.includes(item.id)} onClick={() => toggle(item.id)}><strong>{item.name}</strong><span>{item.weight} weight · {item.value} value</span></button>)}</div>
      {setBonus > 0 && <p className="bonus-note">Shelter set bonus active: tarp + rope adds 5 value.</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
      <button type="button" className="button button--primary" onClick={lockLoadout}>Lock loadout</button>
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

function OathOfAttention({ seed, persistenceKey, onComplete }: EngineProps) {
  const [state, setState] = useStoredGameState<OathState>(persistenceKey, { round: 0, hits: 0, falseTaps: 0, phase: 'wait' });
  const delay = useMemo(() => 600 + Math.floor(createRng(`${seed}:${state.round}`)() * 900), [seed, state.round]);

  const advance = useCallback((hit: boolean) => {
    const hits = state.hits + (hit ? 1 : 0);
    if (state.round === 4) {
      setState({ round: 5, hits, falseTaps: state.falseTaps, phase: 'done' });
      onComplete({ rawScore: Math.max(0, hits * 200 - state.falseTaps * 100), summary: `${hits} of 5 live flames caught with ${state.falseTaps} early taps.` });
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
      <div className="engine-progress"><span>Signal {Math.min(state.round + 1, 5)} / 5</span><span>{state.hits} caught · {state.falseTaps} early</span></div>
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

export function GameEngine({ slug, ...props }: EngineProps & { slug: string }) {
  switch (slug) {
    case 'fire-signal-cipher': return <FireSignalCipher {...props} />;
    case 'strategy-trivia': return <ChoiceEngine {...props} questions={TRIVIA_QUESTIONS} kicker="Survivor history" />;
    case 'idol-lockbox': return <IdolLockbox {...props} />;
    case 'torchlight-labyrinth': return <TorchlightLabyrinth {...props} />;
    case 'memory-totem': return <MemoryTotem {...props} />;
    case 'island-coordinates': return <IslandCoordinates {...props} />;
    case 'chain-reaction': return <ChainReaction {...props} />;
    case 'supply-drop': return <SupplyDrop {...props} />;
    case 'risk-the-flame': return <RiskTheFlame {...props} />;
    case 'tribal-pulse': return <ChoiceEngine {...props} questions={TRIBAL_PULSE_QUESTIONS} kicker="Majority prediction" />;
    case 'oath-of-attention': return <OathOfAttention {...props} />;
    case 'survivor-gauntlet': return <SurvivorGauntlet {...props} />;
    case 'command-from-camp': return <CommandFromCamp {...props} />;
    case 'vault-lock': return <VaultLock {...props} />;
    case 'riddle-trials': return <RiddleTrials {...props} />;
    default: return null;
  }
}
