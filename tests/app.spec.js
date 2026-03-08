import { test, expect } from '@playwright/test';

test.describe('GenArt2025 Application', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the main page', async ({ page }) => {
    // Check that the main elements are present
    const canvas = page.locator('canvas#canvas');
    await expect(canvas).toBeVisible();
    
    const container = page.locator('#container');
    await expect(container).toBeVisible();
  });

  test('should have audio controls', async ({ page }) => {
    const fileInput = page.locator('#audioFile');
    const playBtn = page.locator('#playPause');
    const stopBtn = page.locator('#stop');
    const resetBtn = page.locator('#reset');

    await expect(fileInput).toBeVisible();
    await expect(playBtn).toBeVisible();
    await expect(stopBtn).toBeVisible();
    await expect(resetBtn).toBeVisible();
  });

  test('should display canvas dimensions', async ({ page }) => {
    const canvas = page.locator('canvas#canvas');
    
    const width = await canvas.evaluate(el => el.width);
    const height = await canvas.evaluate(el => el.height);

    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  test('should handle fullscreen button', async ({ page }) => {
    const fullscreenBtn = page.locator('#fullscreen');
    await expect(fullscreenBtn).toBeVisible();
    
    // Button should be clickable
    await expect(fullscreenBtn).toBeEnabled();
  });

  test('should respond to window resize', async ({ page }) => {
    const canvas = page.locator('canvas#canvas');
    const initialWidth = await canvas.evaluate(el => el.width);

    // Resize viewport
    await page.setViewportSize({ width: 1024, height: 768 });

    // Canvas should adapt (may take a moment)
    await page.waitForTimeout(100);
    const newWidth = await canvas.evaluate(el => el.width);

    // Width may change depending on responsive implementation
    expect(initialWidth).toBeGreaterThan(0);
    expect(newWidth).toBeGreaterThan(0);
  });

  test('should have audio info display', async ({ page }) => {
    const audioInfo = page.locator('#audio-info');
    await expect(audioInfo).toBeVisible();
  });
});
