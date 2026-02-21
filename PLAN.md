# DeclineCurve — Arps Decline Curve Analysis

## Mission
Replace IHS Harmony Enterprise ($5K–$20K/yr) for single-well decline curve analysis — free in browser.

## Architecture
- `packages/engine/` — Arps exponential/hyperbolic fitting, EUR calculation, forecasting
- `packages/web/` — React + Vite, production history chart, forecast overlay
- `packages/cli/` — Node runner for batch well analysis

## MVP Features (Free Tier)
1. Paste monthly production data (oil, gas, or water)
2. Fit Arps exponential and hyperbolic decline automatically
3. Display best-fit curve overlaid on production history
4. Output decline rate (D), b-factor, and EUR
5. 12/24/60-month production forecast plot
6. Single-well summary export (CSV + PNG)

## Engine Tasks

### E1: Production Data Parser
- Parse monthly data: Date | Production Rate (bbl/month or Mcf/month)
- Handle missing months (interpolate or skip)
- Compute calendar time from first production
- **Validation**: Known production datasets

### E2: Arps Exponential Decline
- `q(t) = qi × exp(-Di × t)`
- Fit qi and Di via log-linear regression (ln(q) vs t)
- EUR: `Np = qi / Di` (cumulative at t→∞)
- **Validation**: SPE textbook examples

### E3: Arps Hyperbolic Decline
- `q(t) = qi / (1 + b × Di × t)^(1/b)`
- Fit qi, Di, b via nonlinear least-squares (Levenberg-Marquardt)
- Constraints: 0 < b < 1 (physically meaningful)
- EUR: `Np = (qi^b / ((1-b) × Di)) × (qi^(1-b) - qf^(1-b))`
- **Validation**: SPE/AAPG published decline examples

### E4: Best-Fit Selection
- Fit both exponential and hyperbolic
- Compare R² and AIC (Akaike Information Criterion)
- Report best model with parameters
- **Validation**: Known datasets where one model is clearly better

### E5: Production Forecast
- Project future production using fitted decline parameters
- Compute cumulative production at 12, 24, 60 months
- Economic limit: forecast until rate drops below user-defined minimum
- **Validation**: Manual forecast calculation

### E6: Export
- Results: qi, Di, b, EUR, R²
- Forecast table: Month, Rate, Cumulative
- CSV + chart data export

## Web UI Tasks

### W1: Data Entry
- Paste production data (date + rate columns)
- CSV upload
- Data preview table with validation

### W2: Production History Chart
- Recharts: time vs rate (line + scatter)
- Fitted decline curve overlay
- Toggle exponential vs hyperbolic display
- Forecast extension (dashed line)

### W3: Results Panel
- Model parameters: qi, Di, b
- EUR with forecast period
- R² and model comparison
- Cumulative production table

### W4: Export
- Download CSV (history + forecast)
- Download chart as PNG
- Print-friendly single-well summary

### W5: Toolbar & Theme
- Import, Fit, Forecast, Export buttons
- Forecast period selector (12/24/60 months)
- Light/dark theme

## Key Equations
- Exponential: `q = qi × e^(-Dt)`, EUR = `qi/D`
- Hyperbolic: `q = qi / (1+bDt)^(1/b)`
- Harmonic (b=1): `q = qi / (1+Dt)`, EUR = `(qi/D) × ln(qi/qf)`

## Validation Strategy
- SPE Petroleum Engineering Handbook decline examples
- AAPG reserve estimation worked problems
- Compare to IHS Harmony on published well datasets
