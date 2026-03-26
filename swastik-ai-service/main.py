"""
Swastik AI Consultation Service — FastAPI
Production-grade AI reasoning engine for doctor consultations.

Supports all 12 Computer Vision health signals:
  1. Heart Rate (rPPG)           — face ROI color → FFT → BPM
  2. Respiration Rate            — chest/shoulder landmark motion
  3. Blood Oxygen SpO2           — multi-channel rPPG regression
  4. Stress / HRV                — RR intervals → RMSSD, SDNN
  5. Drowsiness / Fatigue        — Eye Aspect Ratio (EAR)
  6. Pain Level (FACS)           — Facial Action Units → pain score
  7. Abnormal Posture            — spine angle from pose landmarks
  8. Fall Detection              — torso angle + velocity
  9. Tremor Detection            — landmark jitter FFT (4-6 Hz)
  10. Skin Condition Screening   — MobileNet/EfficientNet CNN
  11. Facial Pallor (Anemia)     — conjunctiva ROI color → Hb estimate
  12. Facial Asymmetry (Stroke)  — left/right face landmark comparison

Produces:
  - Alerts (per-signal threshold violations)
  - Possible medical conditions
  - Suggested follow-up questions
  - Structured medical notes
  - Drug interaction warnings
  - Risk indicators with severity
"""

import os
import re
import json
import time
import jwt
from datetime import datetime
from typing import Optional, List
from contextlib import asynccontextmanager

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, Header, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import asyncio
import redis.asyncio as aioredis
from redis.exceptions import ResponseError

load_dotenv()

# ── Configuration ──────────────────────────────────────────────────

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY", "")
MONGODB_URI = os.getenv("MONGODB_URI", "")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "swastik_healthcare")
# Prefer access-token secret for cross-service compatibility with backend.
JWT_SECRET = os.getenv("JWT_ACCESS_SECRET") or os.getenv("JWT_SECRET", "")
AI_MAX_TOKENS = int(os.getenv("AI_MAX_TOKENS", "1500"))
AI_TEMPERATURE = float(os.getenv("AI_TEMPERATURE", "0.3"))
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
AI_INGEST_STREAM = os.getenv("AI_INGEST_STREAM", "telemedicine:vitals:ingest")
AI_INGEST_GROUP = os.getenv("AI_INGEST_GROUP", "ai-reasoning-workers")
AI_INGEST_CONSUMER = os.getenv("AI_INGEST_CONSUMER", f"worker-{os.getpid()}")
AI_INGEST_MAXLEN = int(os.getenv("AI_INGEST_MAXLEN", "20000"))
AI_PENDING_MIN_IDLE_MS = int(os.getenv("AI_PENDING_MIN_IDLE_MS", "60000"))
AI_AUTOCLAIM_BATCH = int(os.getenv("AI_AUTOCLAIM_BATCH", "100"))

# Initialize Redis client globally
redis_client = aioredis.from_url(REDIS_URL)
ai_worker_task: Optional[asyncio.Task] = None

# ── MongoDB Setup ──────────────────────────────────────────────────

db = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db, ai_worker_task
    if MONGODB_URI:
        try:
            from motor.motor_asyncio import AsyncIOMotorClient
            client = AsyncIOMotorClient(MONGODB_URI)
            db = client[MONGODB_DB_NAME]
            print("✅ MongoDB connected (AI Service)")
        except Exception as e:
            print(f"⚠️  MongoDB connection failed: {e}")

    # Start async AI reasoning worker (Redis Streams consumer group)
    ai_worker_task = asyncio.create_task(ai_reasoning_worker())
    print("✅ AI reasoning worker started")

    yield

    if ai_worker_task:
        ai_worker_task.cancel()
        try:
            await ai_worker_task
        except asyncio.CancelledError:
            pass

    await redis_client.close()
    print("🔌 AI Service shutting down")


# ── App Init ───────────────────────────────────────────────────────

