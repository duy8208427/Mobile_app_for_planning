# Chạy dự án — thứ tự các bước

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
