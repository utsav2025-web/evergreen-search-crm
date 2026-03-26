"""
Search Fund CRM — Full ORM Model Definitions
=============================================

Tables (17 total):
  users, companies, contacts, deals,
  email_threads, broker_listings, outreach_log, notes, documents,
  financials, cim_extracts, industry_kb, comp_transactions,
  brokers, lenders, ndas, call_logs

Every field in the spec is present.  Additional fields that support
the full feature set (enrichment, AI scoring, relationships) are
included with clear comments.
"""
import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float, ForeignKey,
    Index, Integer, JSON, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


# ─────────────────────────────────────────────────────────────────────────────
# Enumerations
# ─────────────────────────────────────────────────────────────────────────────

class DealStage(str, enum.Enum):
    """Pipeline stages for a company / deal (Lead → Acquisition)."""
    LEAD              = "lead"        # Raw inbound / imported lead
    PROSPECT          = "prospect"    # Qualified, not yet contacted
    CONTACTED         = "contacted"   # Outreach sent
    NDA               = "nda"         # NDA executed
    CIM               = "cim"         # CIM received & under review
    MODEL             = "model"       # Financial model being built
    IOI               = "ioi"         # Indication of Interest submitted
    LOI               = "loi"         # LOI submitted
    DILIGENCE         = "diligence"   # Due Diligence
    CLOSED            = "closed"      # Acquisition closed
    PASSED            = "passed"      # Passed / dead


class ContactMethod(str, enum.Enum):
    EMAIL     = "email"
    PHONE     = "phone"
    LINKEDIN  = "linkedin"
    LETTER    = "letter"
    IN_PERSON = "in_person"
    OTHER     = "other"


class OutreachDirection(str, enum.Enum):
    OUTBOUND = "outbound"
    INBOUND  = "inbound"


class OutreachOutcome(str, enum.Enum):
    NO_RESPONSE    = "no_response"
    POSITIVE       = "positive"
    NEGATIVE       = "negative"
    MEETING_BOOKED = "meeting_booked"
    NDA_REQUESTED  = "nda_requested"
    PASSED         = "passed"
    PENDING        = "pending"


class DocumentType(str, enum.Enum):
    NDA       = "nda"
    CIM       = "cim"
    LOI       = "loi"
    FINANCIAL = "financial"
    DD        = "dd"
    OTHER     = "other"


class EntityType(str, enum.Enum):
    LLC       = "llc"
    S_CORP    = "s_corp"
    C_CORP    = "c_corp"
    SOLE_PROP = "sole_prop"
    PARTNER   = "partnership"
    OTHER     = "other"


class NDAStatus(str, enum.Enum):
    DRAFT   = "draft"
    SENT    = "sent"
    SIGNED  = "signed"
    EXPIRED = "expired"


class CallOutcome(str, enum.Enum):
    COMPLETED   = "completed"
    NO_ANSWER   = "no_answer"
    LEFT_VM     = "left_vm"
    RESCHEDULED = "rescheduled"
    CANCELLED   = "cancelled"


# ─────────────────────────────────────────────────────────────────────────────
# Timestamp Mixin
# ─────────────────────────────────────────────────────────────────────────────

class TimestampMixin:
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Users
# ─────────────────────────────────────────────────────────────────────────────

