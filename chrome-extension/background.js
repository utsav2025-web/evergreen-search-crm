/**
 * background.js — Evergreen Search Chrome Extension Service Worker
 * Handles:
 * - API calls to the CRM backend (avoids CORS issues from popup)
 * - Badge management (green = logged in, gray = not, yellow ! = already in CRM)
 * - Tab change detection for badge updates
 */

"use strict";

// ── Constants ─────────────────────────────────────────────────────────────────

const BADGE_COLORS = {
  loggedIn: "#22c55e",    // green
  loggedOut: "#9ca3af",   // gray
  exists: "#f59e0b",      // yellow/amber
};

// ── Storage helpers ───────────────────────────────────────────────────────────

async function getStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

async function setStorage(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, resolve);
  });
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

async function updateBadge(tabId, status) {
  // status: "loggedOut" | "loggedIn" | "exists"
  const configs = {
    loggedOut: { text: "", color: BADGE_COLORS.loggedOut, title: "Not logged in to Evergreen Search" },
    loggedIn:  { text: "", color: BADGE_COLORS.loggedIn,  title: "Evergreen Search — Ready" },
    exists:    { text: "!", color: BADGE_COLORS.exists,   title: "This company is already in your CRM pipeline!" },
  };
  const cfg = configs[status] || configs.loggedOut;

  try {
    await chrome.action.setBadgeText({ text: cfg.text, tabId });
    await chrome.action.setBadgeBackgroundColor({ color: cfg.color, tabId });
    await chrome.action.setTitle({ title: cfg.title, tabId });
  } catch (e) {
    // Tab may have been closed
  }
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiRequest(method, path, body = null) {
  const { crmBaseUrl, authToken } = await getStorage(["crmBaseUrl", "authToken"]);
  if (!crmBaseUrl || !authToken) {
    return { ok: false, status: 401, data: { error: "not_authenticated" } };
  }

  const url = `${crmBaseUrl.replace(/\/$/, "")}${path}`;
  const headers = {
    "Content-Type": "application/json",
    "Cookie": `sf_session=${authToken}`,
  };

  try {
    const response = await fetch(url, {
      method,
      headers,
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    });

    let data;
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    return { ok: response.ok, status: response.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { error: "network_error", message: err.message } };
  }
}

// ── Domain check for badge ────────────────────────────────────────────────────

async function checkDomainForBadge(tabId, url) {
  if (!url || url.startsWith("chrome://") || url.startsWith("chrome-extension://") ||
      url.startsWith("about:") || url.startsWith("edge://")) {
    return;
  }

  const { authToken } = await getStorage(["authToken"]);
  if (!authToken) {
    await updateBadge(tabId, "loggedOut");
    return;
  }

  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    const result = await apiRequest("GET", `/api/companies/check-domain?domain=${encodeURIComponent(domain)}`);

    if (result.status === 401) {
      await updateBadge(tabId, "loggedOut");
      // Clear stale token
      await setStorage({ authToken: null });
    } else if (result.ok && result.data.exists) {
      await updateBadge(tabId, "exists");
    } else {
      await updateBadge(tabId, "loggedIn");
    }
  } catch {
    await updateBadge(tabId, "loggedIn");
  }
}

// ── Tab event listeners ───────────────────────────────────────────────────────

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    checkDomainForBadge(tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url) {
    checkDomainForBadge(activeInfo.tabId, tab.url);
  }
});

// ── Message handler from popup ────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch((err) => {
    sendResponse({ ok: false, error: err.message });
  });
  return true; // Keep channel open for async
});

