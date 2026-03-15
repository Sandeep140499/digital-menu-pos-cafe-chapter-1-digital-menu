import { test, expect } from "@playwright/test";

test.describe("Admin flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill("chapteronecafe11@gmail.com");
    await page.locator("#password").fill("admin@123");
    await page.getByRole("button", { name: /Sign in/i }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });
  });

  test("admin dashboard loads after login", async ({ page }) => {
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole("heading", { name: /Dashboard|Admin/i })).toBeVisible({
      timeout: 5000,
    });
  });
});