class User(TimestampMixin, Base):
    """Platform users — Matt and Utsav."""
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String(50),  unique=True, nullable=False, index=True)
    display_name  = Column(String(100), nullable=False)
    email         = Column(String(255), unique=True, nullable=True)
    password_hash = Column(String(255), nullable=True)   # null for OAuth-only users
    # role: partner | guest
    role          = Column(String(20), default="partner", nullable=False)
    # Google OAuth fields
    google_id     = Column(String(255), unique=True, nullable=True, index=True)
    google_email  = Column(String(255), unique=True, nullable=True)
    google_access_token  = Column(Text, nullable=True)
    google_refresh_token = Column(Text, nullable=True)
    google_token_expiry  = Column(DateTime(timezone=True), nullable=True)
    # Guest session expiry (legacy)
    session_expiry = Column(DateTime(timezone=True), nullable=True)
    # Soft-login session token
    session_token      = Column(String(128), nullable=True, index=True)
    session_expires_at = Column(DateTime(timezone=True), nullable=True)
    is_active     = Column(Boolean, default=True, nullable=False)
    avatar_url    = Column(String(500), nullable=True)
    # Gmail OAuth tokens stored as encrypted JSON blob
    gmail_tokens  = Column(Text, nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    notes         = relationship("Note",        back_populates="author",
                                 foreign_keys="Note.author_id")
    call_logs     = relationship("CallLog",     back_populates="conducted_by_user")


# ─────────────────────────────────────────────────────────────────────────────
# Brokers  (declared before Company so FK resolves)
# ─────────────────────────────────────────────────────────────────────────────

class Broker(TimestampMixin, Base):
    """M&A broker / intermediary CRM."""
    __tablename__ = "brokers"

    id                   = Column(Integer, primary_key=True, index=True)
    firm_name            = Column(String(255), nullable=True)
    first_name           = Column(String(100), nullable=False)
    last_name            = Column(String(100), nullable=True)
    email                = Column(String(255), nullable=True, index=True)
    phone                = Column(String(50),  nullable=True)
    website              = Column(String(500), nullable=True)
    state                = Column(String(50),  nullable=True)
    # Industries this broker focuses on
    specialties          = Column(JSON, default=list)
    # cold | warm | hot
    relationship_strength = Column(String(20), default="cold")
    last_contacted_at    = Column(DateTime(timezone=True), nullable=True)
    notes_text           = Column(Text, nullable=True)
    # bizbuysell | axial | bizquest | manual | referral
    source               = Column(String(100), nullable=True)
    deal_count           = Column(Integer, default=0)
    avg_deal_size        = Column(Float, nullable=True)

    # Relationships
    contacts             = relationship("Contact", back_populates="broker")
    deals                = relationship("Deal",    back_populates="broker")
    listings             = relationship("BrokerListing", back_populates="broker")


# ─────────────────────────────────────────────────────────────────────────────
# Lenders  (declared before Deal so FK resolves)
# ─────────────────────────────────────────────────────────────────────────────

class Lender(TimestampMixin, Base):
    """SBA and conventional lender tracker."""
    __tablename__ = "lenders"

    id              = Column(Integer, primary_key=True, index=True)
    name            = Column(String(255), nullable=False)
    # sba_preferred | sba | conventional | mezzanine | seller_note
    lender_type     = Column(String(50),  nullable=True)
    contact_name    = Column(String(200), nullable=True)
    contact_email   = Column(String(255), nullable=True)
    contact_phone   = Column(String(50),  nullable=True)
    website         = Column(String(500), nullable=True)
    state           = Column(String(50),  nullable=True)
    max_loan_amount = Column(Float, nullable=True)
    min_loan_amount = Column(Float, nullable=True)
    # Annual SBA 7(a) volume rank (1 = Live Oak, etc.)
    sba_volume_rank = Column(Integer, nullable=True)
    notes_text      = Column(Text, nullable=True)
    is_active       = Column(Boolean, default=True)

    # Relationships
    deals           = relationship("Deal", back_populates="lender")


# ─────────────────────────────────────────────────────────────────────────────
# Companies
# ─────────────────────────────────────────────────────────────────────────────

class Company(TimestampMixin, Base):
    """
    Core company record.

    Spec fields
    -----------
    id, name, website, industry, sub_industry, annual_revenue,
    ebitda, ebitda_margin, employees, founded_year,
    state_of_incorporation, entity_type, asking_price,
    implied_multiple, deal_stage, source, broker_id, listing_url,
    owner_name, owner_email, owner_phone, lead_partner, deal_score,
    enrichment_score, created_at, updated_at, last_contacted_at,
    is_proprietary

    Additional fields
    -----------------
    slug, description, city, state, country, revenue_ttm, ebitda_ttm,
    sde_ttm, gross_margin, year_founded (alias), ein, edgar_cik,
    opencorporates_id, google_place_id, linkedin_url, tags,
    ai_score, ai_score_rationale, is_active
    """
    __tablename__ = "companies"

    # ── Primary key ──────────────────────────────────────────────────────────
    id                    = Column(Integer, primary_key=True, index=True)

    # ── Identity ─────────────────────────────────────────────────────────────
    name                  = Column(String(255), nullable=False, index=True)
    slug                  = Column(String(255), unique=True, nullable=False, index=True)
    website               = Column(String(500), nullable=True)
    description           = Column(Text, nullable=True)

    # ── Industry classification ───────────────────────────────────────────────
    industry              = Column(String(100), nullable=True, index=True)
    sub_industry          = Column(String(100), nullable=True)

    # ── Financials (top-level / TTM) ─────────────────────────────────────────
    # Spec: annual_revenue
    annual_revenue        = Column(Float, nullable=True)
    # Alias kept for backward-compat with seed / existing code
    revenue_ttm           = Column(Float, nullable=True)
    # Spec: ebitda
    ebitda                = Column(Float, nullable=True)
    ebitda_ttm            = Column(Float, nullable=True)   # alias
    # Spec: ebitda_margin  (0.0–1.0 decimal)
    ebitda_margin         = Column(Float, nullable=True)
    gross_margin          = Column(Float, nullable=True)
    sde_ttm               = Column(Float, nullable=True)   # Seller's Discretionary Earnings

    # ── Deal economics ────────────────────────────────────────────────────────
    # Spec: asking_price
    asking_price          = Column(Float, nullable=True)
    # Spec: implied_multiple  (EV / EBITDA)
    implied_multiple      = Column(Float, nullable=True)

    # ── Company profile ───────────────────────────────────────────────────────
    # Spec: employees
    employees             = Column(Integer, nullable=True)
    employee_count        = Column(Integer, nullable=True)   # alias
    # Spec: founded_year
    founded_year          = Column(Integer, nullable=True)
    year_founded          = Column(Integer, nullable=True)   # alias
    # Spec: state_of_incorporation
    state_of_incorporation = Column(String(50), nullable=True)
    # Spec: entity_type
    entity_type           = Column(Enum(EntityType), nullable=True)
    city                  = Column(String(100), nullable=True)
    state                 = Column(String(50),  nullable=True, index=True)
    country               = Column(String(50),  default="USA")

    # ── Pipeline ─────────────────────────────────────────────────────────────
    # Spec: deal_stage  (lead/prospect/contacted/nda/cim/model/ioi/loi/dd/closed/passed)
    deal_stage            = Column(Enum(DealStage), default=DealStage.LEAD,
                                   nullable=False, index=True)
    # When the company entered its current stage (for days-in-stage calculation)
    stage_entered_at      = Column(DateTime(timezone=True), nullable=True)
    # Thesis scoring
    thesis_score          = Column(Float, nullable=True)   # 0-100 vs investment thesis
    thesis_flags          = Column(JSON, default=list)     # list of flag strings (pass/watch/pursue)
    thesis_scored_at      = Column(DateTime(timezone=True), nullable=True)

    # ── Sourcing ──────────────────────────────────────────────────────────────
    # Spec: source
    source                = Column(String(100), nullable=True, index=True)
    # Spec: broker_id
    broker_id             = Column(Integer, ForeignKey("brokers.id", ondelete="SET NULL"),
                                   nullable=True, index=True)
    # Spec: listing_url
    listing_url           = Column(String(1000), nullable=True)
    source_url            = Column(String(1000), nullable=True)   # alias
    # Source traceability — links back to the originating record
    inbound_email_id      = Column(Integer, ForeignKey("inbound_emails.id", ondelete="SET NULL"), nullable=True, index=True)
    broker_listing_ref_id = Column(Integer, ForeignKey("broker_listings.id", ondelete="SET NULL"), nullable=True, index=True)
    # Spec: is_proprietary  (off-market / direct outreach)
    is_proprietary        = Column(Boolean, default=False, nullable=False)

    # ── Owner / seller contact ────────────────────────────────────────────────
    # Spec: owner_name, owner_email, owner_phone
    owner_name            = Column(String(200), nullable=True)
    owner_email           = Column(String(255), nullable=True)
    owner_phone           = Column(String(50),  nullable=True)

    # ── Team assignment ───────────────────────────────────────────────────────
    # Spec: lead_partner  ("matt" | "utsav" | "both")
    lead_partner          = Column(String(50), nullable=True)

    # ── Scoring ───────────────────────────────────────────────────────────────
    # Spec: deal_score  (0–100, manual or AI-derived)
    deal_score            = Column(Float, nullable=True)
    # Spec: enrichment_score  (0–100, how complete the record is)
    enrichment_score      = Column(Float, nullable=True)
    ai_score              = Column(Float, nullable=True)
    ai_score_rationale    = Column(Text, nullable=True)

    # ── Timestamps ────────────────────────────────────────────────────────────
    # created_at / updated_at come from TimestampMixin
    # Spec: last_contacted_at
    last_contacted_at     = Column(DateTime(timezone=True), nullable=True)

    # ── Enrichment identifiers ────────────────────────────────────────────────
    ein                   = Column(String(20),  nullable=True)
    edgar_cik             = Column(String(20),  nullable=True)
    opencorporates_id     = Column(String(100), nullable=True)
    google_place_id       = Column(String(100), nullable=True)
    linkedin_url          = Column(String(500), nullable=True)

    # ── Metadata ──────────────────────────────────────────────────────────────
    tags                  = Column(JSON, default=list)
    is_active             = Column(Boolean, default=True, nullable=False)

    # ── Relationships ─────────────────────────────────────────────────────────
    broker                = relationship("Broker",       foreign_keys=[broker_id])
    contacts              = relationship("Contact",      back_populates="company")
    deals                 = relationship("Deal",         back_populates="company")
    notes                 = relationship("Note",         back_populates="company")
    documents             = relationship("Document",     back_populates="company")
    financials            = relationship("Financial",    back_populates="company")
    outreach_logs         = relationship("OutreachLog",  back_populates="company")
    call_logs             = relationship("CallLog",      back_populates="company")
    cim_extracts          = relationship("CIMExtract",   back_populates="company")
    ndas                  = relationship("NDA",          back_populates="company")
    broker_listings       = relationship("BrokerListing",
                                         foreign_keys="BrokerListing.matched_company_id",
                                         back_populates="matched_company")

    __table_args__ = (
        Index("ix_companies_deal_stage_active", "deal_stage", "is_active"),
        Index("ix_companies_lead_partner",      "lead_partner"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Contacts
# ─────────────────────────────────────────────────────────────────────────────

class Contact(TimestampMixin, Base):
    """People associated with target companies or brokers."""
    __tablename__ = "contacts"

    id            = Column(Integer, primary_key=True, index=True)
    company_id    = Column(Integer, ForeignKey("companies.id", ondelete="SET NULL"),
                           nullable=True, index=True)
    broker_id     = Column(Integer, ForeignKey("brokers.id", ondelete="SET NULL"),
                           nullable=True, index=True)
    first_name    = Column(String(100), nullable=False)
    last_name     = Column(String(100), nullable=True)
    title         = Column(String(150), nullable=True)
    email         = Column(String(255), nullable=True, index=True)
    phone         = Column(String(50),  nullable=True)
    linkedin_url  = Column(String(500), nullable=True)
    is_primary    = Column(Boolean, default=False)
    notes_text    = Column(Text, nullable=True)

    # Relationships
    company       = relationship("Company",     back_populates="contacts")
    broker        = relationship("Broker",      back_populates="contacts")
    outreach_logs = relationship("OutreachLog", back_populates="contact")
    call_logs     = relationship("CallLog",     back_populates="contact")


# ─────────────────────────────────────────────────────────────────────────────
# Broker Listings  (scraped from BizBuySell / Axial / BizQuest / DealStream)
# ─────────────────────────────────────────────────────────────────────────────

class BrokerListing(TimestampMixin, Base):
    """
    Raw listing scraped from a broker marketplace.

    Spec fields
    -----------
    id, broker_site, listing_id, listing_url, business_name,
    asking_price, revenue, ebitda, location, industry, description,
    date_listed, date_scraped, matched_company_id, is_new, raw_text

    Additional fields
    -----------------
    broker_id, broker_name, broker_email, broker_phone,
    cash_flow, is_active, raw_data
    """
    __tablename__ = "broker_listings"

    id                  = Column(Integer, primary_key=True, index=True)

    # Spec: broker_site  (bizbuysell | axial | bizquest | dealstream)
    broker_site         = Column(String(50),   nullable=False, index=True)
    # Spec: listing_id  (external ID from the source site)
    listing_id          = Column(String(255),  nullable=True,  index=True)
    # Spec: listing_url
    listing_url         = Column(String(1000), nullable=True)
    # Spec: business_name
    business_name       = Column(String(500),  nullable=True)
    # Spec: asking_price
    asking_price        = Column(Float, nullable=True)
    # Spec: revenue
    revenue             = Column(Float, nullable=True)
    # Spec: ebitda
    ebitda              = Column(Float, nullable=True)
    # Cash flow / SDE (some sites use this instead of EBITDA)
    cash_flow           = Column(Float, nullable=True)
    # Spec: location
    location            = Column(String(200), nullable=True)
    # Spec: industry
    industry            = Column(String(100), nullable=True, index=True)
    # Spec: description
    description         = Column(Text, nullable=True)
    # Spec: date_listed
    date_listed         = Column(DateTime(timezone=True), nullable=True)
    # Spec: date_scraped
    date_scraped        = Column(DateTime(timezone=True), server_default=func.now())
    # Spec: matched_company_id  (FK to companies if we've matched it)
    matched_company_id  = Column(Integer, ForeignKey("companies.id", ondelete="SET NULL"),
                                 nullable=True, index=True)
    # Spec: is_new  (True until reviewed by a partner)
    is_new              = Column(Boolean, default=True, nullable=False)
    # Spec: raw_text  (full scraped text before parsing)
    raw_text            = Column(Text, nullable=True)

    # Additional broker contact info from the listing
    broker_id           = Column(Integer, ForeignKey("brokers.id", ondelete="SET NULL"),
                                 nullable=True, index=True)
    broker_name         = Column(String(200), nullable=True)
    broker_email        = Column(String(255), nullable=True)
    broker_phone        = Column(String(50),  nullable=True)
    # Geographic breakdown
    city                = Column(String(200), nullable=True)
    state               = Column(String(50),  nullable=True, index=True)
    country             = Column(String(100), nullable=True)
    # Business details
    employees           = Column(Integer, nullable=True)
    years_in_business   = Column(Integer, nullable=True)
    sba_eligible        = Column(Boolean, nullable=True)
    # Acquisition classification
    acquisition_tag     = Column(String(30), nullable=True, index=True)  # platform | bolt_on | owner_operator | unknown
    industry_priority   = Column(String(20), nullable=True, index=True)  # priority | non_priority | unknown
    # Review status: new | reviewed | interested | passed | matched
    status              = Column(String(30), nullable=True, default="new")
    # Parsed / structured data from the scraper
    raw_data            = Column(JSON, default=dict)
    is_active           = Column(Boolean, default=True)

    # Relationships
    matched_company     = relationship("Company",
                                       foreign_keys=[matched_company_id],
                                       back_populates="broker_listings")
    broker              = relationship("Broker", back_populates="listings")
    deals               = relationship("Deal",   back_populates="listing")

    __table_args__ = (
        UniqueConstraint("broker_site", "listing_id",
                         name="uq_broker_listing_site_id"),
        Index("ix_broker_listings_is_new", "is_new"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Deals  (one per company in the pipeline)
# ─────────────────────────────────────────────────────────────────────────────

class Deal(TimestampMixin, Base):
    """Pipeline deal record — one per company being actively evaluated."""
    __tablename__ = "deals"

    id                  = Column(Integer, primary_key=True, index=True)
    company_id          = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"),
                                 nullable=False, index=True)
    broker_id           = Column(Integer, ForeignKey("brokers.id",   ondelete="SET NULL"),
                                 nullable=True, index=True)
    lender_id           = Column(Integer, ForeignKey("lenders.id",   ondelete="SET NULL"),
                                 nullable=True)
    listing_id          = Column(Integer, ForeignKey("broker_listings.id", ondelete="SET NULL"),
                                 nullable=True)

    deal_name           = Column(String(255), nullable=True)
    stage               = Column(Enum(DealStage), default=DealStage.PROSPECT,
                                 nullable=False, index=True)
    asking_price        = Column(Float, nullable=True)
    offer_price         = Column(Float, nullable=True)
    revenue_multiple    = Column(Float, nullable=True)
    ebitda_multiple     = Column(Float, nullable=True)
    # 0–100 %
    probability         = Column(Integer, default=10)
    target_close_date   = Column(DateTime(timezone=True), nullable=True)
    passed_reason       = Column(Text, nullable=True)
    # low | medium | high
    priority            = Column(String(20), default="medium")
    # "matt" | "utsav" | "both"
    assigned_to         = Column(String(50), nullable=True)
    sba_eligible        = Column(Boolean, nullable=True)

    # Relationships
    company             = relationship("Company",       back_populates="deals")
    broker              = relationship("Broker",        back_populates="deals")
    lender              = relationship("Lender",        back_populates="deals")
    listing             = relationship("BrokerListing", back_populates="deals")
    notes               = relationship("Note",          back_populates="deal")
    documents           = relationship("Document",      back_populates="deal")
    ndas                = relationship("NDA",           back_populates="deal")


# ─────────────────────────────────────────────────────────────────────────────
# Email Threads  (Gmail sync)
# ─────────────────────────────────────────────────────────────────────────────

class EmailThread(TimestampMixin, Base):
    """
    Gmail thread synced via OAuth.

    Spec fields
    -----------
    id, gmail_thread_id, subject, sender_email, snippet,
    full_body, received_at, is_broker, matched_company_id, is_processed

    Additional fields
    -----------------
    company_id, contact_id, message_count, is_unread, labels,
    raw_messages, linked_by
    """
    __tablename__ = "email_threads"

    id                  = Column(Integer, primary_key=True, index=True)

    # Spec: gmail_thread_id
    gmail_thread_id     = Column(String(255), unique=True, nullable=True, index=True)
    # Spec: subject
    subject             = Column(String(500), nullable=True)
    # Spec: sender_email
    sender_email        = Column(String(255), nullable=True, index=True)
    # Spec: snippet  (Gmail-provided 200-char preview)
    snippet             = Column(Text, nullable=True)
    # Spec: full_body  (full decoded HTML/text of most recent message)
    full_body           = Column(Text, nullable=True)
    # Spec: received_at  (timestamp of the most recent message)
    received_at         = Column(DateTime(timezone=True), nullable=True, index=True)
    # Spec: is_broker  (True if sender is a known broker)
    is_broker           = Column(Boolean, default=False, nullable=False)
    # Spec: matched_company_id
    matched_company_id  = Column(Integer, ForeignKey("companies.id", ondelete="SET NULL"),
                                 nullable=True, index=True)
    # Spec: is_processed  (True after AI/manual triage)
    is_processed        = Column(Boolean, default=False, nullable=False)

    # Additional fields
    company_id          = Column(Integer, ForeignKey("companies.id", ondelete="SET NULL"),
                                 nullable=True, index=True)
    contact_id          = Column(Integer, ForeignKey("contacts.id",  ondelete="SET NULL"),
                                 nullable=True)
    message_count       = Column(Integer, default=1)
    is_unread           = Column(Boolean, default=True)
    # Gmail label IDs
    labels              = Column(JSON, default=list)
    # List of individual message dicts {id, from, to, date, body}
    raw_messages        = Column(JSON, default=list)
    # "matt" | "utsav" — who linked this thread
    linked_by           = Column(String(50), nullable=True)

    __table_args__ = (
        Index("ix_email_threads_is_processed", "is_processed"),
        Index("ix_email_threads_is_broker",    "is_broker"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Outreach Log
# ─────────────────────────────────────────────────────────────────────────────

class OutreachLog(TimestampMixin, Base):
    """
    Every outreach touch — email, phone, LinkedIn, letter.

    Spec fields
    -----------
    id, company_id, contact_method, direction, notes, outcome,
    follow_up_date, created_at, sent_by

    Additional fields
    -----------------
    contact_id, subject, body, sent_at, replied_at,
    email_thread_id, sequence_step, template_used
    """
    __tablename__ = "outreach_log"

    id                  = Column(Integer, primary_key=True, index=True)

    # Spec: company_id
    company_id          = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"),
                                 nullable=False, index=True)
    contact_id          = Column(Integer, ForeignKey("contacts.id",  ondelete="SET NULL"),
                                 nullable=True)
    # Spec: sent_by  (username string — simple, no FK)
    sent_by             = Column(String(100), nullable=True)

    # Spec: contact_method  (email | phone | linkedin | letter | in_person | other)
    contact_method      = Column(Enum(ContactMethod), nullable=False,
                                 default=ContactMethod.EMAIL)
    # Spec: direction  (outbound | inbound)
    direction           = Column(Enum(OutreachDirection), nullable=False,
                                 default=OutreachDirection.OUTBOUND)
    # Spec: notes
    notes               = Column(Text, nullable=True)
    # Spec: outcome
    outcome             = Column(Enum(OutreachOutcome), default=OutreachOutcome.PENDING)
    # Spec: follow_up_date
    follow_up_date      = Column(DateTime(timezone=True), nullable=True)

    # Additional fields
    subject             = Column(String(500), nullable=True)
    body                = Column(Text, nullable=True)
    sent_at             = Column(DateTime(timezone=True), nullable=True)
    replied_at          = Column(DateTime(timezone=True), nullable=True)
    email_thread_id     = Column(Integer, ForeignKey("email_threads.id", ondelete="SET NULL"),
                                 nullable=True)
    sequence_step       = Column(Integer, default=1)
    template_used       = Column(String(100), nullable=True)

    # Relationships
    company             = relationship("Company", back_populates="outreach_logs")
    contact             = relationship("Contact", back_populates="outreach_logs")
    # sent_by_user relationship removed (sent_by is now a plain string)

    __table_args__ = (
        Index("ix_outreach_follow_up", "follow_up_date"),
        Index("ix_outreach_outcome",   "outcome"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Notes
# ─────────────────────────────────────────────────────────────────────────────

class Note(TimestampMixin, Base):
    """
    Timestamped notes on companies or deals.

    Spec fields
    -----------
    id, company_id, content, created_at, created_by, tagged_stage

    Additional fields
    -----------------
    deal_id, note_type, is_pinned
    """
    __tablename__ = "notes"

    id              = Column(Integer, primary_key=True, index=True)

    # Spec: company_id
    company_id      = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"),
                             nullable=True, index=True)
    deal_id         = Column(Integer, ForeignKey("deals.id", ondelete="CASCADE"),
                             nullable=True, index=True)
    # Spec: created_by  (FK to users)
    author_id       = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"),
                             nullable=True)
    # Spec: content
    content         = Column(Text, nullable=False)
    # Spec: tagged_stage  (pipeline stage this note was written at)
    tagged_stage    = Column(Enum(DealStage), nullable=True)
    # general | meeting | call | analysis | diligence
    note_type       = Column(String(50), default="general")
    is_pinned       = Column(Boolean, default=False)

    # Relationships
    company         = relationship("Company", back_populates="notes")
    deal            = relationship("Deal",    back_populates="notes")
    author          = relationship("User",    back_populates="notes",
                                   foreign_keys=[author_id])


# ─────────────────────────────────────────────────────────────────────────────
# Documents
# ─────────────────────────────────────────────────────────────────────────────

class Document(TimestampMixin, Base):
    """
    Document vault — NDAs, CIMs, LOIs, financials, DD materials.

    Spec fields
    -----------
    id, company_id, doc_type (nda/cim/loi/financial/dd/other),
    filename, file_path, uploaded_by

    Additional fields
    -----------------
    deal_id, file_size_bytes, mime_type, description,
    is_confidential, version
    """
    __tablename__ = "documents"

    id                  = Column(Integer, primary_key=True, index=True)

    # Spec: company_id
    company_id          = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"),
                                 nullable=True, index=True)
    deal_id             = Column(Integer, ForeignKey("deals.id", ondelete="CASCADE"),
                                 nullable=True, index=True)
    # Spec: doc_type  (nda | cim | loi | financial | dd | other)
    doc_type            = Column(Enum(DocumentType), nullable=False)
    # Spec: filename
    filename            = Column(String(500), nullable=False)
    # Spec: file_path  (relative path under /uploads/)
    file_path           = Column(String(1000), nullable=False)
    # Spec: uploaded_by  (FK to users)
    uploaded_by         = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"),
                                 nullable=True)

    # Additional fields
    file_size_bytes     = Column(Integer, nullable=True)
    mime_type           = Column(String(100), nullable=True)
    description         = Column(Text, nullable=True)
    is_confidential     = Column(Boolean, default=True)
    version             = Column(Integer, default=1)

    # Relationships
    company             = relationship("Company", back_populates="documents")
    deal                = relationship("Deal",    back_populates="documents")

    __table_args__ = (
        Index("ix_documents_doc_type", "doc_type"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Financials  (annual / TTM / quarterly P&L per company)
# ─────────────────────────────────────────────────────────────────────────────

class Financial(TimestampMixin, Base):
    """Historical financial data rows — one row per period per company."""
    __tablename__ = "financials"

    id              = Column(Integer, primary_key=True, index=True)
    company_id      = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"),
                             nullable=False, index=True)
    period_year     = Column(Integer, nullable=False)
    # annual | ttm | quarterly
    period_type     = Column(String(20), default="annual")
    period_quarter  = Column(Integer, nullable=True)   # 1–4

    revenue         = Column(Float, nullable=True)
    gross_profit    = Column(Float, nullable=True)
    ebitda          = Column(Float, nullable=True)
    ebit            = Column(Float, nullable=True)
    net_income      = Column(Float, nullable=True)
    total_assets    = Column(Float, nullable=True)
    total_debt      = Column(Float, nullable=True)
    capex           = Column(Float, nullable=True)
    owner_comp      = Column(Float, nullable=True)   # add-back
    sde             = Column(Float, nullable=True)   # Seller's Discretionary Earnings
    # Full imported rows / raw JSON from Excel
    raw_data        = Column(JSON, default=dict)
    # manual | cim_extract | excel_import | seed
    source          = Column(String(100), nullable=True)

    # Relationships
    company         = relationship("Company", back_populates="financials")

    __table_args__ = (
        UniqueConstraint("company_id", "period_year", "period_type", "period_quarter",
                         name="uq_financials_company_period"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# CIM Extracts  (AI-parsed Confidential Information Memoranda)
# ─────────────────────────────────────────────────────────────────────────────

class CIMExtract(TimestampMixin, Base):
    """AI-extracted structured data from a CIM PDF."""
    __tablename__ = "cim_extracts"

    id                      = Column(Integer, primary_key=True, index=True)
    company_id              = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"),
                                     nullable=False, index=True)
    document_id             = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"),
                                     nullable=True)
    extracted_at            = Column(DateTime(timezone=True), nullable=True)
    model_used              = Column(String(100), nullable=True)

    business_summary        = Column(Text, nullable=True)
    key_products            = Column(JSON, default=list)
    customer_concentration  = Column(Float, nullable=True)   # % top customer
    revenue_recurring_pct   = Column(Float, nullable=True)
    employee_count          = Column(Integer, nullable=True)
    key_risks               = Column(JSON, default=list)
    growth_opportunities    = Column(JSON, default=list)
    financials_summary      = Column(JSON, default=dict)
    deal_score              = Column(Float, nullable=True)   # 0–100
    score_rationale         = Column(Text, nullable=True)
    raw_text                = Column(Text, nullable=True)
    raw_response            = Column(JSON, default=dict)

    # Relationships
    company                 = relationship("Company", back_populates="cim_extracts")


# ─────────────────────────────────────────────────────────────────────────────
# Industry Knowledge Base
# ─────────────────────────────────────────────────────────────────────────────

class IndustryKB(TimestampMixin, Base):
    """Industry research articles, theses, and benchmarks."""
    __tablename__ = "industry_kb"

    id              = Column(Integer, primary_key=True, index=True)
    industry        = Column(String(100), nullable=False, index=True)
    sub_industry    = Column(String(100), nullable=True)
    title           = Column(String(500), nullable=False)
    content         = Column(Text, nullable=False)
    source_url      = Column(String(1000), nullable=True)
    tags            = Column(JSON, default=list)
    added_by        = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"),
                             nullable=True)
    is_public       = Column(Boolean, default=True)


# ─────────────────────────────────────────────────────────────────────────────
# Comparable Transactions
# ─────────────────────────────────────────────────────────────────────────────

class CompTransaction(TimestampMixin, Base):
    """M&A comparable transaction database."""
    __tablename__ = "comp_transactions"

    id                   = Column(Integer, primary_key=True, index=True)
    target_name          = Column(String(255), nullable=True)
    industry             = Column(String(100), nullable=True, index=True)
    sub_industry         = Column(String(100), nullable=True)
    transaction_date     = Column(DateTime(timezone=True), nullable=True)
    enterprise_value     = Column(Float, nullable=True)
    revenue_ttm          = Column(Float, nullable=True)
    ebitda_ttm           = Column(Float, nullable=True)
    ev_revenue_multiple  = Column(Float, nullable=True)
    ev_ebitda_multiple   = Column(Float, nullable=True)
    # strategic | pe | search_fund | individual
    buyer_type           = Column(String(50), nullable=True)
    source               = Column(String(100), nullable=True)
    notes_text           = Column(Text, nullable=True)
    raw_data             = Column(JSON, default=dict)


# ─────────────────────────────────────────────────────────────────────────────
# NDAs
# ─────────────────────────────────────────────────────────────────────────────

class NDA(TimestampMixin, Base):
    """NDA tracking with e-signature status."""
    __tablename__ = "ndas"

    id                  = Column(Integer, primary_key=True, index=True)
    company_id          = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"),
                                 nullable=False, index=True)
    deal_id             = Column(Integer, ForeignKey("deals.id", ondelete="CASCADE"),
                                 nullable=True)
    document_id         = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"),
                                 nullable=True)
    status              = Column(Enum(NDAStatus), default=NDAStatus.DRAFT)
    sent_to_email       = Column(String(255), nullable=True)
    sent_at             = Column(DateTime(timezone=True), nullable=True)
    signed_at           = Column(DateTime(timezone=True), nullable=True)
    expires_at          = Column(DateTime(timezone=True), nullable=True)
    signatory_name      = Column(String(200), nullable=True)
    # docusign | hellosign | manual
    esign_provider      = Column(String(50),  nullable=True)
    esign_envelope_id   = Column(String(255), nullable=True)
    ai_review_notes     = Column(Text, nullable=True)
    redlines            = Column(JSON, default=list)

    # Relationships
    company             = relationship("Company", back_populates="ndas")
    deal                = relationship("Deal",    back_populates="ndas")


# ─────────────────────────────────────────────────────────────────────────────
# Call Logs
# ─────────────────────────────────────────────────────────────────────────────

class CallLog(TimestampMixin, Base):
    """Call scheduling, prep notes, and post-call summaries."""
    __tablename__ = "call_logs"

    id                  = Column(Integer, primary_key=True, index=True)
    company_id          = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"),
                                 nullable=False, index=True)
    contact_id          = Column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"),
                                 nullable=True)
    conducted_by        = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"),
                                 nullable=True)
    scheduled_at        = Column(DateTime(timezone=True), nullable=True)
    completed_at        = Column(DateTime(timezone=True), nullable=True)
    duration_minutes    = Column(Integer, nullable=True)
    outcome             = Column(Enum(CallOutcome), nullable=True)
    prep_notes          = Column(Text, nullable=True)
    call_notes          = Column(Text, nullable=True)
    ai_summary          = Column(Text, nullable=True)
    recording_url       = Column(String(1000), nullable=True)
    next_steps          = Column(Text, nullable=True)
    calendar_event_id   = Column(String(255), nullable=True)

    # Relationships
    company             = relationship("Company", back_populates="call_logs")
    contact             = relationship("Contact", back_populates="call_logs")
    conducted_by_user   = relationship("User",    back_populates="call_logs",
                                       foreign_keys=[conducted_by])


