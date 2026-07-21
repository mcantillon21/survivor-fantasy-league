import test from 'node:test';
import assert from 'node:assert/strict';
import { CHALLENGE_CHOICES } from './challenges.js';
import { tallyVoteRows } from './game-rules.js';

test('official challenge choices all have unique slugs', () => {
  assert.ok(CHALLENGE_CHOICES.length > 0);
  assert.equal(new Set(CHALLENGE_CHOICES.map(({ value }) => value)).size, CHALLENGE_CHOICES.length);
});

test('vote tally returns a decisive elimination', () => {
  assert.deepEqual(tallyVoteRows([
    { target_id: 'a' },
    { target_id: 'a' },
    { target_id: 'b' },
  ]), {
    eliminated: 'a',
    tie: false,
    tied: ['a'],
    votes: [['a', 2], ['b', 1]],
  });
});

test('vote tally preserves a tie without selecting an elimination', () => {
  assert.deepEqual(tallyVoteRows([
    { target_id: 'a' },
    { target_id: 'b' },
  ]), {
    eliminated: null,
    tie: true,
    tied: ['a', 'b'],
    votes: [['a', 1], ['b', 1]],
  });
});
