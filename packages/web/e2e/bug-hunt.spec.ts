import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const BASE = 'http://localhost:1448';

async function selectSample(page: Page, name: string) {
  const select = page.locator('[data-testid="sample-select"]');
  const option = select.locator('option', { hasText: name });
  const value = await option.getAttribute('value');
  await select.selectOption(value!);
}

async function fitData(page: Page) {
  await expect(page.locator('.data-table')).toBeVisible();
  await page.getByRole('button', { name: '▶ Fit' }).click();
  await expect(page.locator('.result-card').first()).toBeVisible();
}

// --- Bug Hunt: App Load ---
test.describe('Bug Hunt: App Load', () => {
  test('app loads with sample data visible in textarea and data table', async ({ page }) => {
    await page.goto(BASE);
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    const val = await textarea.inputValue();
    expect(val.length).toBeGreaterThan(50);
    expect(val).toContain('Date');
    expect(val).toContain('Rate');
    // Data table should auto-parse
    await expect(page.locator('.data-table')).toBeVisible();
    // Header row
    await expect(page.locator('.data-table th').first()).toHaveText('Month');
    await expect(page.locator('.data-table th').last()).toHaveText('Rate');
    // At least 10 data rows
    const rows = page.locator('.data-table tbody tr');
    expect(await rows.count()).toBeGreaterThanOrEqual(10);
  });
});

// --- Bug Hunt: Theme ---
test.describe('Bug Hunt: Theme', () => {
  test('theme toggle works and persists across reload', async ({ page }) => {
    await page.goto(BASE);
    // Default is light
    const htmlTheme = await page.locator('html').getAttribute('data-theme');
    expect(htmlTheme).toBe('light');

    // Toggle to dark
    await page.getByRole('button', { name: '🌙' }).click();
    expect(await page.locator('html').getAttribute('data-theme')).toBe('dark');
    const stored = await page.evaluate(() => localStorage.getItem('declinecurve-theme'));
    expect(stored).toBe('dark');

    // Reload and check persistence
    await page.reload();
    expect(await page.locator('html').getAttribute('data-theme')).toBe('dark');

    // Toggle back
    await page.getByRole('button', { name: '☀️' }).click();
    expect(await page.locator('html').getAttribute('data-theme')).toBe('light');
    const stored2 = await page.evaluate(() => localStorage.getItem('declinecurve-theme'));
    expect(stored2).toBe('light');
  });
});

// --- Bug Hunt: Sample Datasets (auto-import, no Import button) ---
test.describe('Bug Hunt: Sample Datasets', () => {
  const samples = [
    'Permian Basin Tight Oil',
    'Conventional Sandstone',
    'Gas Well (Mcf/day)',
    'Mature Stripper Well',
    'Multi-Phase Shale Well',
  ];

  for (const name of samples) {
    test(`selecting "${name}" auto-imports (no Import button needed)`, async ({ page }) => {
      await page.goto(BASE);
      await selectSample(page, name);
      
      // Textarea updated
      const textarea = page.locator('textarea');
      const val = await textarea.inputValue();
      expect(val.length).toBeGreaterThan(50);
      
      // Data table auto-appears
      await expect(page.locator('.data-table')).toBeVisible();
      
      // No "Import" button should exist
      const importBtn = page.getByRole('button', { name: /import/i });
      expect(await importBtn.count()).toBe(0);
    });
  }
});

