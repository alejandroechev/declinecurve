import { useState, useCallback, useRef } from 'react';
import {
  parseProductionData,
  fitExponential,
  fitHyperbolic,
  selectBestFit,
  generateForecast,
  exportResultsCsv,
  exportForecastCsv,
  type ParsedProduction,
  type FitResult,
  type ForecastResult,
} from '@declinecurve/engine';
import { ProductionChart } from './components/ProductionChart';
import { ResultsPanel } from './components/ResultsPanel';

const SAMPLE_DATA = `Date,Rate (bbl/month)
2022-01,1200
2022-02,1140
2022-03,1083
2022-04,1029
2022-05,977
2022-06,928
2022-07,882
2022-08,838
2022-09,796
2022-10,756
2022-11,718
2022-12,682
2023-01,648
2023-02,616
2023-03,585
2023-04,556
2023-05,528
2023-06,502
2023-07,477
2023-08,453
2023-09,430
2023-10,409
2023-11,388
2023-12,369`;

type ForecastPeriod = 12 | 24 | 60;

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [rawData, setRawData] = useState(SAMPLE_DATA);
  const [parsed, setParsed] = useState<ParsedProduction | null>(null);
  const [fits, setFits] = useState<FitResult[]>([]);
  const [bestFit, setBestFit] = useState<FitResult | null>(null);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [forecastPeriod, setForecastPeriod] = useState<ForecastPeriod>(24);
  const [error, setError] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  };

  const handleParse = useCallback(() => {
    try {
      const p = parseProductionData(rawData);
      setParsed(p);
      setError(null);
      setFits([]);
      setBestFit(null);
      setForecast(null);
    } catch (e: unknown) {
      setError((e as Error).message);
      setParsed(null);
    }
  }, [rawData]);

  const handleFit = useCallback(() => {
    if (!parsed) return;
    try {
      const { best, all } = selectBestFit(parsed.time, parsed.rates);
      setFits(all);
      setBestFit(best);
      // Auto-generate forecast
      const lastTime = parsed.time[parsed.time.length - 1];
      const fc = generateForecast(best.model, forecastPeriod, 1, lastTime);
      setForecast(fc);
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }, [parsed, forecastPeriod]);

  const handleForecastPeriodChange = useCallback(
    (period: ForecastPeriod) => {
      setForecastPeriod(period);
      if (bestFit && parsed) {
        const lastTime = parsed.time[parsed.time.length - 1];
        const fc = generateForecast(bestFit.model, period, 1, lastTime);
        setForecast(fc);
      }
    },
    [bestFit, parsed]
  );

  const handleExportCsv = useCallback(() => {
    if (!bestFit || !forecast) return;
    const resultsCsv = exportResultsCsv(bestFit);
    const forecastCsv = exportForecastCsv(forecast.points);
    const combined = resultsCsv + '\n\n' + forecastCsv;
    downloadFile(combined, 'decline_analysis.csv', 'text/csv');
  }, [bestFit, forecast]);

  const handleExportPng = useCallback(() => {
    if (!chartRef.current) return;
    const svg = chartRef.current.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx.scale(2, 2);
      ctx.fillStyle = theme === 'dark' ? '#0f172a' : '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'decline_chart.png';
          a.click();
          URL.revokeObjectURL(url);
        }
      });
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }, [theme]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRawData(ev.target?.result as string);
    };
    reader.readAsText(file);
  };

  return (
    <div className="app">
      <div className="toolbar">
        <h1>📉 DeclineCurve</h1>
        <button onClick={handleParse}>Import</button>
        <button onClick={handleFit} disabled={!parsed}>
          Fit
        </button>
        <select
          value={forecastPeriod}
          onChange={(e) => handleForecastPeriodChange(Number(e.target.value) as ForecastPeriod)}
        >
          <option value={12}>12 months</option>
          <option value={24}>24 months</option>
          <option value={60}>60 months</option>
        </select>
        <button onClick={handleExportCsv} disabled={!bestFit}>
          Export CSV
        </button>
        <button onClick={handleExportPng} disabled={!bestFit}>
          Export PNG
        </button>
        <button onClick={() => window.open('/intro.html', '_blank')}>📖 Guide</button>
        <button onClick={toggleTheme}>{theme === 'light' ? '🌙' : '☀️'}</button>
      </div>

      <div className="main">
        {/* Left: Data Entry */}
        <div className="panel">
          <h2>Production Data</h2>
          <textarea
            value={rawData}
            onChange={(e) => setRawData(e.target.value)}
            placeholder="Paste date,rate data here..."
          />
          <div className="hint">CSV or tab-delimited: Date, Rate (bbl/month)</div>
          <div className="file-upload">
            <label>
              📁 Upload CSV
              <input type="file" accept=".csv,.txt" onChange={handleFileUpload} />
            </label>
          </div>
          {error && <div className="error">⚠️ {error}</div>}
          {parsed && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {parsed.records.slice(0, 20).map((r, i) => (
                  <tr key={i}>
                    <td>
                      {r.date.getFullYear()}-{String(r.date.getMonth() + 1).padStart(2, '0')}
                    </td>
                    <td>{r.rate.toLocaleString()}</td>
                  </tr>
                ))}
                {parsed.records.length > 20 && (
                  <tr>
                    <td colSpan={2} style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      ...{parsed.records.length - 20} more rows
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Center: Chart */}
        <div className="chart-area">
          <h2>Production History & Decline Curve</h2>
          <div className="chart-container" ref={chartRef}>
            <ProductionChart
              parsed={parsed}
              fits={fits}
              bestFit={bestFit}
              forecast={forecast}
            />
          </div>
        </div>

        {/* Right: Results */}
        <div className="results">
          <ResultsPanel fits={fits} bestFit={bestFit} forecast={forecast} />
        </div>
      </div>
    </div>
  );
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
