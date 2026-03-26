/**
 * options.js — SearchFund CRM Extension Settings
 */

"use strict";

const $ = (id) => document.getElementById(id);

function showAlert(elementId, message, type = "success") {
  const el = $(elementId);
  if (!el) return;
  el.textContent = message;
  el.className = `alert alert-${type}`;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 4000);
}

function getStorage(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function setStorage(data) {
  return new Promise((resolve) => chrome.storage.local.set(data, resolve));
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(response);
    });
  });
}

async function updateAuthStatus() {
  const { authToken, currentUser } = await getStorage(["authToken", "currentUser"]);
  const dot = $("status-dot");
  const text = $("status-text");
  const userEl = $("status-user");
  const logoutBtn = $("btn-logout");

  if (authToken && currentUser) {
    dot.className = "status-dot status-dot-green";
    text.textContent = "Signed in";
    userEl.textContent = currentUser.display_name || currentUser.username || "";
    logoutBtn.style.display = "inline-flex";
  } else {
    dot.className = "status-dot status-dot-gray";
    text.textContent = "Not signed in";
    userEl.textContent = "";
    logoutBtn.style.display = "none";
  }
}

async function init() {
  const stored = await getStorage(["crmBaseUrl", "claudeApiKey"]);

  if (stored.crmBaseUrl) {
    $("crm-url").value = stored.crmBaseUrl;
  }

  if (stored.claudeApiKey) {
    $("claude-key").value = stored.claudeApiKey;
  }

  await updateAuthStatus();
}

document.addEventListener("DOMContentLoaded", () => {
  init();

  // ── Save CRM URL ──────────────────────────────────────────────────────────
  $("btn-save-url")?.addEventListener("click", async () => {
    let url = $("crm-url").value.trim().replace(/\/$/, "");
    if (!url) {
      showAlert("url-alert", "Please enter a CRM URL.", "error");
      return;
    }
    if (!url.startsWith("http")) {
      url = "https://" + url;
      $("crm-url").value = url;
    }
    await setStorage({ crmBaseUrl: url });
    showAlert("url-alert", "✓ CRM URL saved successfully.", "success");
  });

  // ── Test Connection ───────────────────────────────────────────────────────
  $("btn-test-connection")?.addEventListener("click", async () => {
    const url = $("crm-url").value.trim().replace(/\/$/, "");
    if (!url) {
      showAlert("url-alert", "Please enter a CRM URL first.", "error");
      return;
    }

    showAlert("url-alert", "Testing connection…", "success");

    try {
      const resp = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(5000) });
      if (resp.ok) {
        const data = await resp.json();
        showAlert("url-alert", `✓ Connected! CRM is running (${data.env || "ok"}).`, "success");
      } else {
        showAlert("url-alert", `✗ CRM responded with status ${resp.status}.`, "error");
      }
    } catch (err) {
      showAlert("url-alert", `✗ Cannot reach CRM: ${err.message}`, "error");
    }
  });

  // ── Save Claude Key ───────────────────────────────────────────────────────
  $("btn-save-claude")?.addEventListener("click", async () => {
    const key = $("claude-key").value.trim();
    if (!key) {
      showAlert("claude-alert", "Please enter an API key.", "error");
      return;
    }
    if (!key.startsWith("sk-ant-")) {
      showAlert("claude-alert", "⚠ This doesn't look like an Anthropic key (should start with sk-ant-). Saved anyway.", "success");
    } else {
      showAlert("claude-alert", "✓ Claude API key saved.", "success");
    }
    await setStorage({ claudeApiKey: key });
  });

  // ── Clear Claude Key ──────────────────────────────────────────────────────
  $("btn-clear-claude")?.addEventListener("click", async () => {
    await setStorage({ claudeApiKey: null });
    $("claude-key").value = "";
    showAlert("claude-alert", "Claude API key cleared. AI enrichment disabled.", "success");
  });

  // ── Sign Out ──────────────────────────────────────────────────────────────
  $("btn-logout")?.addEventListener("click", async () => {
    try {
      await sendMessage({ type: "LOGOUT" });
    } catch {}
    await updateAuthStatus();
    showAlert("url-alert", "Signed out successfully.", "success");
  });
});