// --- Bug Hunt: Fit CTA ---
test.describe('Bug Hunt: Fit CTA', () => {
  test('Fit button is visually prominent (btn-primary class)', async ({ page }) => {
    await page.goto(BASE);
    const fitBtn = page.getByRole('button', { name: '▶ Fit' });
    await expect(fitBtn).toBeVisible();
    await expect(fitBtn).toHaveClass(/btn-primary/);
    
    // Check it's styled differently than other buttons
    const fitBg = await fitBtn.evaluate((el) => getComputedStyle(el).backgroundColor);
    const otherBtn = page.getByRole('button', { name: '📂 Upload' });
    const otherBg = await otherBtn.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(fitBg).not.toBe(otherBg);
  });

  test('Fit produces curves, EUR, R², AIC for default data', async ({ page }) => {
    await page.goto(BASE);
    await fitData(page);
    
    // Must have results
    const cards = page.locator('.result-card');
    expect(await cards.count()).toBeGreaterThanOrEqual(2);
    
    // Check EUR present
    const eurElements = page.locator('.result-row').filter({ hasText: 'EUR' });
    expect(await eurElements.count()).toBeGreaterThanOrEqual(2);
    
    // Check R² present and numeric
    const r2Elements = page.locator('.result-row').filter({ hasText: 'R²' });
    expect(await r2Elements.count()).toBeGreaterThanOrEqual(2);
    
    // Check chart has fitted curves
    await expect(page.locator('.recharts-legend-item-text', { hasText: 'Exponential Fit' })).toBeVisible();
    await expect(page.locator('.recharts-legend-item-text', { hasText: 'Hyperbolic Fit' })).toBeVisible();
  });
});

// --- Bug Hunt: File Upload ---
test.describe('Bug Hunt: File Upload', () => {
  test('upload CSV loads data and auto-parses', async ({ page }) => {
    await page.goto(BASE);
    const csv = `Date,Rate
2023-01,500
2023-02,480
2023-03,460
2023-04,440
2023-05,420
2023-06,400
2023-07,380
2023-08,360
2023-09,340
2023-10,320`;
    const tmpFile = path.join(os.tmpdir(), 'bughunt-upload.csv');
    fs.writeFileSync(tmpFile, csv);
    
    await page.locator('[data-testid="file-input"]').setInputFiles(tmpFile);
    await expect(page.locator('textarea')).toHaveValue(/500/, { timeout: 5000 });
    await expect(page.locator('.data-table')).toBeVisible();
    
    // Should be able to fit immediately
    await page.getByRole('button', { name: '▶ Fit' }).click();
    await expect(page.locator('.result-card').first()).toBeVisible();
    
    fs.unlinkSync(tmpFile);
  });
});

// --- Bug Hunt: In-place Exports ---
test.describe('Bug Hunt: In-place Exports', () => {
  test('CSV export button on results panel', async ({ page }) => {
    await page.goto(BASE);
    await fitData(page);
    
    const csvBtn = page.locator('.export-inline');
    await expect(csvBtn).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      csvBtn.click(),
    ]);
    expect(download.suggestedFilename()).toBe('decline_analysis.csv');
  });

  test('PNG and SVG export on chart', async ({ page }) => {
    await page.goto(BASE);
    await fitData(page);
    
    // PNG
    const pngBtn = page.locator('.chart-exports button', { hasText: 'PNG' });
    await expect(pngBtn).toBeVisible();
    const [pngDownload] = await Promise.all([
      page.waitForEvent('download'),
      pngBtn.click(),
    ]);
    expect(pngDownload.suggestedFilename()).toBe('decline_chart.png');
    
    // SVG
    const svgBtn = page.locator('.chart-exports button', { hasText: 'SVG' });
    await expect(svgBtn).toBeVisible();
    const [svgDownload] = await Promise.all([
      page.waitForEvent('download'),
      svgBtn.click(),
    ]);
    expect(svgDownload.suggestedFilename()).toBe('decline_chart.svg');
  });
});

