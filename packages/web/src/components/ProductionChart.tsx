import { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { predictRate, type FitResult, type ParsedProduction, type ForecastResult } from '@declinecurve/engine';

interface Props {
  parsed: ParsedProduction | null;
  fits: FitResult[];
  bestFit: FitResult | null;
  forecast: ForecastResult | null;
}

export function ProductionChart({ parsed, fits, bestFit, forecast }: Props) {
  const chartData = useMemo(() => {
    if (!parsed) return [];

    const maxHistoryTime = Math.max(...parsed.time);
    const forecastEnd = forecast ? forecast.points[forecast.points.length - 1]?.month ?? maxHistoryTime : maxHistoryTime;
    const maxTime = Math.max(maxHistoryTime, forecastEnd);

    const data: Record<string, number | undefined>[] = [];

    // Build a time index covering history + forecast
    for (let t = 0; t <= maxTime; t++) {
      const entry: Record<string, number | undefined> = { month: t };

      // Actual production data point
      const histIdx = parsed.time.indexOf(t);
      if (histIdx !== -1) {
        entry.actual = parsed.rates[histIdx];
      }

      // Fitted curves (over history range)
      if (fits.length > 0 && t <= maxHistoryTime) {
        for (const fit of fits) {
          const key = fit.model.type === 'exponential' ? 'expFit' : 'hypFit';
          entry[key] = predictRate(fit.model, t);
        }
      }

      // Forecast (dashed, beyond history)
      if (forecast && bestFit && t >= maxHistoryTime) {
        entry.forecast = predictRate(bestFit.model, t);
      }

      data.push(entry);
    }

    return data;
  }, [parsed, fits, bestFit, forecast]);

  if (!parsed) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
        Import production data to begin analysis
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 40, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="month" label={{ value: 'Month', position: 'bottom', offset: 0 }} />
        <YAxis label={{ value: 'Rate (bbl/month)', angle: -90, position: 'insideLeft', offset: 10 }} />
        <Tooltip
          contentStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6 }}
          labelFormatter={(v) => `Month ${v}`}
          formatter={(value: number) => [value.toFixed(1), '']}
        />
        <Legend verticalAlign="top" height={36} />

        {/* Actual production scatter */}
        <Scatter name="Actual" dataKey="actual" fill="#ef4444" shape="circle" legendType="circle" />

        {/* Exponential fit line */}
        {fits.some((f) => f.model.type === 'exponential') && (
          <Line
            name="Exponential Fit"
            dataKey="expFit"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        )}

        {/* Hyperbolic fit line */}
        {fits.some((f) => f.model.type === 'hyperbolic') && (
          <Line
            name="Hyperbolic Fit"
            dataKey="hypFit"
            stroke="#8b5cf6"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        )}

        {/* Forecast (dashed) */}
        {forecast && (
          <Line
            name="Forecast"
            dataKey="forecast"
            stroke="#16a34a"
            strokeWidth={2}
            strokeDasharray="8 4"
            dot={false}
            connectNulls
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
