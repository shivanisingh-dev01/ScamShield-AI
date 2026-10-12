"""ScamShield AI URL analyzer for manual scans.

Never opens/fetches the submitted website. Performs hostname DNS checks,
heuristics, optional certificate validation, and optional Google Safe Browsing.
Not a guarantee that any website is safe.
"""
from __future__ import annotations

import ipaddress
import os
import re
import socket
import ssl
import threading
import time
from urllib.parse import urlsplit

import requests
from brand_intelligence import check_brand_impersonation, catalog_stats

SHORTENERS = {"bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "rb.gy"}
SUSPICIOUS_TERMS = {"verify", "password", "login", "confirm", "unlock", "suspended", "urgent", "claim"}
_REPUTATION_CACHE: dict[str, tuple[float, dict]] = {}
_CACHE_LOCK = threading.Lock()


def _belongs_to(host: str, official: str) -> bool:
    return host == official or host.endswith("." + official)


def _validate_and_normalize(raw: str):
    if not isinstance(raw, str) or not 1 <= len(raw.strip()) <= 2048:
        raise ValueError("Enter a URL containing 1–2048 characters.")
    raw = raw.strip()
    if any(ch.isspace() or ord(ch) < 32 for ch in raw):
        raise ValueError("URLs cannot contain spaces or control characters.")
    if "://" in raw and not re.match(r"^https?://", raw, re.I):
        raise ValueError("Only HTTP and HTTPS URLs are supported.")
    normalized = raw if re.match(r"^https?://", raw, re.I) else "https://" + raw
    try:
        parts = urlsplit(normalized)
        host = (parts.hostname or "").lower().rstrip(".")
        port = parts.port  # May raise ValueError
        if not host or parts.scheme.lower() not in ("https", "http"):
            raise ValueError
        host = host.encode("idna").decode("ascii")
        if len(host) > 253:
            raise ValueError
        try:
            ipaddress.ip_address(host)
        except ValueError:
            labels = host.split(".")
            if len(labels) < 2 or any(
                not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label)
                for label in labels
            ):
                raise ValueError
    except (ValueError, UnicodeError) as exc:
        raise ValueError("Enter a valid HTTP or HTTPS website URL.") from exc
    return normalized, parts, host, port


def _dns_check(host: str) -> tuple[str, list[str]]:
    """Only DNS lookup; never request the user's URL or follow redirects."""
    try:
        addresses = sorted({
            entry[4][0]
            for entry in socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
        })
    except socket.gaierror as exc:
        if exc.errno == socket.EAI_NONAME:
            return "not_resolved", []
        return "lookup_failed", []
    except OSError:
        return "lookup_failed", []
    if not addresses:
        return "not_resolved", []
    # Don't connect to arbitrary private, loopback, or reserved destinations.
    try:
        if any(not ipaddress.ip_address(addr).is_global for addr in addresses):
            return "restricted_address", []
    except ValueError:
        return "lookup_failed", []
    return "resolved", addresses


def _tls_check(host: str, addresses: list[str]) -> str:
    """Optional certificate check against a validated public IP, no HTTP fetch.

    Only use for standard HTTPS port 443. DNS re-resolution is avoided by
    connecting directly to an already checked IP while using hostname SNI.
    """
    context = ssl.create_default_context()
    for address in addresses[:2]:
        family = socket.AF_INET6 if ":" in address else socket.AF_INET
        try:
            with socket.socket(family, socket.SOCK_STREAM) as sock:
                sock.settimeout(3)
                sock.connect((address, 443))
                with context.wrap_socket(sock, server_hostname=host):
                    return "valid_certificate"
        except ssl.SSLCertVerificationError:
            return "invalid_certificate"
        except (ssl.SSLError, OSError):
            continue
    return "connection_unavailable"


def _reputation_lookup(url: str) -> dict:
    """Contact Google's threat API only; never access the URL being checked."""
    key = os.getenv("GOOGLE_SAFE_BROWSING_API_KEY", "").strip()
    if not key:
        return {"status": "not_configured", "threat_types": []}

    with _CACHE_LOCK:
        old = _REPUTATION_CACHE.get(url)
        if old and old[0] > time.monotonic():
            return old[1]

    try:
        response = requests.get(
            "https://safebrowsing.googleapis.com/v5/urls:search",
            params={"key": key, "urls[]": url},
            timeout=6,
        )
        response.raise_for_status()
        body = response.json()
        threats = body.get("threats", [])
        types = sorted({item for match in threats for item in match.get("threatTypes", [])})
        result = {"status": "matched" if threats else "no_known_match", "threat_types": types}
        duration = str(body.get("cacheDuration", "0s"))
        try:
            seconds = max(0.0, float(duration.removesuffix("s")))
        except ValueError:
            seconds = 0.0
        if seconds:
            with _CACHE_LOCK:
                _REPUTATION_CACHE[url] = (time.monotonic() + seconds, result)
        return result
    except (requests.RequestException, ValueError, TypeError):
        return {"status": "unavailable", "threat_types": []}