app = FastAPI(
    title="Swastik AI Consultation Service",
    description="AI reasoning engine for telemedicine — supports 12 CV health signals",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════════════════════════════
#  WEBSOCKET ENDPOINT — Vitals Stream 
# ══════════════════════════════════════════════════════════════════

class VitalsRuleEngine:
    """
    Layer 1 Deterministic Rule Engine — runs synchronously inline on every patient payload.
    Returns structured alert objects with severity, code, and clinical context. Target: < 5ms.
    """
    RULES = [
        {"code": "TACHYCARDIA",          "metric": "heart_rate",            "op": ">",  "threshold": 120,  "severity": "critical", "message": "Heart rate exceeds clinical upper limit (> 120 bpm via rPPG)"},
        {"code": "SEVERE_TACHYCARDIA",   "metric": "heart_rate",            "op": ">",  "threshold": 150,  "severity": "critical", "message": "Severe tachycardia — immediate cardiac assessment required (> 150 bpm)"},
        {"code": "BRADYCARDIA",          "metric": "heart_rate",            "op": "<",  "threshold": 50,   "severity": "critical", "message": "Heart rate critically low — bradycardia (< 50 bpm via rPPG)"},
        {"code": "RESPIRATORY_DISTRESS", "metric": "respiration_rate",      "op": ">",  "threshold": 25,   "severity": "warning",  "message": "Elevated respiration rate — possible respiratory distress (> 25/min)"},
        {"code": "HYPOXEMIA",            "metric": "spo2",                  "op": "<",  "threshold": 92,   "severity": "critical", "message": "Low blood oxygen — hypoxemia (SpO2 < 92% via experimental rPPG)"},
        {"code": "SEVERE_DROWSINESS",    "metric": "drowsiness_score",      "op": ">",  "threshold": 0.8,  "severity": "warning",  "message": "Severe drowsiness detected via Eye Aspect Ratio (EAR > 80%)"},
        {"code": "SEVERE_PAIN",          "metric": "pain_score",            "op": ">",  "threshold": 7,    "severity": "critical", "message": "Severe pain detected via Facial Action Coding System (> 7/10)"},
        {"code": "STROKE_INDICATOR",     "metric": "facial_asymmetry_score","op": ">",  "threshold": 0.6,  "severity": "critical", "message": "Significant facial asymmetry — possible stroke indicator. FAST protocol recommended."},
        {"code": "FALL_DETECTED",        "metric": "fall_detected",         "op": "==", "threshold": True, "severity": "critical", "message": "Fall detected during consultation — immediate attention required"},
        {"code": "SEVERE_TREMOR",        "metric": "tremor_severity",       "op": ">",  "threshold": 7,    "severity": "warning",  "message": "Severe tremor detected — consider Parkinson screening"},
    ]

    @classmethod
    def evaluate(cls, metrics: dict) -> list[dict]:
        """
        Evaluate clinical thresholds. Returns structured alert dicts.
        Deduplicates by code so no alert fires twice per payload.
        """
        alerts: list[dict] = []
        seen_codes: set[str] = set()
        ts = datetime.utcnow().isoformat() + "Z"
        for rule in cls.RULES:
            code = rule["code"]
            if code in seen_codes:
                continue
            val = metrics.get(rule["metric"])
            if val is None:
                continue
            triggered = (
                (rule["op"] == ">"  and val >  rule["threshold"]) or
                (rule["op"] == "<"  and val <  rule["threshold"]) or
                (rule["op"] == "==" and val == rule["threshold"])
            )
            if triggered:
                seen_codes.add(code)
                alerts.append({
                    "code":          code,
                    "metric":        rule["metric"],
                    "severity":      rule["severity"],
                    "threshold":     rule["threshold"] if not isinstance(rule["threshold"], bool) else None,
                    "current_value": val if not isinstance(val, bool) else val,
                    "message":       rule["message"],
                    "timestamp":     ts,
                })
        return alerts

def _parse_iso_utc() -> str:
    return datetime.utcnow().isoformat() + "Z"


async def ensure_ai_ingest_group():
    """Create Redis Streams consumer group for async AI reasoning workers."""
    try:
        await redis_client.xgroup_create(
            name=AI_INGEST_STREAM,
            groupname=AI_INGEST_GROUP,
            id="0",
            mkstream=True,
        )
        print(f"✅ Created consumer group {AI_INGEST_GROUP} on {AI_INGEST_STREAM}")
    except ResponseError as e:
        if "BUSYGROUP" not in str(e):
            raise


def build_async_ai_reasoning(payload: dict, backpressure: bool = False) -> dict:
    """
    Build lightweight async reasoning output from deterministic alerts.
    This runs in background workers and never blocks the primary WS ingestion path.
    """
    metrics = payload.get("data", payload)
    alerts = metrics.get("alerts", [])
    session_id = metrics.get("session_id") or payload.get("session_id")

    if alerts:
        top = alerts[:3]
        summary = "; ".join(a.get("message", "") for a in top)
        severity = "critical" if any(a.get("severity") == "critical" for a in alerts) else "warning"
        reasoning = (
            f"Detected {len(alerts)} active clinical alert(s): {summary}. "
            f"Prioritize focused history and confirm with device-grade measurements."
        )
    else:
        severity = "info"
        reasoning = "No critical deterministic alerts currently. Continue routine monitoring and symptom correlation."

    if backpressure:
        reasoning += " (Backpressure mode: compact reasoning response generated.)"

    return {
        "session_id": session_id,
        "ai_reasoning": reasoning,
        "ai_reasoning_severity": severity,
        "source": "async-ai-worker",
        "generated_at": _parse_iso_utc(),
    }


async def process_ai_ingest_message(msg_id, msg_data, backpressure: bool = False) -> None:
    """Process one ingest-stream message and ACK only after handling."""
    raw_payload = msg_data.get(b"payload") or msg_data.get("payload")
    if not raw_payload:
        await redis_client.xack(AI_INGEST_STREAM, AI_INGEST_GROUP, msg_id)
        return

    try:
        payload = json.loads(raw_payload.decode("utf-8") if isinstance(raw_payload, (bytes, bytearray)) else raw_payload)
    except Exception:
        # Poison payload — ack so it doesn't block group
        await redis_client.xack(AI_INGEST_STREAM, AI_INGEST_GROUP, msg_id)
        return

    metrics = payload.get("data", payload)
    session_id = metrics.get("session_id") or payload.get("session_id")
    if not session_id:
        await redis_client.xack(AI_INGEST_STREAM, AI_INGEST_GROUP, msg_id)
        return

    ai_payload = build_async_ai_reasoning(payload, backpressure=backpressure)
    session_stream = f"telemedicine:vitals:{session_id}"

    await redis_client.xadd(
        name=session_stream,
        fields={"payload": json.dumps(ai_payload)},
        maxlen=5000,
        approximate=True,
    )

    await redis_client.xack(AI_INGEST_STREAM, AI_INGEST_GROUP, msg_id)


async def reclaim_stale_pending(backpressure: bool = False) -> int:
    """
    Reclaim stale pending messages from dead consumers using XAUTOCLAIM.
    Returns number of messages reclaimed in this pass.
    """
    reclaimed = 0
    start_id = "0-0"

    while True:
        try:
            claimed = await redis_client.xautoclaim(
                name=AI_INGEST_STREAM,
                groupname=AI_INGEST_GROUP,
                consumername=AI_INGEST_CONSUMER,
                min_idle_time=AI_PENDING_MIN_IDLE_MS,
                start_id=start_id,
                count=AI_AUTOCLAIM_BATCH,
            )
        except ResponseError as e:
            # NOGROUP can happen during startup races
            if "NOGROUP" in str(e):
                await ensure_ai_ingest_group()
                return reclaimed
            raise

        # redis-py typically returns: (next_start_id, [(msg_id, msg_data), ...], [deleted_ids?])
        next_start_id = claimed[0] if isinstance(claimed, (list, tuple)) and len(claimed) > 0 else "0-0"
        messages = claimed[1] if isinstance(claimed, (list, tuple)) and len(claimed) > 1 else []

        if not messages:
            return reclaimed

        for msg_id, msg_data in messages:
            reclaimed += 1
            await process_ai_ingest_message(msg_id, msg_data, backpressure=backpressure)

        # Stop if server indicates no further range
        if not next_start_id or next_start_id == "0-0":
            return reclaimed
        start_id = next_start_id


async def ai_reasoning_worker():
    """
    Consumer-group worker:
    - Reads from global ingest stream (AI_INGEST_STREAM)
    - Generates async AI reasoning
    - Publishes reasoning into session-specific stream for doctor fan-out
    - ACKs only after successful processing
    """
    await ensure_ai_ingest_group()

    while True:
        try:
            # Basic backlog signal for backpressure mode
            pending_count = 0
            try:
                pending_summary = await redis_client.xpending(AI_INGEST_STREAM, AI_INGEST_GROUP)
                if isinstance(pending_summary, dict):
                    pending_count = int(pending_summary.get("pending", 0))
                elif isinstance(pending_summary, (list, tuple)) and pending_summary:
                    pending_count = int(pending_summary[0])
            except Exception:
                pending_count = 0

            backpressure = pending_count > 1000

            # Recover stale pending entries from dead consumers before reading new ones
            if pending_count > 0:
                try:
                    reclaimed = await reclaim_stale_pending(backpressure=backpressure)
                    if reclaimed > 0:
                        print(f"[AI Worker] reclaimed {reclaimed} stale pending messages")
                except Exception as e:
                    print(f"[AI Worker] autoclaim failed: {e}")

            response = await redis_client.xreadgroup(
                groupname=AI_INGEST_GROUP,
                consumername=AI_INGEST_CONSUMER,
                streams={AI_INGEST_STREAM: ">"},
                count=50 if backpressure else 20,
                block=1000,
            )
            if not response:
                continue

            for _stream, messages in response:
                for msg_id, msg_data in messages:
                    await process_ai_ingest_message(msg_id, msg_data, backpressure=backpressure)
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[AI Worker] error: {e}")
            await asyncio.sleep(1)


@app.websocket("/ws/vitals/{session_id}/{role}")
async def vitals_websocket(
    websocket: WebSocket,
    session_id: str,
    role: str,
    token: Optional[str] = Query(None),
    last_id: Optional[str] = Query(None),
):
    """
    Real-time CV vitals WebSocket endpoint.
    - JWT auth/role checks
    - Session-isolated stream key
    - Approximate stream trimming
    - Stream replay via last_id
    - Keepalive ping/pong
    """
    if role not in ("patient", "doctor"):
        await websocket.close(code=4000, reason="Invalid role")
        return

    await websocket.accept()

    jwt_payload = None
    if JWT_SECRET:
        if not token:
            await websocket.close(code=4001, reason="Missing auth token")
            return
        try:
            jwt_payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            user_role = jwt_payload.get("role", "")
            if role == "doctor" and user_role != "doctor":
                await websocket.close(code=4003, reason="Doctor role required")
                return
            if role == "patient" and user_role not in ("patient", "user"):
                await websocket.close(code=4003, reason="Patient role required")
                return

            # Optional strict session binding if token carries consultation/session id
            token_session = jwt_payload.get("session_id") or jwt_payload.get("consultationId")
            if token_session and str(token_session) != str(session_id):
                await websocket.close(code=4003, reason="Session mismatch")
                return
        except jwt.ExpiredSignatureError:
            await websocket.close(code=4001, reason="Token expired")
            return
        except jwt.InvalidTokenError:
            await websocket.close(code=4001, reason="Invalid token")
            return

    stream_key = f"telemedicine:vitals:{session_id}"

    async def reader_task():
        try:
            while True:
                text = await websocket.receive_text()
                try:
                    payload = json.loads(text)
                except json.JSONDecodeError:
                    continue

                if payload.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong", "ts": time.time()}))
                    continue

                if role != "patient":
                    continue

                metrics = payload.get("data", payload)
                metrics.setdefault("session_id", session_id)

                alerts = VitalsRuleEngine.evaluate(metrics)
                if alerts:
                    metrics["alerts"] = alerts

                if "data" in payload:
                    payload["data"] = metrics
                else:
                    payload = metrics

                # Source-of-truth session stream
                await redis_client.xadd(
                    name=stream_key,
                    fields={"payload": json.dumps(payload)},
                    maxlen=5000,
                    approximate=True,
                )

                # Async AI ingest stream (consumer-group workers)
                await redis_client.xadd(
                    name=AI_INGEST_STREAM,
                    fields={"payload": json.dumps(payload), "session_id": str(session_id)},
                    maxlen=AI_INGEST_MAXLEN,
                    approximate=True,
                )
        except WebSocketDisconnect:
            pass
        except Exception as e:
            print(f"[WS] reader error: {e}")

    async def writer_task():
        stream_last_id = last_id if last_id else "$"
        try:
            while True:
                response = await redis_client.xread(
                    streams={stream_key: stream_last_id},
                    count=20,
                    block=1000,
                )
                if not response:
                    continue

                for _stream_name, messages in response:
                    for msg_id, msg_data in messages:
                        stream_last_id = msg_id.decode("utf-8")
                        raw = msg_data.get(b"payload") or msg_data.get("payload")
                        if not raw:
                            continue
                        try:
                            obj = json.loads(raw.decode("utf-8") if isinstance(raw, (bytes, bytearray)) else raw)
                            obj["_stream_id"] = stream_last_id
                            await websocket.send_text(json.dumps(obj))
                        except Exception:
                            await websocket.send_text(raw.decode("utf-8") if isinstance(raw, (bytes, bytearray)) else str(raw))
        except asyncio.CancelledError:
            pass
        except WebSocketDisconnect:
            pass
        except Exception as e:
            print(f"[WS] writer error: {e}")

    async def keepalive_task():
        try:
            while True:
                await asyncio.sleep(30)
                await websocket.send_text(json.dumps({"type": "ping", "ts": time.time()}))
        except asyncio.CancelledError:
            pass
        except Exception:
            pass

    tasks = [
        asyncio.create_task(reader_task()),
        asyncio.create_task(keepalive_task()),
    ]
    if role == "doctor":
        tasks.append(asyncio.create_task(writer_task()))

    try:
        await asyncio.gather(*tasks)
    except asyncio.CancelledError:
        pass
    except Exception as e:
        print(f"[WS] gather error: {e}")
    finally:
        for t in tasks:
            t.cancel()

# ══════════════════════════════════════════════════════════════════
#  PYDANTIC MODELS — All 12 CV Signals
# ══════════════════════════════════════════════════════════════════

class VitalsData(BaseModel):
    # Signal 1: Heart Rate (rPPG)
    #   Pipeline: Face ROI → avg RGB → detrend + bandpass (0.8-3Hz) → FFT → BPM
    heart_rate: Optional[float] = Field(None, ge=20, le=250, description="Heart rate in BPM via rPPG")

    # Signal 2: Respiration Rate (Chest Motion)
    respiration_rate: Optional[float] = Field(None, ge=4, le=60, description="Breaths per minute via chest motion")

    # Signal 3: Blood Oxygen SpO2 (Experimental rPPG)
    #   Pipeline: Multi-channel rPPG (RGB ratios) → regression model → SpO2%
    spo2: Optional[float] = Field(None, ge=50, le=100, description="Estimated SpO2 % (experimental)")

    # Signal 4: Stress / HRV
    #   Pipeline: rPPG pulse waveform → RR intervals → RMSSD, SDNN
    stress_level: Optional[str] = Field(None, description="low|moderate|high|critical")
    hrv_rmssd: Optional[float] = Field(None, ge=0, le=300, description="HRV RMSSD in ms")
    hrv_sdnn: Optional[float] = Field(None, ge=0, le=300, description="HRV SDNN in ms")

    # Signal 5: Drowsiness / Fatigue (EAR)
    #   Pipeline: Face landmarks → eye points → Eye Aspect Ratio → drowsiness flag
    drowsiness_score: Optional[float] = Field(None, ge=0, le=1, description="0=alert, 1=fully drowsy")

    # Signal 6: Pain Level (Facial Action Units / FACS)
    #   Pipeline: OpenFace AU detection → AU4, AU6, AU9 → pain score
    pain_score: Optional[float] = Field(None, ge=0, le=10, description="Pain score 0-10 from FACS")
    pain_action_units: Optional[str] = Field(None, description="Active FACS AUs, e.g. 'AU4,AU6,AU9'")

    # Signal 7: Abnormal Posture
    #   Pipeline: Pose landmarks → shoulder/hip/knee → spine angle → classification
    posture: Optional[str] = Field(None, description="normal|slouching|leaning|lying_down|unstable")
    spine_angle: Optional[float] = Field(None, ge=0, le=180, description="Spine angle in degrees")

    # Signal 8: Fall Detection
    #   Pipeline: Pose landmarks sequence → torso angle + vertical speed → threshold/LSTM
    fall_detected: Optional[bool] = Field(None, description="True if fall detected")

    # Signal 9: Tremor Detection (Parkinson Screening)
    #   Pipeline: Landmark jitter tracking → FFT → dominant frequency (4-6 Hz typical)
    tremor_detected: Optional[bool] = Field(None, description="True if tremor detected")
    tremor_severity: Optional[float] = Field(None, ge=0, le=10, description="Severity 0-10")
    tremor_frequency: Optional[float] = Field(None, ge=0, le=30, description="Dominant frequency in Hz")

    # Signal 10: Skin Condition Screening
    #   Pipeline: Lesion image → MobileNet/EfficientNet CNN → classification
    skin_condition: Optional[str] = Field(None, description="normal|pale|flushed|cyanotic|jaundiced|lesion_detected")
    skin_classification: Optional[str] = Field(None, description="CNN output: melanoma|benign|actinic_keratosis|etc")
    skin_confidence: Optional[float] = Field(None, ge=0, le=1, description="Classification confidence")

    # Signal 11: Facial Pallor (Anemia Indicator)
    #   Pipeline: Conjunctiva/lip ROI → color distribution → regression → Hb estimate
    pallor_score: Optional[float] = Field(None, ge=0, le=1, description="0=healthy color, 1=very pale")
    hemoglobin_estimate: Optional[float] = Field(None, ge=3, le=20, description="Estimated Hb g/dL")

    # Signal 12: Facial Asymmetry (Stroke Warning)
    #   Pipeline: Face landmarks → left vs right movement comparison → asymmetry score
    facial_asymmetry_score: Optional[float] = Field(None, ge=0, le=1, description="0=symmetric, 1=severe asymmetry")

    # Additional device-reported vitals
    temperature: Optional[float] = Field(None, ge=30, le=45, description="Body temp °C")
    blood_pressure_systolic: Optional[float] = Field(None, ge=50, le=300, description="SBP mmHg")
    blood_pressure_diastolic: Optional[float] = Field(None, ge=20, le=200, description="DBP mmHg")


class ConsultationContext(BaseModel):
    consultation_id: str
    doctor_name: Optional[str] = "Doctor"
    doctor_specialization: Optional[str] = "General Medicine"
    symptoms: Optional[str] = ""
    vitals: Optional[VitalsData] = None
    history: Optional[str] = ""
    diagnosis_notes: Optional[str] = ""
    transcript_summary: Optional[str] = ""
    query: str = Field(..., min_length=1, max_length=2000)


class AIAlert(BaseModel):
    type: str  # "critical" | "warning" | "info"
    signal: str  # which of the 12 signals triggered this
    value: Optional[float] = None
    message: str


class SuggestedMedication(BaseModel):
    name: str
    dosage: str
    frequency: str
    duration: str
    notes: str = ""


class AIConsultationResponse(BaseModel):
    alerts: list[str] = []
    possible_conditions: list[str] = []
    suggested_questions: list[str] = []
    summary: str = ""
    clinical_notes: str = ""
    risk_indicators: list[str] = []
    severity_assessment: str = "mild"  # mild|moderate|severe|critical
    suggested_medications: list[SuggestedMedication] = []
    differential_diagnoses: list[str] = []
    recommended_tests: list[str] = []
    vitals_interpretation: str = ""
    signal_analysis: dict = {}  # per-signal clinical assessment
    answer: str = ""


class ConsultationSummaryRequest(BaseModel):
    consultation_id: str
    transcript: str = ""
    vitals_history: list[dict] = []
    diagnosis: Optional[str] = ""
    prescriptions: list[dict] = []


# ── JWT Auth ───────────────────────────────────────────────────────

async def verify_doctor_token(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        if payload.get("role") != "doctor":
            raise HTTPException(status_code=403, detail="Only doctors can access AI assistant")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ── AI Provider Calls ─────────────────────────────────────────────

async def call_groq(messages: list[dict], max_tokens: int = AI_MAX_TOKENS, temperature: float = AI_TEMPERATURE) -> dict:
    """Call Groq API for fast LLM inference."""
    if not GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="Groq API key not configured")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "response_format": {"type": "json_object"},
            },
        )

        if response.status_code != 200:
            error_text = response.text
            print(f"[AI Service] Groq error {response.status_code}: {error_text}")
            raise HTTPException(status_code=502, detail=f"Groq API error: {response.status_code}")

        data = response.json()
        return {
            "content": data["choices"][0]["message"]["content"],
            "provider": "groq",
            "model": "llama-3.3-70b-versatile",
            "usage": data.get("usage", {}),
        }


