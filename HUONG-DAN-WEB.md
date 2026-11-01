# Hướng dẫn Web App quản trị (Vite)

Web app riêng cho **cán bộ quản lý**: bản đồ quy hoạch, duyệt báo cáo công dân, quản lý người dùng. Dùng chung API FastAPI và MongoDB với app mobile Expo.

Chạy app mobile / demo: [HUONG-DAN-CHAY-DU-AN.md](HUONG-DAN-CHAY-DU-AN.md).  
Hướng dẫn sử dụng admin (HTML): [docs/HUONG-DAN-ADMIN.html](docs/HUONG-DAN-ADMIN.html).

---

## Local vs Production (đọc trước)

| | **Local (dev trên PC)** | **Production (link online)** |
|--|-------------------------|------------------------------|
| Khi nào dùng | Sửa code, test trên máy | Demo khách, iPhone 4G, không cần PC bật |
| MongoDB | `mongod` local **hoặc** Atlas | **MongoDB Atlas** — `MONGO_URL` trên Vercel |
| Backend API | `http://localhost:8000` | `https://quyhoach-api.vercel.app` |
| Web admin | `http://localhost:5173` | `https://quyhoach-web.vercel.app` |
| App công dân | [Expo Go / Emulator](HUONG-DAN-CHAY-DU-AN.md) | `https://quyhoach-citizen.vercel.app` |
| Cần terminal bật? | **Có** | **Không** |

Mục **LOCAL** bên dưới **không** áp dụng cho link Vercel online.

---

## Cấu trúc

```
web/                 # Vite + React + MapLibre — web quản trị (admin)
frontend/            # Expo — app công dân (web export trên Vercel)
backend/             # FastAPI (port 8000 local; Vercel production)
```

---

## LOCAL — Chạy trên máy dev

> **Chỉ khi sửa code trên PC.** Link production (`quyhoach-*.vercel.app`) **không** cần bật MongoDB/backend local.

