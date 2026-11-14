// Chụp ảnh màn hình cho bộ hướng dẫn bằng cách đi một hồ sơ demo qua đủ 16 bước
// trên bản demo online (chỉ dùng nút đăng nhập demo có sẵn).
//
//   npm i playwright && npx playwright install chromium
//   node docs/capture-screens.mjs [thư-mục-ảnh]
//
// Biến môi trường: WEB (web quản trị), APP (app người dân), mặc định là bản online.
import { chromium } from "playwright";
import { mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] || path.join(__dirname, "images");
await mkdir(outDir, { recursive: true });

const WEB = process.env.WEB || "https://quyhoach-web.vercel.app";
const APP = process.env.APP || "https://quyhoach-citizen.vercel.app";
const SPOT = { latitude: 10.4573, longitude: 105.6336 }; // nội thị TP. Cao Lãnh
const TAG = `[Demo hướng dẫn ${new Date().toISOString().slice(0, 10)}]`;

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
async function shot(page, name, opts = {}) {
  await page.waitForTimeout(opts.wait ?? 900);
  await page.screenshot({ path: path.join(outDir, name), fullPage: !!opts.full });
  log("saved", name);
}

const browser = await chromium.launch({ headless: true });
const desk = await browser.newContext({ viewport: { width: 1366, height: 860 }, locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh" });
const phoneOpts = {
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh", geolocation: SPOT, permissions: ["geolocation"],
};
const web = await desk.newPage();
web.setDefaultTimeout(45000);

async function appLogin(label) {
  const ctx = await browser.newContext(phoneOpts);
  const p = await ctx.newPage();
  p.setDefaultTimeout(45000);
  await p.goto(`${APP}/login`);
  await p.getByText("Đăng nhập", { exact: true }).waitFor();
  if (!label.startsWith("Nguyễn Văn An")) {
    await p.getByText("Nguyễn Văn An — Người dân", { exact: true }).first().click();
    await p.getByText(label, { exact: true }).last().click();
  }
  await p.getByText("Đăng nhập", { exact: true }).click();
  await p.waitForURL((u) => !u.pathname.startsWith("/login"));
  await p.waitForTimeout(2500);
  return p;
}
async function pickPhoto(p, buttonText, file) {
  const [chooser] = await Promise.all([p.waitForEvent("filechooser"), p.getByText(buttonText, { exact: true }).last().click()]);
  await chooser.setFiles(file);
  await p.waitForTimeout(1500);
}
async function openAccordion(label) {
  const btn = web.locator("button", { hasText: label }).first();
  if (/\+\s*$/.test(await btn.innerText())) await btn.click();
  await web.waitForTimeout(700);
}

// RESUME_CASE=<id>: continue an already created demo case from step 3 (skips overview + step 1)
const RESUME = process.env.RESUME_CASE || "";
const evidence = path.join(outDir, "web-ban-do.png");
let caseId = RESUME;
let citizen;
// ---------- Web quản trị: tổng quan ----------
await web.goto(`${WEB}/login`);
if (!RESUME) await shot(web, "web-login.png");
await web.getByRole("button", { name: "Đăng nhập" }).click();
await web.waitForURL("**/admin");
await web.waitForTimeout(3000);
if (!RESUME) {
await shot(web, "web-tong-quan.png");
await web.goto(`${WEB}/admin/map`);
await web.getByText(/thửa địa chính \(đỏ\)|chưa có dữ liệu thửa/).waitFor({ timeout: 90000 });
await shot(web, "web-ban-do.png", { wait: 3000 });
await web.goto(`${WEB}/admin/catalog`);
await shot(web, "web-danh-muc.png", { full: true });
await web.goto(`${WEB}/admin/surveys`);
await shot(web, "web-dot-bay.png");
await web.goto(`${WEB}/admin/violations`);
await shot(web, "web-nghi-van.png");

// ---------- Bước 1: người dân phản ánh ----------
citizen = await appLogin("Nguyễn Văn An — Người dân");
await shot(citizen, "app-nguoi-dan-trang-chu.png");
await citizen.goto(`${APP}/report`);
await citizen.getByPlaceholder("VD: Nhà 4 tầng xây không phép").fill(`${TAG} Nhà 3 tầng xây trên đất sản xuất`);
await citizen.getByText("Sai quy hoạch", { exact: true }).click();
await citizen.getByPlaceholder(/VD: Số 12/).fill("Phường 1, TP. Cao Lãnh, Đồng Tháp");
await citizen.getByText("Lấy tọa độ GPS hiện tại").click();
await pickPhoto(citizen, "Thư viện", evidence);
await citizen.getByPlaceholder(/Mô tả tình hình/).fill("Đang xây nhà 3 tầng, không thấy biển báo giấy phép xây dựng.");
await shot(citizen, "app-gui-phan-anh.png", { full: true });
await citizen.getByText("Gửi báo cáo", { exact: true }).click();
await citizen.waitForURL("**/case-detail**");
caseId = new URL(citizen.url()).searchParams.get("id");
log("case", caseId);
await shot(citizen, "app-tien-do-phan-anh.png", { wait: 2500 });
} else {
  citizen = await appLogin("Nguyễn Văn An — Người dân");
}

// ---------- Bước 3, 5: tiền kiểm, giao việc ----------
const caseUrl = `${WEB}/admin/cases/${caseId}`;
await web.goto(`${WEB}/admin/cases`);
await shot(web, "web-ho-so-danh-sach.png", { wait: 2500 });
await web.goto(caseUrl);
await web.getByText(/Bước \d+\/16/).first().waitFor({ timeout: 60000 });
await web.locator("[data-testid^=case-action-]").first().waitFor({ timeout: 60000 });
await web.waitForTimeout(1500);
const precheckBtn = web.getByRole("button", { name: "Xác nhận nghi vấn vi phạm", exact: true });
if (await precheckBtn.count()) {
  await web.getByText("Gợi ý hành vi").waitFor({ timeout: 60000 });
  await web.getByText(/^Thửa đất$/i).first().scrollIntoViewIfNeeded();
  await shot(web, "web-tien-kiem.png");
  await precheckBtn.click();
  await web.waitForTimeout(3000);
}
if (await web.getByTestId("case-action-assign").count()) await openAccordion("Lập phiếu giao việc");
const assignBtn = web.getByRole("button", { name: "Lập phiếu giao việc", exact: true });
if (await assignBtn.count()) {
  await web.waitForFunction(() =>
    [...document.querySelectorAll("button[type=submit]")].some((b) => b.textContent?.trim() === "Lập phiếu giao việc" && !b.disabled), null, { timeout: 60000 });
  await assignBtn.scrollIntoViewIfNeeded();
  await shot(web, "web-giao-viec.png");
  await assignBtn.click();
  await web.waitForTimeout(3000);
}

// ---------- Bước 6–8: Cán bộ Xử lý ----------
const officer = await appLogin("Phạm Văn Thực — Cán bộ Xử lý");
await shot(officer, "app-can-bo-xu-ly-trang-chu.png");
await officer.goto(`${APP}/case-detail?id=${caseId}`);
await officer.getByText(/Bước \d+\/16/).first().waitFor();
await officer.waitForTimeout(2000);
if (await officer.getByText("Nhận việc, đến hiện trường", { exact: true }).count()) {
  await officer.getByText("Nhận việc, đến hiện trường", { exact: true }).last().click();
  await officer.getByPlaceholder("VD: 12/BB-VPHC").waitFor();
}
if (await officer.getByPlaceholder("VD: 12/BB-VPHC").count()) {
  await officer.getByPlaceholder("VD: 12/BB-VPHC").fill("05/BB-VPHC");
  await officer.getByPlaceholder(/Mô tả hiện trạng/).fill("Nhà 3 tầng đang hoàn thiện, xây trên đất quy hoạch cơ sở sản xuất.");
  await officer.getByPlaceholder("VD: 45.5").fill("120");
  await officer.getByPlaceholder("Họ tên / tên tổ chức").fill("Nguyễn Văn An");
  await officer.getByPlaceholder("Số điện thoại").fill("0903333444");
  await pickPhoto(officer, "Thư viện", evidence);
  await shot(officer, "app-lap-bien-ban.png", { full: true });
  await officer.getByText("Gửi biên bản", { exact: true }).click();
  await officer.waitForTimeout(3500);
}

// ---------- Bước 9–10: quyết định ----------
async function openCase() {
  await web.goto(caseUrl);
  await web.getByText(/Bước \d+\/16/).first().waitFor({ timeout: 60000 });
  await web.waitForTimeout(2500);
}
await openCase();
if (await web.getByTestId("case-action-decide").count()) {
  await openAccordion("Ban hành quyết định xử phạt");
  await web.getByPlaceholder("VD: 123/QĐ-XPHC").fill("05/QĐ-XPHC");
  await web.getByText(/Khung phạt: /).first().scrollIntoViewIfNeeded();
  await shot(web, "web-quyet-dinh.png");
  await web.locator("form button[type=submit]", { hasText: "Ban hành quyết định xử phạt" }).click();
  await web.waitForTimeout(4000);
}

// ---------- Bước 11–12: người vi phạm ----------
await citizen.goto(`${APP}/`);
await citizen.waitForTimeout(3000);
await shot(citizen, "app-quyet-dinh-cua-toi.png");
await citizen.goto(`${APP}/case-detail?id=${caseId}`);
await citizen.getByText(/Bước \d+\/16/).first().waitFor();
await citizen.waitForTimeout(2500);
await shot(citizen, "app-xem-quyet-dinh.png", { full: true });
if (await citizen.getByText("Gửi báo cáo khắc phục", { exact: true }).count()) {
  await citizen.getByText("Đã nộp phạt", { exact: true }).first().click().catch(() => {});
  await pickPhoto(citizen, "Thư viện", evidence);
  await citizen.getByText("Gửi báo cáo khắc phục", { exact: true }).click();
  await citizen.waitForTimeout(3500);
}

// ---------- Bước 13–16 ----------
await openCase();
if (await web.getByTestId("case-action-request_reinspection").count()) {
  await openAccordion("Yêu cầu hậu kiểm");
  await web.locator("form button[type=submit]", { hasText: "Yêu cầu hậu kiểm" }).click();
  await web.waitForTimeout(4000);
}
await officer.goto(`${APP}/case-detail?id=${caseId}`);
await officer.getByText(/Bước \d+\/16/).first().waitFor();
await officer.waitForTimeout(2500);
if (await officer.getByText("Gửi kết quả", { exact: true }).count()) {
  await officer.getByText("Đạt – đã khắc phục", { exact: true }).click();
  await pickPhoto(officer, "Thư viện", evidence);
  await shot(officer, "app-hau-kiem.png", { full: true });
  await officer.getByText("Gửi kết quả", { exact: true }).click();
  await officer.waitForTimeout(3500);
}
for (let i = 0; i < 4 && !(await web.getByTestId("case-action-close").count()); i++) await openCase();
await openAccordion("Đóng hồ sơ lưu trữ");
await web.locator("form button", { hasText: "Đóng hồ sơ" }).last().click();
await web.waitForTimeout(1500);
const confirm = web.getByRole("button", { name: /Xác nhận|Đồng ý/ });
if (await confirm.count()) await confirm.first().click();
await web.waitForTimeout(3500);
await shot(web, "web-ho-so-da-dong.png", { full: true });

await citizen.goto(`${APP}/notifications`);
await shot(citizen, "app-thong-bao.png", { wait: 2500 });
await citizen.goto(`${APP}/building-permits`);
await shot(citizen, "app-giay-phep.png", { wait: 2500 });

log("done, case", caseId);
await browser.close();
