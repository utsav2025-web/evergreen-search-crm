"""
Broker Email Classifier
=======================
Determines whether an email thread is from a business broker or
related to a business acquisition opportunity.

Rules (any match → is_broker = True):
  1. Sender domain is in the known broker domain list
  2. Subject or body contains one or more broker keywords
  3. Sender name contains broker-related terms

Also provides fuzzy company name matching against the companies table.
"""
from __future__ import annotations

import re
from typing import Optional

from rapidfuzz import fuzz, process

# ─── Broker Domain Registry ───────────────────────────────────────────────────

BROKER_DOMAINS: set[str] = {
    # Major aggregators
    "bizbuysell.com",
    "bizquest.com",
    "dealstream.com",
    "axial.net",
    "businessesforsale.com",
    "loopnet.com",
    # National franchise broker networks
    "tworld.com",
    "sunbeltnetwork.com",
    "murphybusiness.com",
    "generational.com",
    "synergybb.com",
    "midstreet.com",
    "morganandwestfield.com",
    "vr-businessbrokers.com",
    "firstchoicebizbrokers.com",
    "transworld.net",
    # M&A advisory
    "houlihanlockey.com",
    "lincolninternational.com",
    "harriswilliams.com",
    "bairdm&a.com",
    "duffandphelps.com",
    # Specialty
    "quietlight.com",
    "empireflippers.com",
    "acquire.com",
    "flippa.com",
}

# ─── Broker Keywords ──────────────────────────────────────────────────────────

BROKER_KEYWORDS: list[str] = [
    # Deal-specific
    "asking price",
    "asking $",
    "listed for sale",
    "business for sale",
    "selling my business",
    "business opportunity",
    "acquisition opportunity",
    "acquisition target",
    "for sale by owner",
    "fsbo",
    # Financial terms
    "ebitda",
    "sde",
    "seller's discretionary earnings",
    "cash flow",
    "revenue multiple",
    "ebitda multiple",
    # Process terms
    "loi",
    "letter of intent",
    "nda",
    "non-disclosure agreement",
    "confidentiality agreement",
    "cim",
    "confidential information memorandum",
    "teaser",
    "deal teaser",
    "offering memorandum",
    # Buyer/seller language
    "qualified buyer",
    "qualified acquirer",
    "strategic buyer",
    "financial buyer",
    "search fund",
    "private equity",
    "business broker",
    "m&a advisor",
    "mergers and acquisitions",
    "acquisition",
    "confidential",
    "listing",
    "listed business",
]

# Compiled lowercase patterns for fast matching
_KEYWORD_PATTERNS = [re.compile(re.escape(kw), re.IGNORECASE) for kw in BROKER_KEYWORDS]

# ─── Sender Name Hints ────────────────────────────────────────────────────────

BROKER_NAME_HINTS: list[str] = [
    "broker",
    "advisor",
    "m&a",
    "mergers",
    "acquisitions",
    "business sales",
    "business transfer",
    "exit planning",
]

_NAME_HINT_PATTERNS = [re.compile(re.escape(h), re.IGNORECASE) for h in BROKER_NAME_HINTS]


# ─── Public API ───────────────────────────────────────────────────────────────

def classify_email(
    sender_email: str,
    sender_name: str = "",
    subject: str = "",
    body: str = "",
) -> dict:
    """
    Returns a dict with:
      is_broker: bool
      reasons: list[str]   — human-readable reasons why it was flagged
      keyword_hits: list[str]
      domain_hit: str | None
    """
    reasons: list[str] = []
    keyword_hits: list[str] = []
    domain_hit: Optional[str] = None

    # 1. Domain check
    if sender_email:
        domain = _extract_domain(sender_email)
        if domain in BROKER_DOMAINS:
            domain_hit = domain
            reasons.append(f"Known broker domain: {domain}")

    # 2. Keyword check in subject + body
    text = f"{subject} {body}"
    for pattern, kw in zip(_KEYWORD_PATTERNS, BROKER_KEYWORDS):
        if pattern.search(text):
            keyword_hits.append(kw)

    if keyword_hits:
        reasons.append(f"Broker keywords found: {', '.join(keyword_hits[:5])}")

    # 3. Sender name check
    for pattern, hint in zip(_NAME_HINT_PATTERNS, BROKER_NAME_HINTS):
        if pattern.search(sender_name):
            reasons.append(f"Broker term in sender name: '{hint}'")
            break

    is_broker = bool(domain_hit or keyword_hits or (len(reasons) > 0))

    return {
        "is_broker": is_broker,
        "reasons": reasons,
        "keyword_hits": keyword_hits,
        "domain_hit": domain_hit,
    }


def fuzzy_match_company(
    business_name: str,
    company_names: list[tuple[int, str]],  # [(company_id, company_name), ...]
    threshold: float = 0.80,
) -> Optional[int]:
    """
    Fuzzy-match a business name against known company names.
    Returns the company_id of the best match if score >= threshold, else None.

    Uses token_set_ratio for robustness against word-order differences.
    """
    if not business_name or not company_names:
        return None

    names_only = [name for _, name in company_names]
    result = process.extractOne(
        business_name,
        names_only,
        scorer=fuzz.token_set_ratio,
    )

    if result is None:
        return None

    best_name, score, idx = result
    if score >= threshold * 100:  # rapidfuzz uses 0-100 scale
        return company_names[idx][0]

    return None


def extract_business_name_from_subject(subject: str) -> Optional[str]:
    """
    Heuristic extraction of a business name from an email subject line.
    Handles common broker subject patterns like:
      "New Listing: Acme HVAC Services - $2.5M"
      "Confidential: Midwest Plumbing Co. for Sale"
      "Acquisition Opportunity - TechServ IT Solutions"
    """
    if not subject:
        return None

    # Remove common prefixes
    prefixes = [
        r"^(new\s+)?listing\s*[:–-]\s*",
        r"^confidential\s*[:–-]\s*",
        r"^acquisition\s+opportunity\s*[:–-]\s*",
        r"^business\s+for\s+sale\s*[:–-]\s*",
        r"^(fw|fwd|re)\s*:\s*",
        r"^\[.*?\]\s*",
    ]
    cleaned = subject.strip()
    for prefix in prefixes:
        cleaned = re.sub(prefix, "", cleaned, flags=re.IGNORECASE).strip()

    # Remove trailing price / financial info
    cleaned = re.sub(r"\s*[-–|]\s*\$[\d,\.]+[MKBmkb]?.*$", "", cleaned).strip()
    cleaned = re.sub(r"\s*[-–|]\s*(asking|price|revenue|ebitda).*$", "", cleaned, flags=re.IGNORECASE).strip()

    # Return None if too short or too long
    if len(cleaned) < 3 or len(cleaned) > 120:
        return None

    return cleaned or None


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _extract_domain(email: str) -> str:
    """Extract lowercase domain from an email address."""
    try:
        return email.strip().lower().split("@")[1]
    except (IndexError, AttributeError):
        return ""
