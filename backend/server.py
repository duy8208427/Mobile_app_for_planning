from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import json
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Env
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ['JWT_SECRET']
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# DB
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="QuyHoạch AI API")
api_router = APIRouter(prefix="/api")

# ---------- Models ----------
class Address(BaseModel):
    province: Optional[str] = None
    district: Optional[str] = None
    ward: Optional[str] = None
    street: Optional[str] = None

class UserPublic(BaseModel):
    id: str
    email: str
    full_name: str
    role: Literal["citizen", "admin"]
    phone: Optional[str] = None
    address: Optional[Address] = None
    created_at: datetime

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    role: Optional[Literal["citizen", "admin"]] = "citizen"

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    user: UserPublic

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[Address] = None

class ReportCreate(BaseModel):
    title: str
    description: str
    address: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    image_base64: Optional[str] = None  # data:image/jpeg;base64,....
    violation_type: Optional[str] = "construction"  # construction|encroachment|zoning|other

class ReportUpdate(BaseModel):
    status: Literal["received", "processing", "resolved", "rejected"]
    admin_response: Optional[str] = None

class Report(BaseModel):
    id: str
    user_id: str
    user_name: str
    title: str
    description: str
    address: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    image_base64: Optional[str] = None
    violation_type: str
    status: str  # received|processing|resolved|rejected
    admin_response: Optional[str] = None
    handled_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class CompareRequest(BaseModel):
    planning_image_base64: str  # data:image/...;base64,...
    satellite_image_base64: str
    location: Optional[str] = None

class Anomaly(BaseModel):
    id: str
    type: str
    severity: Literal["low", "medium", "high"]
    description: str
    location_hint: Optional[str] = None

class CompareResult(BaseModel):
    summary: str
    anomalies: List[Anomaly]
    confidence: float
    raw: Optional[str] = None

class LegalDoc(BaseModel):
    id: str
    code: str
    title: str
    category: str
    issued_date: str
    issuer: str
    summary: str
    content: str

class SocialHousingProject(BaseModel):
    id: str
    name: str
    district: str
    ward: Optional[str] = None
    address: str
    investor: str
    updated_at: datetime

class AdministrativeProcedure(BaseModel):
    id: str
    title: str
    category: str
    order: int
    content: Optional[str] = None
    required_documents: List[str] = []
    processing_time: str = "Đang cập nhật"
    fee: str = "Đang cập nhật"
    receiving_agency: str = "Đang cập nhật"
    legal_basis: List[str] = []

class Notification(BaseModel):
    id: str
    user_id: str
    title: str
    body: str
    type: str  # report_status|zone_alert|general
    related_report_id: Optional[str] = None
    read: bool
    created_at: datetime

# ---------- Utils ----------
def now_utc():
    return datetime.now(timezone.utc)

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Không có token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token đã hết hạn")
    except Exception:
        raise HTTPException(status_code=401, detail="Token không hợp lệ")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Người dùng không tồn tại")
    return user

async def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Chỉ quản lý mới có quyền truy cập")
    return user

def user_to_public(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "full_name": u["full_name"],
        "role": u["role"],
        "phone": u.get("phone"),
        "address": u.get("address"),
        "created_at": u["created_at"],
    }

# ---------- Auth ----------
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(payload: RegisterRequest):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email đã được sử dụng")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": payload.email.lower(),
        "password_hash": hash_password(payload.password),
        "full_name": payload.full_name,
        "phone": payload.phone,
        "role": payload.role or "citizen",
        "created_at": now_utc(),
    }
    await db.users.insert_one(user_doc)
    token = create_token(user_id, user_doc["role"])
    return {"access_token": token, "user": user_to_public(user_doc)}

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(payload: LoginRequest):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng")
    token = create_token(user["id"], user["role"])
    return {"access_token": token, "user": user_to_public(user)}

@api_router.get("/auth/me", response_model=UserPublic)
async def me(user=Depends(get_current_user)):
    return user_to_public(user)

