# Search Fund Acquisition CRM & Deal Flow

A full-stack deal flow management platform built for Matt & Utsav's search fund. Tracks companies, manages the acquisition pipeline, automates outreach, and centralizes all diligence documents.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.11 · FastAPI · SQLAlchemy 2.0 (async) · Alembic |
| **Database** | SQLite (local dev) · PostgreSQL-ready via env var |
| **Task Queue** | Celery + Redis (broker scraping, enrichment, AI) |
| **Auth** | Session-based (itsdangerous) · 30-day remember-me cookie |
| **Frontend** | React 18 · TypeScript · Vite · Tailwind CSS · shadcn/ui |
| **State** | Zustand · TanStack Query |
| **Routing** | React Router v6 |

---

## Project Structure

```
searchfund-crm/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py              # Auth dependency (get_current_user)
│   │   │   └── routes/
│   │   │       ├── auth.py          # Login / logout / me
│   │   │       ├── companies.py     # Company CRUD + search
│   │   │       ├── contacts.py      # Contact management
│   │   │       ├── deals.py         # Deal CRUD
│   │   │       ├── pipeline.py      # Kanban board + stage moves
│   │   │       ├── email.py         # Gmail OAuth + thread sync
│   │   │       ├── broker_listings.py  # Scraped listing management
│   │   │       ├── outreach.py      # Outreach log + sequences
│   │   │       ├── documents.py     # Document vault
│   │   │       ├── financials.py    # Financial model import
│   │   │       ├── cim.py           # CIM upload + AI extraction
│   │   │       ├── industry_kb.py   # Industry knowledge base
│   │   │       ├── comp_transactions.py  # Comparable deals
│   │   │       ├── brokers.py       # Broker CRM
│   │   │       ├── lenders.py       # SBA lender tracker
│   │   │       ├── ndas.py          # NDA management + e-sign
│   │   │       ├── call_logs.py     # Call logs + prep
│   │   │       ├── activity.py      # Team activity feed
│   │   │       ├── scraper.py       # Scraper trigger endpoints
│   │   │       └── enrichment.py    # EDGAR / OpenCorporates enrichment
│   │   ├── core/
│   │   │   ├── config.py            # Pydantic settings
│   │   │   └── security.py          # Password hashing, session signing
│   │   ├── db/
│   │   │   └── base.py              # SQLAlchemy engine + session
│   │   ├── models/
│   │   │   └── models.py            # All ORM models (15 tables)
│   │   ├── tasks/
│   │   │   ├── celery_app.py        # Celery configuration
│   │   │   ├── scraper_tasks.py     # BizBuySell / Axial / BizQuest / DealStream
│   │   │   ├── enrichment_tasks.py  # EDGAR / OpenCorporates / Google Places
│   │   │   ├── email_tasks.py       # Gmail sync background task
│   │   │   └── ai_tasks.py          # CIM scoring, LOI drafting
│   │   └── main.py                  # FastAPI app + CORS + router mounts
│   ├── alembic/                     # Database migrations
│   ├── scripts/
│   │   └── seed.py                  # Seed 5 companies + users
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/layout/
│       │   ├── AppLayout.tsx        # Root layout wrapper
│       │   ├── Sidebar.tsx          # Desktop sidebar (all nav groups)
│       │   ├── TopBar.tsx           # Page title + user avatar
│       │   ├── MobileBottomNav.tsx  # iOS/Android bottom nav (4 primary tabs)
│       │   └── MobileMoreMenu.tsx   # Slide-up "More" sheet (all sections)
│       ├── pages/
│       │   ├── LoginPage.tsx
│       │   ├── DashboardPage.tsx
│       │   ├── pipeline/PipelinePage.tsx      # Kanban board
│       │   ├── companies/CompaniesPage.tsx    # Searchable table
│       │   ├── companies/CompanyDetailPage.tsx # Tabbed detail
│       │   ├── deals/DealsPage.tsx
│       │   ├── outreach/{Outreach,Email,Calls}Page.tsx
│       │   ├── documents/{Documents,NDA}Page.tsx
│       │   ├── financials/{Financials,CIM}Page.tsx
│       │   ├── knowledge/{IndustryKB,CompTransactions,LOI}Page.tsx
│       │   ├── {BrokerListings,Brokers,Lenders}Page.tsx
│       │   ├── ActivityPage.tsx
│       │   └── settings/SettingsPage.tsx
│       ├── lib/
│       │   ├── api.ts               # Axios client + all API modules
│       │   └── utils.ts             # cn(), formatCurrency()
│       └── store/
│           └── authStore.ts         # Zustand auth store
└── docker-compose.yml
```

