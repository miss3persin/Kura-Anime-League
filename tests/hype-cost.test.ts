import { test } from 'node:test';
import assert from 'node:assert';
import { calcCostKp } from '../src/lib/hype';

test('calcCostKp baseline', () => {
  const media = { averageScore: 80, popularity: 5000, status: 'RELEASING' };
  const rawHype = 500;
  // Constant random for test
  const cost = calcCostKp(media, rawHype, () => 0.5);
  assert.ok(cost >= 1000 && cost <= 15000);
  assert.strictEqual(cost % 10, 0);
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
  // Should stay in the lower band of the market
  assert.ok(cost <= 4500);
});

test('calcCostKp reacts to previous momentum and price', () => {
  const media = { averageScore: 78, popularity: 1800, status: 'NOT_YET_RELEASED', trending: 3200 };
  const cost = calcCostKp(media, 760, () => 0.5, { previousCost: 4200, previousHype: 600 });
  assert.ok(cost > 4200);
});
