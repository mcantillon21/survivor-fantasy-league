// Mate-in-1 puzzles for the Puzzle Rush challenge. Every FEN was verified with
// chess.js to have at least one legal move that delivers checkmate for the side
// to move (see the validation used when these were authored). The engine marks
// a puzzle solved when the player's move results in checkmate, so any correct
// mating move counts. `solution` is a sample mating move, used only for hints.
export interface ChessPuzzle {
  fen: string;
  solution: string;
  title: string;
}

export const CHESS_PUZZLES: ChessPuzzle[] = [
  { fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', solution: 'Ra8#', title: 'Back rank' },
  { fen: '6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1', solution: 'Qd8#', title: 'Back rank' },
  { fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', solution: 'Re8#', title: 'Back rank' },
  { fen: '6k1/5ppp/8/8/8/8/5PPP/2R3K1 w - - 0 1', solution: 'Rc8#', title: 'Back rank' },
  { fen: '6k1/8/6K1/8/8/8/8/1Q6 w - - 0 1', solution: 'Qb8#', title: 'Queen and king' },
  { fen: '6k1/8/6K1/8/8/8/8/Q7 w - - 0 1', solution: 'Qa8#', title: 'Queen and king' },
  { fen: 'k7/8/1K6/8/8/8/8/7R w - - 0 1', solution: 'Rh8#', title: 'King and rook' },
  { fen: '7k/8/6K1/8/8/8/8/R7 w - - 0 1', solution: 'Ra8#', title: 'King and rook' },
  { fen: '6k1/8/6K1/8/8/8/6Q1/8 w - - 0 1', solution: 'Qa8#', title: 'Queen finish' },
  { fen: '7k/R7/1R6/8/8/8/8/6K1 w - - 0 1', solution: 'Rb8#', title: 'Two rooks' },
  { fen: 'r5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1', solution: 'Ra1#', title: 'Back rank' },
  { fen: '3q2k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1', solution: 'Qd1#', title: 'Back rank' },
  { fen: '4r1k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1', solution: 'Re1#', title: 'Back rank' },
  { fen: '2r3k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1', solution: 'Rc1#', title: 'Back rank' },
  { fen: '1q6/8/8/8/8/6k1/8/6K1 b - - 0 1', solution: 'Qb1#', title: 'Queen and king' },
  { fen: '5k2/8/5K2/8/8/8/8/Q7 w - - 0 1', solution: 'Qa8#', title: 'Queen and king' },
];
