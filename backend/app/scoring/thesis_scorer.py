"""
Thesis Scorer
=============
Scores a Company record against the user's investment thesis (ThesisConfig).
Returns a 0-100 score, a recommendation (pursue / watch / pass), and a list
of human-readable flag strings explaining the result.

Scoring breakdown (100 points total):
  Financial Fit      40 pts  — EBITDA range, revenue range, margin, multiple
  Industry Fit       25 pts  — target industry match, excluded industry penalty
  Geography Fit      10 pts  — target state match
  Business Profile   15 pts  — years in business, employee count
  Data Completeness  10 pts  — how much data we actually have to score
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Optional

from app.models.models import Company, ThesisConfig


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _safe_float(val) -> Optional[float]:
    try:
        return float(val) if val is not None else None
    except (TypeError, ValueError):
        return None


def _safe_int(val) -> Optional[int]:
    try:
        return int(val) if val is not None else None
    except (TypeError, ValueError):
        return None


def _industry_match(company_industry: Optional[str], target_list: list[str]) -> bool:
    if not company_industry or not target_list:
        return False
    ci = company_industry.lower()
    return any(t.lower() in ci or ci in t.lower() for t in target_list)


# ─────────────────────────────────────────────────────────────────────────────
# Main scorer
# ─────────────────────────────────────────────────────────────────────────────

def score_company(company: Company, thesis: ThesisConfig) -> dict:
    """
    Score a company against the thesis.

    Returns:
        {
            "thesis_score": float (0-100),
            "recommendation": "pursue" | "watch" | "pass",
            "flags": [str, ...],
            "breakdown": { category: {"score": int, "max": int, "notes": str} }
        }
    """
    flags: list[str] = []
    breakdown: dict = {}

    # ── 1. Financial Fit (40 pts) ─────────────────────────────────────────────
    fin_score = 0
    fin_notes: list[str] = []

    ebitda = _safe_float(company.ebitda) or _safe_float(company.ebitda_ttm)
    revenue = _safe_float(company.annual_revenue) or _safe_float(company.revenue_ttm)
    ebitda_margin = _safe_float(company.ebitda_margin)
    asking_price = _safe_float(company.asking_price)

    # EBITDA range (15 pts)
    if ebitda is not None:
        if thesis.ebitda_min <= ebitda <= thesis.ebitda_max:
            fin_score += 15
            fin_notes.append(f"EBITDA ${ebitda/1e6:.1f}M is in target range")
            flags.append(f"✅ EBITDA ${ebitda/1e6:.1f}M in range (${thesis.ebitda_min/1e6:.0f}M–${thesis.ebitda_max/1e6:.0f}M)")
        elif ebitda < thesis.ebitda_min:
            fin_score += 3
            fin_notes.append(f"EBITDA ${ebitda/1e6:.1f}M below minimum ${thesis.ebitda_min/1e6:.0f}M")
            flags.append(f"⚠️ EBITDA ${ebitda/1e6:.1f}M below target minimum ${thesis.ebitda_min/1e6:.0f}M")
        else:
            fin_score += 7
            fin_notes.append(f"EBITDA ${ebitda/1e6:.1f}M above maximum ${thesis.ebitda_max/1e6:.0f}M")
            flags.append(f"⚠️ EBITDA ${ebitda/1e6:.1f}M above target maximum ${thesis.ebitda_max/1e6:.0f}M")
    else:
        fin_notes.append("EBITDA unknown")
        flags.append("❓ EBITDA not available")

    # Revenue range (10 pts)
    if revenue is not None:
        if thesis.revenue_min <= revenue <= thesis.revenue_max:
            fin_score += 10
            fin_notes.append(f"Revenue ${revenue/1e6:.1f}M in target range")
            flags.append(f"✅ Revenue ${revenue/1e6:.1f}M in range")
        elif revenue < thesis.revenue_min:
            fin_score += 2
            flags.append(f"⚠️ Revenue ${revenue/1e6:.1f}M below target minimum ${thesis.revenue_min/1e6:.0f}M")
        else:
            fin_score += 5
            flags.append(f"⚠️ Revenue ${revenue/1e6:.1f}M above target maximum ${thesis.revenue_max/1e6:.0f}M")
    else:
        fin_notes.append("Revenue unknown")

    # EBITDA margin (8 pts)
    if ebitda_margin is not None:
        if ebitda_margin >= thesis.ebitda_margin_min:
            fin_score += 8
            flags.append(f"✅ EBITDA margin {ebitda_margin*100:.0f}% meets {thesis.ebitda_margin_min*100:.0f}% floor")
        else:
            fin_score += 2
            flags.append(f"❌ EBITDA margin {ebitda_margin*100:.0f}% below {thesis.ebitda_margin_min*100:.0f}% floor")
    elif ebitda and revenue and revenue > 0:
        calc_margin = ebitda / revenue
        if calc_margin >= thesis.ebitda_margin_min:
            fin_score += 8
            flags.append(f"✅ Implied EBITDA margin {calc_margin*100:.0f}% meets floor")
        else:
            fin_score += 2
            flags.append(f"❌ Implied EBITDA margin {calc_margin*100:.0f}% below {thesis.ebitda_margin_min*100:.0f}% floor")

    # EV/EBITDA multiple (7 pts)
    multiple = _safe_float(company.implied_multiple)
    if multiple is None and asking_price and ebitda and ebitda > 0:
        multiple = asking_price / ebitda
    if multiple is not None:
        if thesis.min_ev_ebitda_multiple <= multiple <= thesis.max_ev_ebitda_multiple:
            fin_score += 7
            flags.append(f"✅ {multiple:.1f}x EV/EBITDA in target range ({thesis.min_ev_ebitda_multiple:.1f}x–{thesis.max_ev_ebitda_multiple:.1f}x)")
        elif multiple > thesis.max_ev_ebitda_multiple:
            fin_score += 1
            flags.append(f"❌ {multiple:.1f}x EV/EBITDA above {thesis.max_ev_ebitda_multiple:.1f}x ceiling")
        else:
            fin_score += 4
            flags.append(f"⚠️ {multiple:.1f}x EV/EBITDA below {thesis.min_ev_ebitda_multiple:.1f}x floor")

    breakdown["financial_fit"] = {"score": fin_score, "max": 40, "notes": "; ".join(fin_notes)}

    # ── 2. Industry Fit (25 pts) ──────────────────────────────────────────────
    ind_score = 0
    industry = company.industry or ""
    target_industries = thesis.target_industries or []
    excluded_industries = thesis.excluded_industries or []

    if _industry_match(industry, excluded_industries):
        ind_score = 0
        flags.append(f"❌ Industry '{industry}' is in excluded list")
    elif _industry_match(industry, target_industries):
        ind_score = 25
        flags.append(f"✅ Industry '{industry}' matches target niche")
    elif industry:
        ind_score = 10
        flags.append(f"⚠️ Industry '{industry}' not in target niches")
    else:
        ind_score = 5
        flags.append("❓ Industry unknown")

    breakdown["industry_fit"] = {"score": ind_score, "max": 25, "notes": f"Industry: {industry or 'unknown'}"}

    # ── 3. Geography Fit (10 pts) ─────────────────────────────────────────────
    geo_score = 0
    target_states = thesis.target_states or []
    company_state = company.state or ""

    if not target_states:
        geo_score = 10  # No restriction = full score
    elif company_state.upper() in [s.upper() for s in target_states]:
        geo_score = 10
        flags.append(f"✅ Location {company_state} is in target geography")
    elif company_state:
        geo_score = 5
        flags.append(f"⚠️ Location {company_state} not in preferred states")
    else:
        geo_score = 5
        flags.append("❓ Location unknown")

    breakdown["geography_fit"] = {"score": geo_score, "max": 10, "notes": f"State: {company_state or 'unknown'}"}

    # ── 4. Business Profile (15 pts) ─────────────────────────────────────────
    biz_score = 0
    biz_notes: list[str] = []

    founded = _safe_int(company.founded_year) or _safe_int(company.year_founded)
    employees = _safe_int(company.employees) or _safe_int(company.employee_count)
    current_year = datetime.now(timezone.utc).year

    # Years in business (8 pts)
    if founded:
        years = current_year - founded
        if years >= thesis.min_years_in_business:
            biz_score += 8
            biz_notes.append(f"{years} years in business")
            flags.append(f"✅ {years} years in business (min {thesis.min_years_in_business})")
        else:
            biz_score += 2
            flags.append(f"⚠️ Only {years} years in business (min {thesis.min_years_in_business})")
    else:
        biz_score += 4  # Neutral if unknown
        biz_notes.append("Founded year unknown")

    # Employee count (7 pts)
    if employees is not None:
        if employees <= thesis.max_employees:
            biz_score += 7
            biz_notes.append(f"{employees} employees")
            flags.append(f"✅ {employees} employees (max {thesis.max_employees})")
        else:
            biz_score += 2
            flags.append(f"⚠️ {employees} employees exceeds max {thesis.max_employees}")
    else:
        biz_score += 3  # Neutral if unknown

    breakdown["business_profile"] = {"score": biz_score, "max": 15, "notes": "; ".join(biz_notes)}

    # ── 5. Data Completeness (10 pts) ─────────────────────────────────────────
    data_fields = [ebitda, revenue, asking_price, industry, company_state, founded, employees]
    filled = sum(1 for f in data_fields if f is not None and f != "")
    data_score = round((filled / len(data_fields)) * 10)
    breakdown["data_completeness"] = {"score": data_score, "max": 10, "notes": f"{filled}/{len(data_fields)} key fields present"}

    # ── Composite ─────────────────────────────────────────────────────────────
    total = fin_score + ind_score + geo_score + biz_score + data_score
    total = min(100, max(0, total))

    if total >= 70:
        recommendation = "pursue"
    elif total >= 40:
        recommendation = "watch"
    else:
        recommendation = "pass"

    return {
        "thesis_score": round(total, 1),
        "recommendation": recommendation,
        "flags": flags,
        "breakdown": breakdown,
    }
