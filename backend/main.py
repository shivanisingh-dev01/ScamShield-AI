from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from detector import analyze_message
from url_detector import analyze_url
from ml.predict import predict_scam


app = FastAPI(
    title="ScamShield AI",
    description="Manual Scam Detection System",
    version="1.0.0"
)

# Allow local React frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


class MessageRequest(BaseModel):
    text: str = Field(..., min_length=1)


class URLRequest(BaseModel):
    url: str = Field(..., min_length=1)


@app.get("/")
def home():
    return {
        "application": "ScamShield AI",
        "status": "running",
        "mode": "Manual Scam Detection"
    }


@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "ScamShield AI"
    }


@app.post("/api/analyze")
def analyze_message_endpoint(request: MessageRequest):
    try:
        return analyze_message(request.text)
    except Exception as error:
        print("Message analysis error:", error)
        raise HTTPException(
            status_code=500,
            detail="Message analysis failed"
        )


@app.post("/api/analyze-url")
def analyze_url_endpoint(request: URLRequest):
    try:
        return analyze_url(request.url)
    except Exception as error:
        print("URL analysis error:", error)
        raise HTTPException(
            status_code=500,
            detail="URL analysis failed"
        )


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
    except Exception as error:
        print("ML analysis error:", error)
        raise HTTPException(
            status_code=500,
            detail="ML analysis failed"
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8002
    )