# ─────────────────────────────────────────────────────────────────────────────
# Scraper Config  (user-controlled scraper settings, persisted to DB)
# ─────────────────────────────────────────────────────────────────────────────

class ScraperConfig(TimestampMixin, Base):
    """
    Single-row config table (id=1) for all scraper parameters.
    All scraper code reads from this table at runtime — nothing hardcoded.
    """
    __tablename__ = "scraper_config"

    id = Column(Integer, primary_key=True, index=True)

    # ── Site toggles ─────────────────────────────────────────────────────────
    # JSON dict: {site_key: bool}  e.g. {"bizbuysell": true, "axial": false}
    site_enabled = Column(JSON, default=dict, nullable=False)

    # ── Search filters ────────────────────────────────────────────────────────
    min_revenue         = Column(Float, default=500_000)
    max_revenue         = Column(Float, default=20_000_000)
    min_asking_price    = Column(Float, nullable=True)
    max_asking_price    = Column(Float, nullable=True)
    min_ebitda          = Column(Float, nullable=True)
    max_ebitda          = Column(Float, nullable=True)

    # JSON list of industry strings to include
    industries_include  = Column(JSON, default=list)
    # JSON list of industry strings to exclude
    industries_exclude  = Column(JSON, default=list)

    # JSON list of US state abbreviations, or ["ALL"]
    geo_states          = Column(JSON, default=lambda: ["ALL"])

    # Comma-separated keyword strings
    keywords_include    = Column(Text, nullable=True)
    keywords_exclude    = Column(Text, nullable=True)

    # ── Scraper behavior ──────────────────────────────────────────────────────
    # "6h" | "12h" | "daily" | "weekly" | "manual"
    run_schedule        = Column(String(20), default="daily")
    max_listings_per_site = Column(Integer, default=50)
    request_delay_seconds = Column(Float, default=4.0)
    max_pages_per_site  = Column(Integer, default=10)
    rotate_user_agents  = Column(Boolean, default=True)
    respect_robots_txt  = Column(Boolean, default=False)

    # ── Deduplication ─────────────────────────────────────────────────────────
    # 0.70 – 1.00
    fuzzy_match_threshold = Column(Float, default=0.85)
    auto_link_matches     = Column(Boolean, default=True)
    cross_site_dedup      = Column(Boolean, default=True)

    # ── Notifications ─────────────────────────────────────────────────────────
    notify_new_listings       = Column(Boolean, default=True)
    notify_min_asking_price   = Column(Float, nullable=True)
    notify_min_revenue        = Column(Float, nullable=True)

    # Relationships
    run_logs = relationship("ScraperRunLog", back_populates="config",
                            order_by="ScraperRunLog.started_at.desc()")


