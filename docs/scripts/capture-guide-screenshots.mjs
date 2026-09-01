/**
 * Capture guide screenshots into docs/images/
 *
 * Env:
 *   CITIZEN_URL  default https://quyhoach-citizen.vercel.app
 *   ADMIN_URL    default https://quyhoach-web.vercel.app
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../images");
const CITIZEN_URL = (process.env.CITIZEN_URL || "http://127.0.0.1:8081").replace(/\/$/, "");
const ADMIN_URL = (process.env.ADMIN_URL || "http://127.0.0.1:5173").replace(/\/$/, "");

fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log("saved", name);
}

async function fillByTestId(page, testId, value) {
  const el = page.getByTestId(testId);
  await el.waitFor({ state: "visible", timeout: 30000 });
  await el.click({ clickCount: 3 });
  await el.fill(value);
}

async function clickTestId(page, testId) {
  const el = page.getByTestId(testId);
  await el.waitFor({ state: "visible", timeout: 30000 });
  await el.click();
}

async function clickTab(page, label) {
  // Expo tab bar labels
  const tab = page.getByText(label, { exact: true }).last();
  await tab.waitFor({ state: "visible", timeout: 15000 });
  await tab.click();
}

async function dismissAlerts(page) {
  page.on("dialog", async (d) => {
    try {
      await d.accept();
    } catch {}
  });
}

async function citizenLogin(page, email, password) {
  await page.goto(`${CITIZEN_URL}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await sleep(1000);
  // splash may redirect
  if (!(await page.getByTestId("login-email-input").count())) {
    await page.goto(`${CITIZEN_URL}/`, { waitUntil: "networkidle", timeout: 60000 });
    await sleep(1500);
  }
  if (await page.getByTestId("home-screen").count()) {
    // already logged in — logout first
    await clickTab(page, "Cá nhân");
    await sleep(800);
    if (await page.getByTestId("logout-button").count()) {
      await clickTestId(page, "logout-button");
      await sleep(800);
    }
    await page.goto(`${CITIZEN_URL}/login`, { waitUntil: "networkidle", timeout: 60000 });
    await sleep(800);
  }
  await fillByTestId(page, "login-email-input", email);
  await fillByTestId(page, "login-password-input", password);
  await shot(page, email.startsWith("admin") ? "citizen-login.png" : "citizen-login.png");
  // overwrite login once with citizen credentials view preferred for citizen-login
  await clickTestId(page, "login-submit-button");
  await page.getByTestId("home-screen").waitFor({ state: "visible", timeout: 45000 });
  await sleep(1200);
}

async function captureCitizen(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  dismissAlerts(page);

  // Fresh login page for citizen-login.png
  await page.goto(`${CITIZEN_URL}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await sleep(1200);
  if (await page.getByTestId("login-email-input").count()) {
    await fillByTestId(page, "login-email-input", "citizen@quyhoach.vn");
    await fillByTestId(page, "login-password-input", "Citizen@123");
    await shot(page, "citizen-login.png");
    await clickTestId(page, "login-submit-button");
  } else {
    await citizenLogin(page, "citizen@quyhoach.vn", "Citizen@123");
  }
  await page.getByTestId("home-screen").waitFor({ state: "visible", timeout: 45000 });
  await sleep(1500);
  await shot(page, "citizen-home.png");

  await clickTestId(page, "compare-feature-card");
  await page.getByTestId("compare-screen").waitFor({ state: "visible", timeout: 30000 });
  await sleep(1000);
  await shot(page, "citizen-compare.png");
  await clickTestId(page, "compare-back");
  await sleep(800);

  await clickTestId(page, "report-feature-card");
  await page.getByTestId("report-screen").waitFor({ state: "visible", timeout: 30000 });
  await sleep(800);
  await shot(page, "citizen-report.png");
  await clickTestId(page, "report-back");
  await sleep(800);

  await clickTestId(page, "legal-feature-card");
  await page.getByTestId("legal-screen").waitFor({ state: "visible", timeout: 30000 }).catch(async () => {
    // fallback: wait for title text
    await page.getByText("Văn bản pháp luật").first().waitFor({ timeout: 15000 });
  });
  await sleep(1000);
  await shot(page, "citizen-legal.png");
  const legalBack = page.getByTestId("legal-back");
  if (await legalBack.count()) await legalBack.click();
  else await page.goBack();
  await sleep(800);

  await clickTestId(page, "administrative-procedures-feature-card");
  await page.getByTestId("administrative-procedures-screen").waitFor({ state: "visible", timeout: 30000 });
  await sleep(1000);
  await shot(page, "citizen-procedures.png");
  await clickTestId(page, "administrative-procedures-back");
  await sleep(800);

  await clickTestId(page, "building-permits-feature-card");
  await page.getByTestId("building-permits-screen").waitFor({ state: "visible", timeout: 30000 });
  await sleep(1000);
  await shot(page, "citizen-permits.png");
  await clickTestId(page, "building-permits-back");
  await sleep(800);

  await clickTestId(page, "social-housing-feature-card");
  await page.getByTestId("social-housing-screen").waitFor({ state: "visible", timeout: 30000 });
  await sleep(1000);
  await shot(page, "citizen-housing.png");
  await clickTestId(page, "social-housing-back");
  await sleep(800);

  await clickTab(page, "Thông báo");
  await page.getByTestId("notifications-screen").waitFor({ state: "visible", timeout: 30000 });
  await sleep(1000);
  await shot(page, "citizen-notifications.png");

  await clickTab(page, "Cá nhân");
  await page.getByTestId("profile-screen").waitFor({ state: "visible", timeout: 30000 });
  await sleep(1000);
  await shot(page, "citizen-profile.png");

  // Logout then login as admin for implementer home (optional extra)
  await clickTestId(page, "logout-button");
  await sleep(1000);
  await page.goto(`${CITIZEN_URL}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await sleep(800);
  if (await page.getByTestId("login-email-input").count()) {
    await fillByTestId(page, "login-email-input", "admin@quyhoach.vn");
    await fillByTestId(page, "login-password-input", "Admin@123");
    await clickTestId(page, "login-submit-button");
    await page.getByTestId("home-screen").waitFor({ state: "visible", timeout: 45000 });
    await sleep(1500);
    // Tall viewport so QUẢN TRỊ / Trung tâm Quản trị stays in frame
    await page.setViewportSize({ width: 390, height: 1400 });
    await sleep(400);
    await page.getByTestId("open-admin-dashboard").waitFor({ state: "visible", timeout: 10000 });
    await shot(page, "implementer-home.png");
    await page.setViewportSize({ width: 390, height: 844 });
    await sleep(300);
    if (await page.getByTestId("open-admin-dashboard").count()) {
      await clickTestId(page, "open-admin-dashboard");
      await page.getByTestId("admin-tab-screen").waitFor({ state: "visible", timeout: 30000 });
      await sleep(1200);
      await shot(page, "implementer-admin-center.png");
    }
  }

  await context.close();
}

async function captureAdminWeb(browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  dismissAlerts(page);

  await page.goto(`${ADMIN_URL}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await sleep(1000);
  await page.getByTestId("login-email").waitFor({ state: "visible", timeout: 30000 });
  await page.getByTestId("login-email").fill("admin@quyhoach.vn");
  await page.getByTestId("login-password").fill("Admin@123");
  await shot(page, "admin-login.png");
  await page.getByTestId("login-submit").click();
  await page.waitForURL(/\/admin\/?$/, { timeout: 45000 });
  await sleep(1500);
  await shot(page, "admin-dashboard.png");

  await page.goto(`${ADMIN_URL}/admin/map`, { waitUntil: "networkidle", timeout: 60000 });
  await sleep(2500);
  await shot(page, "admin-map.png");

  await page.goto(`${ADMIN_URL}/admin/reports`, { waitUntil: "networkidle", timeout: 60000 });
  await sleep(1500);
  await shot(page, "admin-reports.png");

  await page.goto(`${ADMIN_URL}/admin/users`, { waitUntil: "networkidle", timeout: 60000 });
  await sleep(1500);
  await shot(page, "admin-users.png");

  await context.close();
}

async function main() {
  console.log("CITIZEN_URL", CITIZEN_URL);
  console.log("ADMIN_URL", ADMIN_URL);
  console.log("OUT", OUT);
  const browser = await chromium.launch({ headless: true });
  try {
    await captureCitizen(browser);
    await captureAdminWeb(browser);
  } finally {
    await browser.close();
  }
  const required = [
    "citizen-login.png",
    "citizen-home.png",
    "citizen-profile.png",
    "citizen-report.png",
    "citizen-notifications.png",
    "citizen-compare.png",
    "citizen-legal.png",
    "citizen-procedures.png",
    "citizen-permits.png",
    "citizen-housing.png",
    "admin-login.png",
    "admin-dashboard.png",
    "admin-map.png",
    "admin-reports.png",
    "admin-users.png",
  ];
  const missing = required.filter((f) => !fs.existsSync(path.join(OUT, f)));
  if (missing.length) {
    console.error("MISSING", missing);
    process.exit(1);
  }
  console.log("OK all required screenshots present");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
