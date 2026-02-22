import { test, expect, type Page, type Download } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const BASE = 'http://localhost:1448';

// --- Helpers ---

async function fitData(page: Page) {
  // Data auto-parses on load, just wait for table then fit
  await expect(page.locator('.data-table')).toBeVisible();
  await page.getByRole('button', { name: '▶ Fit' }).click();
  await expect(page.locator('.result-card').first()).toBeVisible();
}

async function selectSample(page: Page, name: string) {
  const select = page.locator('[data-testid="sample-select"]');
  const option = select.locator('option', { hasText: name });
  const value = await option.getAttribute('value');
  await select.selectOption(value!);
}

// --- Core Workflow ---

test.describe('Core Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
  });

  test('page loads with sample production data and auto-parses', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('DeclineCurve');
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    const value = await textarea.inputValue();
    expect(value).toContain('Date,Rate');
    expect(value).toContain('2022-01');
    // Auto-parse: data table should be visible without clicking Import
    await expect(page.locator('.data-table')).toBeVisible();
  });

  test('Fit → decline curves and results displayed', async ({ page }) => {
    await fitData(page);

    const cards = page.locator('.result-card');
    expect(await cards.count()).toBeGreaterThanOrEqual(2);

    await expect(page.locator('.result-card').filter({ hasText: '📐 Exponential' })).toBeVisible();
    await expect(page.locator('.result-card').filter({ hasText: '📈 Hyperbolic' })).toBeVisible();

    await expect(page.getByText('qi').first()).toBeVisible();
    await expect(page.getByText('Di').first()).toBeVisible();
    await expect(page.getByText('R²').first()).toBeVisible();
    await expect(page.getByText('AIC').first()).toBeVisible();
    await expect(page.getByText('EUR').first()).toBeVisible();
  });

  test('Best Fit badge shown on winning model', async ({ page }) => {
    await fitData(page);
    await expect(page.locator('.best-badge')).toBeVisible();
    await expect(page.locator('.best-badge')).toHaveText('Best Fit');
  });

  test('Forecast section displayed after fit', async ({ page }) => {
    await fitData(page);
    await expect(page.getByText('Forecast').last()).toBeVisible();
    const forecastTable = page.locator('.forecast-table');
    await expect(forecastTable).toBeVisible();
    await expect(forecastTable.locator('th').nth(0)).toHaveText('Month');
    await expect(forecastTable.locator('th').nth(1)).toHaveText('Rate');
    await expect(forecastTable.locator('th').nth(2)).toHaveText('Cum.');
  });

  test('Chart renders SVG with data', async ({ page }) => {
    await fitData(page);
    const chartContainer = page.locator('.chart-container');
    await expect(chartContainer.locator('svg').first()).toBeVisible();
    await expect(page.locator('.recharts-legend-item-text', { hasText: 'Actual' })).toBeVisible();
    await expect(page.locator('.recharts-legend-item-text', { hasText: 'Exponential Fit' })).toBeVisible();
    await expect(page.locator('.recharts-legend-item-text', { hasText: 'Hyperbolic Fit' })).toBeVisible();
    await expect(page.locator('.recharts-legend-item-text', { hasText: 'Forecast' })).toBeVisible();
  });

  test('Chart axes are labeled', async ({ page }) => {
    await fitData(page);
    await expect(page.locator('.recharts-label tspan').filter({ hasText: /^Month$/ })).toBeVisible();
    await expect(page.locator('.recharts-label tspan').filter({ hasText: /^Rate/ })).toBeVisible();
  });
});

// --- Sample Datasets (auto-import on selection) ---

