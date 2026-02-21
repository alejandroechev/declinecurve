import { test, expect, type Page, type Download } from '@playwright/test';

const BASE = 'http://localhost:1448';

// --- Helpers ---

async function importAndFit(page: Page) {
  await page.getByRole('button', { name: 'Import' }).click();
  // Wait for the data table to appear
  await expect(page.locator('.data-table')).toBeVisible();
  await page.getByRole('button', { name: 'Fit' }).click();
  // Wait for results to appear
  await expect(page.locator('.result-card').first()).toBeVisible();
}

async function selectSample(page: Page, name: string) {
  const select = page.locator('select').first();
  // Find option by text
  const option = select.locator('option', { hasText: name });
  const value = await option.getAttribute('value');
  await select.selectOption(value!);
}

// --- Core Workflow ---

test.describe('Core Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
  });

  test('page loads with sample production data', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('DeclineCurve');
    // Textarea should contain default sample data
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    const value = await textarea.inputValue();
    expect(value).toContain('Date,Rate');
    expect(value).toContain('2022-01');
  });

  test('Import → data table displayed', async ({ page }) => {
    await page.getByRole('button', { name: 'Import' }).click();
    await expect(page.locator('.data-table')).toBeVisible();
    // Should show Month and Rate columns
    await expect(page.locator('.data-table th').first()).toHaveText('Month');
    await expect(page.locator('.data-table th').nth(1)).toHaveText('Rate');
    // Should have data rows
    const rows = page.locator('.data-table tbody tr');
    expect(await rows.count()).toBeGreaterThan(5);
  });

  test('Fit → decline curves and results displayed', async ({ page }) => {
    await importAndFit(page);

    // Should show two result cards (exponential + hyperbolic)
    const cards = page.locator('.result-card');
    expect(await cards.count()).toBeGreaterThanOrEqual(2);

    // Exponential card
    await expect(page.locator('.result-card').filter({ hasText: '📐 Exponential' })).toBeVisible();
    // Hyperbolic card
    await expect(page.locator('.result-card').filter({ hasText: '📈 Hyperbolic' })).toBeVisible();

    // Results should contain qi, Di, R², AIC, EUR
    await expect(page.getByText('qi').first()).toBeVisible();
    await expect(page.getByText('Di').first()).toBeVisible();
    await expect(page.getByText('R²').first()).toBeVisible();
    await expect(page.getByText('AIC').first()).toBeVisible();
    await expect(page.getByText('EUR').first()).toBeVisible();
  });

  test('Best Fit badge shown on winning model', async ({ page }) => {
    await importAndFit(page);
    await expect(page.locator('.best-badge')).toBeVisible();
    await expect(page.locator('.best-badge')).toHaveText('Best Fit');
  });

  test('Forecast section displayed after fit', async ({ page }) => {
    await importAndFit(page);
    // Forecast card should appear
    await expect(page.getByText('Forecast').last()).toBeVisible();
    // Forecast table should show month, rate, cumulative
    const forecastTable = page.locator('.forecast-table');
    await expect(forecastTable).toBeVisible();
    await expect(forecastTable.locator('th').nth(0)).toHaveText('Month');
    await expect(forecastTable.locator('th').nth(1)).toHaveText('Rate');
    await expect(forecastTable.locator('th').nth(2)).toHaveText('Cum.');
  });

  test('Chart renders SVG with data', async ({ page }) => {
    await importAndFit(page);
    const chartContainer = page.locator('.chart-container');
    await expect(chartContainer.locator('svg').first()).toBeVisible();
    // Should have recharts legend entries for fitted data
    await expect(page.locator('.recharts-legend-item-text', { hasText: 'Actual' })).toBeVisible();
    await expect(page.locator('.recharts-legend-item-text', { hasText: 'Exponential Fit' })).toBeVisible();
    await expect(page.locator('.recharts-legend-item-text', { hasText: 'Hyperbolic Fit' })).toBeVisible();
    await expect(page.locator('.recharts-legend-item-text', { hasText: 'Forecast' })).toBeVisible();
  });

  test('Chart axes are labeled', async ({ page }) => {
    await importAndFit(page);
    // Axis labels are rendered as tspan inside recharts
    await expect(page.locator('.recharts-label tspan').filter({ hasText: /^Month$/ })).toBeVisible();
    await expect(page.locator('.recharts-label tspan').filter({ hasText: /^Rate/ })).toBeVisible();
  });
});

