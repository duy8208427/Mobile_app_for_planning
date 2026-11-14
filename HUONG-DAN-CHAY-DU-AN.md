# Hướng dẫn chạy dự án QuyHoạch

Chạy lệnh từ **thư mục gốc repo** (nơi có `backend/`, `frontend/`, `web/`). Không dùng đường dẫn tuyệt đối của máy khác.

Web admin + deploy: [HUONG-DAN-WEB.md](HUONG-DAN-WEB.md).

---

## 1. Chọn cách chạy

| Phương án | Mục | Khi nào dùng |
|-----------|-----|--------------|
| [Demo online](#2-demo-online-không-cài-gì) | §2 | Demo khách, iPhone 4G — không cài gì |
| [Expo Go (điện thoại)](#6-expo-go-điện-thoại-thật) | §6 | Test native trên máy thật |
| [Android Emulator](#7-android-emulator) | §7 | Test native trên máy ảo PC |
| Web admin + deploy | [HUONG-DAN-WEB.md](HUONG-DAN-WEB.md) | Vite admin local / Vercel + Atlas |

| Thành phần | URL production |
|------------|----------------|
| App công dân | https://quyhoach-citizen.vercel.app |
| Web quản trị | https://quyhoach-web.vercel.app |
| API | https://quyhoach-api.vercel.app |

Tài khoản demo: [mục 8](#8-tài-khoản-demo).

---

## 2. Demo online (không cài gì)

Không cần MongoDB, backend, Expo Go, hay máy dev bật terminal.

1. Mở **https://quyhoach-citizen.vercel.app** trên Safari / Chrome (4G cũng được).
2. Đăng nhập bằng tài khoản [mục 8](#8-tài-khoản-demo).
3. (Tuỳ chọn, iPhone) Safari → Share → **Add to Home Screen**.

Web quản trị: **https://quyhoach-web.vercel.app** (`admin@quyhoach.vn` / `Admin@123`).

Kiểm tra API: https://quyhoach-api.vercel.app/health — phải `{"app":"QuyHoạch AI","ok":true}`.

---

## 3. Chuẩn bị máy (một lần)

| Công cụ | Bắt buộc khi |
|---------|----------------|
| [Node.js LTS](https://nodejs.org) (kèm npm) | Expo / web |
| Python **3.11** | API local ([backend/runtime.txt](backend/runtime.txt)) |
| MongoDB Community, Docker Mongo, **hoặc** [Atlas](https://www.mongodb.com/cloud/atlas/register) | API local |
| [Expo Go](https://expo.dev/go) trên điện thoại | [§6](#6-expo-go-điện-thoại-thật) |
| [Android Studio](https://developer.android.com/studio) + emulator | [§7](#7-android-emulator) |

- Expo Go Android: [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)
- Expo Go iPhone: [App Store](https://apps.apple.com/app/expo-go/id982107779)

Windows **không** chạy được iOS Simulator — test iPhone bằng Expo Go hoặc [demo online](#2-demo-online-không-cài-gì).

---

## 4. Cài đặt lần đầu

Chỉ làm khi clone repo mới hoặc máy chưa cài dependency.

### Backend (bỏ qua nếu chỉ dùng API production)

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Giữ trong `backend/.env`:

```
MONGO_URL=mongodb://localhost:27017
DB_NAME=quyhoach
JWT_SECRET=dev-secret-change-me
CORS_ORIGINS=http://localhost:5173,http://localhost:8081
```

Atlas: đổi `MONGO_URL` thành `mongodb+srv://...` (xem [backend/.env.example](backend/.env.example)).

Backend tự tạo 3 tài khoản demo nếu chưa có. Tài khoản đã có thì giữ nguyên, nên mật khẩu đổi trên production không bị ghi đè. Muốn đặt lại về mật khẩu demo (chỉ dùng khi demo local), thêm `RESET_DEMO_ACCOUNTS=true` vào `backend/.env`.

Nếu PowerShell chặn `Activate.ps1`:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### Frontend

```powershell
cd frontend
copy .env.example .env
npm install
```

Chỉnh `EXPO_PUBLIC_BACKEND_URL` trong `frontend/.env`. **Không** thêm `/api` ở cuối.

| Môi trường | `EXPO_PUBLIC_BACKEND_URL` |
|------------|---------------------------|
| Điện thoại thật + API local, cùng WiFi | `http://192.168.x.x:8000` (IP LAN của PC — `ipconfig`) |
| Android Emulator + API local | `http://10.0.2.2:8000` |
| API production (không cần Mongo local) | `https://quyhoach-api.vercel.app` |

- Điện thoại: **không** dùng `localhost` hay `10.0.2.2`.
- Emulator: dùng `10.0.2.2` (trỏ về `localhost` của PC), **không** dùng IP LAN trừ khi cố ý.

Sửa `.env` xong phải clear cache: `npx expo start -c`.

---

## 5. Chạy chung (API local)

Mỗi process **một terminal**, **giữ mở**. Bỏ Mongo/uvicorn nếu `frontend/.env` trỏ API production.

```
1. MongoDB
2. uvicorn          ← port 8000
3. Expo / Emulator  ← §6 hoặc §7
```

### 5.1. MongoDB

Bỏ qua nếu Windows Service đang chạy, Compass đã connect `mongodb://localhost:27017`, Docker listen `27017`, hoặc Atlas.

```powershell
mongod --dbpath <thư-mục-data>
```

Hoặc Docker:

```powershell
docker run -d --name quyhoach-mongo -p 27017:27017 mongo:7
```

### 5.2. Backend API

```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

Kiểm tra http://localhost:8000/health — phải `{"app":"QuyHoạch AI","ok":true}`.

---

## 6. Expo Go (điện thoại thật)

Dùng khi cần GPS, chọn ảnh, cử chỉ native. **Giữ terminal Expo mở** — đóng = app ngừng chạy.

1. Đặt `EXPO_PUBLIC_BACKEND_URL` theo [bảng §4](#4-cài-đặt-lần-đầu) (IP LAN hoặc production).
2. Chạy Mongo + uvicorn nếu dùng API local ([§5](#5-chạy-chung-api-local)).
3. Start Expo:

```powershell
cd frontend
npx expo start
```

Hỏi port **8081** bận → nhấn **Y**. Terminal hiện mã QR.

### Quét QR

1. Điện thoại và PC **cùng WiFi** (tắt VPN nếu quét không được).
2. **Android:** Expo Go → **Scan QR code**.
3. **iPhone:** Camera hoặc Expo Go — **không** dùng Chrome.

### Khác WiFi / 4G (`--tunnel`)

```powershell
cd frontend
npx expo start --tunnel
```

Tunnel chỉ giúp tải bundle JS. Nếu URL API là IP LAN, điện thoại vẫn phải tới được PC. Muốn login qua 4G → dùng API production. Tunnel lỗi → [demo online](#2-demo-online-không-cài-gì).

---

## 7. Android Emulator

1. Đặt `EXPO_PUBLIC_BACKEND_URL=http://10.0.2.2:8000` (hoặc production).
2. Chạy Mongo + uvicorn nếu API local ([§5](#5-chạy-chung-api-local)).
3. Android Studio → **Device Manager** → **Play** ▶ → đợi màn hình home.
4. Start Expo và mở trên máy ảo:

```powershell
cd frontend
npx expo start
```

Khi Metro sẵn sàng, nhấn **`a`** trong terminal Expo.

---

## 8. Tài khoản demo

| Vai trò | Email | Mật khẩu | Dùng ở |
|---------|-------|----------|--------|
| Người dân | `citizen@quyhoach.vn` | `Citizen@123` | App / https://quyhoach-citizen.vercel.app |
| Cán bộ Xử lý (đi hiện trường) | `manager@quyhoach.vn` | `Manager@123` | App |
| Cán bộ Quản lý (tiền kiểm, giao việc, ra quyết định) | `admin@quyhoach.vn` | `Admin@123` | App + web quản trị |

---

## 9. Dừng

`Ctrl+C`: Expo → backend → tắt emulator (nếu có) → MongoDB (nếu tự chạy `mongod`).

Không tắt MongoDB Windows Service nếu ứng dụng khác đang dùng.

---

## 10. Lỗi thường gặp

| Triệu chứng | Cách xử lý |
|-------------|------------|
| Port 8081 bận | Expo hỏi đổi port → nhấn **Y** |
| Quét QR không mở được | Cùng WiFi; tắt VPN; thử `--tunnel`; firewall mở 8081 |
| Login lỗi mạng | Kiểm tra `.env` và `/health` |
| Sửa `.env` mà app vẫn cũ | `Ctrl+C` → `npx expo start -c` |
| iPhone không thấy QR | Camera hoặc Expo Go, không Chrome |
| Expo Go + API local lỗi mạng | IP LAN (`ipconfig`), không `localhost` / `10.0.2.2` |
| Emulator login lỗi (API local) | Dùng `http://10.0.2.2:8000`, không IP LAN / `localhost` |
| Nhấn `a` không mở app | Emulator chưa vào home — đợi rồi nhấn `a` lại |
| Backend không start | Mongo chưa chạy hoặc `MONGO_URL` sai |
| `Activate.ps1` bị chặn | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |

---

## 11. Liên kết

- [HUONG-DAN-WEB.md](HUONG-DAN-WEB.md) — web admin local + deploy Vercel + Atlas
- [docs/HUONG-DAN-TONG-QUAN.html](docs/HUONG-DAN-TONG-QUAN.html) — hướng dẫn tổng quan
- [backend/.env.example](backend/.env.example) · [frontend/.env.example](frontend/.env.example) · [web/.env.example](web/.env.example)
