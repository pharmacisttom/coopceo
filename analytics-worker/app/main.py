"""
RYCOOP Smart Finance — Analytics Worker (FastAPI)
Responsibilities:
- Liquidity ratio prediction & safety buffer monitoring
- Bond maturity schedule calculation (30, 15, 7, 1 days)
- Commercial bank deposit rate aggregation
- Emits pre-validated notification triggers to NestJS Backend API
"""

from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
import httpx
import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rycoop-analytics-worker")

app = FastAPI(
    title="RYCOOP Smart Finance Analytics Worker",
    version="1.0.0",
    description="Analytics worker for Cooperative Liquidity, Bond Maturity and Bank Interest Rates"
)

NESTJS_BACKEND_URL = "http://backend:3001/api/v1/notifications/emit"

class LiquidityCheckRequest(BaseModel):
    current_liquid_assets: float = Field(..., gt=0, description="สินทรัพย์สภาพคล่องคงเหลือ (บาท)")
    total_deposits_due_30d: float = Field(..., gt=0, description="เงินรับฝากและภาระผูกพันที่จะครบกำหนดใน 30 วัน")
    safety_threshold_percent: float = Field(default=6.0, description="เกณฑ์สภาพคล่องขั้นต่ำของสหกรณ์ (%)")

class BondMaturityCheck(BaseModel):
    bond_id: str
    bond_name: str
    maturity_date: datetime.date
    face_value: float

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "rycoop-analytics-worker",
        "timestamp": datetime.datetime.utcnow().isoformat()
    }

@app.post("/analytics/evaluate-liquidity")
async def evaluate_liquidity(data: LiquidityCheckRequest, background_tasks: BackgroundTasks):
    """
    Evaluates net liquidity coverage ratio (LCR).
    If below safety threshold, dispatches CRITICAL LOW_LIQUIDITY notification.
    """
    lcr_ratio = (data.current_liquid_assets / data.total_deposits_due_30d) * 100
    is_critical = lcr_ratio < data.safety_threshold_percent

    result = {
        "calculated_lcr_percent": round(lcr_ratio, 2),
        "threshold_percent": data.safety_threshold_percent,
        "status": "CRITICAL" if is_critical else "SAFE",
        "evaluation_time": datetime.datetime.utcnow().isoformat()
    }

    if is_critical:
        background_tasks.add_task(
            dispatch_backend_notification,
            category="LOW_LIQUIDITY",
            priority="CRITICAL",
            title="[เตือนวิกฤติ] อัตราส่วนสภาพคล่องสุทธิต่ำกว่าเกณฑ์ความปลอดภัย",
            message=f"ระดับสภาพคล่องลดลงเหลือ {round(lcr_ratio, 2)}% (เกณฑ์กำหนดขั้นต่ำ {data.safety_threshold_percent}%) กรุณาชะลอการลงทุนและจัดสรรเงินสำรองทันที",
            target_role="EXECUTIVE"
        )

    return result

@app.post("/analytics/check-bond-maturities")
async def check_bond_maturities(bonds: List[BondMaturityCheck], background_tasks: BackgroundTasks):
    """
    Calculates days until maturity and triggers alerts for 30d, 15d, 7d thresholds.
    """
    today = datetime.date.today()
    alerts = []

    for bond in bonds:
        days_remaining = (bond.maturity_date - today).days
        if days_remaining in [30, 15, 7, 1]:
            priority = "CRITICAL" if days_remaining <= 7 else "WARNING"
            alerts.append({
                "bond_id": bond.bond_id,
                "days_remaining": days_remaining,
                "priority": priority
            })
            background_tasks.add_task(
                dispatch_backend_notification,
                category="BOND_MATURITY",
                priority=priority,
                title=f"หุ้นกู้ {bond.bond_name} จะครบกำหนดในอีก {days_remaining} วัน",
                message=f"ตราสารหนี้มูลค่า ฿{bond.face_value:,.2f} กำหนดไถ่ถอนวันที่ {bond.maturity_date} เตรียมรับเงินต้นและดอกเบี้ยงวดสุดท้าย",
                target_role="MAKER"
            )

    return {"processed_bonds": len(bonds), "alerts_triggered": alerts}

async def dispatch_backend_notification(
    category: str,
    priority: str,
    title: str,
    message: str,
    target_role: str
):
    """Dispatches event to NestJS Outbox / SSE Engine"""
    event_id = f"evt-analytics-{datetime.datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"
    payload = {
        "id": f"notif-{event_id}",
        "eventId": event_id,
        "category": category,
        "priority": priority,
        "status": "UNREAD",
        "title": title,
        "message": message,
        "targetRole": target_role,
        "createdAt": datetime.datetime.utcnow().isoformat()
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(NESTJS_BACKEND_URL, json=payload)
            logger.info(f"Dispatched {category} notification to backend: status={resp.status_code}")
    except Exception as e:
        logger.warning(f"Could not reach backend notification endpoint (backend may be offline during unit test): {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