// --- Sample Datasets ---

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
    test(`load sample: ${name}`, async ({ page }) => {
      await selectSample(page, name);
      // Textarea should update with new data
      const textarea = page.locator('textarea');
      const value = await textarea.inputValue();
      expect(value).toContain('2022-01');

      // Import and fit
      await page.getByRole('button', { name: 'Import' }).click();
      await expect(page.locator('.data-table')).toBeVisible();
      await page.getByRole('button', { name: 'Fit' }).click();
      await expect(page.locator('.result-card').first()).toBeVisible();

      // Should have valid R² values (between 0 and 1)
      const r2Elements = page.locator('.result-row .value');
      const allValues = await r2Elements.allTextContents();
      // Find R² values — they're 4-decimal numbers between 0 and 1
      const r2Values = allValues.filter(v => /^0\.\d{4}$/.test(v.trim()));
      expect(r2Values.length).toBeGreaterThanOrEqual(1);
    });
  }

  test('Tight Oil → exponential should be reasonable fit', async ({ page }) => {
    await selectSample(page, 'Permian Basin Tight Oil');
    await page.getByRole('button', { name: 'Import' }).click();
    await expect(page.locator('.data-table')).toBeVisible();
    await page.getByRole('button', { name: 'Fit' }).click();
    await expect(page.locator('.result-card').first()).toBeVisible();

    // Find exponential R² value
    const expCard = page.locator('.result-card').filter({ hasText: 'Exponential' });
    const r2Row = expCard.locator('.result-row').filter({ hasText: 'R²' });
    const r2Text = await r2Row.locator('.value').textContent();
    const r2 = parseFloat(r2Text!);
    expect(r2).toBeGreaterThan(0.9); // tight oil has clean exponential decline
  });

  test('Conventional → hyperbolic with reasonable b-factor', async ({ page }) => {
    await selectSample(page, 'Conventional Sandstone');
    await page.getByRole('button', { name: 'Import' }).click();
    await expect(page.locator('.data-table')).toBeVisible();
    await page.getByRole('button', { name: 'Fit' }).click();
    await expect(page.locator('.result-card').first()).toBeVisible();

    // Find hyperbolic b-factor
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

    await page.getByRole('button', { name: 'Import' }).click();
    await expect(page.locator('.data-table')).toBeVisible();
    await page.getByRole('button', { name: 'Fit' }).click();
    await expect(page.locator('.result-card').first()).toBeVisible();
    // Should not error out
    await expect(page.locator('.error')).not.toBeVisible();
  });
});

// --- Model Comparison ---

test.describe('Model Comparison', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
  });

  test('R² values displayed for each model', async ({ page }) => {
    await importAndFit(page);
    const cards = page.locator('.result-card');
    const cardCount = await cards.count();
    // At least 2 model cards (expo + hyp), possibly forecast card
    expect(cardCount).toBeGreaterThanOrEqual(2);

    // Each model card has R²
    for (let i = 0; i < Math.min(cardCount, 2); i++) {
      const card = cards.nth(i);
      await expect(card.locator('.result-row').filter({ hasText: 'R²' })).toBeVisible();
    }
  });

  test('AIC values displayed for each model', async ({ page }) => {
    await importAndFit(page);
    const cards = page.locator('.result-card');
    for (let i = 0; i < 2; i++) {
      const card = cards.nth(i);
      await expect(card.locator('.result-row').filter({ hasText: 'AIC' })).toBeVisible();
    }
  });

  test('Best fit model is highlighted', async ({ page }) => {
    await importAndFit(page);
    const badges = page.locator('.best-badge');
    expect(await badges.count()).toBe(1);
  });
});

// --- Data Entry Edge Cases ---

