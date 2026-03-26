"""
GmailClient
===========
Handles:
  - Google OAuth2 authorization URL generation
  - Token exchange and refresh
  - Full sync (last 90 days) on first run
  - Incremental sync via historyId on subsequent runs
  - Thread fetching, decoding, and storage in email_threads table
"""
from __future__ import annotations

import base64
import email as email_lib
import html
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.config import settings
from app.models.models import EmailThread, GmailCredentials, User, Company
from app.gmail.classifier import classify_email, fuzzy_match_company

logger = logging.getLogger(__name__)

# ─── OAuth Scopes ─────────────────────────────────────────────────────────────

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
]


# ─── OAuth Flow Helpers ───────────────────────────────────────────────────────

def get_oauth_flow() -> Flow:
    """Create a Google OAuth2 Flow object from app settings."""
    client_config = {
        "web": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }
    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri=settings.GOOGLE_REDIRECT_URI,
    )
    return flow


def get_authorization_url(state: str) -> str:
    """Return the Google OAuth2 authorization URL."""
    flow = get_oauth_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state,
    )
    return auth_url


def exchange_code_for_tokens(code: str) -> dict:
    """Exchange an authorization code for access + refresh tokens."""
    flow = get_oauth_flow()
    flow.fetch_token(code=code)
    creds = flow.credentials
    return {
        "access_token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_expiry": creds.expiry,
        "scopes": list(creds.scopes or SCOPES),
    }


# ─── GmailClient ─────────────────────────────────────────────────────────────

