"""
Seed script — populates the database with:
  - 2 users (Matt, Utsav)
  - 5 sample companies across different deal stages
  - 5 deals (one per company)
  - Sample contacts, financials, brokers, lenders
  - Broker listings (5 scraped listings)
  - Email threads (4 sample Gmail threads)
  - Outreach log entries (5 touchpoints)
  - Notes (5 pinned/unpinned notes)
  - Documents (5 document records)

Run from the backend/ directory:
    python -m scripts.seed
"""
import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Ensure app is importable
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import engine, Base, AsyncSessionLocal
from app.core.security import hash_password
from app.models.models import (
    User, Company, Contact, Deal, Financial, Note,
    Broker, Lender, DealStage,
    BrokerListing, EmailThread,
    OutreachLog, ContactMethod, OutreachDirection, OutreachOutcome,
    Document, DocumentType,
)

# ─────────────────────────────────────────────────────────────────────────────
# Time helpers
# ─────────────────────────────────────────────────────────────────────────────

_now = datetime.now(timezone.utc)

def days_ago(n: int) -> datetime:
    return _now - timedelta(days=n)

def days_from_now(n: int) -> datetime:
    return _now + timedelta(days=n)


# ─────────────────────────────────────────────────────────────────────────────
# Seed data
# ─────────────────────────────────────────────────────────────────────────────

USERS = [
    {
        "username": "matt",
        "display_name": "Matt",
        "email": "matt@searchfund.local",
        "password": "changeme_matt",
    },
    {
        "username": "utsav",
        "display_name": "Utsav",
        "email": "utsav@searchfund.local",
        "password": "changeme_utsav",
    },
]

BROKERS_DATA = [
    {
        "first_name": "James",
        "last_name": "Whitfield",
        "firm_name": "Whitfield Business Advisors",
        "email": "james@whitfieldbiz.com",
        "phone": "512-555-0101",
        "state": "TX",
        "specialties": ["manufacturing", "distribution"],
        "relationship_strength": "warm",
        "source": "bizbuysell",
    },
    {
        "first_name": "Sandra",
        "last_name": "Park",
        "firm_name": "Park M&A Group",
        "email": "sandra@parkmna.com",
        "phone": "303-555-0202",
        "state": "CO",
        "specialties": ["healthcare", "services"],
        "relationship_strength": "hot",
        "source": "axial",
    },
    {
        "first_name": "Marcus",
        "last_name": "Williams",
        "firm_name": "SunBelt Business Advisors",
        "email": "mwilliams@sunbeltbusiness.com",
        "phone": "512-555-0300",
        "state": "TX",
        "specialties": ["pest_control", "environmental_services"],
        "relationship_strength": "warm",
        "source": "bizquest",
    },
]

LENDERS_DATA = [
    {
        "name": "Live Oak Bank",
        "lender_type": "sba_preferred",
        "contact_name": "Tom Reeves",
        "contact_email": "treeves@liveoak.bank",
        "website": "https://www.liveoakbank.com",
        "state": "NC",
        "max_loan_amount": 5_000_000,
        "min_loan_amount": 500_000,
        "sba_volume_rank": 1,
    },
    {
        "name": "Huntington National Bank",
        "lender_type": "sba",
        "contact_name": "Lisa Chen",
        "contact_email": "lchen@huntington.com",
        "website": "https://www.huntington.com",
        "state": "OH",
        "max_loan_amount": 5_000_000,
        "min_loan_amount": 250_000,
        "sba_volume_rank": 3,
    },
]