async function handleMessage(message, sender) {
  switch (message.type) {

    // ── Auth: login ───────────────────────────────────────────────────────────
    case "LOGIN": {
      const { username, password } = message;
      const { crmBaseUrl } = await getStorage(["crmBaseUrl"]);
      if (!crmBaseUrl) return { ok: false, error: "No CRM URL configured. Open options." };

      const url = `${crmBaseUrl.replace(/\/$/, "")}/api/auth/login`;
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username, password }),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          return { ok: false, error: err.detail || "Invalid credentials" };
        }
        const data = await resp.json();
        // Extract token from response or from Set-Cookie header
        const token = data.access_token || data.token || null;
        if (token) {
          await setStorage({ authToken: token, currentUser: data.user || null });
        }
        return { ok: true, user: data.user || data };
      } catch (err) {
        return { ok: false, error: `Cannot reach CRM: ${err.message}` };
      }
    }

    // ── Auth: logout ──────────────────────────────────────────────────────────
    case "LOGOUT": {
      await apiRequest("POST", "/api/auth/logout");
      await setStorage({ authToken: null, currentUser: null });
      return { ok: true };
    }

    // ── Auth: check current user ──────────────────────────────────────────────
    case "GET_CURRENT_USER": {
      const result = await apiRequest("GET", "/api/auth/me");
      if (result.ok) {
        await setStorage({ currentUser: result.data });
        return { ok: true, user: result.data };
      }
      if (result.status === 401) {
        await setStorage({ authToken: null, currentUser: null });
      }
      return { ok: false, status: result.status };
    }

    // ── Domain check ─────────────────────────────────────────────────────────
    case "CHECK_DOMAIN": {
      const result = await apiRequest("GET", `/api/companies/check-domain?domain=${encodeURIComponent(message.domain)}`);
      return result;
    }

    // ── Claude enrichment ─────────────────────────────────────────────────────
    case "ENRICH_WITH_CLAUDE": {
      const { extractedData, claudeApiKey } = message;
      if (!claudeApiKey) return { ok: false, error: "No Claude API key configured" };

      const prompt = buildClaudePrompt(extractedData);

      try {
        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": claudeApiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1024,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          return { ok: false, error: err.error?.message || "Claude API error" };
        }

        const data = await resp.json();
        const text = data.content?.[0]?.text || "";

        // Extract JSON from response
        const jsonMatch = text.match(/```json\s*([\s\S]+?)\s*```/) ||
                          text.match(/\{[\s\S]+\}/);
        if (jsonMatch) {
          try {
            const enriched = JSON.parse(jsonMatch[1] || jsonMatch[0]);
            return { ok: true, data: enriched };
          } catch {
            return { ok: false, error: "Failed to parse Claude response" };
          }
        }
        return { ok: false, error: "No JSON in Claude response" };
      } catch (err) {
        return { ok: false, error: `Claude API unreachable: ${err.message}` };
      }
    }

    // ── Create company from extension ─────────────────────────────────────────
    case "CREATE_COMPANY": {
      const result = await apiRequest("POST", "/api/companies/from-extension", message.payload);
      return result;
    }

    // ── Get companies list (for fuzzy match) ──────────────────────────────────
    case "GET_COMPANIES": {
      const result = await apiRequest("GET", "/api/companies/?limit=500&fields=id,name,website");
      return result;
    }

    // ── Update badge for current tab ──────────────────────────────────────────
    case "UPDATE_BADGE": {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        await checkDomainForBadge(tabs[0].id, tabs[0].url);
      }
      return { ok: true };
    }

    default:
      return { ok: false, error: `Unknown message type: ${message.type}` };
  }
}

// ── Claude prompt builder ─────────────────────────────────────────────────────

function buildClaudePrompt(data) {
  return `You are analyzing a company website for a search fund acquisition CRM. 
Extract and clean the following information from the page data provided.

Page URL: ${data.website}
Page Title: ${data.page_title || ""}
OG Site Name: ${data.og_site_name || ""}
OG Title: ${data.og_title || ""}
Meta Description: ${data.description || ""}
Detected Phone: ${data.phone || ""}
Detected Email: ${data.email || ""}
Detected Address: ${data.address || ""}
Detected Industry: ${data.industry || ""}
Detected Founded Year: ${data.founded_year || ""}
Detected Employees: ${data.employees || ""}

Page Text (first 3000 chars):
${data.page_text || ""}

Based on all of the above, return a JSON object with these exact fields:
{
  "name": "Clean company name (not a tagline)",
  "description": "1-2 sentence business description",
  "industry": "Industry category (e.g. HVAC Services, IT Managed Services, Pest Control, Landscaping, Manufacturing, Distribution, etc.)",
  "sub_industry": "More specific sub-category if clear",
  "business_type": "One of: B2B service, B2C service, manufacturing, distribution, SaaS, healthcare, construction, food & beverage, other",
  "owner_name": "Owner or founder name if mentioned, else null",
  "owner_email": "Owner or contact email if found, else null",
  "owner_phone": "Primary phone number if found, else null",
  "city": "City if found, else null",
  "state": "US state abbreviation (2 letters) if found, else null",
  "founded_year": integer year or null,
  "employees": integer headcount or null,
  "linkedin_url": "LinkedIn company URL if found, else null",
  "is_franchise": true if this appears to be a franchise location (not the franchisor), false otherwise,
  "confidence": "high|medium|low — how confident you are in the company name extraction"
}

Return ONLY the JSON object, no explanation.`;
}

// ── Startup: set initial badge ────────────────────────────────────────────────

(async () => {
  const { authToken } = await getStorage(["authToken"]);
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  for (const tab of tabs) {
    if (tab.id && tab.url) {
      await checkDomainForBadge(tab.id, tab.url);
    }
  }
})();
