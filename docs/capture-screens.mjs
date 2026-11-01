import { chromium } from "playwright";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "images");
await mkdir(outDir, { recursive: true });

const API = "http://127.0.0.1:8000";
const ADMIN = "http://127.0.0.1:5173";
const CITIZEN = "http://127.0.0.1:8081";

async function loginApi(email, password) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login ${email}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function shot(page, name) {
  const file = path.join(outDir, name);
  await page.waitForTimeout(800);
  await page.screenshot({ path: file, fullPage: false });
  console.log("saved", name);
}

const browser = await chromium.launch({ headless: true });

// --- Admin web (desktop) ---
{
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  page.setDefaultTimeout(60000);
  await page.goto(`${ADMIN}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[type="password"]');
  await page.locator('input[type="email"]').fill("admin@quyhoach.vn");
  await page.locator('input[type="password"]').fill("Admin@123");
  await shot(page, "admin-login.png");
  await page.getByRole("button", { name: /Đăng nhập/i }).click();
  await page.waitForURL("**/admin**", { timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot(page, "admin-dashboard.png");

  await page.goto(`${ADMIN}/admin/map`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  await shot(page, "admin-map.png");

  await page.goto(`${ADMIN}/admin/violations`, { waitUntil: "domcontentloaded" });
  const allBtn = page.getByRole("button", { name: "Tất cả" });
  if (await allBtn.count()) await allBtn.click();
  await page.waitForTimeout(1000);
  await shot(page, "admin-violations.png");

  await page.goto(`${ADMIN}/admin/reports`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await shot(page, "admin-reports.png");
  await context.close();
}

// --- Citizen app (mobile viewport) ---
{
  const citizenData = await loginApi("citizen@quyhoach.vn", "Citizen@123");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  // Inject auth before app boots
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem("qh_token", token);
      localStorage.setItem("qh_user", JSON.stringify(user));
    },
    { token: citizenData.access_token, user: citizenData.user }
  );

  // Login screen (clear storage for this shot)
  const loginCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const loginPage = await loginCtx.newPage();
  await loginPage.goto(`${CITIZEN}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await loginPage.waitForTimeout(2500);
  await shot(loginPage, "citizen-login.png");
  await loginCtx.close();

  const routes = [
    ["/(tabs)", "citizen-home.png"],
    ["/compare", "citizen-compare.png"],
    ["/report", "citizen-report.png"],
    ["/legal", "citizen-legal.png"],
    ["/administrative-procedures", "citizen-procedures.png"],
    ["/building-permits", "citizen-permits.png"],
    ["/social-housing", "citizen-housing.png"],
    ["/(tabs)/notifications", "citizen-notifications.png"],
    ["/(tabs)/profile", "citizen-profile.png"],
  ];

  for (const [route, file] of routes) {
    const url = `${CITIZEN}${route}`;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForTimeout(2500);
      await shot(page, file);
    } catch (e) {
      console.error("fail", file, e.message);
      await writeFile(path.join(outDir, file + ".error.txt"), String(e));
    }
  }
  await context.close();
}

await browser.close();
console.log("done");