class GmailClient:
    """
    Wraps the Gmail API for a single authenticated user.
    All sync operations are synchronous (called from Celery tasks).
    """

    def __init__(self, gmail_creds: GmailCredentials):
        self._creds_row = gmail_creds
        self._service = None
        self._google_creds = self._build_google_creds()

    def _build_google_creds(self) -> Credentials:
        row = self._creds_row
        return Credentials(
            token=row.access_token,
            refresh_token=row.refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            scopes=row.scopes or SCOPES,
        )

    def _get_service(self):
        if self._service is None:
            creds = self._google_creds
            if creds.expired and creds.refresh_token:
                creds.refresh(Request())
                # Caller must persist updated tokens
            self._service = build("gmail", "v1", credentials=creds, cache_discovery=False)
        return self._service

    def get_refreshed_tokens(self) -> dict:
        """Return current token state (after any refresh)."""
        creds = self._google_creds
        return {
            "access_token": creds.token,
            "token_expiry": creds.expiry,
        }

    # ── Thread Listing ────────────────────────────────────────────────────────

    def list_thread_ids(
        self,
        after_date: Optional[datetime] = None,
        max_results: int = 500,
    ) -> list[str]:
        """
        Return a list of thread IDs matching the query.
        If after_date is given, only threads after that date.
        """
        service = self._get_service()
        query_parts = []
        if after_date:
            ts = int(after_date.timestamp())
            query_parts.append(f"after:{ts}")

        query = " ".join(query_parts) if query_parts else ""
        thread_ids = []
        page_token = None

        while True:
            kwargs: dict = {
                "userId": "me",
                "maxResults": min(max_results - len(thread_ids), 500),
            }
            if query:
                kwargs["q"] = query
            if page_token:
                kwargs["pageToken"] = page_token

            try:
                resp = service.users().threads().list(**kwargs).execute()
            except HttpError as e:
                logger.error(f"Gmail list threads error: {e}")
                break

            threads = resp.get("threads", [])
            thread_ids.extend(t["id"] for t in threads)

            page_token = resp.get("nextPageToken")
            if not page_token or len(thread_ids) >= max_results:
                break

        return thread_ids

    def get_thread(self, thread_id: str) -> Optional[dict]:
        """Fetch a full thread by ID."""
        service = self._get_service()
        try:
            return service.users().threads().get(
                userId="me",
                id=thread_id,
                format="full",
            ).execute()
        except HttpError as e:
            logger.error(f"Gmail get thread {thread_id} error: {e}")
            return None

    # ── History-based Incremental Sync ────────────────────────────────────────

    def get_history_since(self, start_history_id: str) -> tuple[list[str], str]:
        """
        Use Gmail History API to get thread IDs modified since start_history_id.
        Returns (list_of_thread_ids, new_history_id).
        """
        service = self._get_service()
        thread_ids: set[str] = set()
        page_token = None
        latest_history_id = start_history_id

        while True:
            kwargs: dict = {
                "userId": "me",
                "startHistoryId": start_history_id,
                "historyTypes": ["messageAdded"],
            }
            if page_token:
                kwargs["pageToken"] = page_token

            try:
                resp = service.users().history().list(**kwargs).execute()
            except HttpError as e:
                if e.resp.status == 404:
                    # historyId expired — need full resync
                    logger.warning("historyId expired, falling back to full sync")
                    return [], ""
                logger.error(f"Gmail history error: {e}")
                break

            history = resp.get("history", [])
            for record in history:
                for msg in record.get("messagesAdded", []):
                    thread_ids.add(msg["message"]["threadId"])

            latest_history_id = resp.get("historyId", latest_history_id)
            page_token = resp.get("nextPageToken")
            if not page_token:
                break

        return list(thread_ids), latest_history_id

    def get_profile(self) -> dict:
        """Get the authenticated user's Gmail profile (includes historyId)."""
        service = self._get_service()
        try:
            return service.users().getProfile(userId="me").execute()
        except HttpError as e:
            logger.error(f"Gmail getProfile error: {e}")
            return {}

    # ── Message Parsing ───────────────────────────────────────────────────────

    @staticmethod
    def parse_thread(thread_data: dict) -> dict:
        """
        Extract structured data from a raw Gmail thread object.
        Returns a dict ready to upsert into email_threads.
        """
        messages = thread_data.get("messages", [])
        if not messages:
            return {}

        first_msg = messages[0]
        last_msg = messages[-1]
        headers = {h["name"].lower(): h["value"] for h in first_msg.get("payload", {}).get("headers", [])}

        subject = headers.get("subject", "(no subject)")
        sender_raw = headers.get("from", "")
        sender_name, sender_email = _parse_sender(sender_raw)

        # Get snippet from most recent message
        snippet = last_msg.get("snippet", "")[:500]

        # Decode full body
        full_body = _extract_body(first_msg.get("payload", {}))

        # Parse received timestamp
        date_str = headers.get("date", "")
        received_at = _parse_date(date_str)

        # Gmail internal date (ms since epoch) as fallback
        if not received_at and first_msg.get("internalDate"):
            ts = int(first_msg["internalDate"]) / 1000
            received_at = datetime.fromtimestamp(ts, tz=timezone.utc)

        return {
            "gmail_thread_id": thread_data["id"],
            "subject": subject,
            "sender_email": sender_email,
            "sender_name": sender_name,
            "snippet": snippet,
            "full_body": full_body,
            "received_at": received_at,
            "message_count": len(messages),
            "raw_messages": [m.get("id") for m in messages],
        }


# ─── Sync Orchestrator ────────────────────────────────────────────────────────