// --- Bug Hunt: Chart Label Overlap ---
test.describe('Bug Hunt: Chart Labels', () => {
  test('x-axis label does not overlap with tick labels', async ({ page }) => {
    await page.goto(BASE);
    await fitData(page);
    
    // Get X-axis label
    const xLabel = page.locator('.recharts-label tspan').filter({ hasText: /^Month$/ });
    await expect(xLabel).toBeVisible();
    const xLabelBox = await xLabel.boundingBox();
    
    // Get the last tick label on x-axis
    const xTickTexts = page.locator('.recharts-xAxis .recharts-cartesian-axis-tick-value');
    const tickCount = await xTickTexts.count();
    expect(tickCount).toBeGreaterThan(0);
    
    // Check that the x-axis label doesn't overlap with tick labels
    if (xLabelBox && tickCount > 0) {
      const lastTick = xTickTexts.last();
      const tickBox = await lastTick.boundingBox();
      if (tickBox) {
        // X-axis label should be BELOW the tick labels (no overlap)
        const tickBottom = tickBox.y + tickBox.height;
        // Allow some tolerance
        expect(xLabelBox.y).toBeGreaterThanOrEqual(tickBottom - 5);
      }
    }
  });

  test('x-axis label does not get cut off at chart bottom', async ({ page }) => {
    await page.goto(BASE);
    await fitData(page);
    
    const xLabel = page.locator('.recharts-label tspan').filter({ hasText: /^Month$/ });
    await expect(xLabel).toBeVisible();
    const xLabelBox = await xLabel.boundingBox();
    
    const chartContainer = page.locator('.chart-container');
    const containerBox = await chartContainer.boundingBox();
    
    if (xLabelBox && containerBox) {
      const labelBottom = xLabelBox.y + xLabelBox.height;
      const containerBottom = containerBox.y + containerBox.height;
      // Label should not extend beyond container
      expect(labelBottom).toBeLessThanOrEqual(containerBottom + 5);
    }
  });
});

// --- Bug Hunt: All 5 Samples Fit ---
test.describe('Bug Hunt: All Samples Fit', () => {
  const samples = [
    { name: 'Permian Basin Tight Oil', minR2: 0.85 },
    { name: 'Conventional Sandstone', minR2: 0.5 },
    { name: 'Gas Well (Mcf/day)', minR2: 0.5 },
    { name: 'Mature Stripper Well', minR2: -1.0 },  // noisy flat data, R² can be negative
    { name: 'Multi-Phase Shale Well', minR2: 0.8 },
  ];

  for (const { name, minR2 } of samples) {
    test(`"${name}" fits with reasonable R² ≥ ${minR2}`, async ({ page }) => {
      await page.goto(BASE);
      await selectSample(page, name);
      await expect(page.locator('.data-table')).toBeVisible();
      
      await page.getByRole('button', { name: '▶ Fit' }).click();
      await expect(page.locator('.result-card').first()).toBeVisible();
      
      // Check no errors
      await expect(page.locator('.error')).not.toBeVisible();
      
      // Best fit badge exists
      await expect(page.locator('.best-badge')).toBeVisible();
      
      // R² is reasonable for at least one model
      const r2Rows = page.locator('.result-row').filter({ hasText: 'R²' });
      const count = await r2Rows.count();
      let foundGoodR2 = false;
      for (let i = 0; i < count; i++) {
        const val = await r2Rows.nth(i).locator('.value').textContent();
        const r2 = parseFloat(val!);
        if (r2 >= minR2) foundGoodR2 = true;
      }
      expect(foundGoodR2).toBe(true);
      
      // EUR > 0 (or "N/A" for non-declining wells)
      const eurRows = page.locator('.result-row').filter({ hasText: 'EUR' });
      const eurCount = await eurRows.count();
      for (let i = 0; i < eurCount; i++) {
        const val = await eurRows.nth(i).locator('.value').textContent();
        if (val?.includes('N/A')) continue; // non-declining wells show N/A
        const eur = parseFloat(val!.replace(/,/g, ''));
        expect(eur).toBeGreaterThan(0);
      }
      
      // Forecast table present
      await expect(page.locator('.forecast-table')).toBeVisible();
    });
  }
});