def analyze_url(url: str) -> dict:
    normalized, parts, host, port = _validate_and_normalize(url)
    score = 0
    warnings: list[str] = []
    indicators: list[str] = []

    def flag(points: int, indicator: str, explanation: str):
        nonlocal score
        score += points
        indicators.append(indicator)
        warnings.append(explanation)

    if parts.scheme.lower() == "http":
        flag(15, "HTTP", "The link uses HTTP, which does not encrypt web traffic.")
    if "@" in parts.netloc or parts.username is not None:
        flag(40, "misleading @ symbol", "The @ symbol can disguise the true destination hostname.")
    if any(part.startswith("xn--") for part in host.split(".")):
        flag(20, "punycode", "Internationalized hostname: examine for lookalike characters.")
    if host in SHORTENERS:
        flag(25, "shortened URL", "The short link hides its final destination; redirects were not followed.")
    try:
        ipaddress.ip_address(host)
        flag(20, "IP address URL", "This link uses a numeric IP address instead of a domain name.")
    except ValueError:
        pass
    if port not in (None, 80, 443):
        flag(15, "unusual port", "The link specifies a nonstandard web port.")
    if len(normalized) > 130:
        flag(10, "long URL", "The URL is unusually long.")
    if host.count(".") >= 4:
        flag(10, "many subdomains", "The hostname contains unusually many subdomain levels.")

    # Scalable catalog-based identity checks. This database can contain
    # thousands of brands without changing source code.
    brand_finding = check_brand_impersonation(host)
    matching_brand = None
    matched_official = None
    if brand_finding:
        matching_brand = brand_finding["brand"]
        matched_official = brand_finding["reference_domain"]
        flag(70, "potential brand impersonation", (
            f"Possible {matching_brand} impersonation ({brand_finding['match_type']}). "
            f"The hostname is not under a cataloged official domain. "
            f"Reference domain: {matched_official}. "
            "A name resemblance alone is NOT proof of malicious intent."
        ))

    url_terms = set(re.findall(r"[a-z]+", (parts.path + " " + parts.query).lower()))
    if len(url_terms & SUSPICIOUS_TERMS) >= 2:
        flag(10, "credential / pressure terms", "Multiple credential or urgent-action terms appear in the URL.")

    dns_status, public_ips = _dns_check(host)
    if dns_status == "not_resolved":
        flag(35, "DNS not resolved", "This hostname did not resolve in DNS; website availability and ownership are unverified.")
    elif dns_status == "lookup_failed":
        warnings.append("DNS lookup could not be completed. Website availability remains unknown.")
    elif dns_status == "restricted_address":
        flag(75, "non-public destination", "This hostname resolves to a private, loopback, or otherwise restricted IP address.")
    else:
        warnings.append("DNS resolves, but this does NOT establish that the site is legitimate or reachable.")

    tls_status = "not_checked"
    if os.getenv("SCAMSHIELD_ENABLE_TLS_CHECK", "0") == "1":
        if dns_status == "resolved" and parts.scheme == "https" and port in (None, 443):
            tls_status = _tls_check(host, public_ips)
            if tls_status == "invalid_certificate":
                flag(30, "invalid TLS certificate", "The HTTPS certificate could not be validated.")
            elif tls_status == "connection_unavailable":
                warnings.append("HTTPS certificate check could not connect. Reachability is unverified.")
        else:
            tls_status = "not_applicable"

    reputation = _reputation_lookup(normalized)
    if reputation["status"] == "matched":
        flag(100, "known threat", "Google Safe Browsing reported a known threat for this URL.")
    elif reputation["status"] == "not_configured":
        warnings.append("Online reputation was NOT checked (no API key configured).")
    elif reputation["status"] == "unavailable":
        warnings.append("Online reputation lookup failed; threat-list status is unknown.")
    else:
        warnings.append("No known threat matched in this lookup; this does not prove the link is safe.")

    score = min(100, score)
    if reputation["status"] == "matched":
        risk_level, verdict, verification_status = "HIGH", "Known malicious URL reported", "KNOWN_THREAT"
    elif "potential brand impersonation" in indicators:
        risk_level, verdict, verification_status = "HIGH", "Potential brand impersonation detected", "SUSPICIOUS"
    elif dns_status == "not_resolved":
        risk_level, verdict, verification_status = (
            "HIGH" if score >= 60 else "MEDIUM",
            "Website could not be found in DNS; safety unverified",
            "UNVERIFIED",
        )
    elif score >= 60:
        risk_level, verdict, verification_status = "HIGH", "Multiple suspicious URL indicators", "SUSPICIOUS"
    elif score >= 30:
        risk_level, verdict, verification_status = "MEDIUM", "Potentially suspicious URL", "SUSPICIOUS"
    else:
        risk_level, verdict, verification_status = "LOW", "No major indicators found; safety NOT verified", "NOT_VERIFIED_SAFE"

    return {
        "risk_score": score,
        "risk_level": risk_level,
        "verdict": verdict,
        "detected_keywords": indicators,
        "warnings": warnings,
        "urls_found": [normalized],
        "domain": host,
        "official_domain_reference": matched_official,
        "possible_brand": matching_brand,
        "brand_catalog": catalog_stats(),
        "dns_status": dns_status,
        "tls_status": tls_status,
        "reputation_check": reputation,
        "verification_status": verification_status,
        "recommendation": (
            "Do not enter passwords, OTPs, or payment details. Find the organization's official website independently. "
            "A successful DNS lookup or HTTPS connection does not prove authenticity."
            if score >= 30 or reputation["status"] in ("not_configured", "unavailable")
            else "No obvious warning was detected, but safety is not established. Verify unexpected links independently."
        ),
    }
