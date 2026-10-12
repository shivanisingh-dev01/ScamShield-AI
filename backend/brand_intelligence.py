"""Data-driven brand lookalike detector for ScamShield AI.

Uses a local CSV registry. No URL is visited and no claims of domain safety
are made. The registry must be curated from independently checked sources.
Scales to large registries using alias and domain indexes.
"""
from __future__ import annotations

import csv
import difflib
import re
from pathlib import Path
from functools import lru_cache

BRANDS_CSV = Path(__file__).resolve().with_name("brands.csv")

# Common confusables in ASCII hostnames. False positives are possible.
CONFUSABLE = str.maketrans({"0": "o", "1": "l", "3": "e", "5": "s", "8": "b"})


def _normalize_alias(raw: str) -> str:
    return re.sub(r"[^a-z0-9]", "", raw.casefold())


def _valid_domain(raw: str) -> str | None:
    raw = raw.strip().lower().rstrip(".")
    try:
        raw = raw.encode("idna").decode("ascii")
    except UnicodeError:
        return None
    if not 3 <= len(raw) <= 253 or "." not in raw:
        return None
    if not all(re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label)
               for label in raw.split(".")):
        return None
    return raw


@lru_cache(maxsize=5)
def _load_brand_catalog(file_mtime_ns: int):
    official_to_brand = {}
    brand_to_domains = {}
    aliases = {}
    count = 0
    if not BRANDS_CSV.exists():
        return official_to_brand, brand_to_domains, aliases, {}, count
    with BRANDS_CSV.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {"brand", "aliases", "official_domains"}
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise ValueError("brands.csv needs brand,aliases,official_domains columns")
        for row in reader:
            brand = (row.get("brand") or "").strip()
            domains = tuple(filter(None, (_valid_domain(x) for x in
                                          (row.get("official_domains") or "").split(";"))))
            if not brand or not domains:
                continue
            count += 1
            brand_to_domains.setdefault(brand, set()).update(domains)
            for domain in domains:
                # The source is a user-curated reference; entries aren't automatically verified.
                official_to_brand[domain] = brand
            for alias in [brand, *(row.get("aliases") or "").split(";")]:
                norm = _normalize_alias(alias)
                # Short/generic brand names can create excessive false positives.
                if len(norm) < 3:
                    continue
                if norm not in aliases:
                    aliases[norm] = (brand, domains[0])
    # Indexed fuzzy candidates (first character, alias length).
    buckets = {}
    for alias in aliases:
        if len(alias) >= 5:
            buckets.setdefault((alias[0], len(alias)), []).append(alias)
    return official_to_brand, brand_to_domains, aliases, buckets, count


def _catalog():
    mtime = BRANDS_CSV.stat().st_mtime_ns if BRANDS_CSV.exists() else -1
    return _load_brand_catalog(mtime)


def catalog_stats() -> dict:
    official, _, aliases, _, count = _catalog()
    return {"brands": count, "domains": len(official), "aliases": len(aliases),
            "coverage": "catalog only; NOT all brands"}


def _candidate_tokens(hostname: str) -> set[str]:
    """Extract hyphen/subdomain pieces and joined 2- or 3-word variations."""
    pieces = [p for p in re.split(r"[.\-_]", hostname.lower()) if p]
    result = set(pieces)
    for i in range(len(pieces)):
        for width in (2, 3):
            if i + width <= len(pieces):
                result.add("".join(pieces[i:i + width]))
    return {x for x in result if len(x) >= 3 and len(x) <= 40}


def _under_official_domain(hostname: str, official: str) -> bool:
    return hostname == official or hostname.endswith("." + official)


def check_brand_impersonation(hostname: str) -> dict | None:
    """Return *possible* impersonation or None when no supported match is found.

    None means unrecognized, NOT legitimate. Does not resolve/visit hostname.
    """
    host = hostname.lower().strip(".")
    official, brand_to_domains, aliases, buckets, _ = _catalog()
    tokens = _candidate_tokens(host)
    # Collect matching aliases first, then check *this brand*'s official domains.
    for token in sorted(tokens, key=len, reverse=True):
        matched_alias = None
        match_type = None
        if token in aliases:
            matched_alias = token
            match_type = "brand name in hostname"
        else:
            simplified = token.translate(CONFUSABLE)
            if simplified != token and simplified in aliases:
                matched_alias = simplified
                match_type = "numeric-character substitution"
            elif len(token) >= 5:
                # Fuzzy-match nearby lengths, only if initial character matches.
                # This avoids comparing each URL against the full catalog.
                for length in (len(token) - 1, len(token), len(token) + 1):
                    for alias in buckets.get((token[0], length), ()):
                        if difflib.SequenceMatcher(None, token, alias).ratio() >= 0.88:
                            matched_alias = alias
                            match_type = "similar-looking brand spelling"
                            break
                    if matched_alias:
                        break
        if not matched_alias:
            continue
        brand, reference = aliases[matched_alias]
        if any(_under_official_domain(host, domain)
               for domain in brand_to_domains.get(brand, ())):
            continue
        return {"brand": brand, "reference_domain": reference,
                "matched_alias": matched_alias, "match_type": match_type}
    return None
