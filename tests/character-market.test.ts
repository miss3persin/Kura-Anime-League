import { test } from 'node:test';
import assert from 'node:assert';
import { appendCharacterPriceHistory, calcCharacterPrice, getCharacterPriceChange } from '../src/lib/character-market';

test('calcCharacterPrice keeps values inside market bounds', () => {
  const price = calcCharacterPrice({ favorites: 2500, role: 'Waifu', gender: 'Female' }, () => 0.5);
  assert.ok(price >= 800 && price <= 6500);
  assert.strictEqual(price % 10, 0);
});

test('calcCharacterPrice is more explosive with upward momentum', () => {
  const price = calcCharacterPrice(
    { favorites: 6000, role: 'Husbando', gender: 'Male' },
    () => 0.5,
    { previousPrice: 1800, previousFavorites: 3200 }
  );
  assert.ok(price > 1800);
});

test('character price history tracks delta and percent', () => {
  const history = appendCharacterPriceHistory([{ timestamp: '2026-03-07T08:00:00Z', price: 1500 }], 1800, '2026-03-07T10:00:00Z');
  const change = getCharacterPriceChange(history, 1800);
  assert.strictEqual(change.delta, 300);
  assert.ok(change.percent > 0);
});