COMPANIES_DATA = [
    # ── 1. Prospect ───────────────────────────────────────────────────────────
    {
        "company": {
            "name": "Midwest HVAC Solutions",
            "slug": "midwest-hvac-solutions",
            "website": "https://www.midwesthvac.example.com",
            "industry": "HVAC & Mechanical Services",
            "sub_industry": "Residential & Commercial HVAC",
            "description": (
                "Family-owned HVAC installation and maintenance company serving the greater "
                "Indianapolis metro area since 1998. Strong recurring maintenance contracts "
                "representing ~60% of revenue. 12 licensed technicians."
            ),
            "city": "Indianapolis",
            "state": "IN",
            "country": "USA",
            "annual_revenue": 4_200_000,
            "revenue_ttm": 4_200_000,
            "ebitda": 840_000,
            "ebitda_ttm": 840_000,
            "ebitda_margin": 0.20,
            "asking_price": 3_780_000,
            "implied_multiple": 4.5,
            "employees": 18,
            "employee_count": 18,
            "founded_year": 1998,
            "year_founded": 1998,
            "source": "bizbuysell",
            "listing_url": "https://www.bizbuysell.com/listing/midwest-hvac/stub",
            "source_url": "https://www.bizbuysell.com/listing/midwest-hvac/stub",
            "owner_name": "Gary Kowalski",
            "owner_email": "gary@midwesthvac.example.com",
            "owner_phone": "317-555-0301",
            "lead_partner": "matt",
            "deal_score": 72.0,
            "enrichment_score": 65.0,
            "ai_score": 72.0,
            "ai_score_rationale": "Strong recurring revenue base and essential service. Owner-operator risk and geographic concentration are key concerns.",
            "tags": ["recurring_revenue", "b2b", "b2c", "essential_services", "owner_operator"],
            "deal_stage": DealStage.PROSPECT,
            "is_proprietary": False,
            "is_active": True,
        },
        "deal": {
            "deal_name": "Midwest HVAC Solutions",
            "asking_price": 3_780_000,
            "probability": 15,
            "priority": "medium",
            "assigned_to": "matt",
            "sba_eligible": True,
        },
        "contacts": [
            {
                "first_name": "Gary",
                "last_name": "Kowalski",
                "title": "Owner / Founder",
                "email": "gary@midwesthvac.example.com",
                "phone": "317-555-0301",
                "is_primary": True,
            }
        ],
        "financials": [
            {"period_year": 2023, "period_type": "annual", "revenue": 4_200_000, "ebitda": 840_000, "sde": 1_050_000, "owner_comp": 210_000},
            {"period_year": 2022, "period_type": "annual", "revenue": 3_850_000, "ebitda": 693_000, "sde": 900_000, "owner_comp": 207_000},
            {"period_year": 2021, "period_type": "annual", "revenue": 3_400_000, "ebitda": 578_000, "sde": 782_000, "owner_comp": 204_000},
        ],
        "notes": [
            {"content": "Sourced from BizBuySell. Broker is James Whitfield. Owner looking to retire in 18 months.", "note_type": "general", "is_pinned": True, "tagged_stage": DealStage.PROSPECT},
            {"content": "Initial financials look solid. Need to request CIM and verify maintenance contract terms.", "note_type": "analysis", "is_pinned": False, "tagged_stage": DealStage.PROSPECT},
        ],
    },
    # ── 2. NDA Signed ─────────────────────────────────────────────────────────
    {
        "company": {
            "name": "Precision Parts Manufacturing",
            "slug": "precision-parts-manufacturing",
            "website": "https://www.precisionparts.example.com",
            "industry": "Manufacturing",
            "sub_industry": "CNC Machining & Precision Components",
            "description": (
                "ISO 9001-certified CNC machining shop serving aerospace, defense, and "
                "medical device OEMs. 85% of revenue from 3 long-term customers under "
                "multi-year supply agreements. Located in Denver, CO."
            ),
            "city": "Denver",
            "state": "CO",
            "country": "USA",
            "annual_revenue": 7_800_000,
            "revenue_ttm": 7_800_000,
            "ebitda": 1_716_000,
            "ebitda_ttm": 1_716_000,
            "ebitda_margin": 0.22,
            "asking_price": 8_580_000,
            "implied_multiple": 5.0,
            "employees": 42,
            "employee_count": 42,
            "founded_year": 2003,
            "year_founded": 2003,
            "source": "axial",
            "listing_url": "https://www.axial.net/forum/stub",
            "source_url": "https://www.axial.net/forum/stub",
            "owner_name": "Patricia Nguyen",
            "owner_email": "patricia@precisionparts.example.com",
            "owner_phone": "303-555-0401",
            "lead_partner": "utsav",
            "deal_score": 81.0,
            "enrichment_score": 80.0,
            "ai_score": 81.0,
            "ai_score_rationale": "High-quality customer base with long-term contracts. Customer concentration (85% from 3 customers) is the primary risk.",
            "tags": ["b2b", "manufacturing", "aerospace", "defense", "recurring_revenue", "iso_certified"],
            "deal_stage": DealStage.NDA,
            "is_proprietary": False,
            "is_active": True,
        },
        "deal": {
            "deal_name": "Precision Parts Manufacturing",
            "asking_price": 8_580_000,
            "probability": 30,
            "priority": "high",
            "assigned_to": "utsav",
            "sba_eligible": False,
        },
        "contacts": [
            {
                "first_name": "Patricia",
                "last_name": "Nguyen",
                "title": "CEO & Owner",
                "email": "patricia@precisionparts.example.com",
                "phone": "303-555-0401",
                "is_primary": True,
            },
            {
                "first_name": "Sandra",
                "last_name": "Park",
                "title": "M&A Broker",
                "email": "sandra@parkmna.com",
                "phone": "303-555-0202",
                "is_primary": False,
            },
        ],
        "financials": [
            {"period_year": 2023, "period_type": "annual", "revenue": 7_800_000, "ebitda": 1_716_000, "sde": 1_950_000, "owner_comp": 234_000},
            {"period_year": 2022, "period_type": "annual", "revenue": 7_100_000, "ebitda": 1_491_000, "sde": 1_740_000, "owner_comp": 249_000},
            {"period_year": 2021, "period_type": "annual", "revenue": 6_300_000, "ebitda": 1_197_000, "sde": 1_450_000, "owner_comp": 253_000},
        ],
        "notes": [
            {"content": "NDA signed 2024-01-15. CIM requested from broker Sandra Park.", "note_type": "general", "is_pinned": True, "tagged_stage": DealStage.NDA},
            {"content": "Strong EBITDA margins (~22%). Customer concentration is a concern — need to understand contract renewal terms.", "note_type": "analysis", "is_pinned": False, "tagged_stage": DealStage.NDA},
            {"content": "Utsav to lead financial model build once CIM is received.", "note_type": "general", "is_pinned": False, "tagged_stage": DealStage.NDA},
        ],
    },
    # ── 3. LOI Stage ──────────────────────────────────────────────────────────
    {
        "company": {
            "name": "SunBelt Pest Control",
            "slug": "sunbelt-pest-control",
            "website": "https://www.sunbeltpest.example.com",
            "industry": "Environmental Services",
            "sub_industry": "Pest Control & Extermination",
            "description": (
                "Regional pest control company operating in Florida and Georgia with "
                "22,000 active residential and commercial accounts. ~75% recurring "
                "monthly/quarterly service agreements. Fleet of 38 service vehicles."
            ),
            "city": "Tampa",
            "state": "FL",
            "country": "USA",
            "annual_revenue": 9_500_000,
            "revenue_ttm": 9_500_000,
            "ebitda": 1_900_000,
            "ebitda_ttm": 1_900_000,
            "ebitda_margin": 0.20,
            "asking_price": 11_400_000,
            "implied_multiple": 6.0,
            "employees": 85,
            "employee_count": 85,
            "founded_year": 2007,
            "year_founded": 2007,
            "source": "direct",
            "listing_url": None,
            "source_url": None,
            "owner_name": "Marcus Williams",
            "owner_email": "marcus@sunbeltpest.example.com",
            "owner_phone": "813-555-0501",
            "lead_partner": "matt",
            "deal_score": 88.0,
            "enrichment_score": 90.0,
            "ai_score": 88.0,
            "ai_score_rationale": "Excellent recurring revenue profile with strong route density. Pest control is a proven search fund acquisition category.",
            "tags": ["recurring_revenue", "b2c", "b2b", "essential_services", "route_density", "florida"],
            "deal_stage": DealStage.LOI,
            "is_proprietary": True,
            "is_active": True,
        },
        "deal": {
            "deal_name": "SunBelt Pest Control",
            "asking_price": 11_400_000,
            "offer_price": 10_500_000,
            "ebitda_multiple": 5.5,
            "probability": 55,
            "priority": "high",
            "assigned_to": "matt",
            "sba_eligible": False,
        },
        "contacts": [
            {
                "first_name": "Marcus",
                "last_name": "Williams",
                "title": "Founder & President",
                "email": "marcus@sunbeltpest.example.com",
                "phone": "813-555-0501",
                "is_primary": True,
            }
        ],
        "financials": [
            {"period_year": 2023, "period_type": "annual", "revenue": 9_500_000, "ebitda": 1_900_000, "sde": 2_200_000, "owner_comp": 300_000},
            {"period_year": 2022, "period_type": "annual", "revenue": 8_600_000, "ebitda": 1_634_000, "sde": 1_950_000, "owner_comp": 316_000},
            {"period_year": 2021, "period_type": "annual", "revenue": 7_800_000, "ebitda": 1_404_000, "sde": 1_720_000, "owner_comp": 316_000},
        ],
        "notes": [
            {"content": "CIM received 2024-02-01. 47 pages. Matt leading CIM review.", "note_type": "general", "is_pinned": True, "tagged_stage": DealStage.LOI},
            {"content": "AI score: 88/100. Key strengths: route density, recurring contracts, essential service.", "note_type": "analysis", "is_pinned": False, "tagged_stage": DealStage.LOI},
            {"content": "LOI submitted at $10.5M (5.5x EBITDA). Seller reviewing. Broker says another offer at $11M — need to move fast.", "note_type": "analysis", "is_pinned": True, "tagged_stage": DealStage.LOI},
        ],
    },
    # ── 4. Due Diligence ──────────────────────────────────────────────────────
    {
        "company": {
            "name": "TechServ IT Managed Services",
            "slug": "techserv-it-managed-services",
            "website": "https://www.techserv.example.com",
            "industry": "Technology Services",
            "sub_industry": "Managed IT Services (MSP)",
            "description": (
                "Managed service provider (MSP) serving 140 SMB clients in the "
                "Dallas-Fort Worth metro. Services include network management, cybersecurity, "
                "cloud migrations, and helpdesk. ~90% of revenue is recurring MRR under "
                "3-year contracts."
            ),
            "city": "Dallas",
            "state": "TX",
            "country": "USA",
            "annual_revenue": 5_600_000,
            "revenue_ttm": 5_600_000,
            "ebitda": 1_344_000,
            "ebitda_ttm": 1_344_000,
            "ebitda_margin": 0.24,
            "asking_price": 8_064_000,
            "implied_multiple": 6.0,
            "employees": 31,
            "employee_count": 31,
            "founded_year": 2011,
            "year_founded": 2011,
            "source": "bizquest",
            "listing_url": "https://www.bizquest.com/listing/techserv/stub",
            "source_url": "https://www.bizquest.com/listing/techserv/stub",
            "owner_name": "Kevin Okafor",
            "owner_email": "kevin@techserv.example.com",
            "owner_phone": "214-555-0601",
            "lead_partner": "both",
            "deal_score": 91.0,
            "enrichment_score": 95.0,
            "ai_score": 91.0,
            "ai_score_rationale": "Best-in-class recurring revenue (90% MRR). MSP sector has strong acquisition multiples and clear growth playbook.",
            "tags": ["recurring_revenue", "b2b", "msp", "technology", "mrr", "cybersecurity"],
            "deal_stage": DealStage.DILIGENCE,
            "is_proprietary": False,
            "is_active": True,
        },
        "deal": {
            "deal_name": "TechServ IT Managed Services",
            "asking_price": 8_064_000,
            "offer_price": 7_392_000,
            "revenue_multiple": 1.32,
            "ebitda_multiple": 5.5,
            "probability": 75,
            "priority": "high",
            "assigned_to": "both",
            "sba_eligible": True,
        },
        "contacts": [
            {
                "first_name": "Kevin",
                "last_name": "Okafor",
                "title": "CEO & Founder",
                "email": "kevin@techserv.example.com",
                "phone": "214-555-0601",
                "is_primary": True,
            },
            {
                "first_name": "James",
                "last_name": "Whitfield",
                "title": "M&A Broker",
                "email": "james@whitfieldbiz.com",
                "phone": "512-555-0101",
                "is_primary": False,
            },
        ],
        "financials": [
            {"period_year": 2023, "period_type": "annual", "revenue": 5_600_000, "ebitda": 1_344_000, "sde": 1_600_000, "owner_comp": 256_000},
            {"period_year": 2022, "period_type": "annual", "revenue": 4_900_000, "ebitda": 1_078_000, "sde": 1_340_000, "owner_comp": 262_000},
            {"period_year": 2021, "period_type": "annual", "revenue": 4_100_000, "ebitda": 820_000, "sde": 1_090_000, "owner_comp": 270_000},
        ],
        "notes": [
            {"content": "LOI accepted at $7.39M (5.5x EBITDA). DD kicked off 2024-03-05. QofE engagement signed with Riviera Partners CPA.", "note_type": "general", "is_pinned": True, "tagged_stage": DealStage.DILIGENCE},
            {"content": "SBA 7(a) pre-qualified with Live Oak Bank up to $5M. Utsav building 5-year financial model.", "note_type": "general", "is_pinned": False, "tagged_stage": DealStage.DILIGENCE},
            {"content": "Management team is strong — 3 senior technicians with 5+ years each. Low key-person risk.", "note_type": "diligence", "is_pinned": False, "tagged_stage": DealStage.DILIGENCE},
            {"content": "DD Checklist: [x] 3yr financials [x] Client contracts [ ] IP/software licenses [ ] Litigation check [ ] Insurance certs", "note_type": "diligence", "is_pinned": True, "tagged_stage": DealStage.DILIGENCE},
        ],
    },
    # ── 5. Passed ─────────────────────────────────────────────────────────────
    {
        "company": {
            "name": "Cascade Landscaping & Snow",
            "slug": "cascade-landscaping-snow",
            "website": "https://www.cascapelandscaping.example.com",
            "industry": "Landscaping & Grounds Maintenance",
            "sub_industry": "Commercial Landscaping",
            "description": (
                "Commercial landscaping and snow removal company serving HOAs, "
                "corporate campuses, and retail centers in the Pacific Northwest. "
                "Multi-year contracts with 95% renewal rate. Fleet of 22 vehicles "
                "and equipment worth ~$1.8M."
            ),
            "city": "Portland",
            "state": "OR",
            "country": "USA",
            "annual_revenue": 6_100_000,
            "revenue_ttm": 6_100_000,
            "ebitda": 1_098_000,
            "ebitda_ttm": 1_098_000,
            "ebitda_margin": 0.18,
            "asking_price": 6_588_000,
            "implied_multiple": 6.0,
            "employees": 55,
            "employee_count": 55,
            "founded_year": 2005,
            "year_founded": 2005,
            "source": "direct",
            "listing_url": None,
            "source_url": None,
            "owner_name": "Diane Sorensen",
            "owner_email": "diane@cascapelandscaping.example.com",
            "owner_phone": "503-555-0701",
            "lead_partner": "both",
            "deal_score": 54.0,
            "enrichment_score": 70.0,
            "ai_score": 54.0,
            "ai_score_rationale": "Seasonality and high equipment capex reduce FCF. Key-man risk with owner managing top accounts.",
            "tags": ["recurring_revenue", "b2b", "landscaping", "snow_removal", "commercial", "pacific_northwest"],
            "deal_stage": DealStage.PASSED,
            "is_proprietary": True,
            "is_active": True,
        },
        "deal": {
            "deal_name": "Cascade Landscaping & Snow",
            "asking_price": 6_588_000,
            "offer_price": 6_100_000,
            "revenue_multiple": 1.0,
            "ebitda_multiple": 5.56,
            "probability": 0,
            "priority": "low",
            "assigned_to": "both",
            "sba_eligible": True,
            "passed_reason": "Seasonal revenue concentration (65% May-Oct), high equipment capex (~$400K/yr), and key-man risk on top accounts.",
        },
        "contacts": [
            {
                "first_name": "Diane",
                "last_name": "Sorensen",
                "title": "Owner",
                "email": "diane@cascapelandscaping.example.com",
                "phone": "503-555-0701",
                "is_primary": True,
            }
        ],
        "financials": [
            {"period_year": 2023, "period_type": "annual", "revenue": 6_100_000, "ebitda": 1_098_000, "sde": 1_350_000, "owner_comp": 252_000},
            {"period_year": 2022, "period_type": "annual", "revenue": 5_700_000, "ebitda": 969_000, "sde": 1_230_000, "owner_comp": 261_000},
            {"period_year": 2021, "period_type": "annual", "revenue": 5_100_000, "ebitda": 816_000, "sde": 1_070_000, "owner_comp": 254_000},
        ],
        "notes": [
            {"content": "Decided to pass. Seasonal revenue concentration (65% in May-Oct) creates cash flow stress. Equipment capex ~$400K/yr suppresses true FCF.", "note_type": "analysis", "is_pinned": True, "tagged_stage": DealStage.PASSED},
            {"content": "Key-man risk: 3 of 5 commercial accounts are personal relationships of owner. Multiple too rich at 6.0x for a landscaping business.", "note_type": "analysis", "is_pinned": False, "tagged_stage": DealStage.PASSED},
        ],
    },
]