@api_router.put("/auth/profile", response_model=UserPublic)
async def update_profile(payload: UpdateProfileRequest, user=Depends(get_current_user)):
    update = {}

    if payload.full_name is not None:
        full_name = payload.full_name.strip()
        if not full_name:
            raise HTTPException(status_code=400, detail="Họ và tên không được để trống")
        update["full_name"] = full_name

    if payload.email is not None:
        email = str(payload.email).strip().lower()
        if not email:
            raise HTTPException(status_code=400, detail="Email không được để trống")
        existing = await db.users.find_one({"email": email, "id": {"$ne": user["id"]}})
        if existing:
            raise HTTPException(status_code=400, detail="Email đã được sử dụng")
        update["email"] = email

    if payload.phone is not None:
        update["phone"] = payload.phone.strip() if isinstance(payload.phone, str) else payload.phone

    if payload.address is not None:
        address = {
            "province": (payload.address.province or "").strip() or None,
            "district": (payload.address.district or "").strip() or None,
            "ward": (payload.address.ward or "").strip() or None,
            "street": (payload.address.street or "").strip() or None,
        }
        update["address"] = address

    if update:
        await db.users.update_one({"id": user["id"]}, {"$set": update})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return user_to_public(updated)

@api_router.post("/auth/change-password")
async def change_password(payload: ChangePasswordRequest, user=Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]})
    if not verify_password(payload.old_password, full["password_hash"]):
        raise HTTPException(status_code=400, detail="Mật khẩu cũ không đúng")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(payload.new_password)}})
    return {"ok": True}

# ---------- Reports ----------
@api_router.post("/reports", response_model=Report)
async def create_report(payload: ReportCreate, user=Depends(get_current_user)):
    report_id = str(uuid.uuid4())
    doc = {
        "id": report_id,
        "user_id": user["id"],
        "user_name": user["full_name"],
        "title": payload.title,
        "description": payload.description,
        "address": payload.address,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "image_base64": payload.image_base64,
        "violation_type": payload.violation_type or "construction",
        "status": "received",
        "admin_response": None,
        "handled_by": None,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.reports.insert_one(doc)
    # Notify the user
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "title": "Đã tiếp nhận báo cáo",
        "body": f"Báo cáo \"{payload.title}\" đã được hệ thống tiếp nhận và đang chờ xử lý.",
        "type": "report_status",
        "related_report_id": report_id,
        "read": False,
        "created_at": now_utc(),
    })
    doc.pop("_id", None)
    return doc

@api_router.get("/reports/mine", response_model=List[Report])
async def list_my_reports(user=Depends(get_current_user)):
    cursor = db.reports.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(500)

@api_router.get("/reports", response_model=List[Report])
async def list_all_reports(status: Optional[str] = None, _admin=Depends(require_admin)):
    q = {}
    if status:
        q["status"] = status
    cursor = db.reports.find(q, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(1000)

@api_router.get("/reports/{report_id}", response_model=Report)
async def get_report(report_id: str, user=Depends(get_current_user)):
    r = await db.reports.find_one({"id": report_id}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Không tìm thấy báo cáo")
    if user["role"] != "admin" and r["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Không có quyền")
    return r

@api_router.put("/reports/{report_id}", response_model=Report)
async def update_report(report_id: str, payload: ReportUpdate, admin=Depends(require_admin)):
    r = await db.reports.find_one({"id": report_id})
    if not r:
        raise HTTPException(status_code=404, detail="Không tìm thấy báo cáo")
    update = {
        "status": payload.status,
        "admin_response": payload.admin_response,
        "handled_by": admin["full_name"],
        "updated_at": now_utc(),
    }
    await db.reports.update_one({"id": report_id}, {"$set": update})
    # notify the citizen
    status_label = {
        "received": "đã được tiếp nhận",
        "processing": "đang được xử lý",
        "resolved": "đã được giải quyết",
        "rejected": "đã bị từ chối",
    }.get(payload.status, payload.status)
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": r["user_id"],
        "title": f"Báo cáo {status_label}",
        "body": (payload.admin_response or f"Báo cáo \"{r['title']}\" {status_label}."),
        "type": "report_status",
        "related_report_id": report_id,
        "read": False,
        "created_at": now_utc(),
    })
    updated = await db.reports.find_one({"id": report_id}, {"_id": 0})
    return updated