async def call_huggingface(messages: list[dict], max_tokens: int = AI_MAX_TOKENS) -> dict:
    """Call HuggingFace Inference API as fallback."""
    if not HUGGINGFACE_API_KEY:
        raise HTTPException(status_code=503, detail="HuggingFace API key not configured")

    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.post(
            "https://router.huggingface.co/novita/v3/openai/chat/completions",
            headers={
                "Authorization": f"Bearer {HUGGINGFACE_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "meta-llama/llama-3.3-70b-instruct",
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": AI_TEMPERATURE,
            },
        )

        if response.status_code != 200:
            raise HTTPException(status_code=502, detail=f"HuggingFace API error: {response.status_code}")

        data = response.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        return {
            "content": content,
            "provider": "huggingface",
            "model": "meta-llama/llama-3.3-70b-instruct",
            "usage": data.get("usage", {}),
        }


async def call_ai(messages: list[dict], max_tokens: int = AI_MAX_TOKENS) -> dict:
    """Route AI call with automatic fallback: Groq → HuggingFace."""
    try:
        return await call_groq(messages, max_tokens)
    except Exception as groq_err:
        print(f"[AI Service] Groq failed, falling back to HuggingFace: {groq_err}")
        try:
            return await call_huggingface(messages, max_tokens)
        except Exception as hf_err:
            print(f"[AI Service] All providers failed: {hf_err}")
            raise HTTPException(status_code=503, detail="AI service temporarily unavailable")


