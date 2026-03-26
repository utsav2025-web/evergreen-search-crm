/**
 * popup.js — Evergreen Search Chrome Extension
 * Manages all popup state: auth, loading, form review, and success.
 */

"use strict";

// ── State ─────────────────────────────────────────────────────────────────────

let currentState = null;
let extractedData = null;
let enrichedData = null;
let currentUser = null;
let crmBaseUrl = null;
let existingCompany = null; // If domain already in CRM
let saveForLater = false;

// ── DOM helpers ───────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);
const show = (id) => { const el = $(id); if (el) el.classList.remove("hidden"); };
const hide = (id) => { const el = $(id); if (el) el.classList.add("hidden"); };

function showState(name) {
  ["state-auth", "state-loading", "state-form", "state-success", "state-error"]
    .forEach((s) => hide(s));
  show(`state-${name}`);
  currentState = name;
}

function setError(elementId, message) {
  const el = $(elementId);
  if (el) {
    el.textContent = message;
    el.classList.remove("hidden");
  }
}

function clearError(elementId) {
  const el = $(elementId);
  if (el) {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

function setButtonLoading(btnId, loading) {
  const btn = $(btnId);
  if (!btn) return;
  const text = btn.querySelector(".btn-text");
  const spinner = btn.querySelector(".btn-spinner");
  btn.disabled = loading;
  if (text) text.textContent = loading ? "Working…" : btn.dataset.originalText || text.textContent;
  if (spinner) spinner.classList.toggle("hidden", !loading);
}

// ── Storage helpers ───────────────────────────────────────────────────────────

function getStorage(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

// ── Message helpers ───────────────────────────────────────────────────────────

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// ── Parse currency string to number ──────────────────────────────────────────

function parseCurrency(str) {
  if (!str) return null;
  const clean = str.replace(/[$,\s]/g, "");
  const m = clean.match(/([\d.]+)\s*([KkMmBb]?)/);
  if (!m) return null;
  let num = parseFloat(m[1]);
  const suffix = m[2].toUpperCase();
  if (suffix === "K") num *= 1000;
  else if (suffix === "M") num *= 1_000_000;
  else if (suffix === "B") num *= 1_000_000_000;
  return isNaN(num) ? null : num;
}

// ── Populate form from extracted/enriched data ────────────────────────────────

function populateForm(data) {
  if (!data) return;

  if (data.name) $("f-name").value = data.name;
  if (data.website) $("f-website").value = data.website;

  // Industry dropdown — try to match
  if (data.industry) {
    const sel = $("f-industry");
    const opts = [...sel.options];
    const match = opts.find(
      (o) => o.value.toLowerCase().includes(data.industry.toLowerCase()) ||
             data.industry.toLowerCase().includes(o.value.toLowerCase())
    );
    if (match) sel.value = match.value;
    else {
      // Add custom option
      const opt = new Option(data.industry, data.industry);
      sel.add(opt);
      sel.value = data.industry;
    }
  }

  if (data.owner_name) $("f-owner").value = data.owner_name;
  if (data.owner_email || data.email) $("f-email").value = data.owner_email || data.email;
  if (data.owner_phone || data.phone) $("f-phone").value = data.owner_phone || data.phone;

  // Location
  if (data.city && data.state) {
    $("f-location").value = `${data.city}, ${data.state}`;
  } else if (data.address) {
    $("f-location").value = data.address;
  }

  // Franchise flag
  if (data.is_franchise) {
    show("franchise-tag");
  }

  // Lead partner based on current user
  if (currentUser) {
    const partnerSel = $("f-partner");
    if (currentUser.username === "utsav") partnerSel.value = "utsav";
    else partnerSel.value = "matt";
  }
}

// ── Extract location string to city/state ─────────────────────────────────────

function parseLocation(locationStr) {
  if (!locationStr) return { city: null, state: null };
  const parts = locationStr.split(",").map((s) => s.trim());
  if (parts.length >= 2) {
    return { city: parts[0], state: parts[1].substring(0, 50) };
  }
  return { city: locationStr, state: null };
}

// ── Build payload for API ─────────────────────────────────────────────────────

function buildPayload(saveForLaterFlag = false) {
  const name = $("f-name").value.trim();
  if (!name) throw new Error("Company name is required");

  const locationStr = $("f-location").value.trim();
  const { city, state } = parseLocation(locationStr);

  return {
    name,
    website: $("f-website").value.trim() || null,
    industry: $("f-industry").value || null,
    owner_name: $("f-owner").value.trim() || null,
    owner_email: $("f-email").value.trim() || null,
    owner_phone: $("f-phone").value.trim() || null,
    city,
    state,
    annual_revenue: parseCurrency($("f-revenue").value),
    asking_price: parseCurrency($("f-asking").value),
    lead_partner: $("f-partner").value || "matt",
    notes: $("f-notes").value.trim() || null,
    save_for_later: saveForLaterFlag,
    is_franchise: enrichedData?.is_franchise || false,
    business_type: enrichedData?.business_type || null,
    linkedin_url: enrichedData?.linkedin_url || extractedData?.linkedin_url || null,
  };
}

// ── Main flow ─────────────────────────────────────────────────────────────────

async function init() {
  // Load stored settings
  const stored = await getStorage(["crmBaseUrl", "authToken", "currentUser", "claudeApiKey"]);
  crmBaseUrl = stored.crmBaseUrl || "http://localhost:8000";

  // Check auth
  if (!stored.authToken) {
    showState("auth");
    return;
  }

  // Verify token is still valid
  try {
    const result = await sendMessage({ type: "GET_CURRENT_USER" });
    if (!result.ok) {
      showState("auth");
      return;
    }
    currentUser = result.user;
    updateUserBadge();
  } catch {
    showState("auth");
    return;
  }

  // Start extraction
  await startExtraction();
}

function updateUserBadge() {
  if (!currentUser) return;
  const badge = $("user-badge");
  if (badge) {
    badge.textContent = currentUser.display_name || currentUser.username || "User";
    badge.classList.remove("hidden");
  }
}

async function startExtraction() {
  // Get active tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab) {
    showError("Cannot access current tab", "Please try again.");
    return;
  }

  const domain = getDomain(tab.url);
  showState("loading");
  $("loading-domain").textContent = domain || "page";

  // Check if domain already in CRM
  try {
    const checkResult = await sendMessage({ type: "CHECK_DOMAIN", domain });
    if (checkResult.ok && checkResult.data?.exists) {
      existingCompany = checkResult.data;
    }
  } catch {}

  // Extract page data via content script
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PAGE_DATA" });
    if (response && response.success) {
      extractedData = response.data;
    } else {
      // Content script may not be injected yet — try scripting API
      extractedData = await extractViaScripting(tab.id, tab.url);
    }
  } catch (err) {
    // Content script not available (e.g. chrome:// pages)
    extractedData = {
      name: getDomain(tab.url),
      website: getOrigin(tab.url),
      domain,
      page_text: "",
    };
  }

  // Enrich with Claude if API key available
  const stored = await getStorage(["claudeApiKey"]);
  if (stored.claudeApiKey && extractedData?.page_text) {
    try {
      const enrichResult = await sendMessage({
        type: "ENRICH_WITH_CLAUDE",
        extractedData,
        claudeApiKey: stored.claudeApiKey,
      });
      if (enrichResult.ok && enrichResult.data) {
        enrichedData = enrichResult.data;
        // Merge enriched data over extracted
        extractedData = { ...extractedData, ...enrichedData };
      }
    } catch {}
  }

  // Show form
  showState("form");
  populateForm(extractedData);

  // Show existing company banner if found
  if (existingCompany) {
    $("exists-view-link").textContent = existingCompany.company_name;
    $("exists-view-link").href = `${crmBaseUrl}${existingCompany.crm_url}`;
    show("exists-banner");
  }
}

async function extractViaScripting(tabId, url) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const getMeta = (name) => {
          const el = document.querySelector(`meta[property="${name}"]`) ||
                     document.querySelector(`meta[name="${name}"]`);
          return el ? el.getAttribute("content")?.trim() : null;
        };
        return {
          name: getMeta("og:site_name") || document.title?.split(/[\|\-–]/)[0]?.trim() || "",
          website: window.location.origin,
          domain: window.location.hostname.replace(/^www\./, ""),
          description: getMeta("og:description") || getMeta("description") || null,
          page_text: (document.body?.innerText || "").substring(0, 3000),
          page_title: document.title,
        };
      },
    });
    return results?.[0]?.result || null;
  } catch {
    return null;
  }
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function getOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function showError(title, message, showOpenCrm = false) {
  showState("error");
  $("error-title").textContent = title;
  $("error-message").textContent = message;
  if (showOpenCrm) {
    $("btn-open-crm").href = crmBaseUrl;
    show("btn-open-crm");
  } else {
    hide("btn-open-crm");
  }
}

