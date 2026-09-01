# Hướng dẫn Web App quản trị (Vite)

Web app riêng cho **cán bộ quản lý**: bản đồ quy hoạch, nghi vấn vi phạm, duyệt báo cáo. Dùng chung API FastAPI và MongoDB với app mobile Expo.

---

## Local vs Production (đọc trước)

| | **Local (dev trên PC)** | **Production (link online)** |
|--|-------------------------|------------------------------|
| Khi nào dùng | Sửa code, test trên máy | Demo khách, iPhone 4G, không cần PC bật |
| MongoDB | `mongod.exe` local **hoặc** Atlas | **MongoDB Atlas** — `MONGO_URL` trên Render |
| Backend API | `http://localhost:8000` | Render (ví dụ `https://quyhoach-api.onrender.com`) — Railway cũ đang 404 |
| Web admin | `http://localhost:5173` | `https://quyhoach-web.vercel.app` |
| App công dân | Expo / emulator | `https://quyhoach-citizen.vercel.app` |
| Cần terminal bật? | **Có** | **Không** |

Mục **LOCAL** bên dưới **không** áp dụng cho link Vercel/Railway online. Xem [HUONG-DAN-CHAY-DU-AN.md](HUONG-DAN-CHAY-DU-AN.md) cho mobile local vs demo remote.

---

## Cấu trúc

```
web/                 # Vite + React + MapLibre — web quản trị (admin)
frontend/            # Expo — app công dân (web export trên Vercel)
backend/             # FastAPI (port 8000)
```

---

## LOCAL — Chạy trên máy dev (không dùng cho Vercel/Railway online)

> **Chỉ khi sửa code trên PC.** Link production (`quyhoach-*.vercel.app`) **không** cần bật MongoDB/backend local.

**Terminal 1 — MongoDB** (chỉ dev local; production dùng MongoDB cloud trên Railway/Atlas):

```powershell
cd D:\mongodb-win32-x86_64-windows-8.3.2\bin
.\mongod.exe --dbpath D:\mongodb-win32-x86_64-windows-8.3.2\bin\DB
```

**Terminal 2 — Backend API:**

```powershell
cd c:\Users\kimli\Downloads\Mobile_app_for_planning-main\backend
.\venv\Scripts\Activate.ps1
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 3 — Web:**

```powershell
cd c:\Users\kimli\Downloads\Mobile_app_for_planning-main\web
copy .env.example .env
npm install
npm run dev
```

Mở trình duyệt: http://localhost:5173

### Đăng nhập admin

| Email | Mật khẩu |
|-------|----------|
| `admin@quyhoach.vn` | `Admin@123` |

---

## Biến môi trường (local)

| File | Biến | Mô tả |
|------|------|--------|
| `web/.env` | `VITE_API_URL` | URL backend, ví dụ `http://localhost:8000` |
| `web/.env` | `VITE_GIS_ZONES_URL` | (Tùy chọn) URL GeoJSON; mặc định `/data/planning_zones_demo.geojson` |
| `backend/.env` | `MONGO_URL`, `DB_NAME`, `JWT_SECRET` | Database và JWT |
| `backend/.env` | `CORS_ORIGINS` | `http://localhost:5173` hoặc `*` khi dev |

---

## API web sử dụng

- `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/admin/stats`
- `GET /api/reports`, `PUT /api/reports/{id}`
- `GET /api/planning/zones`, `GET /api/planning/buildings`
- (API `GET /api/violations` còn trên backend; đã gỡ khỏi UI web admin)

---

## PRODUCTION — Deploy online (Vercel + Railway)

Khách/cán bộ truy cập web qua internet, **không cần cùng WiFi** với máy dev.

```mermaid
flowchart LR
  UserAdmin["Admin browser"]
  UserCitizen["Citizen browser"]
  VercelWeb["Vercel web/"]
  VercelFrontend["Vercel frontend/"]
  Railway["Railway API"]
  MongoCloud["MongoDB Railway hoac Atlas"]

  UserAdmin --> VercelWeb
  UserCitizen --> VercelFrontend
  VercelWeb --> Railway
  VercelFrontend --> Railway
  Railway --> MongoCloud
```