# Broker listings — scraped from various sites
BROKER_LISTINGS_DATA = [
    {
        "broker_site": "bizbuysell",
        "listing_id": "BBS-12345",
        "listing_url": "https://www.bizbuysell.com/listing/midwest-hvac/stub",
        "business_name": "Midwest HVAC Solutions",
        "asking_price": 3_780_000.0,
        "revenue": 4_200_000.0,
        "ebitda": 840_000.0,
        "location": "Indianapolis, IN",
        "industry": "HVAC Services",
        "description": "Established HVAC company with strong recurring maintenance revenue. Owner retiring.",
        "date_listed": days_ago(45),
        "date_scraped": days_ago(44),
        "is_new": False,
        "broker_name": "James Whitfield",
        "broker_email": "james@whitfieldbiz.com",
        "broker_phone": "512-555-0101",
        "raw_text": "HVAC business for sale. $4.2M revenue. $840K EBITDA. Owner retiring.",
    },
    {
        "broker_site": "axial",
        "listing_id": "AXL-67890",
        "listing_url": "https://www.axial.net/forum/stub",
        "business_name": "Precision Parts Manufacturing",
        "asking_price": 8_580_000.0,
        "revenue": 7_800_000.0,
        "ebitda": 1_716_000.0,
        "location": "Denver, CO",
        "industry": "Manufacturing",
        "description": "ISO-certified CNC machining shop with aerospace and defense contracts.",
        "date_listed": days_ago(30),
        "date_scraped": days_ago(29),
        "is_new": False,
        "broker_name": "Sandra Park",
        "broker_email": "sandra@parkmna.com",
        "broker_phone": "303-555-0202",
        "raw_text": "CNC machining. ISO 9001. Aerospace/defense OEM supplier. $7.8M revenue.",
    },
    {
        "broker_site": "bizquest",
        "listing_id": "BQ-234567",
        "listing_url": "https://www.bizquest.com/listing/techserv/stub",
        "business_name": "TechServ IT Managed Services",
        "asking_price": 8_064_000.0,
        "revenue": 5_600_000.0,
        "ebitda": 1_344_000.0,
        "location": "Dallas, TX",
        "industry": "Technology Services",
        "description": "MSP with 140 SMB clients. 90% recurring MRR. 3-year contracts.",
        "date_listed": days_ago(60),
        "date_scraped": days_ago(59),
        "is_new": False,
        "broker_name": "James Whitfield",
        "broker_email": "james@whitfieldbiz.com",
        "broker_phone": "512-555-0101",
        "raw_text": "IT managed services. 140 clients. MRR. Cybersecurity. $5.6M revenue.",
    },
    {
        "broker_site": "dealstream",
        "listing_id": "DS-99001",
        "listing_url": "https://www.dealstream.com/deal/plumbing-services-midwest",
        "business_name": "Great Lakes Plumbing Services",
        "asking_price": 2_100_000.0,
        "revenue": 3_400_000.0,
        "ebitda": 510_000.0,
        "location": "Detroit, MI",
        "industry": "Plumbing Services",
        "description": "Residential and commercial plumbing company with 15-year track record.",
        "date_listed": days_ago(7),
        "date_scraped": days_ago(6),
        "is_new": True,
        "broker_name": "Susan Park",
        "broker_email": "spark@dealstream.com",
        "broker_phone": "313-555-0400",
        "raw_text": "Plumbing contractor. Residential + commercial. Detroit metro. $3.4M revenue.",
    },
    {
        "broker_site": "bizbuysell",
        "listing_id": "BBS-55678",
        "listing_url": "https://www.bizbuysell.com/listing/electrical-contractor-55678",
        "business_name": "Premier Electrical Contractors",
        "asking_price": 4_500_000.0,
        "revenue": 5_800_000.0,
        "ebitda": 900_000.0,
        "location": "Charlotte, NC",
        "industry": "Electrical Services",
        "description": "Licensed electrical contractor serving commercial and industrial clients.",
        "date_listed": days_ago(14),
        "date_scraped": days_ago(13),
        "is_new": True,
        "broker_name": "James Whitfield",
        "broker_email": "james@whitfieldbiz.com",
        "broker_phone": "512-555-0101",
        "raw_text": "Electrical contractor. Commercial + industrial. Charlotte NC. $5.8M revenue.",
    },
]