def parse_json_response(content: str) -> dict:
    """Parse JSON from AI response, handling markdown wrapping."""
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass

    # Try extracting from markdown code block
    code_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', content)
    if code_match:
        try:
            return json.loads(code_match.group(1).strip())
        except json.JSONDecodeError:
            pass

    # Try extracting raw JSON object
    json_match = re.search(r'\{[\s\S]*\}', content)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass

    return {"answer": content, "alerts": [], "possible_conditions": [], "suggested_questions": []}


# ══════════════════════════════════════════════════════════════════
#  VITALS ANALYSIS — All 12 Signals
# ══════════════════════════════════════════════════════════════════

def analyze_vitals_for_alerts(vitals: Optional[VitalsData]) -> list[dict]:
    """
    Generate structured clinical alert dicts from all 12 CV health signals.
    Each alert: {code, metric, severity, threshold, current_value, message, timestamp}.
    Used by the REST /api/ai/consult endpoint (Layer 1 deterministic checks).
    """
    if not vitals:
        return []

    alerts: list[dict] = []
    ts = datetime.utcnow().isoformat() + "Z"

    def _a(code: str, metric: str, severity: str, message: str,
           threshold=None, current_value=None) -> dict:
        return {"code": code, "metric": metric, "severity": severity,
                "threshold": threshold, "current_value": current_value,
                "message": message, "timestamp": ts}

    # ── Signal 1: Heart Rate (rPPG) ───────────────────────────────
    if vitals.heart_rate is not None:
        hr = vitals.heart_rate
        if hr > 150:
            alerts.append(_a("SEVERE_TACHYCARDIA", "heart_rate", "critical",
                f"Severe tachycardia (HR: {hr} bpm via rPPG) — immediate cardiac assessment required", 150, hr))
        elif hr > 120:
            alerts.append(_a("TACHYCARDIA", "heart_rate", "critical",
                f"Tachycardia detected (HR: {hr} bpm via rPPG)", 120, hr))
        elif hr < 40:
            alerts.append(_a("SEVERE_BRADYCARDIA", "heart_rate", "critical",
                f"Severe bradycardia (HR: {hr} bpm via rPPG) — emergency assessment required", 40, hr))
        elif hr < 50:
            alerts.append(_a("BRADYCARDIA", "heart_rate", "critical",
                f"Bradycardia detected (HR: {hr} bpm via rPPG)", 50, hr))
        elif hr > 100:
            alerts.append(_a("ELEVATED_HEART_RATE", "heart_rate", "warning",
                f"Elevated heart rate ({hr} bpm)", 100, hr))

    # ── Signal 2: Respiration Rate (Chest Motion) ─────────────────
    if vitals.respiration_rate is not None:
        rr = vitals.respiration_rate
        if rr > 35:
            alerts.append(_a("SEVERE_TACHYPNEA", "respiration_rate", "critical",
                f"Severe tachypnea (RR: {rr}/min) — respiratory emergency", 35, rr))
        elif rr > 25:
            alerts.append(_a("TACHYPNEA", "respiration_rate", "warning",
                f"Tachypnea detected (RR: {rr}/min via chest motion)", 25, rr))
        elif rr < 6:
            alerts.append(_a("SEVERE_BRADYPNEA", "respiration_rate", "critical",
                f"Severe bradypnea (RR: {rr}/min) — respiratory depression", 6, rr))
        elif rr < 8:
            alerts.append(_a("BRADYPNEA", "respiration_rate", "warning",
                f"Bradypnea detected (RR: {rr}/min)", 8, rr))

    # ── Signal 3: SpO2 (Experimental rPPG) ────────────────────────
    if vitals.spo2 is not None:
        spo2 = vitals.spo2
        if spo2 < 88:
            alerts.append(_a("SEVERE_HYPOXEMIA", "spo2", "critical",
                f"Severe hypoxemia (SpO2: {spo2}% — experimental rPPG) — urgent oxygen assessment", 88, spo2))
        elif spo2 < 92:
            alerts.append(_a("HYPOXEMIA", "spo2", "warning",
                f"Hypoxemia warning (SpO2: {spo2}% — experimental)", 92, spo2))

    # ── Signal 4: Stress / HRV ────────────────────────────────────
    if vitals.stress_level == "critical":
        alerts.append(_a("CRITICAL_STRESS", "stress_level", "critical",
            "Patient showing critical stress levels (HRV analysis)"))
    elif vitals.stress_level == "high":
        alerts.append(_a("HIGH_STRESS", "stress_level", "warning",
            "Patient showing high stress (HRV analysis)"))
    if vitals.hrv_rmssd is not None and vitals.hrv_rmssd < 15:
        alerts.append(_a("LOW_HRV_RMSSD", "hrv_rmssd", "warning",
            f"Very low HRV (RMSSD: {vitals.hrv_rmssd}ms) — reduced parasympathetic tone", 15, vitals.hrv_rmssd))
    if vitals.hrv_sdnn is not None and vitals.hrv_sdnn < 20:
        alerts.append(_a("LOW_HRV_SDNN", "hrv_sdnn", "warning",
            f"Very low HRV (SDNN: {vitals.hrv_sdnn}ms) — autonomic dysfunction concern", 20, vitals.hrv_sdnn))

    # ── Signal 5: Drowsiness / Fatigue (EAR) ──────────────────────
    if vitals.drowsiness_score is not None:
        ds = vitals.drowsiness_score
        if ds > 0.9:
            alerts.append(_a("NEAR_UNCONSCIOUS", "drowsiness_score", "critical",
                f"Patient nearly unconscious (drowsiness: {ds:.0%} via EAR)", 0.9, ds))
        elif ds > 0.7:
            alerts.append(_a("SEVERE_DROWSINESS", "drowsiness_score", "warning",
                f"Patient appears severely drowsy (score: {ds:.0%} via Eye Aspect Ratio)", 0.7, ds))

    # ── Signal 6: Pain Level (FACS) ───────────────────────────────
    if vitals.pain_score is not None:
        ps = vitals.pain_score
        au_info = f" — active AUs: {vitals.pain_action_units}" if vitals.pain_action_units else ""
        if ps >= 8:
            alerts.append(_a("SEVERE_PAIN", "pain_score", "critical",
                f"Severe pain detected (score: {ps}/10 via FACS{au_info})", 8, ps))
        elif ps >= 5:
            alerts.append(_a("MODERATE_PAIN", "pain_score", "warning",
                f"Moderate pain detected (score: {ps}/10 via Facial Action Units{au_info})", 5, ps))

    # ── Signal 7: Abnormal Posture ────────────────────────────────
    if vitals.posture and vitals.posture not in ("normal", "unknown"):
        angle_info = f" (spine angle: {vitals.spine_angle}°)" if vitals.spine_angle is not None else ""
        if vitals.posture == "unstable":
            alerts.append(_a("UNSTABLE_POSTURE", "posture", "warning",
                f"Patient posture unstable{angle_info} — fall risk"))
        elif vitals.posture == "lying_down":
            alerts.append(_a("LYING_DOWN", "posture", "info",
                f"Patient appears to be lying down{angle_info}"))
        else:
            alerts.append(_a("ABNORMAL_POSTURE", "posture", "warning",
                f"Abnormal posture: {vitals.posture}{angle_info}"))

    # ── Signal 8: Fall Detection ──────────────────────────────────
    if vitals.fall_detected:
        alerts.append(_a("FALL_DETECTED", "fall_detected", "critical",
            "Fall detected during consultation — immediate attention required"))

    # ── Signal 9: Tremor Detection (Parkinson Screening) ──────────
    if vitals.tremor_detected:
        sev = vitals.tremor_severity or 0.0
        parts = []
        if vitals.tremor_severity is not None: parts.append(f"severity: {vitals.tremor_severity}/10")
        if vitals.tremor_frequency is not None: parts.append(f"freq: {vitals.tremor_frequency}Hz")
        details = " — " + ", ".join(parts) if parts else ""
        if sev >= 7:
            alerts.append(_a("SEVERE_TREMOR", "tremor_severity", "critical",
                f"Severe tremor detected{details} — Parkinson screening recommended", 7, sev))
        elif sev >= 4:
            alerts.append(_a("SIGNIFICANT_TREMOR", "tremor_severity", "warning",
                f"Significant tremor detected{details}", 4, sev))
        else:
            alerts.append(_a("MILD_TREMOR", "tremor_severity", "info",
                f"Mild tremor detected{details}", None, sev))
        if vitals.tremor_frequency is not None and 3.5 <= vitals.tremor_frequency <= 6.5:
            alerts.append(_a("PARKINSONIAN_TREMOR_FREQ", "tremor_frequency", "warning",
                f"Tremor frequency {vitals.tremor_frequency}Hz is in Parkinsonian range (4-6 Hz)",
                None, vitals.tremor_frequency))

    # ── Signal 10: Skin Condition Screening ───────────────────────
    if vitals.skin_condition and vitals.skin_condition not in ("normal",):
        if vitals.skin_condition == "lesion_detected" and vitals.skin_classification:
            conf_str = f" ({vitals.skin_confidence:.0%} confidence)" if vitals.skin_confidence else ""
            alerts.append(_a("SKIN_LESION_DETECTED", "skin_condition", "warning",
                f"Skin lesion detected — CNN classification: {vitals.skin_classification}{conf_str}"))
        elif vitals.skin_condition == "cyanotic":
            alerts.append(_a("CYANOSIS", "skin_condition", "critical",
                "Cyanosis detected — possible respiratory/cardiac compromise"))
        else:
            alerts.append(_a("SKIN_ABNORMALITY", "skin_condition", "info",
                f"Skin appearance: {vitals.skin_condition}"))

    # ── Signal 11: Facial Pallor / Anemia ─────────────────────────
    if vitals.pallor_score is not None and vitals.pallor_score > 0.5:
        hb_info = f" (est. Hb: {vitals.hemoglobin_estimate} g/dL)" if vitals.hemoglobin_estimate else ""
        ps = vitals.pallor_score
        if ps > 0.8:
            alerts.append(_a("SEVERE_PALLOR", "pallor_score", "critical",
                f"Severe pallor detected (score: {ps:.0%}){hb_info} — anemia likely", 0.8, ps))
        else:
            alerts.append(_a("FACIAL_PALLOR", "pallor_score", "warning",
                f"Facial pallor detected (score: {ps:.0%}){hb_info} — consider CBC", 0.5, ps))

    # ── Signal 12: Facial Asymmetry (Stroke) ──────────────────────
    if vitals.facial_asymmetry_score is not None:
        fa = vitals.facial_asymmetry_score
        if fa > 0.8:
            alerts.append(_a("SEVERE_FACIAL_ASYMMETRY", "facial_asymmetry_score", "critical",
                f"Severe facial asymmetry ({fa:.0%}) — STROKE SUSPECTED — initiate FAST protocol", 0.8, fa))
        elif fa > 0.6:
            alerts.append(_a("FACIAL_ASYMMETRY", "facial_asymmetry_score", "critical",
                f"Significant facial asymmetry ({fa:.0%}) — possible stroke indicator", 0.6, fa))

    # ── Additional Vitals ─────────────────────────────────────────
    if vitals.temperature is not None:
        t = vitals.temperature
        if t > 39.5:    alerts.append(_a("HIGH_FEVER",      "temperature", "critical", f"High fever ({t}°C)", 39.5, t))
        elif t > 38.5:  alerts.append(_a("FEVER",           "temperature", "warning",  f"Fever detected ({t}°C)", 38.5, t))
        elif t < 35:    alerts.append(_a("HYPOTHERMIA",     "temperature", "critical", f"Hypothermia ({t}°C)", 35, t))
        elif t < 35.5:  alerts.append(_a("LOW_TEMPERATURE", "temperature", "warning",  f"Low body temperature ({t}°C)", 35.5, t))

    if vitals.blood_pressure_systolic is not None:
        sbp = vitals.blood_pressure_systolic
        if sbp > 180:   alerts.append(_a("HYPERTENSIVE_CRISIS", "blood_pressure_systolic", "critical", f"Hypertensive crisis (SBP: {sbp} mmHg)", 180, sbp))
        elif sbp > 140: alerts.append(_a("HYPERTENSION",        "blood_pressure_systolic", "warning",  f"Elevated blood pressure (SBP: {sbp} mmHg)", 140, sbp))
        elif sbp < 80:  alerts.append(_a("HYPOTENSION",         "blood_pressure_systolic", "warning",  f"Hypotension warning (SBP: {sbp} mmHg)", 80, sbp))

    return alerts


