export interface ExponentialModel {
  type: 'exponential';
  qi: number;  // initial rate
  Di: number;  // decline rate (1/month)
  b: 0;
}

export interface HyperbolicModel {
  type: 'hyperbolic';
  qi: number;
  Di: number;
  b: number;   // 0 < b < 1
}

export type DeclineModel = ExponentialModel | HyperbolicModel;

export interface FitResult {
  model: DeclineModel;
  rSquared: number;
  aic: number;
  eur: number; // estimated ultimate recovery (cumulative)
}

/** Predict rate at time t using an Arps model */
export function predictRate(model: DeclineModel, t: number): number {
  if (model.type === 'exponential') {
    return model.qi * Math.exp(-model.Di * t);
  }
  // Hyperbolic: q = qi / (1 + b*Di*t)^(1/b)
  const denom = 1 + model.b * model.Di * t;
  if (denom <= 0) return 0;
  return model.qi / Math.pow(denom, 1 / model.b);
}

/**
 * E2: Fit exponential decline via log-linear regression.
 * ln(q) = ln(qi) - Di*t  →  linear regression of ln(q) vs t
 */
export function fitExponential(time: number[], rates: number[]): FitResult {
  // Filter out zero/negative rates for log transform
  const valid = time.reduce<{ t: number[]; lnq: number[]; q: number[] }>(
    (acc, t, i) => {
      if (rates[i] > 0) {
        acc.t.push(t);
        acc.lnq.push(Math.log(rates[i]));
        acc.q.push(rates[i]);
      }
      return acc;
    },
    { t: [], lnq: [], q: [] }
  );

  const n = valid.t.length;
  if (n < 2) throw new Error('Need at least 2 positive data points for exponential fit');

  // Linear regression: lnq = a + b*t  where a=ln(qi), b=-Di
  const sumT = valid.t.reduce((s, v) => s + v, 0);
  const sumLnq = valid.lnq.reduce((s, v) => s + v, 0);
  const sumT2 = valid.t.reduce((s, v) => s + v * v, 0);
  const sumTLnq = valid.t.reduce((s, v, i) => s + v * valid.lnq[i], 0);

  const denom = n * sumT2 - sumT * sumT;
  if (Math.abs(denom) < 1e-15) throw new Error('Degenerate data for exponential fit');

  const slope = (n * sumTLnq - sumT * sumLnq) / denom;
  const intercept = (sumLnq - slope * sumT) / n;

  const qi = Math.exp(intercept);
  const Di = -slope;

  if (Di <= 0) {
    // Production is increasing — not a decline; still return but poor R²
  }

  const model: ExponentialModel = { type: 'exponential', qi, Di, b: 0 };
  const rSquared = computeRSquared(valid.t, valid.q, model);
  const aic = computeAIC(valid.t, valid.q, model, 2); // 2 params: qi, Di
  const eur = Di > 0 ? qi / Di : Infinity;

  return { model, rSquared, aic, eur };
}

/**
 * E3: Fit hyperbolic decline via Levenberg-Marquardt.
 * q(t) = qi / (1 + b*Di*t)^(1/b)
 */
export function fitHyperbolic(time: number[], rates: number[]): FitResult {
  const valid = time.reduce<{ t: number[]; q: number[] }>(
    (acc, t, i) => {
      if (rates[i] > 0) {
        acc.t.push(t);
        acc.q.push(rates[i]);
      }
      return acc;
    },
    { t: [], q: [] }
  );

  const n = valid.t.length;
  if (n < 3) throw new Error('Need at least 3 positive data points for hyperbolic fit');

  // Initial guess from exponential fit
  const expFit = fitExponential(time, rates);
  let qi = expFit.model.qi;
  let Di = Math.max(expFit.model.Di, 0.001);
  let b = 0.5;

  // Levenberg-Marquardt iterations
  const maxIter = 200;
  let lambda = 0.01;

  for (let iter = 0; iter < maxIter; iter++) {
    const { J, residuals } = computeJacobianAndResiduals(valid.t, valid.q, qi, Di, b);

    // JᵀJ and Jᵀr
    const JtJ = matMul3x3T(J);
    const Jtr = matVecMul3T(J, residuals);

    // Damped: (JᵀJ + λI)δ = Jᵀr
    const A = [
      [JtJ[0][0] + lambda, JtJ[0][1], JtJ[0][2]],
      [JtJ[1][0], JtJ[1][1] + lambda, JtJ[1][2]],
      [JtJ[2][0], JtJ[2][1], JtJ[2][2] + lambda],
    ];

    const delta = solve3x3(A, Jtr);
    if (!delta) break;

    const newQi = qi + delta[0];
    const newDi = Di + delta[1];
    const newB = b + delta[2];

    // Clamp parameters
    const clampedQi = Math.max(newQi, 1);
    const clampedDi = Math.max(newDi, 1e-6);
    const clampedB = Math.max(0.01, Math.min(0.99, newB));

    const oldSSE = residuals.reduce((s, r) => s + r * r, 0);
    const newResiduals = valid.t.map((t, i) => {
      const pred = clampedQi / Math.pow(1 + clampedB * clampedDi * t, 1 / clampedB);
      return valid.q[i] - pred;
    });
    const newSSE = newResiduals.reduce((s, r) => s + r * r, 0);

    if (newSSE < oldSSE) {
      qi = clampedQi;
      Di = clampedDi;
      b = clampedB;
      lambda *= 0.5;
      if (Math.abs(oldSSE - newSSE) / (oldSSE + 1e-15) < 1e-10) break;
    } else {
      lambda *= 5;
    }
  }

  const model: HyperbolicModel = { type: 'hyperbolic', qi, Di, b };
  const rSquared = computeRSquared(valid.t, valid.q, model);
  const aic = computeAIC(valid.t, valid.q, model, 3); // 3 params: qi, Di, b

  // EUR for hyperbolic with economic limit (use 1 bbl/month as default)
  const qf = 1;
  let eur: number;
  if (b < 1 && Di > 0) {
    eur =
      (Math.pow(qi, b) / ((1 - b) * Di)) *
      (Math.pow(qi, 1 - b) - Math.pow(qf, 1 - b));
  } else {
    eur = Infinity;
  }

  return { model, rSquared, aic, eur };
}

