# DeclineCurve — Business Plan

## Executive Summary

DeclineCurve is a free, browser-based Arps decline curve analysis tool targeting petroleum engineers, reservoir consultants, and small operators who currently pay $5K–$20K/yr for desktop software like IHS Harmony, PHDWin, or Aries. The MVP delivers single-well exponential and hyperbolic decline fitting, EUR calculation, and production forecasting — covering the core workflow that engineers perform daily. Even at $500/yr for premium tiers, DeclineCurve undercuts the cheapest competitor by 90%.

## Market Analysis

### Target Users
- **Independent operators** (1–50 wells) who can't justify $10K+/yr enterprise licenses
- **Petroleum engineering consultants** billing per-project reserve reports
- **Small E&P companies** in unconventional plays needing quick DCA
- **Engineering students and academics** learning decline analysis

### Competitor Landscape

| Product | Price | Strengths | Weaknesses |
|---------|-------|-----------|------------|
| IHS Harmony | ~$10K+/yr | Industry standard, probabilistic, full portfolio | Expensive, desktop-only, steep learning curve |
| PHDWin | ~$5K/yr | Reserves reporting, economics | Legacy UI, Windows-only |
| Aries (Halliburton) | ~$8K/yr | Integrated with other Halliburton tools | Enterprise lock-in, complex |
| Spotfire DCA | ~$3K+/yr | Good visualization | Requires TIBCO platform |
| **DeclineCurve** | **Free / $199–999** | **Instant browser access, modern UI** | **Single-well only (MVP)** |

### Market Opportunity
- ~500K petroleum engineers worldwide, ~100K in North America
- Small operators (< 50 wells) represent ~60% of US well count
- Most can't justify enterprise DCA licenses for occasional use
- No credible free browser-based alternative exists

## Current State Assessment

### What Works
- ✅ Arps exponential decline fitting (log-linear regression)
- ✅ Arps hyperbolic decline fitting (Levenberg-Marquardt)
- ✅ Harmonic decline (b=1 special case)
- ✅ Best-fit model selection (R² and AIC comparison)
- ✅ EUR calculation for all decline types
- ✅ Production forecast generation (12/24/60 months)
- ✅ Web UI with production chart and forecast overlay
- ✅ CSV data import and export

### Test Coverage
- **33 tests total** (0 unit + 33 E2E)
- No unit tests for engine functions
- E2E tests cover full workflow but miss edge cases
- Coverage estimated < 30%

### Survey Results
| Metric | Score |
|--------|-------|
| Pro Use (would use professionally) | 60% |
| Scales (handles real workloads) | 40% |
| Useful (solves a real problem) | 75% |
| Incremental Premium (would pay $50–200/yr) | 55% |
| Major Premium (would pay $500+/yr) | 75% |

### Key Insight
75% willing to pay $500+/yr reflects the massive price gap — even a $500 tool is a 90–95% discount vs incumbents. The "Scales" score (40%) confirms multi-well portfolio is the critical gap.

## Phase 1: Foundation (Free — Current)

### Capabilities
Single-well Arps decline curve analysis with exponential, hyperbolic, and harmonic models. Best-fit selection, EUR, and production forecasting.

### Priority: Harden the Engine
Before monetization, build confidence with comprehensive unit tests:

| Task | Size | Description |
|------|------|-------------|
| Unit tests for exponential fitting | S | Test qi, Di recovery from synthetic data |
| Unit tests for hyperbolic fitting | M | Test qi, Di, b recovery, edge cases (b→0, b→1) |
| Unit tests for EUR calculation | S | Verify against hand calculations |
| Unit tests for forecast generation | S | Validate cumulative production totals |
| Unit tests for data parser | S | Missing months, irregular dates, unit conversion |
| Unit tests for best-fit selection | M | Verify AIC/R² model ranking |
| Validate against SPE examples | M | Published textbook worked problems |
| Validate against IHS Harmony output | M | Same well data, compare parameters |

**Target: 80%+ engine test coverage before Phase 2 development.**

## Phase 2: Professional ($199–349/yr)

### Features

| Feature | Size | Description |
|---------|------|-------------|
| Multi-well portfolio | L | Import and manage multiple wells, batch fitting, portfolio-level EUR summation |
| Type curve generation | L | Statistical type curves from well groups (P10/P50/P90 envelopes from historical data) |
| Rate-cumulative plots | M | Rate vs cumulative production diagnostic plots (standard reservoir engineering tool) |
| NPV/economics module | M | Cash flow analysis: revenue at oil/gas price, LOE, taxes, net present value |
| PDF reserve reports | M | Professional reserve report generation with charts, tables, SEC-style language |

