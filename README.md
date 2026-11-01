# QuyHoạch AI

Hệ thống quản lý quy hoạch và trật tự xây dựng: app công dân (Expo), web quản trị (Vite), API FastAPI + MongoDB.

## Cấu trúc

| Thư mục | Mô tả |
|---------|--------|
| `backend/` | FastAPI — API port 8000 (local) / Vercel production |
| `frontend/` | Expo — app công dân (mobile + web export) |
| `web/` | Vite + React — web quản trị admin |
| `docs/` | Hướng dẫn sử dụng HTML (in PDF cho người dùng) |
| `scripts/` | Deploy Vercel, push GitHub, kiểm tra production |

## Hướng dẫn

| Tài liệu | Dùng khi |
|----------|----------|
| [HUONG-DAN-CHAY-DU-AN.md](HUONG-DAN-CHAY-DU-AN.md) | Demo online, local, Expo Go, Android Emulator |
| [HUONG-DAN-WEB.md](HUONG-DAN-WEB.md) | Web admin local + deploy Vercel + Atlas |
| [docs/HUONG-DAN-TONG-QUAN.html](docs/HUONG-DAN-TONG-QUAN.html) | Hướng dẫn tổng quan (mục lục theo vai trò) |

## Production

| Thành phần | URL |
|------------|-----|
| App công dân | https://quyhoach-citizen.vercel.app |
| Web quản trị | https://quyhoach-web.vercel.app |
| API | https://quyhoach-api.vercel.app |

Tài khoản demo: `citizen@quyhoach.vn` / `Citizen@123`, `manager@quyhoach.vn` / `Manager@123`, `admin@quyhoach.vn` / `Admin@123`.
