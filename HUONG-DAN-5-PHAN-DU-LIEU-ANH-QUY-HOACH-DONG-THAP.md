# Huong Dan 5 Phan: Du Lieu Anh Thuc Te + Quy Hoach (Dong Thap)

Tai lieu nay duoc viet de lam dau vao cho AI/agent, theo dung huong:
- Anh thuc te do phan giai cao, uu tien nguon "mo" va he sinh thai Google.
- Du lieu quy hoach nha nuoc, co mau vector GIS de demo truoc.

---

## 1) Nguon du lieu anh thuc te do phan giai cao cho khu vuc A (Dong Thap)

### 1.1. Chot ky vong ky thuat truoc khi lay du lieu
- Neu muc tieu la "phat hien nha lech quy hoach theo tung can", anh can do phan giai rat cao.
- Moc khuyen nghi:
  - > 3m/pixel: chi danh gia tong quan.
  - 0.5m-1m/pixel: thay cum cong trinh, kho tach tung mai nha.
  - 0.3m/pixel hoac tot hon: kha thi cho bai toan footprint tung nha.

### 1.2. Su dung Google Maps/Google Earth dung cach
- Google Maps/Earth rat tot de:
  - khoanh khu vuc A,
  - xac dinh toa do, ranh gioi,
  - doi chieu truc quan.
- Nhung can luu y:
  - khong nen coi la nguon "thu thap hang loat anh de huan luyen/phan tich tu dong" neu chua kiem tra dieu khoan su dung (ToS/license).
  - demo noi bo co the dung de minh hoa, nhung ban pham san xuat nen dung nguon co license ro rang.

### 1.3. Huong mo + kha thi de demo nhanh
- **Google Earth Engine (GEE)**:
  - Sentinel-2 (10m), Landsat (30m): mien phi, de truy cap.
  - Phu hop demo pipeline du lieu, khong phu hop ket luan tung can nha.
- **OpenAerialMap / orthophoto dia phuong (neu co cong bo)**:
  - thuong co do phan giai tot hon Sentinel.
- **Dron/UAV noi bo** (neu co nguon):
  - phu hop nhat cho demo "nha lech quy hoach" cap do chi tiet.

### 1.4. De xuat cho bai toan Dong Thap (thuc dung)
- Buoc 1: dung Google Earth de khoanh khu vuc A (bbox/polygon), xac dinh toa do.
- Buoc 2: dung GEE lay anh open de dung pipeline va georeference.
- Buoc 3 (nang cap chat luong): bo sung 1 khu nho co anh do phan giai cao hon (UAV/orthophoto) de demo detect nha.

---

## 2) Nguon du lieu quy hoach nha nuoc + mau vector GIS de demo

### 2.1. Dinh dang du lieu quy hoach nen co
- Uu tien:
  - GeoJSON
  - Shapefile (SHP/DBF/SHX/PRJ)
  - GeoPackage (GPKG)
  - WMS/WFS service
- Han che dung PDF scan lam dau vao chinh (chi dung tham chieu), vi can georeference lai.

### 2.2. Lop du lieu toi thieu cho demo
- `planning_zones` (vung quy hoach): dat o, giao thong, cay xanh, cong cong...
- `road_corridor` (hanh lang/chi gioi), neu co.
- `parcel` (thua dat), neu xin duoc.
- `admin_boundary` (ranh xa/huyen) de cat khu vuc A.

### 2.3. Bo thuoc tinh (attribute) mau khuyen nghi
- `zone_code`: ma khu chuc nang.
- `zone_name`: ten chuc nang dat.
- `allow_build`: co/khong cho phep xay dung.
- `max_floor`: tang cao toi da (neu co).
- `max_density`: mat do toi da (neu co).
- `legal_doc`: ma van ban phap ly lien quan.
- `updated_at`: ngay cap nhat.

### 2.4. Mau GeoJSON toi gian de demo
```json
{
  "type": "FeatureCollection",
  "name": "planning_zones_demo",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "zone_code": "ODT",
        "zone_name": "Dat o do thi",
        "allow_build": true,
        "max_floor": 5,
        "max_density": 70,
        "legal_doc": "QD-XX-2024",
        "updated_at": "2026-01-15"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[105.6400, 10.4700], [105.6460, 10.4700], [105.6460, 10.4740], [105.6400, 10.4740], [105.6400, 10.4700]]]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "zone_code": "DGT",
        "zone_name": "Dat giao thong",
        "allow_build": false,
        "max_floor": 0,
        "max_density": 0,
        "legal_doc": "QD-XX-2024",
        "updated_at": "2026-01-15"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[105.6425, 10.4708], [105.6435, 10.4708], [105.6435, 10.4740], [105.6425, 10.4740], [105.6425, 10.4708]]]
      }
    }
  ]
}
```