### Pricing Rationale
- $199/yr solo consultant tier (< 25 wells)
- $349/yr small operator tier (< 100 wells)
- Still 93–97% cheaper than IHS Harmony
- Annual subscription, monthly billing option at 20% premium

### Revenue Projections
| Scenario | Users | ARPU | Annual Revenue |
|----------|-------|------|----------------|
| Conservative | 200 | $250 | $50K |
| Moderate | 500 | $275 | $138K |
| Optimistic | 1,000 | $300 | $300K |

## Phase 3: Enterprise ($499–999/yr)

### Features

| Feature | Size | Description |
|---------|------|-------------|
| Probabilistic reserves (P10/P50/P90) | XL | Monte Carlo simulation on decline parameters, probabilistic EUR distributions |
| Machine learning DCA | XL | ML-augmented decline fitting (LSTM/gradient boosting) for unconventional wells with complex behavior |
| Field-level forecasting | XL | Aggregate forecasts across entire fields/plays with shared decline characteristics |
| SEC reserves compliance | L | Reserves categorization (proved/probable/possible), SEC reporting templates and language |
| API integration with oilfield data | L | Import production data from Enverus/DrillingInfo, IHS, state regulatory APIs (TX RRC, NDIC, OCC) |

### Pricing Rationale
- $499/yr small team tier (< 250 wells, 3 users)
- $999/yr enterprise tier (unlimited wells, 10 users)
- Still 50–90% cheaper than any competitor at this feature level
- Volume discounts for large operators (> 1000 wells)

### Revenue Projections
| Scenario | Users | ARPU | Annual Revenue |
|----------|-------|------|----------------|
| Conservative | 100 | $600 | $60K |
| Moderate | 300 | $700 | $210K |
| Optimistic | 750 | $800 | $600K |

## Competitive Advantages

1. **Zero friction** — No download, no install, no license server. Open browser and go.
2. **90–95% cost reduction** — Even premium tiers are a fraction of incumbent pricing.
3. **Modern stack** — Fast, responsive UI vs 15-year-old desktop applications.
4. **Cross-platform** — Works on any device with a browser (field tablets, Mac, Linux).
5. **Instant updates** — No annual upgrade cycles or version lock-in.
6. **Data privacy** — All calculations run client-side. No production data leaves the browser.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Incumbents drop prices | Medium | Already 90%+ cheaper; compete on UX and accessibility |
| Data accuracy concerns | High | Validate against SPE/AAPG references; publish validation reports |
| Enterprise security requirements | Medium | Client-side computation means no data leaves browser |
| Slow adoption in conservative industry | High | Target young engineers and consultants first; conference demos |
| Feature gap vs full-suite tools | Medium | Focus on DCA excellence rather than being everything |

## Go-to-Market Strategy

### Phase 1 (Months 1–6)
- Launch free tier on declinecurve.app
- Post on LinkedIn petroleum engineering groups
- Submit to SPE technology showcase
- Create YouTube tutorial series (DCA basics + tool walkthrough)
- Target petroleum engineering university courses

### Phase 2 (Months 6–12)
- Launch paid tiers with Stripe billing
- Attend NAPE (North American Prospect Expo)
- Partner with petroleum engineering consultancies for bulk licenses
- Publish blog posts comparing DeclineCurve vs Harmony results

### Phase 3 (Months 12–24)
- Enterprise sales outreach to small E&P companies
- API marketplace listing (Enverus partner program)
- White-label licensing for engineering firms
- SEC compliance certification / third-party audit

## Technical Roadmap

```
Phase 1 (Now)          Phase 2 (6-12 mo)       Phase 3 (12-24 mo)
─────────────          ─────────────────        ──────────────────
Single-well DCA        Multi-well portfolio     Probabilistic reserves
Exp/Hyp/Harm fit       Type curves              ML-augmented DCA
EUR calculation        Rate-cum plots           Field forecasting
Basic forecast         NPV/economics            SEC compliance
CSV import/export      PDF reports              API integrations
                       $199-349/yr              $499-999/yr
```

## Success Metrics

| Metric | Phase 1 | Phase 2 | Phase 3 |
|--------|---------|---------|---------|
| Monthly active users | 500 | 2,000 | 5,000 |
| Paid subscribers | — | 200 | 500 |
| Annual revenue | $0 | $50K+ | $200K+ |
| Engine test coverage | 80%+ | 90%+ | 95%+ |
| Wells analyzed/month | 1,000 | 10,000 | 50,000 |