# Email threads — simulated Gmail sync
EMAIL_THREADS_DATA = [
    {
        "gmail_thread_id": "thread_abc123",
        "subject": "RE: Midwest HVAC Solutions — NDA Request",
        "sender_email": "james@whitfieldbiz.com",
        "snippet": "Please find the attached NDA for your review. Once signed, we can share the CIM.",
        "full_body": "Hi Matt,\n\nPlease find the attached NDA for your review. Once signed, we can share the CIM and arrange a call with the owner.\n\nBest,\nJames Whitfield\nWhitfield Business Advisors",
        "received_at": days_ago(20),
        "is_broker": True,
        "is_processed": True,
        "is_unread": False,
        "message_count": 4,
        "labels": ["INBOX", "IMPORTANT"],
        "linked_by": "matt",
    },
    {
        "gmail_thread_id": "thread_def456",
        "subject": "Precision Parts — CIM Follow-Up",
        "sender_email": "sandra@parkmna.com",
        "snippet": "Utsav, attached is the updated CIM with Q3 financials. Let me know if you have questions.",
        "full_body": "Hi Utsav,\n\nAttached is the updated CIM with Q3 financials. Revenue is tracking 8% ahead of prior year.\n\nBest,\nSandra Park\nPark M&A Group",
        "received_at": days_ago(10),
        "is_broker": True,
        "is_processed": True,
        "is_unread": False,
        "message_count": 7,
        "labels": ["INBOX"],
        "linked_by": "utsav",
    },
    {
        "gmail_thread_id": "thread_ghi789",
        "subject": "SunBelt Pest Control — LOI Discussion",
        "sender_email": "mwilliams@sunbeltbusiness.com",
        "snippet": "The seller has reviewed your LOI and has a few comments on the earnout structure.",
        "full_body": "Hi Matt,\n\nThe seller has reviewed your LOI and has a few comments on the earnout structure. He is open to negotiation on the holdback percentage. Can we schedule a call this week?\n\nMarcus Williams\nSunBelt Business Advisors",
        "received_at": days_ago(3),
        "is_broker": True,
        "is_processed": False,
        "is_unread": True,
        "message_count": 12,
        "labels": ["INBOX", "IMPORTANT", "STARRED"],
        "linked_by": "matt",
    },
    {
        "gmail_thread_id": "thread_jkl012",
        "subject": "New Listing Alert: Great Lakes Plumbing Services — $2.1M",
        "sender_email": "alerts@dealstream.com",
        "snippet": "A new business matching your search criteria has been listed on DealStream.",
        "full_body": "A new business matching your search criteria has been listed:\n\nGreat Lakes Plumbing Services\nAsking: $2,100,000 | Revenue: $3,400,000 | EBITDA: $510,000\nLocation: Detroit, MI\n\nView listing: https://www.dealstream.com/deal/plumbing-services-midwest",
        "received_at": days_ago(1),
        "is_broker": False,
        "is_processed": False,
        "is_unread": True,
        "message_count": 1,
        "labels": ["INBOX"],
        "linked_by": None,
    },
]

