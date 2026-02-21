import { describe, it, expect } from 'vitest';
import { exportResultsCsv, exportForecastCsv, formatSummary } from '../src/export.js';
import { type FitResult } from '../src/decline.js';
import { type ForecastPoint } from '../src/forecast.js';

describe('E6: Export', () => {
  const expFit: FitResult = {
    model: { type: 'exponential', qi: 1000, Di: 0.05, b: 0 },
    rSquared: 0.995,
    aic: -120.5,
    eur: 20000,
  };

  const hypFit: FitResult = {
    model: { type: 'hyperbolic', qi: 1000, Di: 0.08, b: 0.5 },
    rSquared: 0.998,
    aic: -130.2,
    eur: 25000,
  };

  it('exports exponential results as CSV', () => {
    const csv = exportResultsCsv(expFit);
    expect(csv).toContain('Parameter,Value');
    expect(csv).toContain('exponential');
    expect(csv).toContain('1000.00');
    expect(csv).toContain('0.050000');
  });

  it('exports hyperbolic results with b-factor', () => {
    const csv = exportResultsCsv(hypFit);
    expect(csv).toContain('hyperbolic');
    expect(csv).toContain('0.5000');
  });

  it('exports forecast table as CSV', () => {
    const points: ForecastPoint[] = [
      { month: 0, rate: 1000, cumulative: 0 },
      { month: 1, rate: 950, cumulative: 975 },
      { month: 2, rate: 900, cumulative: 1900 },
    ];
    const csv = exportForecastCsv(points);
    expect(csv).toContain('Month,Rate,Cumulative');
    expect(csv.split('\n')).toHaveLength(4); // header + 3 rows
  });

  it('formats human-readable summary', () => {
    const summary = formatSummary(expFit);
    expect(summary).toContain('exponential');
    expect(summary).toContain('qi = 1000.00');
    expect(summary).toContain('R²');
    expect(summary).toContain('EUR');
  });

  it('includes b-factor in hyperbolic summary', () => {
    const summary = formatSummary(hypFit);
    expect(summary).toContain('b = 0.5000');
  });
});