async def sync_gmail_for_user(
    db: AsyncSession,
    user_id: int,
    force_full: bool = False,
) -> dict:
    """
    Main sync entry point.
    - First run (initial_sync_done=False): pull last 90 days
    - Subsequent runs: use historyId for incremental sync
    - Classifies each thread as broker/non-broker
    - Fuzzy-matches to existing companies
    - Creates SuggestedCompany stubs for unmatched broker emails

    Returns summary stats dict.
    """
    from app.models.models import SuggestedCompany

    # Load credentials
    result = await db.execute(
        select(GmailCredentials).where(GmailCredentials.user_id == user_id)
    )
    creds_row = result.scalar_one_or_none()
    if not creds_row:
        return {"error": "No Gmail credentials found for user"}

    client = GmailClient(creds_row)

    # Update sync status
    creds_row.last_sync_status = "running"
    await db.commit()

    stats = {
        "threads_fetched": 0,
        "threads_new": 0,
        "threads_updated": 0,
        "broker_flagged": 0,
        "companies_matched": 0,
        "suggested_created": 0,
        "errors": 0,
    }

    try:
        # Load all company names for fuzzy matching
        company_result = await db.execute(
            select(Company.id, Company.name).where(Company.name.isnot(None))
        )
        company_names: list[tuple[int, str]] = [(r.id, r.name) for r in company_result.all()]

        # Determine sync mode
        if not creds_row.initial_sync_done or force_full:
            # Full sync: last 90 days
            after_date = datetime.now(tz=timezone.utc) - timedelta(days=90)
            thread_ids = client.list_thread_ids(after_date=after_date, max_results=2000)
            logger.info(f"Full sync: found {len(thread_ids)} threads")
        else:
            # Incremental sync via historyId
            if not creds_row.history_id:
                # Fallback to full sync if no historyId
                after_date = datetime.now(tz=timezone.utc) - timedelta(days=7)
                thread_ids = client.list_thread_ids(after_date=after_date, max_results=500)
            else:
                thread_ids, new_history_id = client.get_history_since(creds_row.history_id)
                if not thread_ids and not new_history_id:
                    # historyId expired — do a 7-day fallback
                    after_date = datetime.now(tz=timezone.utc) - timedelta(days=7)
                    thread_ids = client.list_thread_ids(after_date=after_date, max_results=500)
                else:
                    creds_row.history_id = new_history_id

        # Process each thread
        for thread_id in thread_ids:
            try:
                await _process_thread(
                    db=db,
                    client=client,
                    thread_id=thread_id,
                    company_names=company_names,
                    stats=stats,
                )
            except Exception as e:
                logger.error(f"Error processing thread {thread_id}: {e}")
                stats["errors"] += 1

        # Update historyId from profile after full sync
        if not creds_row.initial_sync_done or force_full:
            profile = client.get_profile()
            if profile.get("historyId"):
                creds_row.history_id = profile["historyId"]
            creds_row.initial_sync_done = True

        # Persist refreshed tokens
        refreshed = client.get_refreshed_tokens()
        creds_row.access_token = refreshed["access_token"]
        creds_row.token_expiry = refreshed["token_expiry"]
        creds_row.last_sync_at = datetime.now(tz=timezone.utc)
        creds_row.last_sync_status = "ok"
        creds_row.last_sync_error = None

    except Exception as e:
        logger.error(f"Gmail sync failed for user {user_id}: {e}")
        creds_row.last_sync_status = "error"
        creds_row.last_sync_error = str(e)
        stats["error"] = str(e)

    await db.commit()
    return stats


