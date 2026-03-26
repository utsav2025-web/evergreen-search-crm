/**
 * content.js — SearchFund CRM Chrome Extension
 * Injected into the active tab to extract company data from the page.
 * Runs at document_idle and responds to messages from the popup.
 */

(function () {
  "use strict";

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function getMeta(name) {
    const el =
      document.querySelector(`meta[property="${name}"]`) ||
      document.querySelector(`meta[name="${name}"]`);
    return el ? (el.getAttribute("content") || "").trim() : null;
  }

  function cleanTitle(raw) {
    if (!raw) return null;
    // Remove common suffixes like " | Home", " - Official Site", " :: Welcome"
    return raw
      .replace(/\s*[\|\-–—:]+\s*(home|official site|welcome|homepage|main|about us|about)\s*$/i, "")
      .replace(/\s*[\|\-–—:]+\s*[^|–—:-]{1,60}$/, (match) => {
        // Only strip if the suffix looks like a tagline (not the company name)
        const suffix = match.replace(/^\s*[\|\-–—:]+\s*/, "");
        if (suffix.split(" ").length <= 4) return "";
        return match;
      })
      .trim();
  }

  function cleanDomain(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  }

  function extractPhones(text) {
    const patterns = [
      /\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/g,
      /\+1[\s.\-]?\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/g,
      /\d{3}[\s.\-]\d{3}[\s.\-]\d{4}/g,
    ];
    const found = new Set();
    for (const pat of patterns) {
      const matches = text.match(pat) || [];
      matches.forEach((m) => found.add(m.trim()));
    }
    return [...found].slice(0, 3);
  }

  function extractEmails(doc) {
    const emails = new Set();
    // From mailto: links
    doc.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
      const email = a.href.replace("mailto:", "").split("?")[0].trim();
      if (email && !email.includes("example") && !email.includes("your@")) {
        emails.add(email);
      }
    });
    // From text content
    const emailPattern = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    const bodyText = doc.body ? doc.body.innerText : "";
    const matches = bodyText.match(emailPattern) || [];
    matches.forEach((e) => {
      if (!e.includes("example") && !e.includes("sentry") && !e.includes("@2x")) {
        emails.add(e);
      }
    });
    return [...emails].slice(0, 3);
  }

  function extractLinkedIn(doc) {
    const links = doc.querySelectorAll('a[href*="linkedin.com/company/"]');
    for (const link of links) {
      const href = link.href;
      const match = href.match(/linkedin\.com\/company\/([^/?#]+)/);
      if (match) return `https://www.linkedin.com/company/${match[1]}`;
    }
    return null;
  }

  function extractFoundedYear(text) {
    const patterns = [
      /(?:founded|established|since|est\.?)\s+(?:in\s+)?(\d{4})/i,
      /(\d{4})\s+(?:to present|–\s*present)/i,
      /©\s*(\d{4})/,
    ];
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m) {
        const year = parseInt(m[1], 10);
        if (year >= 1800 && year <= new Date().getFullYear()) return year;
      }
    }
    return null;
  }

  function extractEmployeeCount(text) {
    const patterns = [
      /(\d[\d,]+)\s*\+?\s*(?:employees|team members|staff|professionals|people)/i,
      /(?:team of|staff of|workforce of)\s*(\d[\d,]+)/i,
      /(\d[\d,]+)\s*\+?\s*(?:full[- ]time|FTE)/i,
    ];
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m) {
        const num = parseInt(m[1].replace(/,/g, ""), 10);
        if (num > 0 && num < 1000000) return num;
      }
    }
    return null;
  }

  function extractAddress(doc) {
    // Try schema.org LocalBusiness
    const schema = doc.querySelector('[itemtype*="LocalBusiness"], [itemtype*="Organization"]');
    if (schema) {
      const streetEl = schema.querySelector('[itemprop="streetAddress"]');
      const cityEl = schema.querySelector('[itemprop="addressLocality"]');
      const stateEl = schema.querySelector('[itemprop="addressRegion"]');
      if (cityEl || streetEl) {
        return [streetEl, cityEl, stateEl]
          .filter(Boolean)
          .map((el) => el.textContent.trim())
          .join(", ");
      }
    }

    // Try JSON-LD
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        const addr = data.address || (data["@graph"] && data["@graph"][0]?.address);
        if (addr) {
          const parts = [addr.streetAddress, addr.addressLocality, addr.addressRegion]
            .filter(Boolean);
          if (parts.length > 0) return parts.join(", ");
        }
      } catch {}
    }

    // Fallback: look for address-like text near "address", "location", "headquarters"
    const bodyText = doc.body ? doc.body.innerText : "";
    const addrPattern = /(?:address|location|headquarters|hq)[:\s]+([^\n]{10,80})/i;
    const m = bodyText.match(addrPattern);
    if (m) return m[1].trim();

    return null;
  }

  function extractCityState(address) {
    if (!address) return { city: null, state: null };
    // Match "City, ST" or "City, State"
    const m = address.match(/([A-Za-z\s]+),\s*([A-Z]{2}|[A-Za-z\s]+)(?:\s+\d{5})?/);
    if (m) {
      return {
        city: m[1].trim(),
        state: m[2].trim().substring(0, 50),
      };
    }
    return { city: null, state: null };
  }

  function extractIndustry(doc) {
    // Try og:type
    const ogType = getMeta("og:type");
    if (ogType && ogType !== "website" && ogType !== "article") return ogType;

    // Try schema.org
    const schema = doc.querySelector('[itemtype*="schema.org"]');
    if (schema) {
      const type = schema.getAttribute("itemtype") || "";
      const match = type.match(/schema\.org\/(.+)/);
      if (match && match[1] !== "WebPage" && match[1] !== "WebSite") {
        return match[1].replace(/([A-Z])/g, " $1").trim();
      }
    }

    return null;
  }

  function getPageText() {
    if (!document.body) return "";
    // Get visible text, limit to 3000 chars
    const text = document.body.innerText || document.body.textContent || "";
    return text.replace(/\s+/g, " ").trim().substring(0, 3000);
  }

  function getOgImage() {
    return getMeta("og:image") || getMeta("og:image:url") || null;
  }

  // ── Main extraction ──────────────────────────────────────────────────────────

  function extractPageData() {
    const url = window.location.href;
    const domain = cleanDomain(url);
    const bodyText = document.body ? document.body.innerText : "";

    // Company name
    const ogSiteName = getMeta("og:site_name");
    const ogTitle = getMeta("og:title");
    const pageTitle = document.title;
    const rawName = ogSiteName || cleanTitle(ogTitle) || cleanTitle(pageTitle) || domain;

    // Description
    const description =
      getMeta("og:description") ||
      getMeta("description") ||
      getMeta("twitter:description") ||
      null;

    // Contact info
    const phones = extractPhones(bodyText);
    const emails = extractEmails(document);

    // Address
    const address = extractAddress(document);
    const { city, state } = extractCityState(address);

    // Industry
    const industry = extractIndustry(document);

    // Founded year
    const foundedYear = extractFoundedYear(bodyText);

    // Employee count
    const employees = extractEmployeeCount(bodyText);

    // LinkedIn
    const linkedinUrl = extractLinkedIn(document);

    // Logo / og:image
    const logoUrl = getOgImage();

    // Full page text for Claude
    const pageText = getPageText();

    // Clean website URL to root domain
    let website = url;
    try {
      const parsed = new URL(url);
      website = parsed.origin; // e.g. https://example.com
    } catch {}

    return {
      // Extracted fields
      name: rawName,
      website,
      domain,
      description,
      phone: phones[0] || null,
      phones,
      email: emails[0] || null,
      emails,
      address,
      city,
      state,
      industry,
      founded_year: foundedYear,
      employees,
      linkedin_url: linkedinUrl,
      logo_url: logoUrl,
      // For Claude enrichment
      page_text: pageText,
      page_title: pageTitle,
      og_title: ogTitle,
      og_site_name: ogSiteName,
    };
  }

  // ── Message listener ─────────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "EXTRACT_PAGE_DATA") {
      try {
        const data = extractPageData();
        sendResponse({ success: true, data });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    }
    return true; // Keep message channel open for async response
  });

})();
