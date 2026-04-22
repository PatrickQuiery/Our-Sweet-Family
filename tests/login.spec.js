const { test, expect } = require('@playwright/test');

const DEMO_EMAIL = 'parent@demo.com';
const DEMO_PASSWORD = 'password123';

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders all expected elements', async ({ page }) => {
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create one free' })).toBeVisible();
    await expect(page.getByText(DEMO_EMAIL)).toBeVisible();
  });

  test('successful login with demo credentials redirects to dashboard', async ({ page }) => {
    await page.getByLabel('Email').fill(DEMO_EMAIL);
    await page.getByLabel('Password').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });

  test('shows loading state while request is in flight', async ({ page }) => {
    await page.getByLabel('Email').fill(DEMO_EMAIL);
    await page.getByLabel('Password').fill(DEMO_PASSWORD);

    // Slow down the network so we can catch the loading state
    await page.route('**/api/auth/login', async (route) => {
      await new Promise((r) => setTimeout(r, 800));
      await route.continue();
    });

    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('button', { name: 'Signing in...' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Signing in...' })).toBeDisabled();
  });

  test('shows error for wrong password', async ({ page }) => {
    await page.getByLabel('Email').fill(DEMO_EMAIL);
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Invalid credentials')).toBeVisible({ timeout: 10_000 });
  });

  test('shows error for unknown email', async ({ page }) => {
    await page.getByLabel('Email').fill('nobody@example.com');
    await page.getByLabel('Password').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Invalid credentials')).toBeVisible({ timeout: 10_000 });
  });

  test('does not submit with empty fields', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign in' }).click();

    // HTML5 required validation should block submission — URL stays on /login
    await expect(page).toHaveURL(/\/login/);
    // No API call should have been made
    const errorBanner = page.locator('.bg-red-50');
    await expect(errorBanner).not.toBeVisible();
  });

  test('does not submit with missing password', async ({ page }) => {
    await page.getByLabel('Email').fill(DEMO_EMAIL);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/login/);
  });

  test('sign-up link navigates to /signup', async ({ page }) => {
    await page.getByRole('link', { name: 'Create one free' }).click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('logo link navigates to landing page', async ({ page }) => {
    await page.getByRole('link', { name: 'Our Sweet Family' }).click();
    await expect(page).toHaveURL(/^\/?$/);
  });

  test('already-authenticated user is redirected away from /login', async ({ page, context }) => {
    // Log in once to get a token
    const response = await page.request.post('/api/auth/login', {
      data: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
    });
    const { token } = await response.json();

    // Store the token as the app would (localStorage)
    await context.addInitScript((t) => {
      window.localStorage.setItem('token', t);
    }, token);

    await page.goto('/login');
    // App should redirect an authenticated session away from login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 });
  });
});