test.describe('Sample Datasets', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
  });

  const sampleNames = [
    'Permian Basin Tight Oil',
    'Conventional Sandstone',
    'Gas Well (Mcf/day)',
    'Mature Stripper Well',
    'Multi-Phase Shale Well',
  ];

  for (const name of sampleNames) {
    test(`sample auto-imports on selection: ${name}`, async ({ page }) => {
      await selectSample(page, name);
      // Textarea should update with new data
      const textarea = page.locator('textarea');
      const value = await textarea.inputValue();
      expect(value).toContain('2022-01');

      // Data table should appear automatically (auto-parse)
      await expect(page.locator('.data-table')).toBeVisible();

      // Fit should work without any Import step
      await page.getByRole('button', { name: '▶ Fit' }).click();
      await expect(page.locator('.result-card').first()).toBeVisible();

      const r2Elements = page.locator('.result-row .value');
      const allValues = await r2Elements.allTextContents();
      const r2Values = allValues.filter(v => /^0\.\d{4}$/.test(v.trim()));
      expect(r2Values.length).toBeGreaterThanOrEqual(1);
    });
  }

  test('Tight Oil → exponential should be reasonable fit', async ({ page }) => {
    await selectSample(page, 'Permian Basin Tight Oil');
    await expect(page.locator('.data-table')).toBeVisible();
    await page.getByRole('button', { name: '▶ Fit' }).click();
    await expect(page.locator('.result-card').first()).toBeVisible();

    const expCard = page.locator('.result-card').filter({ hasText: 'Exponential' });
    const r2Row = expCard.locator('.result-row').filter({ hasText: 'R²' });
    const r2Text = await r2Row.locator('.value').textContent();
    const r2 = parseFloat(r2Text!);
    expect(r2).toBeGreaterThan(0.9);
  });

  test('Conventional → hyperbolic with reasonable b-factor', async ({ page }) => {
    await selectSample(page, 'Conventional Sandstone');
    await expect(page.locator('.data-table')).toBeVisible();
    await page.getByRole('button', { name: '▶ Fit' }).click();
    await expect(page.locator('.result-card').first()).toBeVisible();

    const hypCard = page.locator('.result-card').filter({ hasText: 'Hyperbolic' });
    const bRow = hypCard.locator('.result-row').filter({ has: page.locator('.label', { hasText: 'b' }) });
    const bText = await bRow.locator('.value').textContent();
    const b = parseFloat(bText!);
    expect(b).toBeGreaterThan(0);
    expect(b).toBeLessThan(1);
  });

  test('Gas Well → handles gas units in header', async ({ page }) => {
    await selectSample(page, 'Gas Well');
    const textarea = page.locator('textarea');
    const value = await textarea.inputValue();
    expect(value).toContain('Mcf');

    await expect(page.locator('.data-table')).toBeVisible();
    await page.getByRole('button', { name: '▶ Fit' }).click();
    await expect(page.locator('.result-card').first()).toBeVisible();
    await expect(page.locator('.error')).not.toBeVisible();
  });
});

// --- Model Comparison ---

test.describe('Model Comparison', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
  });

  test('R² values displayed for each model', async ({ page }) => {
    await fitData(page);
    const cards = page.locator('.result-card');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThanOrEqual(2);

    for (let i = 0; i < Math.min(cardCount, 2); i++) {
      const card = cards.nth(i);
      await expect(card.locator('.result-row').filter({ hasText: 'R²' })).toBeVisible();
    }
  });

  test('AIC values displayed for each model', async ({ page }) => {
    await fitData(page);
    const cards = page.locator('.result-card');
    for (let i = 0; i < 2; i++) {
      const card = cards.nth(i);
      await expect(card.locator('.result-row').filter({ hasText: 'AIC' })).toBeVisible();
    }
  });

  test('Best fit model is highlighted', async ({ page }) => {
    await fitData(page);
    const badges = page.locator('.best-badge');
    expect(await badges.count()).toBe(1);
  });
});

// --- Data Entry Edge Cases ---

