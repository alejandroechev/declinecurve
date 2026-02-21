import { describe, it, expect } from 'vitest';
import { fitExponential, fitHyperbolic, selectBestFit, predictRate } from '../src/decline.js';

// Generate synthetic exponential decline data: qi=1000, Di=0.05/month
function generateExpData(qi: number, Di: number, months: number) {
  const time: number[] = [];
  const rates: number[] = [];
  for (let t = 0; t < months; t++) {
    time.push(t);
    rates.push(qi * Math.exp(-Di * t));
  }
  return { time, rates };
}

// Generate synthetic hyperbolic decline data
function generateHypData(qi: number, Di: number, b: number, months: number) {
  const time: number[] = [];
  const rates: number[] = [];
  for (let t = 0; t < months; t++) {
    time.push(t);
    rates.push(qi / Math.pow(1 + b * Di * t, 1 / b));
  }
  return { time, rates };
}

describe('E2: Arps Exponential Decline', () => {
  it('recovers qi and Di from synthetic exponential data', () => {
    const { time, rates } = generateExpData(1000, 0.05, 24);
    const result = fitExponential(time, rates);

    expect(result.model.type).toBe('exponential');
    expect(result.model.qi).toBeCloseTo(1000, 0);
    expect(result.model.Di).toBeCloseTo(0.05, 3);
    expect(result.rSquared).toBeGreaterThan(0.99);
  });

  it('computes EUR correctly', () => {
    const { time, rates } = generateExpData(1000, 0.05, 24);
    const result = fitExponential(time, rates);
    // EUR = qi/Di = 1000/0.05 = 20000
    expect(result.eur).toBeCloseTo(20000, -1);
  });

  it('handles noisy data with reasonable R²', () => {
    const { time, rates } = generateExpData(500, 0.03, 36);
    // Add ±5% noise
    const noisy = rates.map((r) => r * (1 + (Math.random() - 0.5) * 0.1));
    const result = fitExponential(time, noisy);
    expect(result.rSquared).toBeGreaterThan(0.9);
  });
});

describe('E3: Arps Hyperbolic Decline', () => {
  it('recovers parameters from synthetic hyperbolic data', () => {
    const { time, rates } = generateHypData(1000, 0.08, 0.5, 36);
    const result = fitHyperbolic(time, rates);

    expect(result.model.type).toBe('hyperbolic');
    expect(result.model.qi).toBeCloseTo(1000, -1);
    expect(result.model.Di).toBeCloseTo(0.08, 1);
    expect(result.model.b).toBeCloseTo(0.5, 1);
    expect(result.rSquared).toBeGreaterThan(0.99);
  });

  it('constrains b between 0 and 1', () => {
    const { time, rates } = generateHypData(800, 0.06, 0.3, 24);
    const result = fitHyperbolic(time, rates);
    expect(result.model.b).toBeGreaterThan(0);
    expect(result.model.b).toBeLessThan(1);
  });
});

describe('E4: Best-Fit Selection', () => {
  it('selects exponential for exponential data', () => {
    const { time, rates } = generateExpData(1000, 0.05, 36);
    const { best } = selectBestFit(time, rates);
    expect(best.model.type).toBe('exponential');
    expect(best.rSquared).toBeGreaterThan(0.99);
  });

  it('selects hyperbolic for hyperbolic data', () => {
    const { time, rates } = generateHypData(1000, 0.1, 0.7, 48);
    const { best, all } = selectBestFit(time, rates);
    // Hyperbolic should fit better
    expect(best.model.type).toBe('hyperbolic');
    expect(all).toHaveLength(2);
  });

  it('returns both models', () => {
    const { time, rates } = generateExpData(500, 0.04, 24);
    const { all } = selectBestFit(time, rates);
    const types = all.map((f) => f.model.type);
    expect(types).toContain('exponential');
    expect(types).toContain('hyperbolic');
  });
});

describe('predictRate', () => {
  it('predicts exponential rate correctly', () => {
    const model = { type: 'exponential' as const, qi: 1000, Di: 0.05, b: 0 as const };
    expect(predictRate(model, 0)).toBeCloseTo(1000);
    expect(predictRate(model, 10)).toBeCloseTo(1000 * Math.exp(-0.5), 1);
  });

  it('predicts hyperbolic rate correctly', () => {
    const model = { type: 'hyperbolic' as const, qi: 1000, Di: 0.08, b: 0.5 };
    expect(predictRate(model, 0)).toBeCloseTo(1000);
    const expected = 1000 / Math.pow(1 + 0.5 * 0.08 * 12, 2);
    expect(predictRate(model, 12)).toBeCloseTo(expected, 0);
  });
});
