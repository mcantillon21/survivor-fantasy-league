import assert from 'node:assert/strict';
import test from 'node:test';
import { Chess } from 'chess.js';
import {
  PUZZLES_BY_TIER,
  attackerCanMate,
  defenderIsLost,
  toughestDefence,
  type ChessPuzzle,
} from './chess-puzzles.ts';

// Every puzzle in a tier must be a forced mate in EXACTLY that many moves — no
// faster mate, and the stated depth is reachable.
function mateDepth(fen: string, cap: number): number {
  const g = new Chess(fen);
  for (let d = 1; d <= cap; d++) if (attackerCanMate(g, d)) return d;
  return 0;
}

for (const tier of [1, 2, 3] as const) {
  test(`mate-in-${tier} puzzles are all exact forced mates`, () => {
    const puzzles = PUZZLES_BY_TIER[tier];
    assert.ok(puzzles.length > 0, `tier ${tier} has puzzles`);
    for (const p of puzzles) {
      assert.equal(p.mateIn, tier, `mateIn tag matches tier for ${p.fen}`);
      assert.equal(mateDepth(p.fen, tier), tier, `exact mate-in-${tier} for ${p.fen}`);
    }
  });
}

// Simulate the engine's actual play loop: the attacker (player) plays the
// solver-optimal move each turn, the engine answers with its toughest defence,
// and the puzzle must terminate in checkmate within `mateIn` attacker moves —
// with every intermediate move recognised as "still forcing mate".
function bestAttackerMove(game: Chess, budget: number): string {
  for (const m of game.moves()) {
    game.move(m);
    let ok: boolean;
    if (game.isCheckmate()) ok = true;
    else ok = budget >= 2 && defenderIsLost(game, budget - 1);
    game.undo();
    if (ok) return m;
  }
  throw new Error('no forcing move found — position is not a forced mate');
}

function playThrough(p: ChessPuzzle) {
  const game = new Chess(p.fen);
  for (let moveNo = 1; moveNo <= p.mateIn; moveNo++) {
    const budget = p.mateIn - (moveNo - 1);
    const mv = bestAttackerMove(game, budget);
    game.move(mv);
    if (game.isCheckmate()) return moveNo; // solved
    // Engine's loop only accepts the move if the mate stays forced.
    const attackerLeft = p.mateIn - moveNo;
    assert.ok(attackerLeft >= 1 && defenderIsLost(game, attackerLeft), `${p.fen}: move ${moveNo} keeps mate forced`);
    const defence = toughestDefence(game, attackerLeft);
    assert.ok(defence, `${p.fen}: engine has a defence at move ${moveNo}`);
    game.move(defence!);
  }
  throw new Error(`${p.fen}: not mated within ${p.mateIn} moves`);
}

for (const tier of [2, 3] as const) {
  test(`mate-in-${tier} puzzles are solvable through the engine's defence`, () => {
    for (const p of PUZZLES_BY_TIER[tier]) {
      const solvedOn = playThrough(p);
      assert.equal(solvedOn, tier, `${p.fen} mates exactly on move ${tier}`);
    }
  });
}

// A plausible-but-non-forcing first move must NOT be accepted as "on track".
test('a non-forcing move is rejected by the mate check', () => {
  const p = PUZZLES_BY_TIER[2][0];
  const game = new Chess(p.fen);
  const forcing = bestAttackerMove(game, p.mateIn);
  // Find any legal first move that is not a forced-mate move, and confirm the
  // engine's acceptance test (checkmate OR defenderIsLost) fails for it.
  const alternatives = game.moves().filter((m) => m !== forcing);
  let checkedOne = false;
  for (const m of alternatives) {
    game.move(m);
    const stillForced = game.isCheckmate() || defenderIsLost(game, p.mateIn - 1);
    game.undo();
    if (!stillForced) { checkedOne = true; break; }
  }
  assert.ok(checkedOne, 'at least one alternative first move is correctly rejected');
});
