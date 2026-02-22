import { type FitResult, type ForecastResult } from '@declinecurve/engine';

interface Props {
  fits: FitResult[];
  bestFit: FitResult | null;
  forecast: ForecastResult | null;
  onExportCsv?: () => void;
}

export function ResultsPanel({ fits, bestFit, forecast, onExportCsv }: Props) {
  if (fits.length === 0) {
    return (
      <>
        <h2>Results</h2>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Click <strong>▶ Fit</strong> to analyze decline.
        </div>
      </>
    );
  }

  return (
    <>
      <div className="results-header">
        <h2>Results</h2>
        {bestFit && onExportCsv && (
          <button className="export-inline" onClick={onExportCsv} title="Export CSV">📄 CSV</button>
        )}
      </div>

      {fits.map((fit) => {
        const isBest = bestFit && fit.model.type === bestFit.model.type;
        return (
          <div className="result-card" key={fit.model.type}>
            <h3>
              {fit.model.type === 'exponential' ? '📐 Exponential' : '📈 Hyperbolic'}
              {isBest && <span className="best-badge">Best Fit</span>}
            </h3>
            <div className="result-row">
              <span className="label">qi</span>
              <span className="value">{fit.model.qi.toFixed(1)} bbl/mo</span>
            </div>
            <div className="result-row">
              <span className="label">Di</span>
              <span className="value">{(fit.model.Di * 100).toFixed(2)}%/mo</span>
            </div>
            {fit.model.type === 'hyperbolic' && (
              <div className="result-row">
                <span className="label">b</span>
                <span className="value">{fit.model.b.toFixed(4)}</span>
              </div>
            )}
            <div className="result-row">
              <span className="label">R²</span>
              <span className="value">{fit.rSquared.toFixed(4)}</span>
            </div>
            <div className="result-row">
              <span className="label">AIC</span>
              <span className="value">{fit.aic.toFixed(1)}</span>
            </div>
            <div className="result-row">
              <span className="label">EUR</span>
              <span className="value">{fit.eur.toLocaleString(undefined, { maximumFractionDigits: 0 })} bbl</span>
            </div>
          </div>
        );
      })}

      {forecast && (
        <div className="result-card">
          <h3>📊 Forecast</h3>
          <div className="result-row">
            <span className="label">Period</span>
            <span className="value">{forecast.points.length - 1} months</span>
          </div>
          <div className="result-row">
            <span className="label">Cum. Production</span>
            <span className="value">{forecast.eurAtEnd.toLocaleString(undefined, { maximumFractionDigits: 0 })} bbl</span>
          </div>
          <table className="forecast-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Rate</th>
                <th>Cum.</th>
              </tr>
            </thead>
            <tbody>
              {forecast.points
                .filter((_, i) => i === 0 || i === forecast.points.length - 1 || (i % 6 === 0))
                .map((p) => (
                  <tr key={p.month}>
                    <td>{p.month}</td>
                    <td>{p.rate.toFixed(1)}</td>
                    <td>{p.cumulative.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
