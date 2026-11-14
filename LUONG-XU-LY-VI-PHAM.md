# Luồng xử lý vi phạm trật tự xây dựng

Mỗi phản ánh của người dân và mỗi cảnh báo AI được mở thành một **Hồ sơ vụ việc** (`HS-2026-0001`…). Hồ sơ đi qua 16 bước, chia 4 giai đoạn. Mọi bước được ghi vào dòng thời gian của hồ sơ, không ghi đè.

Code: `backend/case_flow.py` (máy trạng thái, danh mục vi phạm, khung phạt) và `backend/routers/cases.py` (API `/api/cases`).

## Vai trò

| Vai trò trong nghiệp vụ | Mã trong hệ thống | Làm ở đâu |
| --- | --- | --- |
| Người dân (người phản ánh / người vi phạm) | `citizen` | App |
| Hệ thống AI | dữ liệu `violations` từ đợt bay flycam | Tự động |
| Cán bộ Quản lý | `admin` | Web quản trị và app |
| Cán bộ Xử lý | `manager` | App (tại hiện trường) |

Người vi phạm được nhập trong biên bản. Nếu số điện thoại trùng với một tài khoản người dân, người đó nhận quyết định trên app và tự gửi báo cáo khắc phục. Nếu không, cán bộ nhập thay.

## 16 bước

| Giai đoạn | Bước | Ai | Trạng thái hồ sơ sau bước |
| --- | --- | --- | --- |
| 1. Phát hiện và Tiền kiểm | 1. Gửi phản ánh vi phạm | Người dân | `tiep_nhan` |
| | 2. Gửi cảnh báo điểm nghi ngờ ("Mở hồ sơ tiền kiểm" từ trang Nghi vấn) | AI → Cán bộ Quản lý | `tiep_nhan` |
| | 3. Tiền kiểm online: thửa, quy hoạch, giấy phép, hồ sơ trùng thửa | Cán bộ Quản lý | `da_tien_kiem` |
| | 4. Không vi phạm → đóng | Cán bộ Quản lý | `khong_vi_pham` (kết thúc) |
| | 5. Lập phiếu giao việc (chọn cán bộ, hạn) | Cán bộ Quản lý | `da_giao_viec` |
| 2. Kiểm tra thực địa và Lập biên bản | 6. Nhận việc, đến hiện trường | Cán bộ Xử lý | `dang_kiem_tra` |
| | 7. Thu thập bằng chứng (ảnh) | Cán bộ Xử lý | `dang_kiem_tra` |
| | 8. Lập biên bản, yêu cầu chấm dứt hành vi, gửi hồ sơ | Cán bộ Xử lý | `cho_quyet_dinh` |
| 3. Ban hành quyết định và Xử lý | 9. Rà soát, áp dụng mức phạt (hoặc trả lại bổ sung) | Cán bộ Quản lý | `cho_quyet_dinh` / `dang_kiem_tra` |
| | 10. Ban hành quyết định xử phạt, yêu cầu khắc phục | Cán bộ Quản lý | `cho_khac_phuc` hoặc `cho_cap_phep` |
| | 11. Nộp phạt, thực hiện khắc phục | Người vi phạm | |
| | 12. Báo cáo kết quả khắc phục | Người vi phạm (hoặc cán bộ nhập thay) | `da_bao_cao_khac_phuc` |
| 4. Hậu kiểm và Đóng hồ sơ | 13. Yêu cầu xác minh hiện trạng | Cán bộ Quản lý | `cho_hau_kiem` |
| | 14–15. Hậu kiểm thực địa, trả kết quả | Cán bộ Xử lý | `hau_kiem_dat`, hoặc `cho_khac_phuc` nếu không đạt |
| | 16. Đóng hồ sơ lưu trữ | Cán bộ Quản lý | `da_dong` |

**Nhánh Điều 85** áp dụng cho Case 1 và 2 khi công trình còn đang thi công. Sau quyết định, hồ sơ chuyển sang `cho_cap_phep`:
- Người vi phạm có 35 ngày (nhà ở riêng lẻ) hoặc 120 ngày (công trình phải lập BCKTKT/BCNCKT) để được cấp hoặc điều chỉnh giấy phép.
- Có giấy phép: cán bộ kiểm tra hiện trạng trong 5 ngày. Phù hợp thì đạt; không phù hợp thì buộc phá dỡ trong 15 ngày.
- Hết hạn hoặc không được cấp: buộc tự phá dỡ trong 15 ngày.

**Case 5:** cán bộ bấm "Vẫn tiếp tục thi công" sau khi đã lập biên bản.
- Trước khi có quyết định: hồ sơ chuyển sang hành vi `TIEP_TUC_SAU_BIEN_BAN` (khoản 11).
- Sau khi đã có quyết định: ghi nhận theo khoản 12.

## 5 trường hợp vi phạm (Điều 25 NĐ 339/2026/NĐ-CP)

Khung phạt dưới đây là mức áp dụng cho **tổ chức**, đơn vị triệu đồng. **Cá nhân bị phạt bằng một nửa** (Điều 4 khoản 4).

Cột loại công trình:
- a: nhà ở riêng lẻ;
- b: nhà ở riêng lẻ trong khu vực bảo vệ di tích, di sản hoặc công trình khác;
- c: công trình phải lập Báo cáo kinh tế - kỹ thuật;
- d: công trình phải lập Báo cáo nghiên cứu khả thi.