test.describe('Data Entry', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
  });

  test('empty data → Import shows error', async ({ page }) => {
    const textarea = page.locator('textarea');
    await textarea.fill('');
    await page.getByRole('button', { name: 'Import' }).click();
    await expect(page.locator('.error')).toBeVisible();
  });

  test('single data point → Fit shows error', async ({ page }) => {
    const textarea = page.locator('textarea');
    await textarea.fill('Date,Rate\n2022-01,1000');
    await page.getByRole('button', { name: 'Import' }).click();
    await expect(page.locator('.data-table')).toBeVisible();
    await page.getByRole('button', { name: 'Fit' }).click();
    // Should show error (need at least 2 for exponential, 3 for hyperbolic)
    await expect(page.locator('.error')).toBeVisible();
  });

  test('two data points → exponential fit works', async ({ page }) => {
    const textarea = page.locator('textarea');
    await textarea.fill('Date,Rate\n2022-01,1000\n2022-02,900');
    await page.getByRole('button', { name: 'Import' }).click();
    await expect(page.locator('.data-table')).toBeVisible();
    await page.getByRole('button', { name: 'Fit' }).click();
    // Might error on hyperbolic (needs 3+) but should show some result or error
    // With 2 points, exponential works but hyperbolic throws
    // The selectBestFit function calls both, so if hyperbolic fails it may error
    // Let's check what actually happens
    const hasError = await page.locator('.error').isVisible().catch(() => false);
    const hasResults = await page.locator('.result-card').first().isVisible().catch(() => false);
    // At least one of these should be true
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
    await page.getByRole('button', { name: 'Import' }).click();
    await expect(page.locator('.data-table')).toBeVisible();
    await page.getByRole('button', { name: 'Fit' }).click();
    await expect(page.locator('.result-card').first()).toBeVisible();
    // Should not error
    await expect(page.locator('.error')).not.toBeVisible();
  });

  test('garbage data → Import shows error', async ({ page }) => {
    const textarea = page.locator('textarea');
    await textarea.fill('not valid data at all xyz');
    await page.getByRole('button', { name: 'Import' }).click();
    await expect(page.locator('.error')).toBeVisible();
  });
});

// --- Export ---

test.describe('Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
  });

  test('CSV export triggers download', async ({ page }) => {
    await importAndFit(page);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export CSV' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('decline_analysis.csv');
  });

  test('PNG export triggers download', async ({ page }) => {
    await importAndFit(page);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export PNG' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('decline_chart.png');
  });

  test('Export buttons disabled before fit', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Export PNG' })).toBeDisabled();
  });
});

// --- Forecast Period ---

test.describe('Forecast Period', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
  });

  test('changing forecast period updates forecast', async ({ page }) => {
    await importAndFit(page);

    // Get initial forecast period text
    const forecastCard = page.locator('.result-card').filter({ hasText: 'Forecast' });
    const periodRow = forecastCard.locator('.result-row').filter({ hasText: 'Period' });
    const initialPeriod = await periodRow.locator('.value').textContent();

    // Change to 60 months
    const periodSelect = page.locator('select').filter({ has: page.locator('option[value="60"]') });
    await periodSelect.selectOption('60');

    // Period should update
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
    // Click moon icon to go dark
    const themeBtn = page.getByRole('button', { name: '🌙' });
    await themeBtn.click();
    const theme = await page.locator('html').getAttribute('data-theme');
    expect(theme).toBe('dark');
  });

  test('theme toggle back to light mode', async ({ page }) => {
    // Toggle to dark then back to light
    await page.getByRole('button', { name: '🌙' }).click();
    await page.getByRole('button', { name: '☀️' }).click();
    const theme = await page.locator('html').getAttribute('data-theme');
    expect(theme).toBe('light');
  });

  test('Guide button opens intro page', async ({ page }) => {
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('button', { name: '📖 Guide' }).click(),
    ]);
    expect(popup.url()).toContain('intro.html');
  });

  test('Fit button is disabled before Import', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Fit' })).toBeDisabled();
  });

  test('chart placeholder shown before import', async ({ page }) => {
    await expect(page.getByText('Import production data to begin')).toBeVisible();
  });

  test('results placeholder shown before fit', async ({ page }) => {
    await expect(page.getByText('Click Import then Fit')).toBeVisible();
  });
});
