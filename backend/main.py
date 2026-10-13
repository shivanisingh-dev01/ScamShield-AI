import os
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from detector import analyze_message
from url_detector import analyze_url
from ml.predict import predict_scam


# ==========================================
# LOGGING
# ==========================================

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ScamShieldAI")


# ==========================================
# FASTAPI APPLICATION
# ==========================================

app = FastAPI(
    title="ScamShield AI",
    description="AI-Powered Scam Detection System",
    version="1.0.0"
)


# ==========================================
# CORS CONFIGURATION
# VERCEL FRONTEND + RENDER BACKEND
# ==========================================

# Read allowed frontend URLs from Render environment variables.
#
# Example:
# ALLOWED_ORIGINS=https://scam-shield-ai-j1ew.vercel.app

allowed_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]

# Local development URLs are allowed separately.
# Vercel production URL must be included in ALLOWED_ORIGINS.

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ==========================================
# REQUEST MODELS
# ==========================================

class MessageRequest(BaseModel):
    text: str = Field(
        ...,
        min_length=1,
        max_length=10000
    )


class URLRequest(BaseModel):
    url: str = Field(
        ...,
        min_length=1,
        max_length=2048
    )


# ==========================================
# HOME ENDPOINT
# ==========================================

@app.get("/")
def home():
    return {
        "application": "ScamShield AI",
        "status": "running",
        "version": "1.0.0",
        "mode": "Scam Detection"
    }


# ==========================================
# HEALTH CHECK
# ==========================================

@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "ScamShield AI"
    }


# ==========================================
# MESSAGE SCAM DETECTION
# ==========================================

@app.post("/api/analyze")
def analyze_message_endpoint(request: MessageRequest):

    try:
        result = analyze_message(request.text)

        return result

    except Exception:
        logger.exception("Message analysis failed")

        raise HTTPException(
            status_code=500,
            detail="Message analysis failed"
        )


# ==========================================
# URL SCAM DETECTION
# ==========================================

@app.post("/api/analyze-url")
def analyze_url_endpoint(request: URLRequest):

    try:
        result = analyze_url(request.url)

        return result

    except Exception:
        logger.exception("URL analysis failed")

        raise HTTPException(
            status_code=500,
            detail="URL analysis failed"
        )


# ==========================================
# MACHINE LEARNING SCAM DETECTION
# ==========================================

@app.post("/api/analyze-ml")
def analyze_ml_endpoint(request: MessageRequest):

    try:
        result = predict_scam(request.text)

        return {
            "success": True,
            "message": request.text,
            "prediction": result["prediction"],
            "scam_probability": result["scam_probability"],
            "model": result["model"]
        }

    except Exception:
        logger.exception("ML analysis failed")

        raise HTTPException(
            status_code=500,
            detail="ML analysis failed"
        )


# ==========================================
# LOCAL DEVELOPMENT SERVER
# ==========================================

if __name__ == "__main__":

    import uvicorn

    port = int(os.getenv("PORT", "8002"))

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port
    )