| Mã | Hành vi | a | b | c | d | Khắc phục | Căn cứ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `KHONG_PHEP` | Xây dựng không có giấy phép | 60–80 | 80–100 | 120–140 | 140–160 | Xin cấp phép (Điều 85) hoặc phá dỡ | k7, k14 |
| `SAI_PHEP` | Sai nội dung giấy phép | 30–40 | 50–70 | 100–120 | 120–140 | Xin điều chỉnh phép (Điều 85) hoặc phá dỡ phần sai | k6, k14 |
| `SAI_QUY_HOACH` | Không đúng quy hoạch | 80–100 | 100–120 | 160–180 | 180–200 | Buộc phá dỡ | k9, k14 |
| `LAN_CHIEM` | Cơi nới, lấn chiếm | 80–100 | 100–120 | 180–200 | 200–220 | Buộc phá dỡ phần vi phạm | k10, k14 |
| `TIEP_TUC_SAU_BIEN_BAN` | Tiếp tục sau khi đã lập biên bản | 60–80 | 80–100 | 400–500 | 500–600 | Theo hành vi gốc. Bổ sung: tước giấy phép xây dựng 3–12 tháng, tịch thu tang vật | k11, k13, k14 |

Hành vi tái phạm sau khi đã bị xử phạt (khoản 12) có khung riêng: a 80–100, b 100–120, c 400–800, d 800–1.000.

**Thẩm quyền:** Chủ tịch UBND cấp xã được phạt tới 500 triệu đồng với tổ chức, tức 250 triệu với cá nhân (Điều 79). Phần mềm cảnh báo khi mức phạt vượt ngưỡng này.

**Gợi ý từ cảnh báo AI** (Cán bộ Quản lý xác nhận ở bước tiền kiểm):

| Luật AI | Case gợi ý |
| --- | --- |
| `SAI_MDSD` | `SAI_QUY_HOACH` |
| `LAN_RANH` | `LAN_CHIEM` |
| `NHA_MOI` | `KHONG_PHEP`; thành `SAI_PHEP` nếu thửa đã có giấy phép |

> Khung phạt là gợi ý theo Nghị định 339/2026/NĐ-CP. Người có thẩm quyền quyết định mức cụ thể sau khi đối chiếu văn bản gốc và tình tiết vụ việc.

## Dữ liệu dùng cho tiền kiểm

| Dữ liệu | Nguồn | Số lượng | Script nạp |
| --- | --- | --- | --- |
| Thửa đất nền địa chính | `Sở TNMT\BD_NenDiaChinh\GeoDatabase\20250808_BanDoNenDiaChinh.gdb` lớp `ThuaDat` | 269.822 | `scripts/import_cadastre_mongo.py <gdb> ThuaDat` |
| Thửa đất nội thị TP. Cao Lãnh | `Sở TNMT\QHSDD_tpCaoLanh\GeoDatabase\TPCaoLanh.gdb` lớp `ThuaDat_TNMT_DC` | 61.782 (chỉ các phường chưa có) | `scripts/import_cadastre_mongo.py <gdb> ThuaDat_TNMT_DC --append` |
| Quy hoạch sử dụng đất (năm 2030) | cùng file, lớp `SuDungDat_TNMT_QH` | 11.293 vùng | `scripts/import_planning_zones.py <gdb>` |
| Giấy phép xây dựng | **dữ liệu mẫu** (`is_demo: true`) gắn trên thửa thật | 30 | `scripts/seed_demo_permits.py` |

Ba script đọc GDB cần GDAL, nên chạy bằng Python của QGIS: `"C:\Program Files\QGIS 4.0.3in\python-qgis.bat" scripts\...`. Script giấy phép chạy bằng `backendenv\Scripts\python`. Tất cả đọc `MONGO_URL` trong `backend/.env`.

Tiền kiểm so sánh **mục đích sử dụng theo quy hoạch** tại vị trí với loại đất hiện trạng của thửa, rồi gợi ý hành vi:
- vị trí không thuộc quy hoạch đất ở (ODT/ONT): Case 3;
- thuộc đất ở và thửa đã có giấy phép: Case 2;
- thuộc đất ở, chưa có giấy phép: Case 1.

Khi có dữ liệu giấy phép thật: xoá giấy phép mẫu bằng `db.permits.deleteMany({is_demo: true})`, rồi nạp dữ liệu thật với các trường `permit_no`, `so_to`, `so_thua`, `owner_name`, `address`, `issued_date`, `area_m2`, `floors`.

## Đợt bay flycam
Chưa có đợt bay thật. Trên web quản trị, mục **Đợt bay** → **Đăng ký đợt bay (bổ sung ảnh sau)** tạo một đợt ở trạng thái "Chờ ảnh". Ảnh trực giao (GeoTIFF, thường nặng hàng GB) được bổ sung sau trên **máy trạm AI**:
1. Chạy `docker compose up` gồm PostGIS và `services/detection`.
2. Mở web quản trị trỏ vào API trên máy trạm.
3. Bấm "Bổ sung ảnh" ở đợt bay đó. AI xử lý xong sẽ tạo nghi vấn ở trang **Nghi vấn AI**.

Bản online không nhận tải file ảnh trực giao.

## Chuyển dữ liệu cũ
`backend\venv\Scripts\python scripts\migrate_reports_to_cases.py` mở hồ sơ cho các báo cáo cũ chưa có hồ sơ. Chạy lại nhiều lần cũng an toàn.
