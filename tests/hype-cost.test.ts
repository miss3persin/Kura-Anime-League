import { test } from 'node:test';
import assert from 'node:assert';
import { calcCostKp } from '../src/lib/hype';

test('calcCostKp baseline', () => {
  const media = { averageScore: 80, popularity: 5000, status: 'RELEASING' };
  const rawHype = 500;
  // Constant random for test
  const cost = calcCostKp(media, rawHype, () => 0.5);
  assert.ok(cost >= 1000 && cost <= 12000);
  assert.strictEqual(cost % 50, 0);
});

test('calcCostKp high hype', () => {
  const media = { averageScore: 95, popularity: 100000, status: 'RELEASING' };
  const rawHype = 1000;
  const cost = calcCostKp(media, rawHype, () => 0.5);
  // Should be high
  assert.ok(cost > 5000);
});

test('calcCostKp low performance', () => {
  const media = { averageScore: 40, popularity: 100, status: 'FINISHED' };
  const rawHype = 100;
  const cost = calcCostKp(media, rawHype, () => 0.5);
  // Should be near floor
  assert.ok(cost <= 3000);
});
