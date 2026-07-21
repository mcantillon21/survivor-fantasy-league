import test from 'node:test';
import assert from 'node:assert/strict';
import { TRIBE_MASHUPS, generateTribePair, tribeLabel } from './tribe-names.js';

test('tribe mashups are unique and non-empty', () => {
  assert.ok(TRIBE_MASHUPS.length >= 2);
  assert.equal(new Set(TRIBE_MASHUPS).size, TRIBE_MASHUPS.length);
  assert.ok(TRIBE_MASHUPS.every((name) => typeof name === 'string' && name.length > 0));
});

test('generateTribePair always returns two distinct names', () => {
  for (let i = 0; i < 1000; i++) {
    const [a, b] = generateTribePair();
    assert.ok(a && b, 'both names present');
    assert.notEqual(a, b, 'names are distinct');
  }
});

test('tribeLabel maps internal keys to display names with fallbacks', () => {
  const names = ['Taganong', 'Nuvati'];
  assert.equal(tribeLabel('red', names), 'Taganong');
  assert.equal(tribeLabel('blue', names), 'Nuvati');
  assert.equal(tribeLabel('red', null), 'Red');
  assert.equal(tribeLabel('blue', undefined), 'Blue');
  assert.equal(tribeLabel('green', names), 'green'); // unknown key passes through
});
