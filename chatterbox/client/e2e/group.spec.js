/**
 * Purpose: E2E coverage for creating a room/group.
 */

import { expect, test } from '@playwright/test';

test('creates a public group room', async ({ page }) => {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const username = `group_${suffix}`;
  const roomName = `E2E Room ${suffix}`;

  await page.goto('/register');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Email').fill(`${username}@example.com`);
  await page.getByLabel('Password').fill('StrongPassword123!');
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page.getByText('ChatterBox')).toBeVisible();

  await page.getByRole('button', { name: 'Rooms' }).click();
  await page.getByRole('button', { name: 'Create room' }).click();
  await page.getByLabel('Name').fill(roomName);
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByText(roomName)).toBeVisible();
});
