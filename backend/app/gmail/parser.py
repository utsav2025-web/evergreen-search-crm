"""
Email → Company Parser (Claude-powered)
========================================
Uses the OpenAI-compatible API (model: gemini-2.5-flash or gpt-4.1-mini)
to extract structured company data from broker email content.

Extracted fields:
  business_name, industry, sub_industry, location (city, state),
  asking_price, revenue, ebitda, sde, employees, founded_year,
  owner_name, owner_email, owner_phone,
  broker_name, broker_email, broker_phone,
  description, key_highlights, reason_for_sale,
  source_url, entity_type

Falls back gracefully if the API is unavailable or the key is not set.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Prompt Template ──────────────────────────────────────────────────────────

EXTRACTION_SYSTEM_PROMPT = """You are an expert M&A analyst assistant specializing in small business acquisitions.
Your job is to extract structured data from broker emails and business listing descriptions.

Extract all available information and return it as a single JSON object.
If a field is not mentioned, return null for that field.
For monetary values, return numbers only (no $ signs or commas).
For percentages, return decimal values (e.g., 0.25 for 25%).

Return ONLY valid JSON, no explanation or markdown."""

EXTRACTION_USER_PROMPT = """Extract all business acquisition data from this broker email.

EMAIL SUBJECT: {subject}
FROM: {sender}
EMAIL BODY:
{body}