/**
 * E4: Select best fit between exponential and hyperbolic.
 */
export function selectBestFit(time: number[], rates: number[]): { best: FitResult; all: FitResult[] } {
  const expFit = fitExponential(time, rates);
  const hypFit = fitHyperbolic(time, rates);

  const all = [expFit, hypFit];
  // Prefer higher R², use AIC as tiebreaker
  const best = hypFit.rSquared > expFit.rSquared + 0.005 ? hypFit : expFit;

  return { best, all };
}

// ---- Helpers ----

function computeRSquared(time: number[], rates: number[], model: DeclineModel): number {
  const mean = rates.reduce((s, v) => s + v, 0) / rates.length;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < time.length; i++) {
    const pred = predictRate(model, time[i]);
    ssRes += (rates[i] - pred) ** 2;
    ssTot += (rates[i] - mean) ** 2;
  }
  if (ssTot === 0) return 1;
  return 1 - ssRes / ssTot;
}

function computeAIC(time: number[], rates: number[], model: DeclineModel, k: number): number {
  const n = time.length;
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const pred = predictRate(model, time[i]);
    sse += (rates[i] - pred) ** 2;
  }
  // AIC = n*ln(SSE/n) + 2k
  return n * Math.log(sse / n + 1e-15) + 2 * k;
}

function computeJacobianAndResiduals(
  t: number[],
  q: number[],
  qi: number,
  Di: number,
  b: number
): { J: number[][]; residuals: number[] } {
  const n = t.length;
  const J: number[][] = [];
  const residuals: number[] = [];

  for (let i = 0; i < n; i++) {
    const bDt = b * Di * t[i];
    const base = 1 + bDt;
    const invB = 1 / b;
    const pred = qi / Math.pow(base, invB);
    residuals.push(q[i] - pred);

    // ∂q/∂qi = 1 / (1+bDt)^(1/b)
    const dqi = 1 / Math.pow(base, invB);

    // ∂q/∂Di = -qi * t / (1+bDt)^(1/b + 1)
    const dDi = (-qi * t[i]) / Math.pow(base, invB + 1);

    // ∂q/∂b  (numerical differentiation for stability)
    const eps = 1e-6;
    const bPlus = b + eps;
    const predPlus = qi / Math.pow(1 + bPlus * Di * t[i], 1 / bPlus);
    const db = (predPlus - pred) / eps;

    J.push([dqi, dDi, db]);
  }

  return { J, residuals };
}

function matMul3x3T(J: number[][]): number[][] {
  const result = Array.from({ length: 3 }, () => [0, 0, 0]);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let sum = 0;
      for (let k = 0; k < J.length; k++) {
        sum += J[k][i] * J[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}

function matVecMul3T(J: number[][], r: number[]): number[] {
  const result = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    for (let k = 0; k < J.length; k++) {
      result[i] += J[k][i] * r[k];
    }
  }
  return result;
}

function solve3x3(A: number[][], b: number[]): number[] | null {
  // Gaussian elimination for 3x3
  const a = A.map((r) => [...r]);
  const rhs = [...b];

  for (let col = 0; col < 3; col++) {
    let maxRow = col;
    for (let row = col + 1; row < 3; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[maxRow][col])) maxRow = row;
    }
    [a[col], a[maxRow]] = [a[maxRow], a[col]];
    [rhs[col], rhs[maxRow]] = [rhs[maxRow], rhs[col]];

    if (Math.abs(a[col][col]) < 1e-15) return null;

    for (let row = col + 1; row < 3; row++) {
      const factor = a[row][col] / a[col][col];
      for (let j = col; j < 3; j++) {
        a[row][j] -= factor * a[col][j];
      }
      rhs[row] -= factor * rhs[col];
    }
  }

  const x = [0, 0, 0];
  for (let i = 2; i >= 0; i--) {
    let sum = rhs[i];
    for (let j = i + 1; j < 3; j++) {
      sum -= a[i][j] * x[j];
    }
    x[i] = sum / a[i][i];
  }
  return x;
}