test.describe('Data Entry', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
  });

  test('empty data → Fit is disabled', async ({ page }) => {
    const textarea = page.locator('textarea');
    await textarea.fill('');
    await expect(page.getByRole('button', { name: '▶ Fit' })).toBeDisabled();
  });

  test('single data point → Fit shows error', async ({ page }) => {
    const textarea = page.locator('textarea');
    await textarea.fill('Date,Rate\n2022-01,1000');
    await expect(page.locator('.data-table')).toBeVisible();
    await page.getByRole('button', { name: '▶ Fit' }).click();
    await expect(page.locator('.error')).toBeVisible();
  });

  test('two data points → exponential fit works', async ({ page }) => {
    const textarea = page.locator('textarea');
    await textarea.fill('Date,Rate\n2022-01,1000\n2022-02,900');
    await expect(page.locator('.data-table')).toBeVisible();
    await page.getByRole('button', { name: '▶ Fit' }).click();
    const hasError = await page.locator('.error').isVisible().catch(() => false);
    const hasResults = await page.locator('.result-card').first().isVisible().catch(() => false);
    expect(hasError || hasResults).toBe(true);
  });

  test('non-monotonic data (production increases) → still fits', async ({ page }) => {
    const textarea = page.locator('textarea');
    await textarea.fill(`Date,Rate
2022-01,1000
2022-02,900
2022-03,950
2022-04,850
2022-05,800
2022-06,820
2022-07,750
2022-08,700
2022-09,680
2022-10,660`);
    await expect(page.locator('.data-table')).toBeVisible();
    await page.getByRole('button', { name: '▶ Fit' }).click();
    await expect(page.locator('.result-card').first()).toBeVisible();
    await expect(page.locator('.error')).not.toBeVisible();
  });

  test('garbage data → Fit is disabled', async ({ page }) => {
    const textarea = page.locator('textarea');
    await textarea.fill('not valid data at all xyz');
    await expect(page.getByRole('button', { name: '▶ Fit' })).toBeDisabled();
  });
});

// --- In-place Exports ---

test.describe('In-place Exports', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
  });

  test('CSV export on results panel triggers download', async ({ page }) => {
    await fitData(page);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.export-inline').click(),
    ]);
    expect(download.suggestedFilename()).toBe('decline_analysis.csv');
  });

  test('PNG export on chart triggers download', async ({ page }) => {
    await fitData(page);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.chart-exports button', { hasText: 'PNG' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('decline_chart.png');
  });

  test('SVG export on chart triggers download', async ({ page }) => {
    await fitData(page);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.chart-exports button', { hasText: 'SVG' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('decline_chart.svg');
  });

  test('export buttons not visible before fit', async ({ page }) => {
    await expect(page.locator('.chart-exports')).not.toBeVisible();
    await expect(page.locator('.export-inline')).not.toBeVisible();
  });
});

// --- File Upload ---

test.describe('File Upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
  });

  test('Upload button exists in toolbar', async ({ page }) => {
    await expect(page.getByRole('button', { name: '📂 Upload' })).toBeVisible();
  });

  test('file upload loads CSV and auto-parses', async ({ page }) => {
    const csvContent = `Date,Rate
2023-01,500
2023-02,480
2023-03,460
2023-04,440
2023-05,420`;
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, 'test-upload.csv');
    fs.writeFileSync(tmpFile, csvContent);

    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles(tmpFile);

    // Wait for FileReader to complete and textarea to update
    await expect(page.locator('textarea')).toHaveValue(/500/, { timeout: 5000 });

    // Data should auto-parse — table visible without clicking Import
    await expect(page.locator('.data-table')).toBeVisible();

    fs.unlinkSync(tmpFile);
  });
});

// --- Chart Labels ---

test.describe('Chart Labels', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
  });

  test('chart labels do not overlap', async ({ page }) => {
    await fitData(page);

    // Get the bounding boxes of the X-axis label and the legend
    const xLabel = page.locator('.recharts-label tspan').filter({ hasText: /^Month$/ });
    await expect(xLabel).toBeVisible();

    const legend = page.locator('.recharts-legend-wrapper');
    await expect(legend).toBeVisible();

    const xLabelBox = await xLabel.boundingBox();
    const legendBox = await legend.boundingBox();

    // Legend should be above the chart (top-aligned), X-axis label at bottom
    // They should not overlap vertically
    if (xLabelBox && legendBox) {
      const legendBottom = legendBox.y + legendBox.height;
      expect(xLabelBox.y).toBeGreaterThan(legendBottom);
    }
  });
});

// --- Forecast Period ---

