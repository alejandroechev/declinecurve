import { describe, it, expect } from 'vitest';
import { parseProductionData } from '../src/parser.js';

describe('E1: Production Data Parser', () => {
  it('parses CSV with ISO dates', () => {
    const input = `Date,Rate
2020-01-01,1000
2020-02-01,950
2020-03-01,900`;
    const result = parseProductionData(input);
    expect(result.records).toHaveLength(3);
    expect(result.time).toEqual([0, 1, 2]);
    expect(result.rates).toEqual([1000, 950, 900]);
  });

  it('parses tab-delimited data', () => {
    const input = `2020-01\t500\n2020-02\t480\n2020-03\t460`;
    const result = parseProductionData(input);
    expect(result.records).toHaveLength(3);
    expect(result.rates).toEqual([500, 480, 460]);
  });

  it('parses US date format (MM/DD/YYYY)', () => {
    const input = `01/01/2020,1000\n02/01/2020,950`;
    const result = parseProductionData(input);
    expect(result.records).toHaveLength(2);
    expect(result.time).toEqual([0, 1]);
  });

  it('skips invalid lines gracefully', () => {
    const input = `Date,Rate\n2020-01,100\nbadline\n2020-02,90\n2020-03,-5`;
    const result = parseProductionData(input);
    expect(result.records).toHaveLength(2);
  });

  it('throws on empty/invalid input', () => {
    expect(() => parseProductionData('')).toThrow('No valid production records');
    expect(() => parseProductionData('garbage data')).toThrow();
  });

  it('sorts records by date', () => {
    const input = `2020-03,900\n2020-01,1000\n2020-02,950`;
    const result = parseProductionData(input);
    expect(result.rates).toEqual([1000, 950, 900]);
  });
});
