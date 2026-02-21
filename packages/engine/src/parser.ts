/** A single month's production record */
export interface ProductionRecord {
  date: Date;
  rate: number; // bbl/month or Mcf/month
}

/** Parsed production data with computed time offsets */
export interface ParsedProduction {
  records: ProductionRecord[];
  /** Time in months from first production */
  time: number[];
  rates: number[];
}

/**
 * Parse production data from text (CSV or tab-delimited).
 * Expected: two columns — date and rate.
 * Handles missing months by skipping them (no interpolation in MVP).
 */
export function parseProductionData(input: string): ParsedProduction {
  const lines = input.trim().split(/\r?\n/);
  const records: ProductionRecord[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || /^(date|month|time)/i.test(trimmed)) continue; // skip headers

    const parts = trimmed.split(/[,\t]+/);
    if (parts.length < 2) continue;

    const dateStr = parts[0].trim();
    const rateStr = parts[1].trim();

    const date = parseDate(dateStr);
    const rate = parseFloat(rateStr);

    if (!date || isNaN(rate) || rate < 0) continue;

    records.push({ date, rate });
  }

  if (records.length === 0) {
    throw new Error('No valid production records found');
  }

  // Sort by date
  records.sort((a, b) => a.date.getTime() - b.date.getTime());

  const firstDate = records[0].date;
  const time = records.map((r) => monthsDiff(firstDate, r.date));
  const rates = records.map((r) => r.rate);

  return { records, time, rates };
}

function parseDate(s: string): Date | null {
  // Try ISO or common formats: YYYY-MM-DD, MM/DD/YYYY, YYYY/MM/DD, YYYY-MM
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3] || '1'));
  }
  const usMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    return new Date(parseInt(usMatch[3]), parseInt(usMatch[1]) - 1, parseInt(usMatch[2]));
  }
  const slashIso = s.match(/^(\d{4})\/(\d{1,2})(?:\/(\d{1,2}))?$/);
  if (slashIso) {
    return new Date(parseInt(slashIso[1]), parseInt(slashIso[2]) - 1, parseInt(slashIso[3] || '1'));
  }
  return null;
}

function monthsDiff(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}
