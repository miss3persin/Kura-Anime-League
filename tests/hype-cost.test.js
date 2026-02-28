const assert = require('node:assert');
const { describe, test } = require('node:test');
const { calcCostKp } = require('../src/lib/hype');

describe('calcCostKp', () => {
  test('never drops below the floor or misaligns rounding', () => {
    const media = { averageScore: 10, popularity: 5, status: 'FINISHED' };
    const result = calcCostKp(media, 0, () => 0);
    assert(result >= 1000, 'floor should be 1000 KP');
    assert.strictEqual(result % 50, 0, 'price should round to 50 KP increments');
  });

  test('honors the ceiling and remains rounded', () => {
    const media = { averageScore: 95, popularity: 100000, status: 'RELEASING' };
    const result = calcCostKp(media, 1000, () => 1);
    assert(result <= 12000, 'ceiling should be 12000 KP');
    assert(result >= 1000);
    assert.strictEqual(result % 50, 0);
  });
});
