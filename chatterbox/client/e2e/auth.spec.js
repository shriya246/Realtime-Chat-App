/**
 * Purpose: E2E coverage for registration and login.
 */

import { expect, test } from '@playwright/test';

const uniqueUser = () => `e2e_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

test('registers and logs in with a new account', async ({ page }) => {
  const username = uniqueUser();
  const email = `${username}@example.com`;

  await page.goto('/register');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('StrongPassword123!');
  await page.getByRole('button', { name: /create account/i }).click();

  await expect(page.getByText('ChatterBox')).toBeVisible();
});