# Outreach log entries — indexed by company position (0-4)
OUTREACH_ENTRIES = [
    # Midwest HVAC — initial broker inquiry
    {
        "company_idx": 0,
        "sent_by_username": "matt",
        "contact_method": ContactMethod.EMAIL,
        "direction": OutreachDirection.OUTBOUND,
        "notes": "Sent initial inquiry email to broker James Whitfield about Midwest HVAC listing.",
        "outcome": OutreachOutcome.POSITIVE,
        "follow_up_date": None,
        "subject": "Inquiry: Midwest HVAC Solutions (BBS-12345)",
        "sent_at": days_ago(25),
        "replied_at": days_ago(22),
        "sequence_step": 1,
        "template_used": "initial_broker_inquiry",
    },
    # Midwest HVAC — NDA sent
    {
        "company_idx": 0,
        "sent_by_username": "matt",
        "contact_method": ContactMethod.EMAIL,
        "direction": OutreachDirection.OUTBOUND,
        "notes": "Sent signed NDA back to broker. Awaiting CIM.",
        "outcome": OutreachOutcome.POSITIVE,
        "follow_up_date": None,
        "subject": "RE: Midwest HVAC Solutions — Signed NDA Attached",
        "sent_at": days_ago(18),
        "replied_at": days_ago(17),
        "sequence_step": 2,
        "template_used": None,
    },
    # Precision Parts — intro call
    {
        "company_idx": 1,
        "sent_by_username": "utsav",
        "contact_method": ContactMethod.PHONE,
        "direction": OutreachDirection.OUTBOUND,
        "notes": "30-minute intro call with Sandra Park (Axial). Business sounds strong — ISO-certified, long-term aerospace contracts. Owner wants clean exit, no earnout.",
        "outcome": OutreachOutcome.MEETING_BOOKED,
        "follow_up_date": days_from_now(3),
        "subject": None,
        "sent_at": days_ago(15),
        "replied_at": days_ago(15),
        "sequence_step": 1,
        "template_used": None,
    },
    # SunBelt — LOI submission
    {
        "company_idx": 2,
        "sent_by_username": "matt",
        "contact_method": ContactMethod.EMAIL,
        "direction": OutreachDirection.OUTBOUND,
        "notes": "Submitted revised LOI with 10% earnout over 18 months. Seller reviewing.",
        "outcome": OutreachOutcome.PENDING,
        "follow_up_date": days_from_now(5),
        "subject": "SunBelt Pest Control — Revised LOI v2",
        "sent_at": days_ago(4),
        "replied_at": None,
        "sequence_step": 3,
        "template_used": "loi_submission",
    },
    # TechServ — site visit
    {
        "company_idx": 3,
        "sent_by_username": "utsav",
        "contact_method": ContactMethod.IN_PERSON,
        "direction": OutreachDirection.OUTBOUND,
        "notes": "Site visit to TechServ Dallas office. Met Kevin Okafor and his ops team. Very organized — clean financials, strong culture. Confirmed 90% MRR with client list.",
        "outcome": OutreachOutcome.MEETING_BOOKED,
        "follow_up_date": days_from_now(7),
        "subject": None,
        "sent_at": days_ago(8),
        "replied_at": days_ago(8),
        "sequence_step": 4,
        "template_used": None,
    },
]

