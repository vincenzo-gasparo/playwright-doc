import { test } from '@playwright/test';

test('test with steps', async () => {
  await test.step('step one', async () => {
    await test.step('nested step', async () => {});
  });

  await test.step('step two', async () => {});
});