class ScraperRunLog(TimestampMixin, Base):
    """
    One row per scraper run (full or single-site).
    Records per-site stats and overall run metadata.
    """
    __tablename__ = "scraper_run_logs"

    id              = Column(Integer, primary_key=True, index=True)
    config_id       = Column(Integer, ForeignKey("scraper_config.id", ondelete="SET NULL"),
                             nullable=True, index=True)

    # "full" | site_key e.g. "bizbuysell"
    run_type        = Column(String(50), nullable=False, default="full")
    # "running" | "completed" | "failed" | "cancelled"
    status          = Column(String(20), nullable=False, default="running")

    started_at      = Column(DateTime(timezone=True), server_default=func.now())
    finished_at     = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Float, nullable=True)

    # Aggregate stats
    sites_run       = Column(Integer, default=0)
    pages_scraped   = Column(Integer, default=0)
    listings_found  = Column(Integer, default=0)
    listings_new    = Column(Integer, default=0)
    listings_dupes  = Column(Integer, default=0)
    errors          = Column(Integer, default=0)

    # Per-site breakdown: {site_key: {pages, found, new, errors, status}}
    per_site_stats  = Column(JSON, default=dict)

    # Celery task ID for cancellation
    celery_task_id  = Column(String(255), nullable=True)

    error_log       = Column(Text, nullable=True)

    # Relationships
    config          = relationship("ScraperConfig", back_populates="run_logs")


