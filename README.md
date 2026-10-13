# 🛡️ ScamShield AI

> **AI-Powered Scam Detection System** — Analyze messages and URLs in real time to protect yourself from phishing, fraud, and online scams.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [API Reference](#-api-reference)
- [How It Works](#-how-it-works)
- [Deployment](#-deployment)
- [Security Notes](#-security-notes)

---

## 🔍 Overview

ScamShield AI is a full-stack web application that uses **keyword-based heuristics**, **URL intelligence**, and a **Naive Bayes machine learning model** to detect potential scams in text messages and URLs.

Users can paste a suspicious message or URL and instantly receive a risk assessment — including a risk score, verdict, detected keywords, and safety recommendations.

---

## ✨ Features

- 📩 **Message Analysis** — Scans text for scam keywords, urgency phrases, and embedded URLs with a weighted scoring system.
- 🔗 **URL Analysis** — Performs DNS resolution, structure checks, and optional Google Safe Browsing lookup to assess URL safety.
- 🤖 **ML-Based Detection** — A custom-trained **Multinomial Naive Bayes** model provides a probability score for scam classification.
- 🏷️ **Brand Intelligence** — Detects possible brand impersonation against a curated catalog of known domains (`brands.csv`).
- 📊 **Risk Scoring** — Returns a 0–100 risk score with verdicts: `Low Risk`, `Medium Risk`, or `High Risk`.
- 📧 **Gmail Integration** — Automated scanning of Gmail inbox via the Gmail API (`gmail_auto.py`).

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| **Python** | Core language |
| **FastAPI** | REST API framework |
| **Uvicorn** | ASGI web server |
| **Pydantic** | Request validation |
| **Naive Bayes (custom)** | ML scam classifier |
| **Gmail API** | Email scanning |

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 19** | UI framework |
| **TypeScript** | Type-safe JavaScript |
| **Vite** | Build tool & dev server |
| **Framer Motion** | Animations |
| **Recharts** | Data visualizations |
| **Lucide React** | Icons |

---

## 📁 Project Structure

```
ScamShield AI/
├── backend/
│   ├── main.py                # FastAPI app & API endpoints
│   ├── detector.py            # Keyword-based message analysis
│   ├── url_detector.py        # URL risk analysis with DNS & Safe Browsing
│   ├── brand_intelligence.py  # Brand impersonation detection
│   ├── brands.csv             # Curated brand/domain catalog
│   ├── gmail_auto.py          # Gmail inbox scanner
│   ├── import_brand_csv.py    # Bulk brand CSV importer
│   ├── requirements.txt       # Python dependencies
│   └── ml/
│       ├── train_model.py     # Model training script
│       ├── predict.py         # Inference / prediction
│       ├── scam_model.json    # Trained Naive Bayes model
│       └── training_data.csv  # Labeled training data
└── frontend/
    ├── index.html
    ├── package.json
    └── src/
        ├── App.tsx            # Main application component
        ├── components/        # Reusable UI components
        ├── pages/             # Page-level components
        └── utils/             # Helper utilities
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.9+
- Node.js 18+
- npm

---

### Backend Setup

```bash
# Navigate to the backend directory
cd backend

# Create and activate a virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the development server
uvicorn main:app --host 127.0.0.1 --port 8002 --reload
```

The backend will be available at: `http://127.0.0.1:8002`

Interactive API docs: `http://127.0.0.1:8002/docs`

---

### Frontend Setup

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will be available at: `http://localhost:5173`

---

## 📡 API Reference

### `GET /`
Health check — returns application status.

### `GET /api/health`
Returns `{ "status": "healthy" }`.

### `POST /api/analyze`
Analyze a text message for scam indicators.

**Request body:**
```json
{
  "text": "Congratulations! You've won a free gift card. Click here to claim now!"
}
```

**Response:**
```json
{
  "risk_score": 75,
  "risk_level": "High Risk",
  "verdict": "Potential Scam Detected",
  "detected_keywords": ["congratulations", "gift card", "click here"],
  "urls_found": [],
  "recommendation": "Avoid clicking links or sharing personal information."
}
```

---

### `POST /api/analyze-url`
Analyze a URL for phishing or impersonation.

**Request body:**
```json
{
  "url": "https://paypa1-login.example.org"
}
```

---

### `POST /api/analyze-ml`
Run the Naive Bayes ML model on a message.

**Request body:**
```json
{
  "text": "Your bank account has been suspended. Verify immediately."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Your bank account has been suspended. Verify immediately.",
  "prediction": "Scam",
  "scam_probability": 0.9731,
  "model": "Multinomial Naive Bayes"
}
```

---

## 🧠 How It Works

### 1. Keyword Heuristics (`detector.py`)
A weighted keyword dictionary assigns points for scam-related phrases (e.g., `"free money"` = 30 pts, `"otp"` = 25 pts). The final score (capped at 100) maps to a risk level:

| Score | Risk Level |
|-------|-----------|
| 0–29  | 🟢 Low Risk |
| 30–59 | 🟡 Medium Risk |
| 60–100| 🔴 High Risk |

### 2. URL Analysis (`url_detector.py`)
- DNS resolution checks for suspicious domains
- URL structure analysis (lookalike characters, suspicious TLDs)
- Brand impersonation detection via `brands.csv`
- Optional **Google Safe Browsing API** integration

### 3. Naive Bayes ML (`ml/predict.py`)
A Multinomial Naive Bayes classifier trained on labeled scam/legitimate messages. It uses Laplace smoothing and returns a `scam_probability` (0.0 – 1.0).

To retrain the model:
```bash
cd backend
python ml/train_model.py
```

---

## 🌐 Deployment

This project is configured for:
- **Backend** → [Render](https://render.com) (set `ALLOWED_ORIGINS` env variable)
- **Frontend** → [Vercel](https://vercel.com)

### Environment Variables (Backend — Render)

| Variable | Description |
|----------|-------------|
| `ALLOWED_ORIGINS` | Comma-separated list of allowed frontend URLs (e.g., `https://your-app.vercel.app`) |
| `GOOGLE_SAFE_BROWSING_API_KEY` | *(Optional)* Google Safe Browsing API key for URL lookup |
| `PORT` | Server port (default: `8002`) |

---

## 🔒 Security Notes

- **Never expose API keys in frontend code.** Use environment variables on the server.
- The URL detector performs DNS resolution but does **not** follow or fetch user-provided URLs to avoid SSRF vulnerabilities.
- A brand catalog match indicates *possible* impersonation — it does not confirm fraud. Always verify independently.
- Enable **Google Safe Browsing** for production deployments to catch known malicious URLs.
- Apply **rate limiting** and **authentication** before any public release.

---

## 📄 License

This project is for educational and personal use. See individual dependency licenses for third-party libraries.

---

<p align="center">Built with ❤️ to fight online scams</p>
