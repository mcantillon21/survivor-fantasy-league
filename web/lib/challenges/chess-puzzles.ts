import { Chess } from 'chess.js';

// Puzzles for the Puzzle Rush challenge, grouped by mate distance. Every FEN was
// generated and verified with the forced-mate solver below (see scripts) to have
// a forced checkmate in EXACTLY `mateIn` moves for the side to move — no faster
// mate exists, and every defence still loses. The engine validates the player's
// moves at runtime with the same solver, so `solution` is only a human label.
export interface ChessPuzzle {
  fen: string;
  solution: string;
  title: string;
  mateIn: 1 | 2 | 3;
}

// --- Forced-mate solver -----------------------------------------------------
// Operates on a single Chess instance with make/undo (no cloning) for speed.
// Positions in this challenge are sparse endgames, so full-width search to
// depth 3 is instant.

// Can the side to move force checkmate in at most `moves` of its own moves?
export function attackerCanMate(game: Chess, moves: number): boolean {
  if (moves < 1) return false;
  for (const m of game.moves()) {
    game.move(m);
    let ok: boolean;
    if (game.isCheckmate()) ok = true;
    else if (moves >= 2) ok = defenderIsLost(game, moves - 1);
    else ok = false;
    game.undo();
    if (ok) return true;
  }
  return false;
}

// Defender to move: is the attacker still able to force mate in `moves` against
// EVERY legal reply? (A position with no replies is stalemate — attacker failed.)
// Also used at runtime to check a player's move kept the mate forced.
export function defenderIsLost(game: Chess, moves: number): boolean {
  const replies = game.moves();
  if (replies.length === 0) return false;
  for (const r of replies) {
    game.move(r);
    const stillMates = attackerCanMate(game, moves);
    game.undo();
    if (!stillMates) return false;
  }
  return true;
}

// After the attacker has just moved (and it was not mate), pick the defender's
// reply that holds out the longest, so the puzzle plays out its full length.
// `attackerBudget` is how many attacker moves remain to force the mate.
export function toughestDefence(game: Chess, attackerBudget: number): string | null {
  const replies = game.moves();
  if (replies.length === 0) return null;
  let best = replies[0];
  let bestDepth = -1;
  for (const r of replies) {
    game.move(r);
    let depth = attackerBudget + 1; // "beyond budget" if we never find a mate
    for (let d = 1; d <= attackerBudget; d++) {
      if (attackerCanMate(game, d)) { depth = d; break; }
    }
    game.undo();
    if (depth > bestDepth) { bestDepth = depth; best = r; }
  }
  return best;
}

// --- Puzzle bank ------------------------------------------------------------

