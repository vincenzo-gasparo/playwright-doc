import { test } from '@playwright/test';

const items = ['a', 'b'];

for (const item of items) {
  test.describe(`group for ${item}`, () => {
    test(`should handle ${item}`, async ({ page }) => {
      await test.step(`step with ${item}`, async () => {});
    });
  });

  test(`top-level test for ${item}`, async ({ page }) => {});
}