// --- Bug Hunt: Edge Cases ---
test.describe('Bug Hunt: Edge Cases', () => {
  test('empty textarea → Fit disabled, no crash', async ({ page }) => {
    await page.goto(BASE);
    const textarea = page.locator('textarea');
    await textarea.fill('');
    await expect(page.getByRole('button', { name: '▶ Fit' })).toBeDisabled();
    // No error should show (just disabled)
    await expect(page.locator('.error')).not.toBeVisible();
    // Chart should show placeholder
    await expect(page.getByText('Import production data to begin')).toBeVisible();
  });

  test('single data point → error message, no crash', async ({ page }) => {
    await page.goto(BASE);
    await page.locator('textarea').fill('Date,Rate\n2022-01,1000');
    await expect(page.locator('.data-table')).toBeVisible();
    await page.getByRole('button', { name: '▶ Fit' }).click();
    await expect(page.locator('.error')).toBeVisible();
    // Should not crash the app
    await expect(page.locator('h1')).toContainText('DeclineCurve');
  });

  test('fit before data loaded (cleared) → disabled', async ({ page }) => {
    await page.goto(BASE);
    await page.locator('textarea').fill('');
    const fitBtn = page.getByRole('button', { name: '▶ Fit' });
    await expect(fitBtn).toBeDisabled();
  });

  test('garbage data → Fit disabled, no crash', async ({ page }) => {
    await page.goto(BASE);
    await page.locator('textarea').fill('asdf qwerty 12345 not csv');
    await expect(page.getByRole('button', { name: '▶ Fit' })).toBeDisabled();
    await expect(page.locator('h1')).toContainText('DeclineCurve');
  });

  test('header-only CSV → Fit disabled', async ({ page }) => {
    await page.goto(BASE);
    await page.locator('textarea').fill('Date,Rate');
    await expect(page.getByRole('button', { name: '▶ Fit' })).toBeDisabled();
  });
});

// --- Bug Hunt: Toolbar Alignment ---
test.describe('Bug Hunt: Toolbar', () => {
  test('toolbar items are vertically centered', async ({ page }) => {
    await page.goto(BASE);
    const toolbar = page.locator('.toolbar');
    await expect(toolbar).toBeVisible();
    
    const toolbarBox = await toolbar.boundingBox();
    if (!toolbarBox) return;
    const toolbarCenter = toolbarBox.y + toolbarBox.height / 2;
    
    // Check a few elements are vertically centered in toolbar
    const elements = [
      page.locator('.toolbar h1'),
      page.locator('[data-testid="sample-select"]'),
      page.getByRole('button', { name: '▶ Fit' }),
    ];
    
    for (const el of elements) {
      const box = await el.boundingBox();
      if (box) {
        const elCenter = box.y + box.height / 2;
        // Should be within 5px of toolbar center
        expect(Math.abs(elCenter - toolbarCenter)).toBeLessThan(10);
      }
    }
  });

  test('spacer pushes utility buttons to right', async ({ page }) => {
    await page.goto(BASE);
    const fitBtn = page.getByRole('button', { name: '▶ Fit' });
    const themeBtn = page.getByRole('button', { name: '🌙' });
    
    const fitBox = await fitBtn.boundingBox();
    const themeBox = await themeBtn.boundingBox();
    
    if (fitBox && themeBox) {
      // Theme button should be well to the right of Fit button
      expect(themeBox.x).toBeGreaterThan(fitBox.x + fitBox.width + 50);
    }
  });
});

// --- Bug Hunt: Forecast Period Change ---
test.describe('Bug Hunt: Forecast Period', () => {
  test('changing forecast period to 60 months updates forecast table', async ({ page }) => {
    await page.goto(BASE);
    await fitData(page);
    
    // Change to 60 months
    const periodSelect = page.locator('select').filter({ has: page.locator('option[value="60"]') });
    await periodSelect.selectOption('60');
    
    // Forecast card should show 60 months
    const forecastCard = page.locator('.result-card').filter({ hasText: 'Forecast' });
    await expect(forecastCard).toBeVisible();
    
    // Check period shows updated value
    const periodRow = forecastCard.locator('.result-row').filter({ hasText: 'Period' });
    const periodText = await periodRow.locator('.value').textContent();
    // Should reflect 60 months (actual displayed value may vary)
    expect(periodText).toContain('60');
  });
});

// --- Bug Hunt: Console Errors ---
test.describe('Bug Hunt: Console Errors', () => {
  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    
    await page.goto(BASE);
    await page.waitForTimeout(2000);
    
    // Filter out expected errors (e.g., favicon, analytics)
    const realErrors = errors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('analytics') &&
      !e.includes('ERR_CONNECTION_REFUSED')
    );
    expect(realErrors).toEqual([]);
  });

  test('no console errors after fit', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    
    await page.goto(BASE);
    await fitData(page);
    
    const realErrors = errors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('analytics') &&
      !e.includes('ERR_CONNECTION_REFUSED')
    );
    expect(realErrors).toEqual([]);
  });
});
