# ScamShield AI — scalable brand catalog

## What this upgrade does

The URL detector can now load **an arbitrary-sized curated brand list from `brands.csv`**. Its source no longer has a fixed list of nine brands. Every entry supplies an official hostname reference and optional aliases. A mismatch may be reported as **possible impersonation**. It does not prove fraud. The current seed CSV has 29 *illustrative* domain references; verify the official-domain ownership with primary sources before treating the entries as authoritative.

**No database can cover all brands**, including new businesses, regional companies, trademarks and aliases. Crucially, sites not in the catalog continue to receive DNS, URL structure, and optionally Google Safe Browsing checks. Unrecognized must never mean "safe."

## Installation

Copy `url_detector.py`, `brand_intelligence.py`, and `brands.csv` into `backend/` (back up old `url_detector.py`). From that folder, run:

```powershell
python -m pip install requests
python -m py_compile url_detector.py brand_intelligence.py
python test_brands.py
```

Stop the existing FastAPI backend with Ctrl+C, then run **only one**:

```powershell
python -m uvicorn main:app --host 127.0.0.1 --port 8002
```

Test POST `/api/analyze-url` at `http://127.0.0.1:8002/docs`.

## Adding 1, 100, or 10,000 brands

Add new rows in `brands.csv`:

```csv
brand,aliases,official_domains
Example Company,examplecompany;examplecorp,example.org;login.example.org
```

Use the **exact, independently verified** official domains of each brand, not guesses or domains from untrusted messages. Separate alternate names and official domains with semicolons. `brand_intelligence.py` reads the CSV and refreshes its cache when the file changes. You can import a vetted list of many thousands of brands using `python import_brand_csv.py path/to/verified_brands.csv`. The input file must use the same 3 column names. It merges records by brand name, replacing existing records for that name. Verify the domain ownership independently and back up the CSV before a large import. Duplicate aliases, generic terms and multiple brand ownerships can produce false positives; review data provenance, version and update frequency.

**Use `https://sbi.bank.com`, `https://paypa1.example.org`, `https://paypal-login.example.org`, and `https://www.google.com` as input examples.** These are hypothetical examples, not assertions about the current owner of any URL.

## Why a real-time threat feed is necessary

A brand catalog finds *some* impersonation, not all phishing. Enable the already-optional `GOOGLE_SAFE_BROWSING_API_KEY` to look up **known reported malicious URLs across all brands**; Google Safe Browsing has non-commercial-use restrictions and transmits submitted URLs to Google. Other sources include PhishTank and OpenPhish (review usage terms, update cadence and rate limits). A clean reputation check is never proof of safety.

## Public deployment precautions

Never retrieve/visit user-provided URLs with a server-side `requests.get()` or follow redirects unless you implement strict SSRF defenses, DNS rebinding protection, destination-IP restrictions, and timeouts. This URL detector performs DNS resolution, optional public-IP-pinned TLS checks, and an optional request to Google's fixed API endpoint. Use authentication and rate limiting before public release; never expose API keys in frontend code. Do not call a known official hostname "verified safe": a familiar domain could be compromised.