# ---------- AI Compare ----------
def _parse_data_url(data: str):
    """Return (mime, base64_payload) from data URL or raw base64."""
    if data.startswith("data:"):
        try:
            header, payload = data.split(",", 1)
            mime = header.split(";")[0].replace("data:", "") or "image/jpeg"
            return mime, payload
        except Exception:
            return "image/jpeg", data
    return "image/jpeg", data

@api_router.post("/ai/compare", response_model=CompareResult)
async def ai_compare(payload: CompareRequest, user=Depends(get_current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI key chưa được cấu hình")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi tải thư viện AI: {e}")

    _, planning_b64 = _parse_data_url(payload.planning_image_base64)
    _, satellite_b64 = _parse_data_url(payload.satellite_image_base64)

    system_prompt = (
        "Bạn là chuyên gia phân tích quy hoạch đô thị và ảnh viễn thám. "
        "Bạn nhận được 2 ảnh: (1) bản đồ quy hoạch chính thức, (2) ảnh viễn thám/vệ tinh thực địa. "
        "So sánh chi tiết và liệt kê các bất thường (xây dựng trái phép, lấn chiếm, lệch quy hoạch). "
        "TRẢ LỜI BẰNG TIẾNG VIỆT và CHỈ TRẢ VỀ JSON THUẦN không có markdown, theo cấu trúc: "
        '{"summary": str, "confidence": float (0..1), "anomalies": [{"type": str, "severity": "low|medium|high", "description": str, "location_hint": str}]}'
    )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"compare-{uuid.uuid4()}",
        system_message=system_prompt,
    ).with_model("gemini", "gemini-3.1-pro-preview")

    msg = UserMessage(
        text=(
            f"Vị trí: {payload.location or 'Không xác định'}.\n"
            "Ảnh 1: Bản đồ quy hoạch.\nẢnh 2: Ảnh viễn thám/vệ tinh.\n"
            "Hãy so sánh và phát hiện các điểm bất thường. Trả về JSON theo schema yêu cầu."
        ),
        file_contents=[
            ImageContent(image_base64=planning_b64),
            ImageContent(image_base64=satellite_b64),
        ],
    )
    try:
        raw = await chat.send_message(msg)
    except Exception as e:
        logger.exception("AI call failed")
        raise HTTPException(status_code=502, detail=f"AI lỗi: {e}")

    # Parse JSON robustly
    text = (raw or "").strip()
    if text.startswith("```"):
        # strip code fences
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()
    parsed = None
    try:
        parsed = json.loads(text)
    except Exception:
        # try extract first { ... }
        try:
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1:
                parsed = json.loads(text[start:end+1])
        except Exception:
            parsed = None

    if not parsed:
        return CompareResult(
            summary="AI đã phân tích nhưng không trả về định dạng JSON hợp lệ.",
            anomalies=[],
            confidence=0.0,
            raw=raw,
        )

    anomalies = []
    for a in parsed.get("anomalies", []) or []:
        anomalies.append(Anomaly(
            id=str(uuid.uuid4()),
            type=a.get("type", "unknown"),
            severity=a.get("severity", "low") if a.get("severity") in ("low", "medium", "high") else "low",
            description=a.get("description", ""),
            location_hint=a.get("location_hint"),
        ))
    return CompareResult(
        summary=parsed.get("summary", ""),
        anomalies=anomalies,
        confidence=float(parsed.get("confidence", 0.7) or 0.7),
        raw=raw,
    )

# ---------- Legal Docs ----------
@api_router.get("/legal", response_model=List[LegalDoc])
async def list_legal(q: Optional[str] = None, category: Optional[str] = None):
    query = {}
    if category:
        query["category"] = category
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"summary": {"$regex": q, "$options": "i"}},
            {"content": {"$regex": q, "$options": "i"}},
            {"code": {"$regex": q, "$options": "i"}},
        ]
    cursor = db.legal_docs.find(query, {"_id": 0}).sort("issued_date", -1)
    return await cursor.to_list(500)

