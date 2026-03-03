import { test } from '@playwright/test';

test.skip('skipped test', async () => {});
test.only('focused test', async () => {});
test.fixme('fixme test', async () => {});
test.fail('expected failure', async () => {});
test.slow('slow test', async () => {});
