# Chạy dự án — thứ tự các bước

**Local vs Production:** Bảng so sánh đầy đủ trong [HUONG-DAN-WEB.md](HUONG-DAN-WEB.md#local-vs-production-đọc-trước).  
**Bước 1–5 bên dưới = LOCAL only** (cần bật terminal trên PC).  
**Demo từ xa (iPhone 4G, không cần PC):** xem mục [Demo app công dân trên iPhone](#demo-app-công-dân-trên-iphone-không-cần-app-store) — link `quyhoach-citizen.vercel.app`.

**Mobile:** cần 3 terminal (+ emulator), thứ tự 1 → 2 → 3 → 4 → 5.  
**Web quản trị:** xem [HUONG-DAN-WEB.md](HUONG-DAN-WEB.md) — thêm Terminal 4 (`web/`, port 5173).

---

## Bước 1 — MongoDB (Terminal 1)

**Là gì:** Bật database — backend mới lưu/đọc được user, báo cáo.

**Cần chạy không?** **Có** — nếu MongoDB chưa chạy sẵn (Compass không connect được).  
Nếu đã cài MongoDB **Windows Service** đang Running → **bỏ qua** bước này.

```powershell
cd D:\mongodb-win32-x86_64-windows-8.3.2\bin
.\mongod.exe --dbpath D:\mongodb-win32-x86_64-windows-8.3.2\bin\DB
```

**Giữ terminal mở** — đóng = tắt database.

---

## Bước 2 — Backend API (Terminal 2)

**Là gì:** Server API (login, báo cáo…) — chạy port **8000**.

**Cần chạy không?** **Có** — mỗi lần dev.

```powershell
cd c:\Users\kimli\Downloads\Mobile_app_for_planning-main\backend
.\venv\Scripts\Activate.ps1
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

**Giữ terminal mở.** Kiểm tra: http://localhost:8000/api/

---

## Bước 3 — Android Emulator

**Là gì:** Mô phỏng điện thoại trên PC.

**Cần chạy không?** **Có** — mỗi lần test app mobile.

Android Studio → **Device Manager** → **Play** ▶ → đợi vào màn hình home.

Vào D:\Android Studio\bin chạy file studio64.exe

---

## Bước 4 — Frontend Expo (Terminal 3)

**Là gì:** Server dev app React Native — build và đưa app lên emulator.

**Cần chạy không?** **Có** — mỗi lần dev.

```powershell
cd c:\Users\kimli\Downloads\Mobile_app_for_planning-main\frontend
npx expo start
```

Hỏi port 8081 bận → nhấn **Y**.

---

## Bước 5 — Mở app trên emulator

**Là gì:** Cài/chạy app lên máy ảo.

Trong terminal Expo (bước 4), emulator **đang mở** → nhấn **`a`**.

---

## Bước 6 — Đăng nhập

| Email | Mật khẩu |
|-------|----------|
| `citizen@quyhoach.vn` | `Citizen@123` |

---

## Tóm tắt thứ tự

```
1. mongod          (Terminal 1)  ← database
2. uvicorn         (Terminal 2)  ← API
3. Emulator Play                 ← máy ảo
4. npx expo start  (Terminal 3)  ← app dev
5. Nhấn a                        ← mở app
```

---

## Bước 7 (tùy chọn) — Web quản trị (Terminal 4)

```powershell
cd c:\Users\kimli\Downloads\Mobile_app_for_planning-main\web
npm run dev
```

Trình duyệt: http://localhost:5173 — đăng nhập `admin@quyhoach.vn` / `Admin@123`.

---

## Dừng

`Ctrl+C` Terminal web (nếu có) → Terminal 3 (Expo) → Terminal 2 (backend) → tắt emulator → Terminal 1 (mongod, nếu có)

---

## Demo app công dân trên iPhone (không cần App Store)

### Khuyên dùng: Link web (khách khác WiFi / 4G)

Gửi khách link — **không cần** cùng WiFi, Expo Go, hay máy dev bật terminal:

**https://quyhoach-citizen.vercel.app**

1. Mở link trên **Safari** iPhone (Chrome iOS cũng được).
2. Đăng nhập: `citizen@quyhoach.vn` / `Citizen@123`.
3. (Tuỳ chọn) Safari → Share → **Add to Home Screen** để có icon trên màn hình chính.

App chạy trong trình duyệt (giao diện giống mobile). Đủ cho demo UI/luồng cơ bản từ xa.

| Thành phần | URL |
|------------|-----|
| App công dân (web) | https://quyhoach-citizen.vercel.app |
| API | https://quyhoach-api-production.up.railway.app |
| Web quản trị | https://quyhoach-web.vercel.app |

**Deploy lại app công dân web** (từ thư mục `frontend/`):

```powershell
vercel deploy --prod
```

Biến môi trường Vercel (`EXPO_PUBLIC_BACKEND_URL`) đã cấu hình sẵn trên project `quyhoach-citizen`.

---

### Phương án khác: Expo Go (cùng WiFi hoặc tunnel)

Dùng khi cần trải nghiệm gần app native hơn (GPS, chọn ảnh).

#### Trên iPhone (người demo)

1. Cài **Expo Go** từ App Store (miễn phí).
2. Quét mã QR do máy dev hiển thị (Camera hoặc trong Expo Go).
3. Đăng nhập: `citizen@quyhoach.vn` / `Citizen@123`.

#### Trên máy dev (Windows)

**Không cần** chạy MongoDB/backend local nếu dùng API production (Railway).

1. Trong `frontend/.env` (xem `frontend/.env.example`):

   ```
   EXPO_PUBLIC_BACKEND_URL=https://quyhoach-api-production.up.railway.app
   ```

2. Chạy Expo:

   ```powershell
   cd c:\Users\kimli\Downloads\Mobile_app_for_planning-main\frontend
   npm install
   npx expo start
   ```

3. **Cùng WiFi** với iPhone: quét QR trong terminal.

4. **Khác WiFi / 4G:** thử tunnel (có thể lỗi ngrok trên một số mạng):

   ```powershell
   $env:NGROK_AUTHTOKEN = "your-ngrok-token"
   npx expo start --tunnel
   ```

   Nếu tunnel lỗi → dùng link web ở trên.

### Lưu ý

- Link web: không cần giữ máy dev bật.
- Expo Go: giữ terminal Expo **mở** trong lúc demo.
- Admin web: https://quyhoach-web.vercel.app (`admin@quyhoach.vn` / `Admin@123`).
- Thêm domain Vercel mới → cập nhật `CORS_ORIGINS` trên Railway (service `quyhoach-api`).

Production mobile + web: xem [HUONG-DAN-WEB.md](HUONG-DAN-WEB.md).
