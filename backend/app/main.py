"""
Evergreen Search CRM — FastAPI Application Entry Point (V2 Refactor)
"""
import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from loguru import logger

from app.core.config import settings
from app.db.base import engine, Base

# ── Route imports ─────────────────────────────────────────────────────────────
from app.api.routes import (
    auth,
    companies,
    contacts,
    deals,
    pipeline,
    email,
    broker_listings,
    outreach,
    notes,
    documents,
    financials,
    industry_kb,
    comp_transactions,
    brokers,
    lenders,
    ndas,
    call_logs,
    activity,
    enrichment,
    dashboard,
    extension,
    quick_add,
    email_ingest,
    thesis,
    bulk_import,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: ensure DB tables exist.  Uses a 15-second timeout so a
    slow/failing asyncpg connection never blocks uvicorn from starting.
    In production Alembic handles schema; this is a safety-net only."""
    try:
        async with asyncio.timeout(15):
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables ensured.")
    except Exception as exc:
        logger.warning(
            f"Startup create_all skipped ({type(exc).__name__}: {exc}). "
            "Alembic manages the schema in production — this is safe to ignore."
        )
    yield
    await engine.dispose()
    logger.info("Database engine disposed.")


app = FastAPI(
    title="Evergreen Search",
    description="Search Fund Deal Flow Platform",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    redirect_slashes=True,
)

# ── Middleware ────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.all_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API Routers ───────────────────────────────────────────────────────────────

API = "/api"

app.include_router(auth.router,              prefix=f"{API}/auth",              tags=["Auth"])
app.include_router(extension.router,         prefix=f"{API}",                   tags=["Extension"])
app.include_router(companies.router,         prefix=f"{API}/companies",         tags=["Companies"])
app.include_router(contacts.router,          prefix=f"{API}/contacts",          tags=["Contacts"])
app.include_router(deals.router,             prefix=f"{API}/deals",             tags=["Deals"])
app.include_router(pipeline.router,          prefix=f"{API}/pipeline",          tags=["Pipeline"])
app.include_router(email.router,             prefix=f"{API}/email",             tags=["Email"])
app.include_router(broker_listings.router,   prefix=f"{API}/broker-listings",   tags=["Broker Listings"])
app.include_router(outreach.router,          prefix=f"{API}/outreach",          tags=["Outreach"])
app.include_router(notes.router,             prefix=f"{API}/notes",             tags=["Notes"])
app.include_router(documents.router,         prefix=f"{API}/documents",         tags=["Documents"])
app.include_router(financials.router,        prefix=f"{API}/financials",        tags=["Financials"])
app.include_router(industry_kb.router,       prefix=f"{API}/industry-kb",       tags=["Industry KB"])
app.include_router(comp_transactions.router, prefix=f"{API}/comp-transactions", tags=["Comp Transactions"])
app.include_router(brokers.router,           prefix=f"{API}/brokers",           tags=["Brokers"])
app.include_router(lenders.router,           prefix=f"{API}/lenders",           tags=["Lenders"])
app.include_router(ndas.router,              prefix=f"{API}/ndas",              tags=["NDAs"])
app.include_router(call_logs.router,         prefix=f"{API}/call-logs",         tags=["Call Logs"])
app.include_router(activity.router,          prefix=f"{API}",                   tags=["Activity"])
app.include_router(dashboard.router,         prefix=f"{API}",                   tags=["Dashboard"])
app.include_router(enrichment.router,        prefix=f"{API}/enrichment",        tags=["Enrichment"])
app.include_router(quick_add.router,         prefix=f"{API}/quick-add",         tags=["Quick Add"])
app.include_router(email_ingest.router,      prefix=f"{API}/email-ingest",      tags=["Email Ingest"])
app.include_router(thesis.router,            prefix=f"{API}/thesis",            tags=["Thesis"])
app.include_router(bulk_import.router,       prefix=f"{API}/import",            tags=["Import"])


@app.get("/api/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "env": settings.APP_ENV, "version": "2.0.0"}


# ── Serve React frontend ──────────────────────────────────────────────────────

_STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static"))

if os.path.isdir(_STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(_STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        return FileResponse(os.path.join(_STATIC_DIR, "index.html"))