const MATE_IN_1: ChessPuzzle[] = [
  { fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', solution: 'Ra8#', title: 'Back rank', mateIn: 1 },
  { fen: '6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1', solution: 'Qd8#', title: 'Back rank', mateIn: 1 },
  { fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', solution: 'Re8#', title: 'Back rank', mateIn: 1 },
  { fen: '6k1/5ppp/8/8/8/8/5PPP/2R3K1 w - - 0 1', solution: 'Rc8#', title: 'Back rank', mateIn: 1 },
  { fen: '6k1/8/6K1/8/8/8/8/1Q6 w - - 0 1', solution: 'Qb8#', title: 'Queen and king', mateIn: 1 },
  { fen: '6k1/8/6K1/8/8/8/8/Q7 w - - 0 1', solution: 'Qa8#', title: 'Queen and king', mateIn: 1 },
  { fen: 'k7/8/1K6/8/8/8/8/7R w - - 0 1', solution: 'Rh8#', title: 'King and rook', mateIn: 1 },
  { fen: '7k/8/6K1/8/8/8/8/R7 w - - 0 1', solution: 'Ra8#', title: 'King and rook', mateIn: 1 },
  { fen: '6k1/8/6K1/8/8/8/6Q1/8 w - - 0 1', solution: 'Qa8#', title: 'Queen finish', mateIn: 1 },
  { fen: '7k/R7/1R6/8/8/8/8/6K1 w - - 0 1', solution: 'Rb8#', title: 'Two rooks', mateIn: 1 },
  { fen: 'r5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1', solution: 'Ra1#', title: 'Back rank', mateIn: 1 },
  { fen: '3q2k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1', solution: 'Qd1#', title: 'Back rank', mateIn: 1 },
  { fen: '4r1k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1', solution: 'Re1#', title: 'Back rank', mateIn: 1 },
  { fen: '2r3k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1', solution: 'Rc1#', title: 'Back rank', mateIn: 1 },
  { fen: '1q6/8/8/8/8/6k1/8/6K1 b - - 0 1', solution: 'Qb1#', title: 'Queen and king', mateIn: 1 },
  { fen: '5k2/8/5K2/8/8/8/8/Q7 w - - 0 1', solution: 'Qa8#', title: 'Queen and king', mateIn: 1 },
];

const MATE_IN_2: ChessPuzzle[] = [
  { fen: 'k2K4/1R6/8/8/8/8/8/1R6 w - - 0 1', solution: 'R7b5', title: 'Two rooks', mateIn: 2 },
  { fen: '8/7R/8/8/8/3K2Q1/8/k7 w - - 0 1', solution: 'Rh2', title: 'Queen and rook', mateIn: 2 },
  { fen: '6k1/8/1R6/8/1K6/5R2/8/8 w - - 0 1', solution: 'Rb7', title: 'Two rooks', mateIn: 2 },
  { fen: '7k/1R6/8/6K1/8/8/1N6/8 w - - 0 1', solution: 'Kg6', title: 'Rook and knight', mateIn: 2 },
  { fen: '7k/8/8/8/Q4R2/8/3K4/8 w - - 0 1', solution: 'Rf7', title: 'Queen and rook', mateIn: 2 },
  { fen: '8/8/8/8/2K5/6R1/5N2/k7 w - - 0 1', solution: 'Kb3', title: 'Rook and knight', mateIn: 2 },
  { fen: '8/k7/8/2K3Q1/8/8/7B/8 w - - 0 1', solution: 'Qg2', title: 'Queen and bishop', mateIn: 2 },
  { fen: 'k6B/5K2/8/8/8/8/2Q5/8 w - - 0 1', solution: 'Qc8+', title: 'Queen and bishop', mateIn: 2 },
  { fen: '4K3/8/8/8/8/8/2Q4N/6k1 w - - 0 1', solution: 'Ng4', title: 'Queen and knight', mateIn: 2 },
  { fen: '6Q1/8/8/8/8/2R5/3K4/1k6 w - - 0 1', solution: 'Qb3+', title: 'Queen and rook', mateIn: 2 },
];

const MATE_IN_3: ChessPuzzle[] = [
  { fen: 'k7/8/8/3K3Q/7B/8/8/8 w - - 0 1', solution: 'Kc6', title: 'Queen and bishop', mateIn: 3 },
  { fen: 'R7/8/8/8/R4K2/8/8/1k6 w - - 0 1', solution: 'Ra2', title: 'Two rooks', mateIn: 3 },
  { fen: '8/7k/8/4R3/8/8/1K6/3R4 w - - 0 1', solution: 'Rg5', title: 'Two rooks', mateIn: 3 },
  { fen: '2N4k/8/6Q1/8/8/K7/8/8 w - - 0 1', solution: 'Qg5', title: 'Queen and knight', mateIn: 3 },
  { fen: 'k7/8/7B/1Q6/5K2/8/8/8 w - - 0 1', solution: 'Bg7', title: 'Queen and bishop', mateIn: 3 },
  { fen: '8/8/4N3/8/2Q4K/8/6k1/8 w - - 0 1', solution: 'Qf4', title: 'Queen and knight', mateIn: 3 },
  { fen: 'k7/8/8/5Q2/N7/K7/8/8 w - - 0 1', solution: 'Qd7', title: 'Queen and knight', mateIn: 3 },
  { fen: '8/8/8/8/8/6K1/6R1/5B1k w - - 0 1', solution: 'Rf2', title: 'Rook and bishop', mateIn: 3 },
  { fen: 'k7/8/6Q1/8/4N3/7K/8/8 w - - 0 1', solution: 'Qf7', title: 'Queen and knight', mateIn: 3 },
  { fen: '8/8/2K5/8/2R2R2/8/8/k7 w - - 0 1', solution: 'Rc2', title: 'Two rooks', mateIn: 3 },
];

export const PUZZLES_BY_TIER: Record<1 | 2 | 3, ChessPuzzle[]> = {
  1: MATE_IN_1,
  2: MATE_IN_2,
  3: MATE_IN_3,
};