# ─────────────────────────────────────────────────────────────────────────────
# Gmail Credentials
# ─────────────────────────────────────────────────────────────────────────────

class GmailCredentials(Base):
    """
    Stores per-user Gmail OAuth2 tokens.
    One row per user — upserted on each OAuth callback.
    """
    __tablename__ = "gmail_credentials"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"),
                             nullable=False, unique=True, index=True)
    email_address   = Column(String(255), nullable=True)   # the Gmail address authorised
    access_token    = Column(Text, nullable=True)
    refresh_token   = Column(Text, nullable=False)
    token_expiry    = Column(DateTime(timezone=True), nullable=True)
    scopes          = Column(JSON, default=list)            # list of granted scopes
    # Incremental sync state
    history_id      = Column(String(64), nullable=True)     # last processed Gmail historyId
    last_sync_at    = Column(DateTime(timezone=True), nullable=True)
    last_sync_status = Column(String(20), nullable=True)    # "ok" | "error" | "running"
    last_sync_error  = Column(Text, nullable=True)
    # Full-sync watermark (ISO date string)
    initial_sync_done = Column(Boolean, default=False)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(),
                             onupdate=func.now())

    user            = relationship("User", backref="gmail_credentials")


class SuggestedCompany(Base):
    """
    Auto-created stub when an inbound broker email cannot be fuzzy-matched
    to an existing Company.  Flagged for manual review / promotion.
    """
    __tablename__ = "suggested_companies"

    id              = Column(Integer, primary_key=True, index=True)
    source_thread_id = Column(Integer, ForeignKey("email_threads.id", ondelete="SET NULL"),
                              nullable=True, index=True)
    # Claude-extracted fields
    name            = Column(String(255), nullable=False)
    industry        = Column(String(255), nullable=True)
    location        = Column(String(255), nullable=True)
    asking_price    = Column(Float, nullable=True)
    revenue         = Column(Float, nullable=True)
    ebitda          = Column(Float, nullable=True)
    owner_name      = Column(String(255), nullable=True)
    owner_email     = Column(String(255), nullable=True)
    broker_name     = Column(String(255), nullable=True)
    broker_email    = Column(String(255), nullable=True)
    description     = Column(Text, nullable=True)
    raw_extract     = Column(JSON, default=dict)   # full Claude JSON response
    # Review state
    status          = Column(String(20), default="pending")  # pending|promoted|dismissed
    reviewed_by     = Column(String(100), nullable=True)
    promoted_company_id = Column(Integer, ForeignKey("companies.id", ondelete="SET NULL"),
                                 nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(),
                             onupdate=func.now())

    source_thread   = relationship("EmailThread", backref="suggested_companies")
    promoted_company = relationship("Company", backref="suggested_from")