Return a JSON object with these fields:
{{
  "business_name": "string or null",
  "industry": "string or null",
  "sub_industry": "string or null",
  "city": "string or null",
  "state": "string or null (2-letter abbreviation if US)",
  "asking_price": "number or null (USD)",
  "revenue": "number or null (annual, USD)",
  "ebitda": "number or null (annual, USD)",
  "sde": "number or null (seller's discretionary earnings, USD)",
  "ebitda_margin": "number or null (decimal, e.g. 0.25)",
  "employees": "integer or null",
  "founded_year": "integer or null",
  "owner_name": "string or null",
  "owner_email": "string or null",
  "owner_phone": "string or null",
  "broker_name": "string or null",
  "broker_email": "string or null",
  "broker_phone": "string or null",
  "description": "string or null (2-3 sentence business description)",
  "key_highlights": ["list of strings, max 5 bullet points"],
  "reason_for_sale": "string or null",
  "source_url": "string or null (listing URL if mentioned)",
  "entity_type": "string or null (LLC, S-Corp, C-Corp, etc.)",
  "years_in_business": "integer or null",
  "is_absentee_owner": "boolean or null",
  "has_real_estate": "boolean or null",
  "real_estate_value": "number or null (USD)",
  "inventory_value": "number or null (USD)",
  "ffe_value": "number or null (FF&E value, USD)"
}}"""


# ─── Main Extraction Function ─────────────────────────────────────────────────

async def extract_company_from_email(
    subject: str,
    sender: str,
    body: str,
    model: str = "gemini-2.5-flash",
) -> dict:
    """
    Use Claude/GPT to extract company data from an email.
    Returns a dict of extracted fields (all may be None).
    Falls back to heuristic extraction if API is unavailable.
    """
    api_key = os.environ.get("OPENAI_API_KEY", "")

    if not api_key:
        logger.warning("OPENAI_API_KEY not set — using heuristic extraction only")
        return _heuristic_extract(subject, sender, body)

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(
            api_key=api_key,
            base_url=os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1"),
        )

        # Truncate body to avoid token limits
        truncated_body = body[:6000] if body else ""

        prompt = EXTRACTION_USER_PROMPT.format(
            subject=subject or "(no subject)",
            sender=sender or "(unknown sender)",
            body=truncated_body,
        )

        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=1500,
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content
        extracted = json.loads(raw)
        logger.info(f"Claude extracted {len([v for v in extracted.values() if v is not None])} fields")
        return extracted

    except Exception as e:
        logger.error(f"Claude extraction failed: {e}")
        # Fall back to heuristic
        return _heuristic_extract(subject, sender, body)


def build_company_prefill(extracted: dict) -> dict:
    """
    Convert Claude extraction output to a Company create payload.
    Maps extracted field names to Company model field names.
    """
    prefill: dict = {}

    # Name
    if extracted.get("business_name"):
        prefill["name"] = extracted["business_name"]

    # Industry
    if extracted.get("industry"):
        prefill["industry"] = extracted["industry"]
    if extracted.get("sub_industry"):
        prefill["sub_industry"] = extracted["sub_industry"]

    # Location
    city = extracted.get("city", "")
    state = extracted.get("state", "")
    if city and state:
        prefill["city"] = city
        prefill["state"] = state
    elif state:
        prefill["state"] = state

    # Financials
    for field in ["asking_price", "revenue", "ebitda", "sde", "ebitda_margin", "employees"]:
        if extracted.get(field) is not None:
            prefill[field] = extracted[field]

    # Owner info
    for field in ["owner_name", "owner_email", "owner_phone"]:
        if extracted.get(field):
            prefill[field] = extracted[field]

    # Description
    if extracted.get("description"):
        prefill["description"] = extracted["description"]

    # Founded year
    if extracted.get("founded_year"):
        prefill["founded_year"] = extracted["founded_year"]

    # Entity type
    if extracted.get("entity_type"):
        et = extracted["entity_type"].lower().replace("-", "_").replace(" ", "_")
        prefill["entity_type"] = et

    # Source URL
    if extracted.get("source_url"):
        prefill["listing_url"] = extracted["source_url"]

    # Deal stage defaults to prospect for email-sourced companies
    prefill["deal_stage"] = "prospect"
    prefill["source"] = "email"

    return prefill


# ─── Heuristic Fallback ───────────────────────────────────────────────────────

def _heuristic_extract(subject: str, sender: str, body: str) -> dict:
    """
    Regex-based extraction as a fallback when the API is unavailable.
    Handles common broker email patterns.
    """
    text = f"{subject}\n{body}"
    result: dict = {k: None for k in [
        "business_name", "industry", "sub_industry", "city", "state",
        "asking_price", "revenue", "ebitda", "sde", "ebitda_margin",
        "employees", "founded_year", "owner_name", "owner_email",
        "owner_phone", "broker_name", "broker_email", "broker_phone",
        "description", "key_highlights", "reason_for_sale", "source_url",
        "entity_type", "years_in_business", "is_absentee_owner",
        "has_real_estate", "real_estate_value", "inventory_value", "ffe_value",
    ]}

    # Extract monetary values
    def parse_money(s: str) -> Optional[float]:
        """Parse '$2.5M', '$500K', '$1,200,000' etc."""
        s = s.replace(",", "").strip()
        match = re.search(r"\$?([\d.]+)\s*([MKBmkb]?)", s)
        if not match:
            return None
        val = float(match.group(1))
        suffix = match.group(2).upper()
        if suffix == "M":
            val *= 1_000_000
        elif suffix == "K":
            val *= 1_000
        elif suffix == "B":
            val *= 1_000_000_000
        return val

    # Asking price
    asking_match = re.search(
        r"asking\s+(?:price\s*[:\-]?\s*)?\$?([\d,\.]+\s*[MKBmkb]?)",
        text, re.IGNORECASE
    )
    if asking_match:
        result["asking_price"] = parse_money(asking_match.group(1))

    # Revenue
    rev_match = re.search(
        r"(?:annual\s+)?revenue\s*[:\-]?\s*\$?([\d,\.]+\s*[MKBmkb]?)",
        text, re.IGNORECASE
    )
    if rev_match:
        result["revenue"] = parse_money(rev_match.group(1))

    # EBITDA
    ebitda_match = re.search(
        r"ebitda\s*[:\-]?\s*\$?([\d,\.]+\s*[MKBmkb]?)",
        text, re.IGNORECASE
    )
    if ebitda_match:
        result["ebitda"] = parse_money(ebitda_match.group(1))

    # SDE
    sde_match = re.search(
        r"(?:sde|seller['\s]*s?\s+discretionary)\s*[:\-]?\s*\$?([\d,\.]+\s*[MKBmkb]?)",
        text, re.IGNORECASE
    )
    if sde_match:
        result["sde"] = parse_money(sde_match.group(1))

    # Employees
    emp_match = re.search(r"(\d+)\s+(?:full[- ]?time\s+)?employees?", text, re.IGNORECASE)
    if emp_match:
        result["employees"] = int(emp_match.group(1))

    # State (US 2-letter)
    state_match = re.search(
        r"\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b",
        text
    )
    if state_match:
        result["state"] = state_match.group(1)

    # Email addresses
    emails = re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", text)
    if emails:
        result["broker_email"] = emails[0]

    # Phone numbers
    phone_match = re.search(
        r"(?:phone|cell|mobile|tel|call)?\s*[:\-]?\s*(\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4})",
        text, re.IGNORECASE
    )
    if phone_match:
        result["broker_phone"] = phone_match.group(1)

    # Source URL
    url_match = re.search(r"https?://[^\s<>\"]+", text)
    if url_match:
        result["source_url"] = url_match.group(0)

    return result
