import { test, expect } from "@playwright/test";

test.describe("Login", () => {
  test("login page loads and shows form", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#email")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.getByRole("button", { name: /Sign in/i })).toBeVisible();
  });

  test("invalid credentials show error", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#email")).toBeVisible({ timeout: 15000 });
    await page.locator("#email").fill("wrong@example.com");
    await page.locator("#password").fill("wrongpassword");
    await page.getByRole("button", { name: /Sign in/i }).click();
    // Avoid strict-mode conflicts with toast containers by targeting the actual message.
    await expect(page.getByText(/Invalid credentials|Unable to login/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("valid admin login redirects to admin dashboard", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#email")).toBeVisible({ timeout: 15000 });
    await page.locator("#email").fill("chapteronecafe11@gmail.com");
    await page.locator("#password").fill("admin@123");
    await page.getByRole("button", { name: /Sign in/i }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });
  });
});