### 2.5. Cach xin du lieu tu So Quy Hoach de dung trong demo
- Xin it nhat 1 khu mau (phuong/xa) voi:
  - lop vung quy hoach co toa do geospatial,
  - thong tin van ban phap ly di kem.
- De nghi So cung cap:
  - CRS goc du lieu (VD: EPSG:4326 hoac VN-2000),
  - ngay cap nhat va co che cap nhat.

---

## 3) Chuan hoa du lieu GIS truoc khi so sanh

### 3.1. Chuan he toa do
- Dua tat ca ve cung 1 CRS (khuyen nghi ban dau: EPSG:4326 de demo web map).
- Neu tinh toan dien tich/chieu dai chinh xac, chuyen sang CRS phu hop khu vuc.

### 3.2. Cat khu vuc A
- Input tu Google Earth (polygon khu vuc A).
- Clip tat ca lop (anh, quy hoach, footprint) theo A de giam tai va dung pham vi.

### 3.3. Kiem tra chat luong du lieu
- Topology: polygon khong tu cat, khong overlap bat hop ly.
- Attribute: khong null o cot quan trong (`zone_code`, `allow_build`...).
- Timestamp: danh dau nguon va thoi diem du lieu de truy vet.

### 3.4. Quan ly phien ban du lieu
- Moi lan cap nhat du lieu, luu theo version:
  - `planning_zones_v1`, `planning_zones_v2`...
- Giu metadata:
  - nguon,
  - ngay nhan,
  - nguoi xu ly,
  - quy tac clean.

---

## 4) So sanh 2 ban do va AI canh bao nha lech quy hoach

### 4.1. Doi tuong so sanh
- `Footprint hien trang` (tu anh thuc te, do model CV trich xuat).
- `Zone quy hoach` (vector nha nuoc).

### 4.2. Rule engine de gan co (khong chi prompt AI)
- Rule 1: Footprint nam trong zone `allow_build = false` -> `violation_high`.
- Rule 2: Footprint cat hanh lang giao thong -> `violation_high`.
- Rule 3: Footprint nam ngoai vung quy hoach hop le -> `violation_medium`.
- Rule 4: Du lieu khong du tin cay (anh mo, cloud cao...) -> `needs_review`.

### 4.3. Vai tro AI trong bai toan nay
- AI/CV:
  - segment footprint nha,
  - tinh confidence.
- GIS rules:
  - quyet dinh nghiep vu "lech quy hoach" dua tren overlay + quy tac.
- Human review:
  - can bo duyet ket qua nghi van truoc khi ket luan.

### 4.4. Dau ra de demo
- Ban do:
  - lop quy hoach + footprint + diem nghi van.
- Bang ket qua:
  - `id`, `toa do`, `ly do`, `muc do`, `confidence`, `anh cat`.
- Bao cao nhanh:
  - tong so doi tuong nghi van theo khu vuc A.

---

## 5) Lo trinh demo 4-6 tuan (goi y thuc thi)

### Tuan 1: Data foundation
- Chot khu vuc A o Dong Thap.
- Lay anh open (GEE) + tao bo vector GIS mau (hoac lay tu So).
- Chuan hoa CRS + clip theo A.

### Tuan 2: API va luu tru
- Tao collection:
  - `planning_zones`
  - `observed_buildings`
  - `violations`
- Tao API:
  - list zones,
  - upload/refresh observed footprint,
  - list violation.

### Tuan 3: Overlay rule engine
- Viet rule GIS 1-4.
- Sinh danh sach vi pham nghi van + score.

### Tuan 4: Giao dien ban do
- Hien 2 lop chong nhau.
- Cho phep bam tung diem de xem ly do vi pham.

### Tuan 5-6: AI/CV nang cap
- Tich hop model tach footprint nha (tu anh do phan giai cao hon).
- Them dashboard thong ke va workflow duyet.

### Checklist ket qua demo dat yeu cau
- [ ] Co khu vuc A va du lieu quy hoach vector.
- [ ] Co map overlay quy hoach vs hien trang.
- [ ] Co danh sach nha/cum nha nghi lech quy hoach.
- [ ] Co ly do canh bao minh bach theo rule.
- [ ] Co co che "can bo xac nhan" thay vi ket luan tu dong.

---

## Luu y phap ly va van hanh
- Luon xac nhan license truoc khi dung anh tu nguon Google vao pipeline phan tich tu dong.
- Du lieu quy hoach chi co gia tri khi kem van ban phap ly va phien ban cap nhat.
- He thong AI nen la cong cu "canh bao som", khong thay the ket luan quan ly nha nuoc.