async def _process_thread(
    db: AsyncSession,
    client: GmailClient,
    thread_id: str,
    company_names: list[tuple[int, str]],
    stats: dict,
) -> None:
    """Fetch, parse, classify, and upsert a single thread."""
    from app.models.models import SuggestedCompany

    # Check if already stored
    existing = await db.execute(
        select(EmailThread).where(EmailThread.gmail_thread_id == thread_id)
    )
    thread_row = existing.scalar_one_or_none()

    # Fetch from Gmail API
    thread_data = client.get_thread(thread_id)
    if not thread_data:
        return

    parsed = GmailClient.parse_thread(thread_data)
    if not parsed:
        return

    stats["threads_fetched"] += 1

    # Classify
    classification = classify_email(
        sender_email=parsed.get("sender_email", ""),
        sender_name=parsed.get("sender_name", ""),
        subject=parsed.get("subject", ""),
        body=parsed.get("full_body", ""),
    )

    # Fuzzy match to company
    matched_company_id = None
    if classification["is_broker"]:
        stats["broker_flagged"] += 1
        # Try matching subject-extracted name or sender name
        from app.gmail.classifier import extract_business_name_from_subject
        biz_name = extract_business_name_from_subject(parsed.get("subject", ""))
        if biz_name:
            matched_company_id = fuzzy_match_company(biz_name, company_names, threshold=0.80)

    if matched_company_id:
        stats["companies_matched"] += 1

    if thread_row:
        # Update existing
        thread_row.snippet = parsed.get("snippet", thread_row.snippet)
        thread_row.full_body = parsed.get("full_body", thread_row.full_body)
        thread_row.message_count = parsed.get("message_count", thread_row.message_count)
        thread_row.is_broker = classification["is_broker"]
        if matched_company_id and not thread_row.matched_company_id:
            thread_row.matched_company_id = matched_company_id
        stats["threads_updated"] += 1
    else:
        # Insert new
        thread_row = EmailThread(
            gmail_thread_id=thread_id,
            subject=parsed.get("subject"),
            sender_email=parsed.get("sender_email"),
            snippet=parsed.get("snippet"),
            full_body=parsed.get("full_body"),
            received_at=parsed.get("received_at"),
            is_broker=classification["is_broker"],
            matched_company_id=matched_company_id,
            is_processed=False,
            is_unread=True,
            message_count=parsed.get("message_count", 1),
            raw_messages=parsed.get("raw_messages", []),
        )
        db.add(thread_row)
        await db.flush()  # get thread_row.id
        stats["threads_new"] += 1

        # Create SuggestedCompany for unmatched broker emails
        if classification["is_broker"] and not matched_company_id:
            from app.gmail.classifier import extract_business_name_from_subject
            biz_name = extract_business_name_from_subject(parsed.get("subject", ""))
            if biz_name:
                suggested = SuggestedCompany(
                    source_thread_id=thread_row.id,
                    name=biz_name,
                    broker_email=parsed.get("sender_email"),
                    broker_name=parsed.get("sender_name"),
                    status="pending",
                )
                db.add(suggested)
                stats["suggested_created"] += 1


# ─── Parsing Helpers ──────────────────────────────────────────────────────────

def _parse_sender(from_header: str) -> tuple[str, str]:
    """Parse 'Name <email@domain.com>' into (name, email)."""
    if not from_header:
        return "", ""
    match = re.match(r'^"?([^"<]*)"?\s*<([^>]+)>', from_header.strip())
    if match:
        return match.group(1).strip(), match.group(2).strip().lower()
    # Plain email address
    if "@" in from_header:
        return "", from_header.strip().lower()
    return from_header.strip(), ""


def _extract_body(payload: dict, depth: int = 0) -> str:
    """Recursively extract plain text body from a Gmail message payload."""
    if depth > 10:
        return ""

    mime_type = payload.get("mimeType", "")
    body_data = payload.get("body", {}).get("data", "")

    if mime_type == "text/plain" and body_data:
        return _decode_base64(body_data)

    if mime_type == "text/html" and body_data:
        raw_html = _decode_base64(body_data)
        return _html_to_text(raw_html)

    # Recurse into parts
    parts = payload.get("parts", [])
    for part in parts:
        text = _extract_body(part, depth + 1)
        if text:
            return text

    return ""


def _decode_base64(data: str) -> str:
    """Decode Gmail's URL-safe base64 encoding."""
    try:
        padded = data + "=" * (4 - len(data) % 4)
        decoded = base64.urlsafe_b64decode(padded)
        return decoded.decode("utf-8", errors="replace")
    except Exception:
        return ""


def _html_to_text(html_content: str) -> str:
    """Very lightweight HTML → plain text conversion."""
    # Remove script/style blocks
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", html_content, flags=re.DOTALL | re.IGNORECASE)
    # Replace block-level tags with newlines
    text = re.sub(r"<(br|p|div|tr|li)[^>]*>", "\n", text, flags=re.IGNORECASE)
    # Remove all remaining tags
    text = re.sub(r"<[^>]+>", "", text)
    # Decode HTML entities
    text = html.unescape(text)
    # Collapse whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def _parse_date(date_str: str) -> Optional[datetime]:
    """Parse an RFC 2822 email date string."""
    if not date_str:
        return None
    try:
        from email.utils import parsedate_to_datetime
        return parsedate_to_datetime(date_str)
    except Exception:
        return None