MongoDB + backend (uvicorn): làm theo [HUONG-DAN-CHAY-DU-AN.md §5](HUONG-DAN-CHAY-DU-AN.md#5-chạy-chung-api-local) — kiểm tra http://localhost:8000/health trước khi mở web.

**Web admin:**

```powershell
cd web
copy .env.example .env
npm install
npm run dev
```

Mở trình duyệt: http://localhost:5173

### Đăng nhập admin

| Email | Mật khẩu |
|-------|----------|
| `admin@quyhoach.vn` | `Admin@123` |

Backend tự seed và **luôn reset** mật khẩu/role tài khoản demo mỗi lần khởi động.

---

## Biến môi trường (local)

| File | Biến | Mô tả |
|------|------|--------|
| `web/.env` | `VITE_API_URL` | URL backend, ví dụ `http://localhost:8000` |
| `web/.env` | `VITE_GIS_ZONES_URL` | (Tùy chọn) URL GeoJSON; mặc định `/data/planning_zones_demo.geojson` |
| `backend/.env` | `MONGO_URL`, `DB_NAME`, `JWT_SECRET` | Database và JWT |
| `backend/.env` | `CORS_ORIGINS` | `http://localhost:5173,http://localhost:8081` |

Mẫu: [web/.env.example](web/.env.example), [backend/.env.example](backend/.env.example).

---

## API web sử dụng

- `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/admin/stats`
- `GET /api/reports`, `PUT /api/reports/{id}`
- `GET /api/planning/zones`, `GET /api/planning/buildings`
- (API `GET /api/violations` còn trên backend; đã gỡ khỏi UI web admin)

---

## PRODUCTION — Deploy online (Vercel + Atlas)

Khách/cán bộ truy cập web qua internet, **không cần cùng WiFi** với máy dev.

```mermaid
flowchart LR
  UserAdmin["Admin browser"]
  UserCitizen["Citizen browser"]
  VercelWeb["Vercel web/"]
  VercelFrontend["Vercel frontend/"]
  VercelApi["Vercel backend/"]
  MongoAtlas["MongoDB Atlas"]

  UserAdmin --> VercelWeb
  UserCitizen --> VercelFrontend
  VercelWeb --> VercelApi
  VercelFrontend --> VercelApi
  VercelApi --> MongoAtlas
```

| Thành phần | Host | URL production |
|------------|------|----------------|
| MongoDB | [MongoDB Atlas M0](https://www.mongodb.com/cloud/atlas/register) | `MONGO_URL` trên project `quyhoach-api` |
| API | [Vercel](https://vercel.com) — thư mục `backend/` | `https://quyhoach-api.vercel.app` |
| Web quản trị | Vercel — thư mục `web/` | `https://quyhoach-web.vercel.app` |
| App công dân (web) | Vercel — thư mục `frontend/` | `https://quyhoach-citizen.vercel.app` |

Client frontend/web **bỏ qua** URL `railway.app` / `onrender.com` và fallback về `https://quyhoach-api.vercel.app`.

Demo công dân trên iPhone: [HUONG-DAN-CHAY-DU-AN.md#2-demo-online-không-cài-gì](HUONG-DAN-CHAY-DU-AN.md#2-demo-online-không-cài-gì) hoặc [Expo Go](HUONG-DAN-CHAY-DU-AN.md#6-expo-go-điện-thoại-thật).

---

### Bước 0 — Đẩy code lên GitHub

Tạo repo mới trên https://github.com/new rồi chạy (từ thư mục gốc repo):

```powershell
.\scripts\push-github.ps1 -GitHubUser "<user>" -RepoName "Mobile_app_for_planning"
```

Hoặc thủ công:

```powershell
git remote add origin https://github.com/<user>/<repo>.git
git branch -M main
git push -u origin main
```

Không commit file `.env`. Chỉ dùng `.env.example`.

**Lưu ý:** `backend/requirements.txt` đã bỏ `emergentintegrations` (không có trên PyPI) — web admin deploy bình thường; tính năng AI compare trên mobile cần cài package riêng khi dev local.

---

### Bước 1 — MongoDB Atlas

1. Đăng ký [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register).
2. **Create deployment** → chọn **M0 FREE**, region **Singapore (`ap-southeast-1`)**.
3. **Database Access** → Add user (username + password mạnh) → lưu lại.
4. **Network Access** → **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`).
5. **Database** → **Connect** → **Drivers** → copy connection string, thêm database `quyhoach`:

```
mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/quyhoach?retryWrites=true&w=majority
```

URL-encode ký tự đặc biệt trong password (`@` → `%40`, `#` → `%23`).

---

### Bước 2 — Deploy Backend API (Vercel)

**Project:** `quyhoach-api` — root [`backend/`](backend/), cấu hình trong [`backend/vercel.json`](backend/vercel.json).

1. [vercel.com](https://vercel.com) → **Add New Project** → import GitHub repo.
2. Cấu hình:

| Mục | Giá trị |
|-----|---------|
| Project name | `quyhoach-api` |
| Root Directory | `backend` |
| Framework | Other |

3. **Environment Variables:**

| Biến | Giá trị |
|------|---------|
| `MONGO_URL` | Connection string Atlas (bước 1) |
| `DB_NAME` | `quyhoach` |
| `JWT_SECRET` | Chuỗi ngẫu nhiên 32+ ký tự (khác `dev-secret-change-me`) |
| `CORS_ORIGINS` | `https://quyhoach-web.vercel.app,https://quyhoach-citizen.vercel.app` |

4. Deploy → URL `https://quyhoach-api.vercel.app`.
5. Kiểm tra: `GET https://quyhoach-api.vercel.app/health` → `{"app":"QuyHoạch AI","ok":true}`.

Deploy tự động bằng script (cần `VERCEL_TOKEN`):

```powershell
.\scripts\vercel-backend-deploy.ps1 -MongoUrl "<atlas-connection-string>" -VercelToken "<token>"
```

Script tạo/cập nhật env project `quyhoach-api`, deploy API, rồi trỏ env `quyhoach-web` và `quyhoach-citizen` về URL API.

> **Lưu ý:** [scripts/vercel-backend-deploy.ps1](scripts/vercel-backend-deploy.ps1) hardcode repo GitHub `duy8208427/Mobile_app_for_planning` — sửa trường `repo` trong file nếu dùng repo khác.

---

### Bước 3 — Deploy Web quản trị (Vercel)

**Project:** `quyhoach-web` — root [`web/`](web/), cấu hình trong [`web/vercel.json`](web/vercel.json).

| Mục | Giá trị |
|-----|---------|
| Root Directory | `web` |
| Framework | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |

**Environment Variable:**

| Biến | Giá trị |
|------|---------|
| `VITE_API_URL` | `https://quyhoach-api.vercel.app` (**không** có `/api`) |

Deploy → URL `https://quyhoach-web.vercel.app`.

Deploy lại thủ công:

```powershell
cd web
vercel deploy --prod
```

---

### Bước 4 — Deploy App công dân web (Vercel)

**Project:** `quyhoach-citizen` — root [`frontend/`](frontend/), cấu hình trong [`frontend/vercel.json`](frontend/vercel.json).

| Mục | Giá trị |
|-----|---------|
| Root Directory | `frontend` |
| Build Command | `npm run build:web` |
| Output Directory | `dist` |

**Environment Variable:**

| Biến | Giá trị |
|------|---------|
| `EXPO_PUBLIC_BACKEND_URL` | `https://quyhoach-api.vercel.app` |

Deploy → URL `https://quyhoach-citizen.vercel.app`.

```powershell
cd frontend
vercel deploy --prod
```

---

### Bước 5 — Kiểm tra truy cập từ xa

```powershell
.\scripts\verify-production.ps1
```

Hoặc thủ công:

1. Mở URL Vercel trên điện thoại **4G/5G** (tắt WiFi):
   - Admin: `https://quyhoach-web.vercel.app`
   - Công dân: `https://quyhoach-citizen.vercel.app`
2. Đăng nhập admin: `admin@quyhoach.vn` / `Admin@123`; công dân: `citizen@quyhoach.vn` / `Citizen@123`.
3. Nếu lỗi CORS → kiểm tra `CORS_ORIGINS` trên Vercel project `quyhoach-api` có đủ cả hai domain Vercel.

### Cập nhật URL API trên frontend/web (sau khi đổi host)

```powershell
.\scripts\vercel-only.ps1 -ApiHost "https://quyhoach-api.vercel.app" -VercelToken "<token>"
```

Biến env Vercel được bake lúc build — **Redeploy bắt buộc** sau khi đổi.

---

### Biến môi trường production (tóm tắt)

```
MongoDB Atlas           → MONGO_URL (db quyhoach)
Vercel quyhoach-api     → MONGO_URL, DB_NAME, JWT_SECRET, CORS_ORIGINS
Vercel quyhoach-web     → VITE_API_URL=https://quyhoach-api.vercel.app
Vercel quyhoach-citizen → EXPO_PUBLIC_BACKEND_URL=https://quyhoach-api.vercel.app
```

---

## Dữ liệu demo GIS

- File tĩnh: `web/public/data/planning_zones_demo.geojson`
- Mongo (sau seed): collections `planning_zones`, `observed_buildings` (và `violations` nếu seed cũ — không còn UI)

Restart backend một lần để `seed_planning_data()` chạy khi DB trống.

---

## Scripts deploy (thư mục `scripts/`)

| Script | Mục đích |
|--------|----------|
| `vercel-backend-deploy.ps1` | Deploy API lên Vercel + cập nhật env 3 project |
| `vercel-only.ps1` | Chỉ cập nhật `VITE_API_URL` / `EXPO_PUBLIC_BACKEND_URL` và redeploy |
| `push-github.ps1` | Đẩy repo lên GitHub |
| `verify-production.ps1` | Kiểm tra `/health` API production |

Tùy chọn: [`backend/Dockerfile`](backend/Dockerfile) để chạy API trong container thủ công (không bắt buộc khi dùng Vercel).
