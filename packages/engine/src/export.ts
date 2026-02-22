import { type FitResult } from './decline.js';
import { type ForecastPoint } from './forecast.js';

/**
 * E6: Export results as CSV string.
 */
export function exportResultsCsv(fit: FitResult): string {
  const m = fit.model;
  const lines = ['Parameter,Value'];
  lines.push(`Model Type,${m.type}`);
  lines.push(`qi (initial rate),${m.qi.toFixed(2)}`);
  lines.push(`Di (decline rate),${m.Di.toFixed(6)}`);
  lines.push(`b-factor,${m.type === 'hyperbolic' ? m.b.toFixed(4) : '0'}`);
  lines.push(`R²,${fit.rSquared.toFixed(6)}`);
  lines.push(`AIC,${fit.aic.toFixed(2)}`);
  lines.push(`EUR,${Number.isFinite(fit.eur) ? fit.eur.toFixed(2) : 'N/A'}`);
  return lines.join('\n');
}

/**
 * Export forecast table as CSV string.
 */
export function exportForecastCsv(points: ForecastPoint[]): string {
  const lines = ['Month,Rate,Cumulative'];
  for (const p of points) {
    lines.push(`${p.month},${p.rate.toFixed(2)},${p.cumulative.toFixed(2)}`);
  }
  return lines.join('\n');
}

/**
 * Format a human-readable summary.
 */
export function formatSummary(fit: FitResult): string {
  const m = fit.model;
  const parts = [
    `Model: ${m.type}`,
    `qi = ${m.qi.toFixed(2)} bbl/month`,
    `Di = ${(m.Di * 100).toFixed(2)}%/month`,
  ];
  if (m.type === 'hyperbolic') {
    parts.push(`b = ${m.b.toFixed(4)}`);
  }
  parts.push(`R² = ${fit.rSquared.toFixed(4)}`);
  parts.push(`EUR = ${Number.isFinite(fit.eur) ? fit.eur.toFixed(0) + ' bbl' : 'N/A'}`);
  return parts.join('\n');
}