| Thành phần | Host | URL production |
|------------|------|----------------|
| MongoDB | MongoDB Railway (trong project) **hoặc** [MongoDB Atlas M0](https://www.mongodb.com/cloud/atlas/register) | `MONGO_URL` trên service `quyhoach-api` |
| API | [Railway](https://railway.com) — [`backend/Dockerfile`](backend/Dockerfile), Root Directory `backend` | `https://quyhoach-api-production.up.railway.app` |
| Web quản trị | [Vercel](https://vercel.com) — thư mục `web/` | `https://quyhoach-web.vercel.app` |
| App công dân (web) | [Vercel](https://vercel.com) — thư mục `frontend/` | `https://quyhoach-citizen.vercel.app` |

Demo công dân trên iPhone: xem [HUONG-DAN-CHAY-DU-AN.md](HUONG-DAN-CHAY-DU-AN.md) (mục demo remote).

---

### Bước 0 — Đẩy code lên GitHub

Repo đã có git local. Tạo repo mới trên https://github.com/new rồi chạy:

```powershell
cd c:\Users\kimli\Downloads\Mobile_app_for_planning-main
.\scripts\push-github.ps1 -GitHubUser "<user>" -RepoName "Mobile_app_for_planning"
```

Hoặc thủ công:

```powershell
git remote add origin https://github.com/<user>/<repo>.git
git branch -M main
git push -u origin main
```

# Khong commit file .env. Chi dung .env.example / render.yaml.
# Wizard: powershell -ExecutionPolicy Bypass -File .\scripts\self-deploy.ps1

**Lưu ý:** `backend/requirements.txt` đã bỏ `emergentintegrations` (không có trên PyPI) — web admin deploy bình thường; tính năng AI compare trên mobile cần cài package riêng khi dev local.

---

### Bước 1 — MongoDB (Railway hoặc Atlas)

**Khuyên dùng:** thêm service **MongoDB** trong cùng Railway project → biến `MONGO_URL` = `${{MongoDB.MONGO_URL}}` (reference).

**Hoặc MongoDB Atlas:**

1. Đăng ký [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register).
2. **Create deployment** → chọn **M0 FREE**, region **Singapore (`ap-southeast-1`)**.
3. **Database Access** → Add user (username + password mạnh) → lưu lại.
4. **Network Access** → **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`).
5. **Database** → **Connect** → **Drivers** → copy connection string:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Thay `<password>` bằng mật khẩu thật (URL-encode ký tự đặc biệt nếu có).
7. Tên database: **`quyhoach`** (khớp `DB_NAME`).

Backend tự **seed** user admin và dữ liệu demo khi DB trống. Đăng nhập: `admin@quyhoach.vn` / `Admin@123`.

---

### Bước 2 — Deploy Backend (Railway)

1. [railway.com](https://railway.com) → **New Project** → **Deploy from GitHub repo** → chọn repo.
2. Service **quyhoach-api** — cấu hình Source (**bắt buộc** — tránh lỗi `railpack process exited`):

| Mục | Giá trị |
|-----|---------|
| Root Directory | **`backend`** (không để trống / repo root) |
| Builder | **Dockerfile** |
| Dockerfile | [`backend/Dockerfile`](backend/Dockerfile) |

Repo có [`backend/railway.toml`](backend/railway.toml) cố định builder Dockerfile (chỉ có hiệu lực khi Root Directory = `backend`).

**Lỗi thường gặp:** Root Directory = `.` → Railpack build cả monorepo → fail. Service vẫn **Online** vì bản deploy cũ chưa bị thay.

**Lưu ý:** [`Dockerfile`](Dockerfile) ở thư mục gốc dùng cho Fly.io / build từ repo root — **không** dùng cho Railway service `quyhoach-api`.

3. **Environment Variables** (service `quyhoach-api`):

| Biến | Giá trị |
|------|---------|
| `MONGO_URL` | Connection string MongoDB Railway hoặc Atlas (bước 1) |
| `DB_NAME` | `quyhoach` |
| `JWT_SECRET` | Chuỗi ngẫu nhiên 32+ ký tự (khác `dev-secret-change-me`) |
| `CORS_ORIGINS` | `https://quyhoach-web.vercel.app,https://quyhoach-citizen.vercel.app` |

4. Deploy → lấy URL public, ví dụ `https://quyhoach-api-production.up.railway.app`.
5. Kiểm tra: mở `https://<url>/api/` → `{"app":"QuyHoạch AI","ok":true}`.

Thêm domain Vercel mới → cập nhật `CORS_ORIGINS` trên Railway rồi redeploy API.

---

### Bước 3 — Deploy Web quản trị (Vercel)

**Project:** `quyhoach-web` — root [`web/`](web/), cấu hình trong [`web/vercel.json`](web/vercel.json).

1. [vercel.com](https://vercel.com) → **Add New Project** → import GitHub repo (hoặc deploy CLI).
2. Cấu hình:

| Mục | Giá trị |
|-----|---------|
| Root Directory | `web` |
| Framework | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |

3. **Environment Variable:**

| Biến | Giá trị |
|------|---------|
| `VITE_API_URL` | `https://quyhoach-api-production.up.railway.app` (URL Railway, **không** có `/api`) |

4. Deploy → URL `https://quyhoach-web.vercel.app`.

Deploy lại thủ công:

```powershell
cd c:\Users\kimli\Downloads\Mobile_app_for_planning-main\web
vercel deploy --prod
```

---

### Bước 3b — Deploy App công dân web (Vercel)

**Project:** `quyhoach-citizen` — root [`frontend/`](frontend/), cấu hình trong [`frontend/vercel.json`](frontend/vercel.json).

| Mục | Giá trị |
|-----|---------|
| Root Directory | `frontend` |
| Build Command | `npm run build:web` |
| Output Directory | `dist` |

**Environment Variable:**

| Biến | Giá trị |
|------|---------|
| `EXPO_PUBLIC_BACKEND_URL` | `https://quyhoach-api-production.up.railway.app` |

Deploy → URL `https://quyhoach-citizen.vercel.app`. Chi tiết demo iPhone: [HUONG-DAN-CHAY-DU-AN.md](HUONG-DAN-CHAY-DU-AN.md).

```powershell
cd c:\Users\kimli\Downloads\Mobile_app_for_planning-main\frontend
vercel deploy --prod
```

---

### Bước 4 — Kiểm tra truy cập từ xa

1. Mở URL Vercel trên điện thoại **4G/5G** (tắt WiFi):
   - Admin: `https://quyhoach-web.vercel.app`
   - Công dân: `https://quyhoach-citizen.vercel.app`
2. Hoặc nhờ người khác (mạng khác) mở cùng URL.
3. Đăng nhập admin: `admin@quyhoach.vn` / `Admin@123`; công dân: `citizen@quyhoach.vn` / `Citizen@123`.
4. Nếu lỗi CORS → kiểm tra `CORS_ORIGINS` trên Railway có đủ cả hai domain Vercel.

---

### Biến môi trường production (tóm tắt)

```
MongoDB (Railway/Atlas) → MONGO_URL, DB_NAME=quyhoach
Railway (backend)       → MONGO_URL, DB_NAME, JWT_SECRET, CORS_ORIGINS
Vercel (web admin)      → VITE_API_URL=https://quyhoach-api-production.up.railway.app
Vercel (citizen)        → EXPO_PUBLIC_BACKEND_URL=https://quyhoach-api-production.up.railway.app
```

---

### Bật lại web production — Render (API) + Atlas + Vercel

Railway `quyhoach-api-production.up.railway.app` đang **404** (`x-railway-fallback`). Dùng Render thay thế.

#### A. MongoDB Atlas

1. [mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register) → Create → **M0 FREE**, region **Singapore (`ap-southeast-1`)**.
2. **Database Access** → Add user (username + password) → lưu lại.
3. **Network Access** → **Allow Access from Anywhere** (`0.0.0.0/0`).
4. **Connect** → Drivers → connection string, thêm database `quyhoach`:

```
mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/quyhoach?retryWrites=true&w=majority
```

URL-encode ký tự đặc biệt trong password (`@` → `%40`, `#` → `%23`).

#### B. GitHub

Đẩy repo lên GitHub (Render đọc từ GitHub). Root phải chứa [`render.yaml`](render.yaml).

#### C. Render Web Service

1. [render.com](https://render.com) → **New** → **Blueprint** (file `render.yaml`) **hoặc** **Web Service** thủ công:

| Mục | Giá trị |
|-----|---------|
| Root Directory | `backend` |
| Runtime | Python |
| Build | `pip install -r requirements.txt` |
| Start | `uvicorn server:app --host 0.0.0.0 --port $PORT` |
| Health Check | `/health` |
| Region | Singapore |

2. Environment:

| Biến | Giá trị |
|------|---------|
| `MONGO_URL` | chuỗi Atlas ở bước A |
| `DB_NAME` | `quyhoach` |
| `JWT_SECRET` | chuỗi ngẫu nhiên 32+ ký tự |
| `CORS_ORIGINS` | `https://quyhoach-web.vercel.app,https://quyhoach-citizen.vercel.app` |

(`CORS_ORIGINS` và `DB_NAME` đã có trong [`render.yaml`](render.yaml); `MONGO_URL` phải dán tay.)

3. Deploy xong, URL dạng `https://quyhoach-api.onrender.com`.
4. Kiểm tra: `GET https://<host>/health` và `GET https://<host>/api/` → `{"app":"QuyHoạch AI","ok":true}`.

**Lưu ý:** Free tier **ngủ ~15 phút**; lần mở đầu chậm 30–60 giây.

#### D. Vercel — trỏ API mới rồi Redeploy

| Project | Biến | Giá trị |
|---------|------|---------|
| `quyhoach-citizen` | `EXPO_PUBLIC_BACKEND_URL` | `https://<host-render>` (không có `/api`) |
| `quyhoach-web` | `VITE_API_URL` | `https://<host-render>` |

Settings → Environment Variables → Save → **Deployments → Redeploy** (bắt buộc: biến bake lúc build).

Đăng nhập: `citizen@quyhoach.vn` / `Citizen@123` (citizen) và `admin@quyhoach.vn` / `Admin@123` (admin).

---

### Nâng cấp — Fly.io (API luôn online)

Nếu có thẻ tín dụng và cần host API khác Railway:

| Thành phần | Host |
|------------|------|
| MongoDB | MongoDB Atlas |
| API | Fly.io — deploy `backend/` (dùng [`Dockerfile`](Dockerfile)) |
| Web | Vercel |

Set secrets Fly: `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `CORS_ORIGINS=https://quyhoach-web.vercel.app,https://quyhoach-citizen.vercel.app`

Web Vercel: `VITE_API_URL` và `EXPO_PUBLIC_BACKEND_URL` cùng URL API production.

---

## Dữ liệu demo GIS

- File tĩnh: `web/public/data/planning_zones_demo.geojson`
- Mongo (sau seed): collections `planning_zones`, `observed_buildings` (và `violations` nếu seed cũ — không còn UI)

Restart backend một lần để `seed_planning_data()` chạy khi DB trống.
