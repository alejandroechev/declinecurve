import { describe, it, expect } from 'vitest';
import { generateForecast } from '../src/forecast.js';
import { type ExponentialModel, type HyperbolicModel } from '../src/decline.js';

describe('E5: Production Forecast', () => {
  const expModel: ExponentialModel = { type: 'exponential', qi: 1000, Di: 0.05, b: 0 };
  const hypModel: HyperbolicModel = { type: 'hyperbolic', qi: 1000, Di: 0.08, b: 0.5 };

  it('generates correct number of forecast points', () => {
    const result = generateForecast(expModel, 12, 0);
    // 0 through 12 = 13 points
    expect(result.points).toHaveLength(13);
  });

  it('first point rate matches qi', () => {
    const result = generateForecast(expModel, 12);
    expect(result.points[0].rate).toBeCloseTo(1000);
    expect(result.points[0].cumulative).toBe(0);
  });

  it('rates decline monotonically for exponential', () => {
    const result = generateForecast(expModel, 24, 0);
    for (let i = 1; i < result.points.length; i++) {
      expect(result.points[i].rate).toBeLessThan(result.points[i - 1].rate);
    }
  });

  it('cumulative increases monotonically', () => {
    const result = generateForecast(expModel, 24, 0);
    for (let i = 2; i < result.points.length; i++) {
      expect(result.points[i].cumulative).toBeGreaterThan(result.points[i - 1].cumulative);
    }
  });

  it('stops at economic limit', () => {
    const result = generateForecast(expModel, 1000, 100);
    const lastRate = result.points[result.points.length - 1].rate;
    expect(lastRate).toBeGreaterThanOrEqual(100);
    expect(result.points.length).toBeLessThan(1001);
  });

  it('works with hyperbolic model', () => {
    const result = generateForecast(hypModel, 24, 0);
    expect(result.points[0].rate).toBeCloseTo(1000);
    expect(result.points.length).toBe(25);
  });

  it('supports startMonth offset', () => {
    const result = generateForecast(expModel, 12, 0, 6);
    expect(result.points[0].month).toBe(6);
    expect(result.points[0].rate).toBeCloseTo(1000 * Math.exp(-0.05 * 6), 0);
  });
});