@api_router.get("/legal/{doc_id}", response_model=LegalDoc)
async def get_legal(doc_id: str):
    d = await db.legal_docs.find_one({"id": doc_id}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Không tìm thấy văn bản")
    return d

# ---------- Social Housing ----------
@api_router.get("/social-housing", response_model=List[SocialHousingProject])
async def list_social_housing(district: Optional[str] = None, user=Depends(get_current_user)):
    _ = user
    query = {}
    if district:
        district_value = district.strip()
        if district_value:
            query["district"] = {"$regex": f"^{re.escape(district_value)}$", "$options": "i"}
    cursor = db.social_housing_projects.find(query, {"_id": 0}).sort([
        ("district", 1),
        ("name", 1),
    ])
    return await cursor.to_list(1000)

# ---------- Administrative Procedures ----------
@api_router.get("/administrative-procedures", response_model=List[AdministrativeProcedure])
async def list_administrative_procedures(
    q: Optional[str] = None,
    category: Optional[str] = None,
    user=Depends(get_current_user),
):
    _ = user
    query = {}
    if category:
        query["category"] = {"$regex": f"^{re.escape(category.strip())}$", "$options": "i"}
    if q:
        keyword = q.strip()
        if keyword:
            query["$or"] = [
                {"title": {"$regex": keyword, "$options": "i"}},
                {"content": {"$regex": keyword, "$options": "i"}},
                {"category": {"$regex": keyword, "$options": "i"}},
            ]

    cursor = db.administrative_procedures.find(query, {"_id": 0}).sort([
        ("category", 1),
        ("order", 1),
        ("title", 1),
    ])
    return await cursor.to_list(2000)

@api_router.get("/administrative-procedures/{procedure_id}", response_model=AdministrativeProcedure)
async def get_administrative_procedure(procedure_id: str, user=Depends(get_current_user)):
    _ = user
    doc = await db.administrative_procedures.find_one({"id": procedure_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Không tìm thấy thủ tục hành chính")
    return doc

# ---------- Notifications ----------
@api_router.get("/notifications", response_model=List[Notification])
async def list_notifications(user=Depends(get_current_user)):
    cursor = db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(500)

@api_router.post("/notifications/{notif_id}/read")
async def mark_read(notif_id: str, user=Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": notif_id, "user_id": user["id"]},
        {"$set": {"read": True}},
    )
    return {"ok": True}

@api_router.post("/notifications/read-all")
async def mark_all_read(user=Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": user["id"], "read": False},
        {"$set": {"read": True}},
    )
    return {"ok": True}

# ---------- Stats (admin) ----------
@api_router.get("/admin/stats")
async def admin_stats(_admin=Depends(require_admin)):
    total = await db.reports.count_documents({})
    pending = await db.reports.count_documents({"status": "received"})
    processing = await db.reports.count_documents({"status": "processing"})
    resolved = await db.reports.count_documents({"status": "resolved"})
    rejected = await db.reports.count_documents({"status": "rejected"})
    return {
        "total": total,
        "pending": pending,
        "processing": processing,
        "resolved": resolved,
        "rejected": rejected,
    }

# ---------- Seed ----------
async def seed_data():
    # Seed admin & test citizen
    if not await db.users.find_one({"email": "admin@quyhoach.vn"}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": "admin@quyhoach.vn",
            "password_hash": hash_password("Admin@123"),
            "full_name": "Trần Văn Quản",
            "phone": "0901111222",
            "role": "admin",
            "created_at": now_utc(),
        })
    if not await db.users.find_one({"email": "citizen@quyhoach.vn"}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": "citizen@quyhoach.vn",
            "password_hash": hash_password("Citizen@123"),
            "full_name": "Nguyễn Văn An",
            "phone": "0903333444",
            "role": "citizen",
            "created_at": now_utc(),
        })

    # Seed legal docs if empty
    if await db.legal_docs.count_documents({}) == 0:
        docs = [
            {
                "id": str(uuid.uuid4()),
                "code": "Luật 35/2018/QH14",
                "title": "Luật Quy hoạch",
                "category": "Luật",
                "issued_date": "2017-11-24",
                "issuer": "Quốc hội",
                "summary": "Quy định việc lập, thẩm định, quyết định, công bố, thực hiện, đánh giá, điều chỉnh quy hoạch trong hệ thống quy hoạch quốc gia.",
                "content": "Luật này quy định các nguyên tắc, trách nhiệm và trình tự lập quy hoạch trong hệ thống quy hoạch quốc gia, quy hoạch vùng, quy hoạch tỉnh, quy hoạch đô thị và nông thôn. Mọi hoạt động xây dựng phải phù hợp với quy hoạch đã được phê duyệt.",
            },
            {
                "id": str(uuid.uuid4()),
                "code": "Luật 50/2014/QH13",
                "title": "Luật Xây dựng",
                "category": "Luật",
                "issued_date": "2014-06-18",
                "issuer": "Quốc hội",
                "summary": "Quy định về quyền, nghĩa vụ, trách nhiệm của cơ quan, tổ chức, cá nhân và quản lý nhà nước trong hoạt động đầu tư xây dựng.",
                "content": "Luật xây dựng quy định trình tự xin cấp giấy phép xây dựng, quản lý chất lượng công trình, xử lý vi phạm xây dựng không phép, sai phép.",
            },
            {
                "id": str(uuid.uuid4()),
                "code": "Nghị định 16/2022/NĐ-CP",
                "title": "Quy định xử phạt vi phạm hành chính về xây dựng",
                "category": "Nghị định",
                "issued_date": "2022-01-28",
                "issuer": "Chính phủ",
                "summary": "Quy định mức xử phạt với hành vi xây dựng không phép, sai phép, lấn chiếm và các vi phạm khác trong hoạt động xây dựng.",
                "content": "Mức phạt từ 60 triệu đến 1 tỷ đồng tùy theo loại công trình và mức độ vi phạm. Buộc khôi phục hiện trạng hoặc tháo dỡ phần vi phạm.",
            },
            {
                "id": str(uuid.uuid4()),
                "code": "Luật 45/2013/QH13",
                "title": "Luật Đất đai",
                "category": "Luật",
                "issued_date": "2013-11-29",
                "issuer": "Quốc hội",
                "summary": "Quy định về chế độ sở hữu đất đai, quyền hạn và trách nhiệm của Nhà nước, quyền và nghĩa vụ của người sử dụng đất.",
                "content": "Đất đai thuộc sở hữu toàn dân do Nhà nước đại diện chủ sở hữu và thống nhất quản lý. Người sử dụng đất phải sử dụng đúng mục đích.",
            },
            {
                "id": str(uuid.uuid4()),
                "code": "Thông tư 03/2018/TT-BXD",
                "title": "Hướng dẫn quản lý quy hoạch xây dựng",
                "category": "Thông tư",
                "issued_date": "2018-04-24",
                "issuer": "Bộ Xây dựng",
                "summary": "Hướng dẫn lập, thẩm định, phê duyệt và điều chỉnh đồ án quy hoạch xây dựng.",
                "content": "Quy định chi tiết về hồ sơ quy hoạch, công bố quy hoạch và giám sát thực hiện quy hoạch xây dựng tại địa phương.",
            },
        ]
        await db.legal_docs.insert_many(docs)

    # Seed social housing projects if empty
    if await db.social_housing_projects.count_documents({}) == 0:
        now = now_utc()
        projects = [
            {
                "id": str(uuid.uuid4()),
                "name": "Dự án NOXH An Phú Đông",
                "district": "Quận 12",
                "ward": "Phường An Phú Đông",
                "address": "Đường Vườn Lài, Phường An Phú Đông, Quận 12",
                "investor": "Công ty Cổ phần Địa ốc Sài Gòn",
                "updated_at": now,
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Khu dân cư NOXH Bắc Rạch Bà Bướm",
                "district": "Quận 7",
                "ward": "Phường Phú Thuận",
                "address": "Khu phố 4, Phường Phú Thuận, Quận 7",
                "investor": "Công ty CP Địa ốc Sài Gòn Thương Tín Sacomreal",
                "updated_at": now,
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Chung cư NOXH Khu nhà ở Nam Phan",
                "district": "Quận 9",
                "ward": "Phường Phú Hữu",
                "address": "Khu nhà ở Nam Phan, Phường Phú Hữu, Quận 9",
                "investor": "Công ty Cổ phần Đầu tư Nam Phan",
                "updated_at": now,
            },
            {
                "id": str(uuid.uuid4()),
                "name": "NOXH CC1 Nguyễn Văn Dung",
                "district": "Quận Gò Vấp",
                "ward": "Phường 6",
                "address": "CC1, đường Nguyễn Văn Dung, Phường 6, Quận Gò Vấp",
                "investor": "Tổng Công ty Xây dựng số 1 TNHH MTV",
                "updated_at": now,
            },
            {
                "id": str(uuid.uuid4()),
                "name": "NOXH Bình Thới",
                "district": "Quận 11",
                "ward": "Phường 14",
                "address": "49/52 Bình Thới, Phường 14, Quận 11",
                "investor": "Công ty TNHH Đầu tư Phát triển Nhà Thành Công",
                "updated_at": now,
            },
            {
                "id": str(uuid.uuid4()),
                "name": "NOXH Tân Phú Residence",
                "district": "Quận Tân Phú",
                "ward": "Phường Sơn Kỳ",
                "address": "Đường Lê Trọng Tấn, Phường Sơn Kỳ, Quận Tân Phú",
                "investor": "Công ty CP Nhà Việt An",
                "updated_at": now,
            },
        ]
        await db.social_housing_projects.insert_many(projects)

    # Seed administrative procedures if empty
    if await db.administrative_procedures.count_documents({}) == 0:
        def proc(
            title: str,
            category: str,
            order: int,
            content: str,
            required_documents: Optional[List[str]] = None,
            processing_time: str = "15 ngày làm việc",
            fee: str = "Theo biểu phí hiện hành",
            receiving_agency: str = "Bộ phận một cửa Sở Xây dựng",
            legal_basis: Optional[List[str]] = None,
        ):
            return {
                "id": str(uuid.uuid4()),
                "title": title,
                "category": category,
                "order": order,
                "content": content,
                "required_documents": required_documents or [
                    "Đơn đề nghị theo mẫu",
                    "Giấy tờ pháp lý liên quan",
                    "Bản vẽ hoặc tài liệu kỹ thuật theo quy định",
                ],
                "processing_time": processing_time,
                "fee": fee,
                "receiving_agency": receiving_agency,
                "legal_basis": legal_basis or [
                    "Luật Xây dựng số 50/2014/QH13",
                    "Nghị định 15/2021/NĐ-CP",
                ],
            }

        procedures = [
            proc(
                "Thủ tục cấp giấy phép xây dựng đối với trường hợp sửa chữa, cải tạo công trình",
                "Cấp phép xây dựng",
                1,
                "Áp dụng cho công trình cần sửa chữa, cải tạo có thay đổi kết cấu chịu lực hoặc công năng.",
                processing_time="20 ngày làm việc",
            ),
            proc("Điều chỉnh giấy phép xây dựng", "Cấp phép xây dựng", 2, "Thực hiện khi thay đổi thiết kế, quy mô hoặc các thông số đã được cấp phép trước đó."),
            proc("Thủ tục cấp giấy phép xây dựng đối với công trình tôn giáo; công trình trong khu vực bảo vệ di tích lịch sử - văn hóa", "Cấp phép xây dựng", 3, "Yêu cầu hồ sơ bổ sung theo quy định chuyên ngành văn hóa, tôn giáo và di tích.", processing_time="25 ngày làm việc"),
            proc("Thủ tục cấp giấy phép xây dựng đối với trường hợp di dời công trình", "Cấp phép xây dựng", 4, "Áp dụng cho trường hợp tháo dỡ, di dời và xây dựng lại công trình tại vị trí mới."),
            proc("Thủ tục cấp lại giấy phép xây dựng", "Cấp phép xây dựng", 5, "Thực hiện khi giấy phép bị mất, hư hỏng hoặc cần cấp lại theo quy định hiện hành.", processing_time="10 ngày làm việc"),
            proc("Thủ tục gia hạn giấy phép xây dựng", "Cấp phép xây dựng", 6, "Áp dụng khi chưa thể khởi công theo thời hạn ghi trong giấy phép đã cấp.", processing_time="05 ngày làm việc"),
            proc("Cấp giấy phép xây dựng có thời hạn đối với công trình cấp I, II", "Cấp phép xây dựng", 7, "Thực hiện cho công trình thuộc khu vực có quy hoạch chưa triển khai ngay."),
            proc("Thủ tục cấp giấy phép xây dựng có thời hạn đối với công trình tôn giáo", "Cấp phép xây dựng", 8, "Áp dụng với cơ sở tôn giáo thuộc khu vực cho phép tồn tại có thời hạn."),
            proc("Cấp giấy phép xây dựng đối với trường hợp xây dựng mới công trình cấp I, II", "Cấp phép xây dựng", 9, "Yêu cầu hồ sơ thiết kế, thẩm định và các điều kiện kỹ thuật theo cấp công trình."),
            proc("Cấp giấy phép xây dựng đối với công trình thuộc tuyến ngoài đô thị", "Cấp phép xây dựng", 10, "Áp dụng với công trình ngoài khu vực đô thị theo phân cấp quản lý xây dựng."),
            proc("Thẩm định báo cáo kinh tế - kỹ thuật đầu tư xây dựng", "Hoạt động xây dựng", 1, "Đánh giá hồ sơ đầu tư trước khi phê duyệt triển khai xây dựng công trình."),
            proc("Cấp chứng chỉ năng lực hoạt động xây dựng", "Hoạt động xây dựng", 2, "Áp dụng cho tổ chức tham gia khảo sát, thiết kế, giám sát và thi công xây dựng."),
            proc("Cấp chứng chỉ hành nghề hoạt động xây dựng", "Hoạt động xây dựng", 3, "Áp dụng cho cá nhân hành nghề thiết kế, giám sát, định giá và quản lý dự án."),
            proc("Xác nhận đủ điều kiện huy động vốn bán, cho thuê mua nhà ở hình thành trong tương lai", "Nhà ở", 1, "Xác nhận điều kiện pháp lý dự án trước khi huy động vốn từ khách hàng.", receiving_agency="Sở Xây dựng và UBND cấp tỉnh"),
            proc("Chấp thuận chủ trương đầu tư dự án nhà ở xã hội", "Nhà ở", 2, "Thực hiện theo quy định pháp luật về nhà ở và đầu tư đối với dự án NOXH.", fee="Không thu lệ phí"),
            proc("Công nhận chủ đầu tư dự án nhà ở thương mại", "Nhà ở", 3, "Xác định tư cách pháp lý chủ đầu tư trước khi triển khai dự án nhà ở."),
        ]
        await db.administrative_procedures.insert_many(procedures)

    # Backfill missing detail fields for existing administrative procedures
    await db.administrative_procedures.update_many(
        {"required_documents": {"$exists": False}},
        {"$set": {"required_documents": ["Đang cập nhật"]}},
    )
    await db.administrative_procedures.update_many(
        {"processing_time": {"$exists": False}},
        {"$set": {"processing_time": "Đang cập nhật"}},
    )
    await db.administrative_procedures.update_many(
        {"fee": {"$exists": False}},
        {"$set": {"fee": "Đang cập nhật"}},
    )
    await db.administrative_procedures.update_many(
        {"receiving_agency": {"$exists": False}},
        {"$set": {"receiving_agency": "Đang cập nhật"}},
    )
    await db.administrative_procedures.update_many(
        {"legal_basis": {"$exists": False}},
        {"$set": {"legal_basis": ["Đang cập nhật"]}},
    )

from routers.planning import create_planning_routers

_planning_router, _violations_router, seed_planning_data = create_planning_routers(
    db, get_current_user, require_admin, now_utc
)
api_router.include_router(_planning_router)
api_router.include_router(_violations_router)


@app.on_event("startup")
async def on_startup():
    await seed_data()
    await seed_planning_data()

@api_router.get("/")
async def root():
    return {"app": "QuyHoạch AI", "ok": True}

# Include router
app.include_router(api_router)

_cors_raw = os.environ.get("CORS_ORIGINS", "*").strip()
_cors_origins = (
    ["*"]
    if _cors_raw == "*"
    else [o.strip() for o in _cors_raw.split(",") if o.strip()]
)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