def build_vitals_context(vitals: Optional[VitalsData]) -> str:
    """
    Build comprehensive human-readable vitals context for AI prompt.
    Organized by the 12 CV signal pipelines.
    """
    if not vitals:
        return "No vitals data available from patient camera"

    sections = []

    # Signal 1-3: Cardiopulmonary
    cardio = []
    if vitals.heart_rate is not None:
        cardio.append(f"HR: {vitals.heart_rate} bpm (rPPG)")
    if vitals.respiration_rate is not None:
        cardio.append(f"RR: {vitals.respiration_rate}/min (chest motion)")
    if vitals.spo2 is not None:
        cardio.append(f"SpO2: {vitals.spo2}% (experimental rPPG)")
    if cardio:
        sections.append("Cardiopulmonary: " + " | ".join(cardio))

    # Signal 4: Stress/HRV
    if vitals.stress_level or vitals.hrv_rmssd is not None:
        hrv_parts = []
        if vitals.stress_level:
            hrv_parts.append(f"Stress: {vitals.stress_level}")
        if vitals.hrv_rmssd is not None:
            hrv_parts.append(f"RMSSD: {vitals.hrv_rmssd}ms")
        if vitals.hrv_sdnn is not None:
            hrv_parts.append(f"SDNN: {vitals.hrv_sdnn}ms")
        sections.append("HRV/Stress: " + " | ".join(hrv_parts))

    # Signal 5: Drowsiness
    if vitals.drowsiness_score is not None:
        sections.append(f"Drowsiness: {vitals.drowsiness_score:.0%} (EAR method)")

    # Signal 6: Pain
    if vitals.pain_score is not None:
        au_info = f" [AUs: {vitals.pain_action_units}]" if vitals.pain_action_units else ""
        sections.append(f"Pain: {vitals.pain_score}/10 (FACS{au_info})")

    # Signal 7: Posture
    if vitals.posture:
        angle = f" (spine: {vitals.spine_angle}°)" if vitals.spine_angle is not None else ""
        sections.append(f"Posture: {vitals.posture}{angle}")

    # Signal 8: Fall
    if vitals.fall_detected:
        sections.append("⚠️ FALL DETECTED")

    # Signal 9: Tremor
    if vitals.tremor_detected:
        parts = []
        if vitals.tremor_severity is not None:
            parts.append(f"severity {vitals.tremor_severity}/10")
        if vitals.tremor_frequency is not None:
            parts.append(f"freq {vitals.tremor_frequency}Hz")
        sections.append(f"Tremor: detected ({', '.join(parts)})" if parts else "Tremor: detected")

    # Signal 10: Skin
    if vitals.skin_condition and vitals.skin_condition != "normal":
        skin_info = vitals.skin_condition
        if vitals.skin_classification:
            skin_info += f" → {vitals.skin_classification}"
        sections.append(f"Skin: {skin_info}")

    # Signal 11: Pallor/Anemia
    if vitals.pallor_score is not None and vitals.pallor_score > 0.3:
        hb = f" (est. Hb: {vitals.hemoglobin_estimate} g/dL)" if vitals.hemoglobin_estimate else ""
        sections.append(f"Pallor: {vitals.pallor_score:.0%}{hb}")

    # Signal 12: Facial Asymmetry
    if vitals.facial_asymmetry_score is not None and vitals.facial_asymmetry_score > 0.2:
        sections.append(f"Facial Asymmetry: {vitals.facial_asymmetry_score:.0%}")

    # Additional vitals
    extra = []
    if vitals.temperature is not None:
        extra.append(f"Temp: {vitals.temperature}°C")
    if vitals.blood_pressure_systolic is not None and vitals.blood_pressure_diastolic is not None:
        extra.append(f"BP: {vitals.blood_pressure_systolic}/{vitals.blood_pressure_diastolic} mmHg")
    if extra:
        sections.append("Additional: " + " | ".join(extra))

    return "\n".join(sections) if sections else "No vitals data available"


