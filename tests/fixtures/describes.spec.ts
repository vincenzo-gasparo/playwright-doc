import { test } from '@playwright/test';

test.describe('outer group', () => {
  test('inner test', async () => {});

  test.describe('nested group', () => {
    test('deeply nested', async () => {});
  });
});

test.describe.parallel('parallel group', () => {
  test('parallel test', async () => {});
});

test.describe.serial('serial group', () => {
  test('serial test', async () => {});
});
