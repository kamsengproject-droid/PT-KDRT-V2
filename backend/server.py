from fastapi import FastAPI, APIRouter, Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
import os
import re
import json
import ipaddress
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

# ==========================================================================
# PT-KDRT support endpoints.
# The Kubernetes ingress routes every /api/* path to this backend, so the two
# server-side endpoints the React app calls (`/api/auth/client-ip` and
# `/api/scan-product`) are implemented here instead of in the Vite/Express
# dev server, keeping the exact same request/response contracts.
# ==========================================================================

DEFAULT_OFFICE_IPS = [
    "158.140.166.38",
    "158.140.166.0/24",
    "2402:8780:1201:81ed::/64",
    "2402:8780:1201:81ed:5d0b:b213:dbef:34f1",
]


def get_allowed_office_ips() -> List[str]:
    env_ips = [ip.strip() for ip in os.environ.get("OFFICE_PUBLIC_IPS", "").split(",") if ip.strip()]
    seen, result = set(), []
    for ip in DEFAULT_OFFICE_IPS + env_ips:
        if ip not in seen:
            seen.add(ip)
            result.append(ip)
    return result


def normalize_ip(raw: str) -> str:
    clean = raw.strip().lower()
    if clean.startswith("[") and "]" in clean:
        clean = clean[1 : clean.index("]")]
    if clean.startswith("::ffff:"):
        clean = clean[7:]
    return clean


def extract_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return normalize_ip(forwarded.split(",")[0])
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return normalize_ip(real_ip)
    return normalize_ip(request.client.host if request.client else "")


def ip_matches(client_ip: str, whitelist_entry: str) -> bool:
    try:
        addr = ipaddress.ip_address(normalize_ip(client_ip))
    except ValueError:
        return False
    entry = normalize_ip(whitelist_entry)
    try:
        if "/" in entry:
            return addr in ipaddress.ip_network(entry, strict=False)
        return addr == ipaddress.ip_address(entry)
    except ValueError:
        return False


@api_router.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@api_router.get("/auth/client-ip")
async def client_ip(request: Request):
    detected = extract_client_ip(request)
    allowed_ips = get_allowed_office_ips()
    return {
        "clientIp": detected,
        "isAllowed": any(ip_matches(detected, office_ip) for office_ip in allowed_ips),
        "allowedOfficeIps": allowed_ips,
    }


class ScanProductRequest(BaseModel):
    imageBase64: str = ""
    mimeType: str = "image/jpeg"


SCAN_PROMPT = """Anda adalah asisten AI khusus membaca screenshot produk marketplace (TikTok Shop, Shopee, Tokopedia, dll).
Tugas Anda: Analisis screenshot produk ini secara teliti dan ekstrak informasinya ke dalam format JSON yang valid.

Aturan Ekstraksi:
1. "productName": Nama atau judul lengkap produk yang tertera di screenshot. Bersihkan dari karakter aneh yang tidak relevan.
2. "productPrice": Harga jual produk dalam angka murni integer (contoh: jika Rp54.450 atau 54.450 -> 54450. Jika tidak terbaca -> 0).
3. "platform": Platform marketplace yang terdeteksi ("TikTok" untuk TikTok Shop, "Shopee" untuk Shopee, atau "MANUAL" jika tidak yakin).
4. "category": Perkiraan kategori produk (pilih satu yang paling cocok dari: "Skincare & Kecantikan", "Fashion & Pakaian", "Mainan & Hobi", "Baju Anak & Bayi", "Elektronik & Gadget", "Rumah Tangga & Dapur", "Otomotif & Aksesoris", "Makanan & Minuman", "Kesehatan & Kebugaran", atau "Lainnya").
5. "aiRecommendation": Jika terdapat badge atau ranking (misal "Top selling #1", "Best Seller", "Paling Laris #1", "Mall", "Star+"), tuliskan (contoh: "TOP SELLING #1"). Jika tidak ada badge khusus, isi string kosong "".
6. "earningInfo": Jika ada informasi perkiraan penghasilan komisi di screenshot kreator (contoh: "Earn Rp5.445"), tuliskan teks aslinya. JANGAN jadikan ini sebagai komisi real. Jika tidak ada, isi "".
7. "variantOrSize": Jika tertera varian / ukuran / warna yang dipilih di screenshot (contoh: "Hitam, Size L"), tuliskan. Jika tidak ada, isi "".
8. "notes": Ringkasan singkat fitur atau catatan penting dari produk.
9. "productImageBoundingBox": Koordinat area foto produk utama dalam format {"box_2d": [ymin, xmin, ymax, xmax]} skala 0-1000, atau null bila tidak jelas.
10. "confidence": Tingkat keyakinan ("HIGH", "MEDIUM", "LOW") untuk "productName", "productPrice", "platform".

Balas HANYA dengan JSON murni tanpa penjelasan dan tanpa code fence."""


@api_router.post("/scan-product")
@api_router.post("/scan-product-image")
async def scan_product(payload: ScanProductRequest):
    if not payload.imageBase64:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Gambar screenshot (imageBase64) wajib disertakan."},
        )

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": "EMERGENT_LLM_KEY belum dikonfigurasi di server."},
        )

    clean_base64 = re.sub(r"^data:image/[a-zA-Z+]+;base64,", "", payload.imageBase64)

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"scan-product-{uuid.uuid4()}",
            system_message="Anda adalah asisten ekstraksi data produk marketplace yang hanya membalas JSON valid.",
        ).with_model("gemini", "gemini-2.5-flash")

        response = await chat.send_message(
            UserMessage(text=SCAN_PROMPT, file_contents=[ImageContent(image_base64=clean_base64)])
        )
        response_text = response if isinstance(response, str) else str(response)

        try:
            parsed = json.loads(response_text)
        except json.JSONDecodeError:
            match = re.search(r"\{[\s\S]*\}", response_text)
            if not match:
                raise ValueError("Format hasil AI tidak valid.")
            parsed = json.loads(match.group(0))

        raw_price = parsed.get("productPrice", 0)
        if isinstance(raw_price, (int, float)):
            price = int(raw_price)
        else:
            digits = re.sub(r"\D", "", str(raw_price))
            price = int(digits) if digits else 0

        return {
            "success": True,
            "data": {
                "productName": parsed.get("productName") or "",
                "productPrice": price,
                "platform": parsed.get("platform") or "MANUAL",
                "category": parsed.get("category") or "Skincare & Kecantikan",
                "aiRecommendation": parsed.get("aiRecommendation") or "",
                "earningInfo": parsed.get("earningInfo") or "",
                "variantOrSize": parsed.get("variantOrSize") or "",
                "notes": parsed.get("notes") or "",
                "productImageBoundingBox": parsed.get("productImageBoundingBox") or None,
                "confidence": parsed.get("confidence")
                or {"productName": "MEDIUM", "productPrice": "MEDIUM", "platform": "MEDIUM"},
            },
        }
    except Exception as exc:
        logging.getLogger(__name__).exception("Error scanning screenshot")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc) or "Gagal memproses screenshot dengan AI."},
        )


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()