# ── Endpoints ─────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "swastik-ai-consultation",
        "version": "2.0.0",
        "signals_supported": 12,
        "timestamp": datetime.utcnow().isoformat(),
        "providers": {
            "groq": bool(GROQ_API_KEY),
            "huggingface": bool(HUGGINGFACE_API_KEY),
        },
        "mongodb": db is not None,
    }


@app.get("/api/ai/signals")
async def list_signals():
    """Lists all 12 supported CV health signals with their pipeline descriptions."""
    return {
        "signals": [
            {"id": 1, "key": "heart_rate_rppg", "name": "Heart Rate", "method": "rPPG (face ROI → FFT → BPM)", "fields": ["heart_rate"]},
            {"id": 2, "key": "respiration_monitoring", "name": "Respiration Rate", "method": "MediaPipe Pose chest/shoulder motion", "fields": ["respiration_rate"]},
            {"id": 3, "key": "spo2_estimation", "name": "Blood Oxygen (SpO2)", "method": "Multi-channel rPPG regression (experimental)", "fields": ["spo2"]},
            {"id": 4, "key": "stress_hrv", "name": "Stress / HRV", "method": "RR intervals → RMSSD, SDNN", "fields": ["stress_level", "hrv_rmssd", "hrv_sdnn"]},
            {"id": 5, "key": "drowsiness_detection", "name": "Drowsiness / Fatigue", "method": "Eye Aspect Ratio (EAR)", "fields": ["drowsiness_score"]},
            {"id": 6, "key": "pain_level_facs", "name": "Pain Level", "method": "Facial Action Units (FACS) → AU4, AU6, AU9", "fields": ["pain_score", "pain_action_units"]},
            {"id": 7, "key": "posture_analysis", "name": "Abnormal Posture", "method": "Pose landmarks → spine angle", "fields": ["posture", "spine_angle"]},
            {"id": 8, "key": "fall_detection", "name": "Fall Detection", "method": "Torso angle + vertical velocity (LSTM)", "fields": ["fall_detected"]},
            {"id": 9, "key": "tremor_detection", "name": "Tremor Detection", "method": "Landmark jitter → FFT (4-6 Hz)", "fields": ["tremor_detected", "tremor_severity", "tremor_frequency"]},
            {"id": 10, "key": "skin_condition_screening", "name": "Skin Condition", "method": "MobileNet/EfficientNet CNN", "fields": ["skin_condition", "skin_classification", "skin_confidence"]},
            {"id": 11, "key": "facial_pallor_anemia", "name": "Facial Pallor (Anemia)", "method": "Conjunctiva ROI → color regression → Hb estimate", "fields": ["pallor_score", "hemoglobin_estimate"]},
            {"id": 12, "key": "facial_asymmetry_stroke", "name": "Facial Asymmetry (Stroke)", "method": "L/R face landmark comparison", "fields": ["facial_asymmetry_score"]},
        ]
    }


