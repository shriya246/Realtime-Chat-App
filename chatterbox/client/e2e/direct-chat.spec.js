/**
 * Purpose: E2E coverage for starting a direct chat and sending a message.
 */

import { expect, test } from '@playwright/test';

const register = async (page, username) => {
  await page.goto('/register');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Email').fill(`${username}@example.com`);
  await page.getByLabel('Password').fill('StrongPassword123!');
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page.getByText('ChatterBox')).toBeVisible();
};

test('starts a direct chat and sends a message', async ({ browser }) => {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const aliceName = `alice_${suffix}`;
  const bobName = `bob_${suffix}`;
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const alice = await aliceContext.newPage();
  const bob = await bobContext.newPage();

  await register(alice, aliceName);
  await register(bob, bobName);

  await alice.getByLabel('Search chats or users').fill(bobName);
  await alice.getByText(`${bobName}@example.com`).click();
  await alice.getByLabel('Direct message').fill('Hello from Playwright');
  await alice.getByRole('button', { name: 'Send direct message' }).click();

  await expect(alice.getByText('Hello from Playwright')).toBeVisible();

  await aliceContext.close();
  await bobContext.close();
});