# Documents — indexed by company position (0-4)
DOCUMENTS_DATA = [
    {
        "company_idx": 0,
        "uploaded_by_username": "matt",
        "doc_type": DocumentType.NDA,
        "filename": "Midwest_HVAC_NDA_Signed_2024.pdf",
        "file_path": "company_1/midwest_hvac_nda_signed.pdf",
        "file_size_bytes": 245_000,
        "mime_type": "application/pdf",
        "description": "Executed NDA with Midwest HVAC Solutions — signed by Matt",
        "is_confidential": True,
        "version": 1,
    },
    {
        "company_idx": 1,
        "uploaded_by_username": "utsav",
        "doc_type": DocumentType.CIM,
        "filename": "Precision_Parts_CIM_v2_Q3_2024.pdf",
        "file_path": "company_2/precision_parts_cim_v2.pdf",
        "file_size_bytes": 3_400_000,
        "mime_type": "application/pdf",
        "description": "Confidential Information Memorandum — updated with Q3 2024 financials",
        "is_confidential": True,
        "version": 2,
    },
    {
        "company_idx": 2,
        "uploaded_by_username": "matt",
        "doc_type": DocumentType.LOI,
        "filename": "SunBelt_LOI_v2_Submitted.pdf",
        "file_path": "company_3/sunbelt_loi_v2.pdf",
        "file_size_bytes": 180_000,
        "mime_type": "application/pdf",
        "description": "Letter of Intent v2 — revised earnout structure, submitted to seller",
        "is_confidential": True,
        "version": 2,
    },
    {
        "company_idx": 3,
        "uploaded_by_username": "utsav",
        "doc_type": DocumentType.FINANCIAL,
        "filename": "TechServ_Financials_2021_2023_Audited.xlsx",
        "file_path": "company_4/techserv_financials_audited.xlsx",
        "file_size_bytes": 890_000,
        "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "description": "3-year audited P&L, balance sheet, and cash flow statements",
        "is_confidential": True,
        "version": 1,
    },
    {
        "company_idx": 3,
        "uploaded_by_username": "utsav",
        "doc_type": DocumentType.DD,
        "filename": "TechServ_DD_Checklist_v1.docx",
        "file_path": "company_4/techserv_dd_checklist.docx",
        "file_size_bytes": 95_000,
        "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "description": "Due diligence checklist — tracking open items",
        "is_confidential": True,
        "version": 1,
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# Seed functions
# ─────────────────────────────────────────────────────────────────────────────

async def seed_users(db: AsyncSession) -> dict[str, User]:
    users = {}
    for u in USERS:
        existing = (await db.execute(select(User).where(User.username == u["username"]))).scalar_one_or_none()
        if existing:
            print(f"  User '{u['username']}' already exists — skipping.")
            users[u["username"]] = existing
            continue
        user = User(
            username=u["username"],
            display_name=u["display_name"],
            email=u["email"],
            password_hash=hash_password(u["password"]),
        )
        db.add(user)
        await db.flush()
        users[u["username"]] = user
        print(f"  ✓ User: {u['username']} (id={user.id})")
    return users


async def seed_brokers(db: AsyncSession) -> list[Broker]:
    brokers = []
    for b in BROKERS_DATA:
        existing = (await db.execute(select(Broker).where(Broker.email == b["email"]))).scalar_one_or_none()
        if existing:
            brokers.append(existing)
            continue
        broker = Broker(**b)
        db.add(broker)
        await db.flush()
        brokers.append(broker)
        print(f"  ✓ Broker: {b['first_name']} {b['last_name']} ({b['firm_name']})")
    return brokers


async def seed_lenders(db: AsyncSession) -> list[Lender]:
    lenders = []
    for l in LENDERS_DATA:
        existing = (await db.execute(select(Lender).where(Lender.name == l["name"]))).scalar_one_or_none()
        if existing:
            lenders.append(existing)
            continue
        lender = Lender(**l)
        db.add(lender)
        await db.flush()
        lenders.append(lender)
        print(f"  ✓ Lender: {l['name']}")
    return lenders


async def seed_companies(
    db: AsyncSession,
    users: dict[str, User],
) -> list[Company]:
    company_objs: list[Company] = []
    for entry in COMPANIES_DATA:
        cdata = entry["company"].copy()
        existing = (await db.execute(select(Company).where(Company.slug == cdata["slug"]))).scalar_one_or_none()
        if existing:
            print(f"  Company '{cdata['name']}' already exists — skipping.")
            company_objs.append(existing)
            continue

        company = Company(**cdata)
        db.add(company)
        await db.flush()
        company_objs.append(company)
        print(f"  ✓ Company: {cdata['name']} (stage: {cdata['deal_stage'].value})")

        # Deal
        deal_data = entry["deal"].copy()
        deal = Deal(
            company_id=company.id,
            stage=cdata["deal_stage"],
            **deal_data,
        )
        db.add(deal)
        await db.flush()

        # Contacts
        for c in entry.get("contacts", []):
            contact = Contact(company_id=company.id, **c)
            db.add(contact)

        # Financials
        for f in entry.get("financials", []):
            fin = Financial(company_id=company.id, source="seed", **f)
            db.add(fin)

        # Notes
        author = users.get("matt")
        for n in entry.get("notes", []):
            note = Note(
                company_id=company.id,
                deal_id=deal.id,
                author_id=author.id if author else None,
                **n,
            )
            db.add(note)

    await db.flush()
    return company_objs


async def seed_broker_listings(
    db: AsyncSession,
    company_objs: list[Company],
) -> None:
    for i, bl in enumerate(BROKER_LISTINGS_DATA):
        existing = (await db.execute(
            select(BrokerListing).where(
                BrokerListing.broker_site == bl["broker_site"],
                BrokerListing.listing_id == bl["listing_id"],
            )
        )).scalar_one_or_none()
        if existing:
            print(f"  Listing '{bl['business_name']}' already exists — skipping.")
            continue

        listing = BrokerListing(**bl)
        # Link first 3 listings to companies
        if i < 3 and i < len(company_objs):
            listing.matched_company_id = company_objs[i].id
        db.add(listing)
        await db.flush()
        print(f"  ✓ Listing: {bl['business_name']} ({bl['broker_site']})")


async def seed_email_threads(
    db: AsyncSession,
    company_objs: list[Company],
) -> None:
    for i, et in enumerate(EMAIL_THREADS_DATA):
        existing = (await db.execute(
            select(EmailThread).where(
                EmailThread.gmail_thread_id == et["gmail_thread_id"]
            )
        )).scalar_one_or_none()
        if existing:
            print(f"  Thread '{et['subject'][:40]}...' already exists — skipping.")
            continue

        thread = EmailThread(**et)
        # Link first 3 threads to companies
        if i < 3 and i < len(company_objs):
            thread.company_id = company_objs[i].id
            thread.matched_company_id = company_objs[i].id
        db.add(thread)
        await db.flush()
        print(f"  ✓ Thread: {et['subject'][:50]}...")


async def seed_outreach(
    db: AsyncSession,
    users: dict[str, User],
    company_objs: list[Company],
) -> None:
    for oe in OUTREACH_ENTRIES:
        company_idx = oe.pop("company_idx")
        sent_by_username = oe.pop("sent_by_username")
        company = company_objs[company_idx] if company_idx < len(company_objs) else None
        if not company:
            continue
        user = users.get(sent_by_username)
        entry = OutreachLog(
            company_id=company.id,
            sent_by=user.id if user else None,
            **oe,
        )
        db.add(entry)
        await db.flush()
        print(f"  ✓ Outreach: {entry.contact_method.value} → {entry.outcome.value} ({company.name})")


async def seed_documents(
    db: AsyncSession,
    users: dict[str, User],
    company_objs: list[Company],
) -> None:
    for doc_data in DOCUMENTS_DATA:
        company_idx = doc_data.pop("company_idx")
        uploaded_by_username = doc_data.pop("uploaded_by_username")
        company = company_objs[company_idx] if company_idx < len(company_objs) else None
        if not company:
            continue
        user = users.get(uploaded_by_username)
        doc = Document(
            company_id=company.id,
            uploaded_by=user.id if user else None,
            **doc_data,
        )
        db.add(doc)
        await db.flush()
        print(f"  ✓ Document: {doc_data['filename']}")


async def main():
    print("=" * 60)
    print("  Search Fund CRM — Seed Script")
    print("=" * 60)

    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("\nDatabase tables ensured.\n")

    async with AsyncSessionLocal() as db:
        print("Seeding users…")
        users = await seed_users(db)

        print("\nSeeding brokers…")
        await seed_brokers(db)

        print("\nSeeding lenders…")
        await seed_lenders(db)

        print("\nSeeding companies, deals, contacts, financials, and notes…")
        company_objs = await seed_companies(db, users)

        print("\nSeeding broker listings…")
        await seed_broker_listings(db, company_objs)

        print("\nSeeding email threads…")
        await seed_email_threads(db, company_objs)

        print("\nSeeding outreach log…")
        await seed_outreach(db, users, company_objs)

        print("\nSeeding documents…")
        await seed_documents(db, users, company_objs)

        await db.commit()

    print("\n" + "=" * 60)
    print("  ✅ Seed complete!")
    print("=" * 60)
    print(f"\n  Companies:        {len(COMPANIES_DATA)}")
    print(f"  Broker Listings:  {len(BROKER_LISTINGS_DATA)}")
    print(f"  Email Threads:    {len(EMAIL_THREADS_DATA)}")
    print(f"  Outreach Entries: {len(OUTREACH_ENTRIES)}")
    print(f"  Documents:        {len(DOCUMENTS_DATA)}")
    print(f"\nLogin credentials:")
    print("  Username: matt    | Password: changeme_matt")
    print("  Username: utsav   | Password: changeme_utsav")
    print()


if __name__ == "__main__":
    asyncio.run(main())