@app.post("/api/ai/consult", response_model=None)
async def ai_consult(ctx: ConsultationContext, user: dict = Depends(verify_doctor_token)):
    """
    Main AI consultation endpoint.
    Receives vitals (all 12 CV signals) + symptoms + history → structured clinical reasoning.
    """
    start_time = time.time()

    # Generate vitals-based alerts from all 12 signals
    vitals_alerts = analyze_vitals_for_alerts(ctx.vitals)
    vitals_context = build_vitals_context(ctx.vitals)

    # Count active signals
    active_signals = []
    if ctx.vitals:
        v = ctx.vitals
        if v.heart_rate is not None: active_signals.append("rPPG Heart Rate")
        if v.respiration_rate is not None: active_signals.append("Respiration")
        if v.spo2 is not None: active_signals.append("SpO2")
        if v.stress_level or v.hrv_rmssd is not None: active_signals.append("Stress/HRV")
        if v.drowsiness_score is not None: active_signals.append("Drowsiness")
        if v.pain_score is not None: active_signals.append("Pain (FACS)")
        if v.posture: active_signals.append("Posture")
        if v.fall_detected: active_signals.append("Fall")
        if v.tremor_detected: active_signals.append("Tremor")
        if v.skin_condition and v.skin_condition != "normal": active_signals.append("Skin")
        if v.pallor_score is not None: active_signals.append("Pallor")
        if v.facial_asymmetry_score is not None: active_signals.append("Facial Asymmetry")

    # Sanitize inputs
    symptoms = (ctx.symptoms or "Not specified")[:500].replace("\n", " ")
    history = (ctx.history or "None provided")[:500].replace("\n", " ")
    diagnosis = (ctx.diagnosis_notes or "None yet")[:500].replace("\n", " ")

    system_prompt = f"""You are Swastik Clinical AI Assistant — an advanced reasoning engine for licensed doctors during active telemedicine consultations on the Swastik Healthcare Platform.

REAL-TIME CONTEXT:
- Doctor: Dr. {ctx.doctor_name} ({ctx.doctor_specialization})
- Patient symptoms: {symptoms}
- Patient medical history: {history}
- Current diagnosis notes: {diagnosis}
- Active CV signals ({len(active_signals)}/12): {', '.join(active_signals) if active_signals else 'None active'}

LIVE COMPUTER VISION VITALS (from patient camera):
{vitals_context}

AUTO-DETECTED ALERTS:
{chr(10).join(f'• [{a["severity"].upper()}] {a["message"]}' for a in vitals_alerts) if vitals_alerts else '• None'}

ABOUT THE 12 CV SIGNALS:
These are real-time health indicators extracted from the patient's phone camera using computer vision:
1. Heart Rate via rPPG — face skin color changes → FFT → BPM
2. Respiration Rate — chest/shoulder motion tracking via MediaPipe Pose
3. SpO2 — experimental multi-channel rPPG (accuracy varies with lighting/skin tone)
4. Stress/HRV — heartbeat variability metrics (RMSSD, SDNN) from pulse waveform
5. Drowsiness — Eye Aspect Ratio monitoring
6. Pain Level — Facial Action Coding System (AU4=brow lower, AU6=cheek raise, AU9=nose wrinkle)
7. Posture — Spine angle from shoulder/hip/knee landmarks
8. Fall Detection — Sudden torso angle + velocity changes
9. Tremor — Landmark micro-jitter, FFT frequency analysis (4-6Hz = Parkinson range)
10. Skin Condition — CNN classification of visible lesions
11. Facial Pallor — Conjunctiva/lip color analysis for anemia screening
12. Facial Asymmetry — L/R face muscle movement comparison for stroke detection

YOUR ROLE:
You assist the DOCTOR (not the patient). You MUST:
1. Analyze ALL active CV signals in context of reported symptoms
2. Correlate signals with each other (e.g., tachycardia + drowsiness + pallor = possible hemorrhage)
3. Generate clinically relevant alerts with signal attribution
4. Suggest possible conditions based on combined symptoms + vitals
5. Recommend follow-up questions the doctor should ask
6. Note limitations of CV-derived measurements (screening, not clinical-grade)
7. Flag any signal combinations that suggest emergency

RESPOND ONLY WITH THIS JSON:
{{
  "alerts": ["alert1", "alert2"],
  "possible_conditions": ["condition1", "condition2"],
  "suggested_questions": ["question1", "question2"],
  "summary": "Consultation summary combining symptoms and all active CV signals",
  "clinical_notes": "Structured medical notes",
  "risk_indicators": ["risk1", "risk2"],
  "severity_assessment": "mild|moderate|severe|critical",
  "suggested_medications": [
    {{"name": "Drug", "dosage": "Dosage", "frequency": "BD/TDS", "duration": "5 days", "notes": "Precautions"}}
  ],
  "differential_diagnoses": ["diagnosis1", "diagnosis2"],
  "recommended_tests": ["test1", "test2"],
  "vitals_interpretation": "Clinical interpretation of ALL active CV signals with cross-correlations",
  "signal_analysis": {{
    "heart_rate_rppg": "interpretation of rPPG HR",
    "stress_hrv": "interpretation of HRV metrics"
  }},
  "answer": "Direct answer to the doctor's query"
}}

RULES:
1. You are assisting a LICENSED DOCTOR — provide specific, actionable guidance
2. Always correlate CV signals with symptoms (e.g., tachycardia + chest tightness = cardiac concern)
3. Flag anomalous signal combinations the doctor might miss
4. Include drug interaction warnings and contraindications
5. If signals suggest emergency (fall, facial asymmetry, critical values), flag IMMEDIATELY
6. Note that SpO2, pallor, and skin screening are experimental — recommend device confirmation
7. For tremor in 4-6Hz range, suggest Parkinson screening
8. For facial asymmetry > 60%, suggest FAST stroke assessment
9. Be concise and clinically precise"""

    # Load conversation memory from MongoDB
    conversation_history = []
    if db:
        try:
            cursor = db.doctor_ai_interactions.find(
                {"consultationId": ctx.consultation_id, "doctorUserId": user.get("userId") or user.get("id")},
            ).sort("timestamp", 1).limit(8)
            async for doc in cursor:
                conversation_history.append({"role": "user", "content": doc.get("query", "")})
                resp = doc.get("response", {})
                conversation_history.append({
                    "role": "assistant",
                    "content": json.dumps(resp) if isinstance(resp, dict) else str(resp),
                })
        except Exception as e:
            print(f"[AI Service] Memory load failed: {e}")

    messages = [
        {"role": "system", "content": system_prompt},
        *conversation_history,
        {"role": "user", "content": ctx.query},
    ]

    # Call AI with fallback
    ai_result = await call_ai(messages)
    parsed = parse_json_response(ai_result["content"])

    # Merge Layer 1 structured alerts with Layer 2 AI-generated string alerts (converted to structured)
    ts_now = datetime.utcnow().isoformat() + "Z"
    existing_messages = {a["message"] for a in vitals_alerts}
    ai_string_alerts = [
        {"code": "AI_ALERT", "metric": "composite", "severity": "warning",
         "threshold": None, "current_value": None, "message": a, "timestamp": ts_now}
        for a in parsed.get("alerts", [])
        if isinstance(a, str) and a not in existing_messages
    ]
    all_alerts = vitals_alerts + ai_string_alerts

    response_data = {
        "alerts": all_alerts,
        "possible_conditions": parsed.get("possible_conditions", []),
        "suggested_questions": parsed.get("suggested_questions", []),
        "summary": parsed.get("summary", ""),
        "clinical_notes": parsed.get("clinical_notes", ""),
        "risk_indicators": parsed.get("risk_indicators", []),
        "severity_assessment": parsed.get("severity_assessment", "mild"),
        "suggested_medications": parsed.get("suggested_medications", []),
        "differential_diagnoses": parsed.get("differential_diagnoses", []),
        "recommended_tests": parsed.get("recommended_tests", []),
        "vitals_interpretation": parsed.get("vitals_interpretation", ""),
        "signal_analysis": parsed.get("signal_analysis", {}),
        "answer": parsed.get("answer", parsed.get("summary", "")),
        "active_signals": active_signals,
        "total_signals_active": len(active_signals),
    }

    latency_ms = int((time.time() - start_time) * 1000)

    # Save to MongoDB audit trail
    if db:
        try:
            doctor_id = user.get("userId") or user.get("id")
            await db.doctor_ai_interactions.insert_one({
                "consultationId": ctx.consultation_id,
                "doctorUserId": doctor_id,
                "doctorName": ctx.doctor_name,
                "query": ctx.query,
                "response": response_data,
                "vitals_snapshot": ctx.vitals.model_dump() if ctx.vitals else None,
                "active_signals": active_signals,
                "provider": ai_result["provider"],
                "model": ai_result["model"],
                "latencyMs": latency_ms,
                "timestamp": datetime.utcnow(),
            })
        except Exception as e:
            print(f"[AI Service] Audit save failed: {e}")

    return {
        "success": True,
        "data": {
            "response": response_data,
            "provider": ai_result["provider"],
            "model": ai_result["model"],
            "latencyMs": latency_ms,
        },
    }


