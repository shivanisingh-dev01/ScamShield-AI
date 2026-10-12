import re


def analyze_message(text: str):

    text = text.lower()

    score = 0
    detected_keywords = []

    scam_keywords = {
        "urgent": 15,
        "verify your account": 25,
        "click here": 15,
        "lottery": 20,
        "winner": 15,
        "free money": 30,
        "bank account": 20,
        "password": 25,
        "otp": 25,
        "limited time": 15,
        "claim your prize": 30,
        "suspended": 20,
        "transfer money": 25,
        "congratulations": 10,
        "gift card": 20,
        "crypto investment": 25
    }

    for keyword, points in scam_keywords.items():
        if keyword in text:
            score += points
            detected_keywords.append(keyword)

    # Detect URLs
    urls = re.findall(r"https?://[^\s]+", text)

    if urls:
        score += 10

    # Detect urgency
    if "immediately" in text:
        score += 15

    score = min(score, 100)

    if score >= 60:
        risk = "High Risk"
        verdict = "Potential Scam Detected"

    elif score >= 30:
        risk = "Medium Risk"
        verdict = "Suspicious Content"

    else:
        risk = "Low Risk"
        verdict = "No Strong Scam Indicators Found"

    return {
        "risk_score": score,
        "risk_level": risk,
        "verdict": verdict,
        "detected_keywords": detected_keywords,
        "urls_found": urls,
        "recommendation": (
            "Avoid clicking links or sharing personal information."
            if score >= 30
            else "Stay cautious and verify the sender."
        )
    }