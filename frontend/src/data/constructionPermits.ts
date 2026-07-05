export type ConstructionPermit = {
  id: string;
  title: string;
  permitCode: string;
  permitDate: string;
  investor: string;
  address: string;
  district: string;
  projectType?: string;
  status?: string;
  note?: string;
};

export const constructionPermits: ConstructionPermit[] = [
  {
    id: "1",
    title: "02 căn biệt thự thuộc DA Khu nhà ở Cty Thành Phúc",
    permitCode: "43/PLGPXD",
    permitDate: "22/4/2020",
    investor: "Cty TNHH ĐT Thành Phúc",
    address: "P.Phú Hữu, Q.9",
    district: "Quận 9",
    projectType: "Biệt thự",
    status: "Đã cấp phép",
    note: "Giấy phép xây dựng 02 căn biệt thự trong dự án khu nhà ở.",
  },
  {
    id: "2",
    title: "Bệnh viện Hoàn Mỹ phía Tây",
    permitCode: "38/GPXD",
    permitDate: "10/4/2020",
    investor: "Cty CP Bệnh viện Hoàn Mỹ phía Tây",
    address: "512 Lê Trọng Tấn, P.Tây Thạnh, Q.Tân Phú",
    district: "Quận Tân Phú",
    projectType: "Công trình y tế",
    status: "Đã cấp phép",
    note: "Xây dựng bệnh viện đa khoa theo quy hoạch sử dụng đất.",
  },
  {
    id: "3",
    title: "Nhà ở kết hợp Khách sạn",
    permitCode: "37/GPXD",
    permitDate: "09/4/2020",
    investor: "Vũ Tiến Hưng - Phạm Thị Vui",
    address: "146-148 Ký Con, P.Nguyễn Thái Bình, Q.1",
    district: "Quận 1",
    projectType: "Nhà ở kết hợp dịch vụ lưu trú",
    status: "Đã cấp phép",
    note: "Công trình nhà ở kết hợp khách sạn tại khu vực trung tâm.",
  },
  {
    id: "4",
    title: "VP làm việc",
    permitCode: "36/GPXD",
    permitDate: "06/4/2020",
    investor: "Trương Vĩnh Tùng - Hồ Công Cẩn",
    address: "28-30 Nguyễn Cư Trinh, P.Phạm Ngũ Lão, Q.1",
    district: "Quận 1",
    projectType: "Văn phòng làm việc",
    status: "Đã cấp phép",
    note: "Xây dựng văn phòng làm việc theo giấy phép quy hoạch.",
  },
  {
    id: "5",
    title: "Nhà thờ, Nhà sinh hoạt",
    permitCode: "35/GPXD",
    permitDate: "03/4/2020",
    investor: "Giáo xứ Bà Điểm",
    address: "10/8 Ấp Trung Lân, xã Bà Điểm, H.Hóc Môn",
    district: "Huyện Hóc Môn",
    projectType: "Công trình tôn giáo",
    status: "Đã cấp phép",
    note: "Xây dựng nhà thờ và nhà sinh hoạt cộng đồng.",
  },
];

export function getPermitById(id: string): ConstructionPermit | undefined {
  return constructionPermits.find((p) => p.id === id);
}