---

## Database Schema (15 Tables)

| Table | Purpose |
|---|---|
| `users` | Matt & Utsav — session auth |
| `companies` | Core company records with financials, AI score, source |
| `contacts` | People at target companies + brokers |
| `deals` | One deal per company — stage, pricing, probability |
| `email_threads` | Gmail thread sync |
| `broker_listings` | Raw scraped listings from BizBuySell / Axial / etc. |
| `outreach_log` | Every email/call/LinkedIn touch |
| `notes` | Timestamped notes on companies/deals |
| `documents` | Document vault — CIMs, NDAs, financials |
| `financials` | Annual/quarterly P&L per company |
| `cim_extracts` | AI-extracted fields from CIM PDFs |
| `industry_kb` | Industry knowledge base articles |
| `comp_transactions` | Comparable M&A transactions |
| `brokers` | Broker CRM |
| `lenders` | SBA lender tracker |
| `ndas` | NDA status + e-signature tracking |
| `call_logs` | Call prep + notes |

---

## Seed Data — 5 Companies

| # | Company | Industry | Ask Price | Stage |
|---|---|---|---|---|
| 1 | Midwest HVAC Solutions | HVAC Services | $3.78M | Sourced |
| 2 | Precision Parts Manufacturing | CNC Machining | $8.58M | NDA Signed |
| 3 | SunBelt Pest Control | Pest Control | $11.4M | CIM Review |
| 4 | TechServ IT Managed Services | MSP / IT | $8.06M | LOI Submitted |
| 5 | Cascade Landscaping & Snow | Landscaping | $6.59M | Due Diligence |

---

## Quick Start

### Backend

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Seed the database (creates SQLite + 5 companies)
python -m scripts.seed

# Run the API server
uvicorn app.main:app --reload --port 8000
```

**Login credentials after seeding:**

| User | Password |
|---|---|
| `matt` | `changeme_matt` |
| `utsav` | `changeme_utsav` |

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
# → http://localhost:5173
```

### Docker (Full Stack)

```bash
# From project root
docker-compose up
# Backend → http://localhost:8000
# Frontend → http://localhost:5173
# API Docs → http://localhost:8000/docs
```

---

## API Overview

The FastAPI backend exposes **61 routes** across all modules:

- `POST /api/auth/login` — session login with remember-me
- `GET  /api/auth/me` — current user
- `GET  /api/companies/` — list + search companies
- `GET  /api/pipeline/board` — Kanban board grouped by stage
- `POST /api/pipeline/{deal_id}/move` — move deal to new stage
- `GET  /api/deals/` — list all deals
- `GET  /api/activity/feed` — team activity feed
- `POST /api/scraper/run` — trigger background scraper
- `POST /api/enrichment/{company_id}` — enrich company data
- … and 50+ more (see `/docs` for full Swagger UI)

---

## Next Modules to Build

The scaffold is ready for these 10 feature modules:

1. **Email Integration** — Gmail OAuth, thread sync, compose
2. **Broker Scraper** — BizBuySell, Axial, BizQuest, DealStream
3. **Company Enrichment** — EDGAR, OpenCorporates, Google Places
4. **Deal Pipeline CRM** — Full Kanban with drag-and-drop
5. **AI Deal Scoring** — CIM PDF upload + GPT-4 extraction
6. **Financial Model** — Excel import + AI builder
7. **NDA Review + E-Sign** — DocuSign/HelloSign integration
8. **Outreach Automation** — Email sequences + call scheduling
9. **Team Workspace** — Real-time activity feed, @mentions
10. **Knowledge Base** — Industry comps, LOI templates, SBA tracker