@app.post("/api/ai/summarize")
async def summarize_consultation(req: ConsultationSummaryRequest, user: dict = Depends(verify_doctor_token)):
    """Generate structured consultation summary with all 12 CV signal data."""
    start_time = time.time()

    vitals_str = ""
    if req.vitals_history:
        latest = req.vitals_history[0] if req.vitals_history else {}
        v = latest.get("vitals", latest)
        vitals_parts = []
        for key in ["heart_rate", "respiration_rate", "spo2", "temperature", "posture",
                     "pain_score", "drowsiness_score", "stress_level", "tremor_detected",
                     "pallor_score", "facial_asymmetry_score", "skin_condition",
                     "hrv_rmssd", "hrv_sdnn", "tremor_frequency", "hemoglobin_estimate", "spine_angle"]:
            if v.get(key) is not None:
                vitals_parts.append(f"{key}: {v[key]}")
        vitals_str = ", ".join(vitals_parts)

    prompt = f"""Generate a comprehensive consultation summary based on:

Transcript: {req.transcript[:2000] if req.transcript else 'Not available'}
Diagnosis: {req.diagnosis or 'Not specified'}
Vitals during consultation (from 12 CV signals): {vitals_str or 'Not available'}
Prescriptions given: {json.dumps(req.prescriptions[:5]) if req.prescriptions else 'None'}

Note: Vitals were captured using computer vision from the patient's phone camera during the teleconsultation. Include a note about the screening nature of these measurements.

Respond with JSON:
{{
  "consultation_summary": "2-3 paragraph clinical summary including CV signal findings",
  "key_findings": ["finding1", "finding2"],
  "vitals_summary": "Summary of all CV-derived vital signs during consultation",
  "cv_signals_used": ["list of which of 12 signals were active"],
  "diagnosis_confirmed": "Final diagnosis if any",
  "treatment_plan": "Prescribed treatment summary",
  "follow_up_recommendations": ["recommendation1", "recommendation2"],
  "patient_education_notes": "Key points to communicate to patient",
  "icd_codes": ["possible ICD-10 code suggestions"],
  "red_flags_noted": ["any concerns for follow-up"],
  "measurement_caveats": "Note about CV-derived measurement limitations"
}}"""

    messages = [
        {"role": "system", "content": "You are a medical documentation AI for the Swastik Healthcare Platform. Generate precise, structured clinical notes. The consultation used 12 computer vision health signals from the patient's camera. Respond only with valid JSON."},
        {"role": "user", "content": prompt},
    ]

    ai_result = await call_ai(messages, max_tokens=1500)
    parsed = parse_json_response(ai_result["content"])
    latency_ms = int((time.time() - start_time) * 1000)

    # Save summary to MongoDB
    if db:
        try:
            await db.consultation_summaries.insert_one({
                "consultationId": req.consultation_id,
                "doctorUserId": user.get("userId") or user.get("id"),
                "summary": parsed,
                "provider": ai_result["provider"],
                "latencyMs": latency_ms,
                "timestamp": datetime.utcnow(),
            })
        except Exception as e:
            print(f"[AI Service] Summary save failed: {e}")

    return {
        "success": True,
        "data": {
            "summary": parsed,
            "provider": ai_result["provider"],
            "latencyMs": latency_ms,
        },
    }


# ── Run ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("AI_SERVICE_PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