class EnrichmentLog(Base):
    """
    One row per enrichment source run per company.
    Tracks what each source found, what it missed, and whether it succeeded.
    """
    __tablename__ = "enrichment_log"

    id              = Column(Integer, primary_key=True, index=True)
    company_id      = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"),
                             nullable=False, index=True)
    # edgar | opencorporates | google_places | web_search | linkedin_snippet | clearbit
    source          = Column(String(50), nullable=False)
    run_at          = Column(DateTime(timezone=True), server_default=func.now())
    success         = Column(Boolean, default=False)
    fields_found    = Column(JSON, default=list)   # list of field names populated
    fields_missing  = Column(JSON, default=list)   # list of fields queried but not found
    raw_response    = Column(JSON, default=dict)   # raw API/parse response for debugging
    error_message   = Column(Text, nullable=True)
    duration_ms     = Column(Integer, nullable=True)   # how long the source call took

    company         = relationship("Company", backref="enrichment_logs")


# ─────────────────────────────────────────────────────────────────────────────
# Deal Scores  (AI-generated per-category scoring)
# ─────────────────────────────────────────────────────────────────────────────
class DealScore(TimestampMixin, Base):
    """
    One row per scoring run per company.
    Stores the full 5-category breakdown plus composite score and deal memo.
    """
    __tablename__ = "deal_scores"

    id                      = Column(Integer, primary_key=True, index=True)
    company_id              = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"),
                                     nullable=False, index=True)
    cim_extract_id          = Column(Integer, ForeignKey("cim_extracts.id", ondelete="SET NULL"),
                                     nullable=True)
    scored_at               = Column(DateTime(timezone=True), server_default=func.now())
    model_used              = Column(String(100), default="claude-sonnet-4-20250514")

    # Composite score (0–100)
    composite_score         = Column(Float, nullable=True)

    # Per-category scores (JSON: {score, max, justification})
    financial_quality       = Column(JSON, default=dict)   # max 30
    business_quality        = Column(JSON, default=dict)   # max 25
    operator_fit            = Column(JSON, default=dict)   # max 20
    deal_structure          = Column(JSON, default=dict)   # max 15
    growth_potential        = Column(JSON, default=dict)   # max 10

    # Full deal memo (markdown)
    deal_memo               = Column(Text, nullable=True)

    # Recommendation: pursue | watch | pass
    recommendation          = Column(String(20), nullable=True)

    # Raw Claude response for debugging
    raw_response            = Column(JSON, default=dict)

    # Relationships
    company                 = relationship("Company", backref="deal_scores")
    cim_extract             = relationship("CIMExtract", backref="deal_scores")


