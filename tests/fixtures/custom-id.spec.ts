import { test as base } from '@playwright/test';

const test = base.extend({
  myFixture: async ({}, use) => {
    await use('value');
  },
});

test('custom fixture test', async ({ myFixture }) => {});
