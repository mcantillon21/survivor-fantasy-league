import assert from 'node:assert/strict';
import test from 'node:test';
import {
  caesarEncode,
  createCoordinateSecret,
  createMaze,
  createRng,
  isMazeReachable,
  normalizeScore,
  scoreCoordinateGuess,
} from './logic.ts';

test('seeded random output is deterministic', () => {
  const first = createRng('parvati');
  const second = createRng('parvati');
  assert.deepEqual([first(), first(), first()], [second(), second(), second()]);
});

test('scores remain inside the shared 0–1000 range', () => {
  assert.equal(normalizeScore(1200, 0, 1), 1000);
  assert.equal(normalizeScore(200, 500, 2), 0);
  assert.equal(normalizeScore(900, 30, 2), 840);
});

test('caesar cipher wraps across the alphabet', () => {
  assert.equal(caesarEncode('TRIBAL Z', 3), 'WULEDO C');
});

test('coordinate feedback distinguishes exact and present symbols', () => {
  assert.deepEqual(scoreCoordinateGuess(['◆', '▲', '●', '✦'], ['◆', '●', '⬟', '▲']), { exact: 1, present: 2 });
  assert.equal(createCoordinateSecret('player').length, 4);
});

test('generated mazes always connect start and goal', () => {
  for (const seed of ['red', 'blue', 'merge', 'finale']) {
    assert.equal(isMazeReachable(createMaze(seed)), true);
  }
});