# ─────────────────────────────────────────────────────────────────────────────
# Notifications
# ─────────────────────────────────────────────────────────────────────────────
class Notification(Base):
    """In-app notifications for partner users (Matt and Utsav only)."""
    __tablename__ = "notifications"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"),
                             nullable=False, index=True)
    # new_listing | nda_signed | stage_change | mention | follow_up | new_email
    notif_type      = Column(String(50), nullable=False)
    title           = Column(String(255), nullable=False)
    body            = Column(Text, nullable=True)
    company_id      = Column(Integer, ForeignKey("companies.id", ondelete="SET NULL"),
                             nullable=True)
    is_read         = Column(Boolean, default=False, nullable=False)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    read_at         = Column(DateTime(timezone=True), nullable=True)
    # extra context (e.g. note_id, listing_id)
    metadata_json   = Column(JSON, default=dict)

    user            = relationship("User", backref="notifications")
    company         = relationship("Company", backref="notifications")


# ─────────────────────────────────────────────────────────────────────────────
# Deal Votes (conviction ratings)
# ─────────────────────────────────────────────────────────────────────────────
class DealVote(Base):
    """Conviction vote (1-5 stars) from a partner on a company in NDA/LOI/DD."""
    __tablename__ = "deal_votes"

    id              = Column(Integer, primary_key=True, index=True)
    company_id      = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"),
                             nullable=False, index=True)
    user_id         = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"),
                             nullable=False)
    # pursue | watch | pass
    recommendation  = Column(String(20), nullable=True)
    # 1-5 conviction stars
    conviction      = Column(Integer, nullable=True)
    notes           = Column(Text, nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(),
                             onupdate=func.now())

    company         = relationship("Company", backref="deal_votes")
    user            = relationship("User", backref="deal_votes")

    __table_args__ = (
        UniqueConstraint("company_id", "user_id", name="uq_deal_vote_company_user"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Activity Log
# ─────────────────────────────────────────────────────────────────────────────
class ActivityLog(Base):
    """Audit trail of partner actions — never logs guest activity."""
    __tablename__ = "activity_log"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"),
                             nullable=True)
    # display name snapshot at time of action
    actor_name      = Column(String(100), nullable=False)
    # moved_stage | added_note | uploaded_doc | sent_email | scored | enriched | etc.
    action_type     = Column(String(80), nullable=False)
    description     = Column(Text, nullable=False)
    company_id      = Column(Integer, ForeignKey("companies.id", ondelete="SET NULL"),
                             nullable=True)
    entity_type     = Column(String(50), nullable=True)   # company | note | document | etc.
    entity_id       = Column(Integer, nullable=True)
    metadata_json   = Column(JSON, default=dict)
    created_at      = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    user            = relationship("User", backref="activity_logs")
    company         = relationship("Company", backref="activity_logs")


# ─────────────────────────────────────────────────────────────────────────────
# Inbound Email  (forwarded broker deal emails via webhook)
# ─────────────────────────────────────────────────────────────────────────────
class InboundEmail(TimestampMixin, Base):
    """
    Stores a broker deal email forwarded to the CRM ingest webhook.
    Each record holds the raw email text, AI-extracted fields, and
    a reference to the BrokerListing that was created from it.
    """
    __tablename__ = "inbound_emails"

    id                  = Column(Integer, primary_key=True, index=True)

    # ── Email metadata ────────────────────────────────────────────
    from_address        = Column(String(500), nullable=True, index=True)
    subject             = Column(String(1000), nullable=True)
    received_at         = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    raw_body            = Column(Text, nullable=True)
    html_body           = Column(Text, nullable=True)
    attachment_text     = Column(Text, nullable=True)
    attachment_names    = Column(JSON, default=list)

    # ── AI extraction status ──────────────────────────────────────
    # pending | processing | done | failed
    parse_status        = Column(String(20), default="pending", nullable=False, index=True)
    parse_error         = Column(Text, nullable=True)

    # ── Extracted fields ──────────────────────────────────────────
    extracted_name      = Column(String(500), nullable=True)
    extracted_ebitda    = Column(Float, nullable=True)
    extracted_revenue   = Column(Float, nullable=True)
    extracted_asking    = Column(Float, nullable=True)
    extracted_cash_flow = Column(Float, nullable=True)
    extracted_location  = Column(String(300), nullable=True)
    extracted_city      = Column(String(200), nullable=True)
    extracted_state     = Column(String(50), nullable=True)
    extracted_industry  = Column(String(200), nullable=True)
    extracted_broker_name  = Column(String(200), nullable=True)
    extracted_broker_email = Column(String(255), nullable=True)
    extracted_broker_phone = Column(String(50), nullable=True)
    extracted_description  = Column(Text, nullable=True)
    extracted_data      = Column(JSON, default=dict)

    # ── Outcome ───────────────────────────────────────────────────
    broker_listing_id   = Column(
        Integer,
        ForeignKey("broker_listings.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_reviewed         = Column(Boolean, default=False, nullable=False)

    # ── Relationships ─────────────────────────────────────────────
    broker_listing      = relationship("BrokerListing", foreign_keys=[broker_listing_id])

    __table_args__ = (
        Index("ix_inbound_emails_parse_status", "parse_status"),
        Index("ix_inbound_emails_is_reviewed",  "is_reviewed"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Investment Thesis Configuration
# ─────────────────────────────────────────────────────────────────────────────

class ThesisConfig(Base):
    """
    Single-row table storing the user's investment thesis parameters.
    Used to auto-score every incoming lead against the thesis.
    """
    __tablename__ = "thesis_config"

    id                      = Column(Integer, primary_key=True, index=True)

    # ── EBITDA range ──────────────────────────────────────────────────────────
    ebitda_min              = Column(Float, default=1_000_000)   # $1M
    ebitda_max              = Column(Float, default=3_000_000)   # $3M

    # ── Revenue range ─────────────────────────────────────────────────────────
    revenue_min             = Column(Float, default=3_000_000)
    revenue_max             = Column(Float, default=15_000_000)

    # ── Margin floors ─────────────────────────────────────────────────────────
    ebitda_margin_min       = Column(Float, default=0.15)        # 15%
    gross_margin_min        = Column(Float, default=0.40)        # 40%

    # ── Deal structure ────────────────────────────────────────────────────────
    max_ev_ebitda_multiple  = Column(Float, default=6.0)         # 6x ceiling
    min_ev_ebitda_multiple  = Column(Float, default=2.5)

    # ── Business profile ──────────────────────────────────────────────────────
    # JSON list of preferred industries e.g. ["Pet Health", "HVAC", "Landscaping"]
    target_industries       = Column(JSON, default=list)
    # JSON list of excluded industries
    excluded_industries     = Column(JSON, default=list)
    # Preferred geographies (US states, e.g. ["TX", "FL", "OH"])
    target_states           = Column(JSON, default=list)
    # Minimum years in business
    min_years_in_business   = Column(Integer, default=5)
    # Maximum employee count
    max_employees           = Column(Integer, default=200)

    # ── Stall thresholds (days) ───────────────────────────────────────────────
    stall_lead_days         = Column(Integer, default=7)
    stall_prospect_days     = Column(Integer, default=14)
    stall_contacted_days    = Column(Integer, default=21)
    stall_nda_days          = Column(Integer, default=30)
    stall_cim_days          = Column(Integer, default=21)
    stall_model_days        = Column(Integer, default=14)
    stall_ioi_days          = Column(Integer, default=14)
    stall_loi_days          = Column(Integer, default=30)
    stall_dd_days           = Column(Integer, default=60)

    # ── Metadata ──────────────────────────────────────────────────────────────
    updated_at              = Column(DateTime(timezone=True), server_default=func.now(),
                                     onupdate=func.now())
    updated_by              = Column(String(100), nullable=True)


# ─────────────────────────────────────────────────────────────────────────────
# Bulk Import Jobs
# ─────────────────────────────────────────────────────────────────────────────

class ImportJob(TimestampMixin, Base):
    """
    Tracks a bulk CSV import job.
    Each row in the CSV becomes a Company record; enrichment is queued automatically.
    """
    __tablename__ = "import_jobs"

    id                  = Column(Integer, primary_key=True, index=True)
    filename            = Column(String(500), nullable=True)
    # pending | processing | done | failed
    status              = Column(String(20), default="pending", nullable=False, index=True)
    total_rows          = Column(Integer, default=0)
    imported_rows       = Column(Integer, default=0)
    skipped_rows        = Column(Integer, default=0)
    failed_rows         = Column(Integer, default=0)
    error_log           = Column(JSON, default=list)   # list of {row, error} dicts
    # Source channel for imported companies
    source_channel      = Column(String(100), default="csv_import")
    # Default deal_stage for imported companies
    default_stage       = Column(String(50), default="lead")
    # Whether to auto-enrich imported companies
    auto_enrich         = Column(Boolean, default=True)
    # Whether to auto-score against thesis
    auto_score          = Column(Boolean, default=True)
    imported_by         = Column(String(100), nullable=True)
    completed_at        = Column(DateTime(timezone=True), nullable=True)
    # JSON list of created company IDs
    company_ids         = Column(JSON, default=list)
