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
| [docs/HUONG-DAN-TONG-QUAN.html](docs/HUONG-DAN-TONG-QUAN.html) | Hướng dẫn tổng quan: 4 vai trò, luồng 16 bước, khung phạt |
| [docs/HUONG-DAN-NGUOI-DAN.html](docs/HUONG-DAN-NGUOI-DAN.html) | Hướng dẫn Người dân (app) |
| [docs/HUONG-DAN-CAN-BO-XU-LY.html](docs/HUONG-DAN-CAN-BO-XU-LY.html) | Hướng dẫn Cán bộ Xử lý (app, hiện trường) |
| [docs/HUONG-DAN-CAN-BO-QUAN-LY.html](docs/HUONG-DAN-CAN-BO-QUAN-LY.html) | Hướng dẫn Cán bộ Quản lý (web quản trị) |
| [docs/SO-TAY-QUAN-TRI.html](docs/SO-TAY-QUAN-TRI.html) | Sổ tay quản trị: nạp dữ liệu, đợt bay, triển khai |

## Production

| Thành phần | URL |
|------------|-----|
| App công dân | https://quyhoach-citizen.vercel.app |
| Web quản trị | https://quyhoach-web.vercel.app |
| API | https://quyhoach-api.vercel.app |

Tài khoản demo: `citizen@quyhoach.vn` / `Citizen@123`, `manager@quyhoach.vn` / `Manager@123`, `admin@quyhoach.vn` / `Admin@123`.
