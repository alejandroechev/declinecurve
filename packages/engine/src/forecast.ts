import { type DeclineModel, predictRate } from './decline.js';

export interface ForecastPoint {
  month: number;
  rate: number;
  cumulative: number;
}

export interface ForecastResult {
  points: ForecastPoint[];
  eurAtEnd: number;
}

/**
 * E5: Generate production forecast from a fitted decline model.
 * @param model Fitted decline model
 * @param months Number of months to forecast
 * @param economicLimit Minimum rate (stop forecast below this)
 * @param startMonth Starting month offset (default 0)
 */
export function generateForecast(
  model: DeclineModel,
  months: number,
  economicLimit: number = 1,
  startMonth: number = 0
): ForecastResult {
  const points: ForecastPoint[] = [];
  let cumulative = 0;

  for (let m = 0; m <= months; m++) {
    const t = startMonth + m;
    const rate = predictRate(model, t);

    if (rate < economicLimit && m > 0) break;

    // Trapezoidal integration for cumulative
    if (m > 0) {
      const prevRate = predictRate(model, t - 1);
      cumulative += (prevRate + rate) / 2;
    }

    points.push({ month: t, rate, cumulative });
  }

  return {
    points,
    eurAtEnd: cumulative,
  };
}