// ── Submit form ───────────────────────────────────────────────────────────────

async function submitForm(saveForLaterFlag = false) {
  clearError("form-error");

  let payload;
  try {
    payload = buildPayload(saveForLaterFlag);
  } catch (err) {
    setError("form-error", err.message);
    return;
  }

  const btnId = saveForLaterFlag ? "btn-save-later" : "btn-add";
  setButtonLoading(btnId, true);

  try {
    const result = await sendMessage({ type: "CREATE_COMPANY", payload });

    if (result.ok && result.data) {
      // Success
      const data = result.data;
      $("success-company-name").textContent = data.company_name;
      $("btn-view-crm").href = `${crmBaseUrl}${data.crm_url}`;
      showState("success");

      // Update badge
      sendMessage({ type: "UPDATE_BADGE" });
    } else if (result.status === 409) {
      // Duplicate
      const detail = result.data?.detail || {};
      const msg = detail.message || "This company already exists in the CRM.";
      setError("form-error", msg);
      if (detail.crm_url) {
        $("duplicate-text").textContent = msg;
        $("duplicate-view-link").href = `${crmBaseUrl}${detail.crm_url}`;
        show("duplicate-banner");
      }
    } else if (result.status === 401) {
      showState("auth");
    } else {
      const errMsg = result.data?.detail || result.data?.error || "Failed to add company. Please try again.";
      setError("form-error", typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg));
    }
  } catch (err) {
    setError("form-error", `Error: ${err.message}`);
  } finally {
    setButtonLoading(btnId, false);
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {

  // ── Login form ──────────────────────────────────────────────────────────────
  $("btn-login")?.addEventListener("click", async () => {
    clearError("auth-error");
    const username = $("auth-username").value.trim();
    const password = $("auth-password").value;

    if (!username || !password) {
      setError("auth-error", "Please enter your username and password.");
      return;
    }

    setButtonLoading("btn-login", true);
    try {
      const result = await sendMessage({ type: "LOGIN", username, password });
      if (result.ok) {
        currentUser = result.user;
        updateUserBadge();
        await startExtraction();
      } else {
        setError("auth-error", result.error || "Login failed. Check your credentials.");
      }
    } catch (err) {
      setError("auth-error", `Cannot reach CRM: ${err.message}`);
    } finally {
      setButtonLoading("btn-login", false);
    }
  });

  // Allow Enter key in password field
  $("auth-password")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("btn-login")?.click();
  });

  // ── Open options ────────────────────────────────────────────────────────────
  $("link-open-options")?.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  $("btn-settings")?.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // ── Add to Pipeline ─────────────────────────────────────────────────────────
  $("company-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    submitForm(false);
  });

  $("btn-add")?.addEventListener("click", (e) => {
    e.preventDefault();
    submitForm(false);
  });

  // ── Save for Later ──────────────────────────────────────────────────────────
  $("btn-save-later")?.addEventListener("click", () => {
    submitForm(true);
  });

  // ── Add Anyway (ignore duplicate) ──────────────────────────────────────────
  $("btn-add-anyway")?.addEventListener("click", () => {
    hide("exists-banner");
    existingCompany = null;
  });

  // ── Retry ───────────────────────────────────────────────────────────────────
  $("btn-retry")?.addEventListener("click", () => {
    init();
  });

  // ── Add Another ─────────────────────────────────────────────────────────────
  $("btn-add-another")?.addEventListener("click", () => {
    extractedData = null;
    enrichedData = null;
    existingCompany = null;
    init();
  });

  // ── Store button original text ──────────────────────────────────────────────
  ["btn-login", "btn-add", "btn-save-later"].forEach((id) => {
    const btn = $(id);
    if (btn) {
      const textEl = btn.querySelector(".btn-text");
      if (textEl) btn.dataset.originalText = textEl.textContent;
    }
  });

  // ── Initialize ──────────────────────────────────────────────────────────────
  init();
});