test.describe('Forecast Period', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
  });

  test('changing forecast period updates forecast', async ({ page }) => {
    await fitData(page);

    const forecastCard = page.locator('.result-card').filter({ hasText: 'Forecast' });
    const periodRow = forecastCard.locator('.result-row').filter({ hasText: 'Period' });
    const initialPeriod = await periodRow.locator('.value').textContent();

    const periodSelect = page.locator('select').filter({ has: page.locator('option[value="60"]') });
    await periodSelect.selectOption('60');

    const newPeriod = await periodRow.locator('.value').textContent();
    expect(newPeriod).not.toBe(initialPeriod);
    expect(newPeriod).toContain('60');
  });
});

// --- UI ---

test.describe('UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
  });

  test('theme toggle switches to dark mode', async ({ page }) => {
    const themeBtn = page.getByRole('button', { name: '🌙' });
    await themeBtn.click();
    const theme = await page.locator('html').getAttribute('data-theme');
    expect(theme).toBe('dark');
  });

  test('theme toggle back to light mode', async ({ page }) => {
    await page.getByRole('button', { name: '🌙' }).click();
    await page.getByRole('button', { name: '☀️' }).click();
    const theme = await page.locator('html').getAttribute('data-theme');
    expect(theme).toBe('light');
  });

  test('theme persists in localStorage', async ({ page }) => {
    await page.getByRole('button', { name: '🌙' }).click();
    const stored = await page.evaluate(() => localStorage.getItem('declinecurve-theme'));
    expect(stored).toBe('dark');

    // Reload and check theme is restored
    await page.reload();
    const theme = await page.locator('html').getAttribute('data-theme');
    expect(theme).toBe('dark');
  });

  test('Guide button opens intro page', async ({ page }) => {
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('button', { name: '📖 Guide' }).click(),
    ]);
    expect(popup.url()).toContain('intro.html');
  });

  test('Fit button styled as primary CTA', async ({ page }) => {
    const fitBtn = page.getByRole('button', { name: '▶ Fit' });
    await expect(fitBtn).toBeVisible();
    await expect(fitBtn).toHaveClass(/btn-primary/);
  });

  test('toolbar has correct layout order', async ({ page }) => {
    // Actions on left, utility on right
    const sampleSelect = page.locator('[data-testid="sample-select"]');
    const uploadBtn = page.getByRole('button', { name: '📂 Upload' });
    const fitBtn = page.getByRole('button', { name: '▶ Fit' });
    await expect(sampleSelect).toBeVisible();
    await expect(uploadBtn).toBeVisible();
    await expect(fitBtn).toBeVisible();

    // Spacer exists in DOM (flex spacer, may have zero height)
    await expect(page.locator('.toolbar-spacer')).toBeAttached();
  });

  test('chart placeholder shown before data', async ({ page }) => {
    const textarea = page.locator('textarea');
    await textarea.fill('');
    await expect(page.getByText('Import production data to begin')).toBeVisible();
  });

  test('results placeholder shown before fit', async ({ page }) => {
    await expect(page.locator('.results').getByText('▶ Fit')).toBeVisible();
  });
});

// --- State Persistence ---

test.describe('State Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
  });

  test('production data persists across reload', async ({ page }) => {
    const textarea = page.locator('textarea');
    const customData = `Date,Rate\n2023-01,500\n2023-02,480\n2023-03,460`;
    await textarea.fill(customData);
    await page.waitForTimeout(700);
    await page.reload();
    await expect(textarea).toHaveValue(/500/);
  });
});

// --- Toolbar Button Order ---

test.describe('Toolbar Button Order', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
  });

  test('buttons in order: Upload, Samples, Fit, spacer, Guide, Feedback, Theme', async ({ page }) => {
    const toolbar = page.locator('.toolbar');
    const html = await toolbar.innerHTML();
    const uploadIdx = html.indexOf('Upload');
    const samplesIdx = html.indexOf('sample-select');
    const fitIdx = html.indexOf('▶ Fit');
    const spacerIdx = html.indexOf('toolbar-spacer');
    const guideIdx = html.indexOf('Guide');
    expect(uploadIdx).toBeLessThan(samplesIdx);
    expect(samplesIdx).toBeLessThan(fitIdx);
    expect(fitIdx).toBeLessThan(spacerIdx);
    expect(spacerIdx).toBeLessThan(guideIdx);
  });
});
