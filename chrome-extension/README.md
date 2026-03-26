# SearchFund CRM — Chrome Extension

**Proprietary Deal Sourcing for Matt & Utsav — Two Evergreen Capital**

Visit any company website and add it to your acquisition pipeline in one click. The extension automatically extracts company data from the page, optionally enriches it with Claude AI, checks for duplicates, and creates the record in your CRM.

---

## Features

- **One-click add** — Visit any company website, click the toolbar icon, review pre-filled data, and add to pipeline
- **Smart extraction** — Automatically reads company name, description, phone, email, address, LinkedIn, and more from the page
- **Claude AI enrichment** — With your Anthropic API key, Claude analyzes the full page text to extract owner info, industry, employee count, founded year, and more
- **Duplicate detection** — Checks the domain against your CRM before adding; shows a warning if already in pipeline
- **Badge indicator** — Green badge = logged in, yellow `!` = company already in CRM, gray = not logged in
- **Keyboard shortcut** — `Cmd+Shift+A` (Mac) or `Ctrl+Shift+A` (Windows/Linux)
- **Save for Later** — Add a company with a "save for later" flag for deferred review
- **Franchise detection** — AI flags potential franchise locations so you don't pursue them

---

## Installation

### Step 1: Load the Extension in Chrome

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `chrome-extension` folder from this project

The "SF" icon will appear in your Chrome toolbar.

### Step 2: Configure the CRM URL

1. Click the ⚙ settings icon in the extension popup, or right-click the toolbar icon → **Options**
2. Enter your CRM Base URL (e.g. `https://8000-abc123.manus.computer` or `http://localhost:8000`)
3. Click **Save URL**, then **Test Connection** to verify

### Step 3: Sign In

1. Click the extension icon in the toolbar
2. Enter your CRM credentials:
   - Username: `matt` or `utsav`
   - Password: `searchfund2024`
3. Click **Sign In**

### Step 4 (Optional): Add Claude AI Key

1. Open extension Options (⚙ icon)
2. Enter your Anthropic API key (get one at [console.anthropic.com](https://console.anthropic.com))
3. Click **Save API Key**

With Claude enabled, the extension will use `claude-sonnet-4-20250514` to analyze the full page text and extract richer company data.

---

## Usage

1. Navigate to any company website (e.g. `https://acmehvac.com`)
2. Click the **SF** icon in your Chrome toolbar (or press `Cmd+Shift+A`)
3. The extension will:
   - Check if the domain is already in your CRM (shows a banner if so)
   - Extract company data from the page
   - Optionally enrich with Claude AI
   - Show the pre-filled review form
4. Review and edit the extracted data
5. Click **Add to Pipeline** — the company is added as a **Prospect** with source **Direct Web**

---

## Form Fields

| Field | Description |
|-------|-------------|
| Company Name | Auto-extracted from og:site_name, page title, or domain |
| Website | The current page's root URL |
| Industry | Dropdown with common search fund target industries |
| Lead Partner | Matt or Utsav (defaults to logged-in user) |
| Revenue / Asking Price | Manual entry (supports $2.5M, $500K formats) |
| Owner Name | Extracted from page or Claude |
| Owner Email / Phone | Extracted from mailto: links, page text |
| Location | City, State extracted from schema.org or page text |
| Notes | Free-form notes added to the company record |

---

## Backend API Endpoints

The extension uses two dedicated endpoints on the CRM backend:

### `GET /api/companies/check-domain?domain={domain}`
Returns whether a company with this domain already exists in the CRM.

```json
{
  "exists": true,
  "company_id": 42,
  "company_name": "Acme HVAC Services",
  "deal_stage": "initial_contact",
  "crm_url": "/companies/42"
}
```

### `POST /api/companies/from-extension`
Creates a new company from the extension payload. Returns `409 Conflict` if the domain already exists.

```json
{
  "name": "Acme HVAC Services",
  "website": "https://acmehvac.com",
  "industry": "HVAC Services",
  "owner_name": "Bob Smith",
  "owner_email": "bob@acmehvac.com",
  "owner_phone": "555-123-4567",
  "city": "Austin",
  "state": "TX",
  "lead_partner": "matt",
  "notes": "Looks like a great fit — 15 years in business",
  "annual_revenue": 2500000,
  "asking_price": 5000000
}
```

---

## File Structure

```
chrome-extension/
├── manifest.json        # Extension manifest (MV3)
├── background.js        # Service worker: API calls, badge management
├── content.js           # Injected into pages: extracts company data
├── popup.html           # Extension popup UI
├── popup.js             # Popup logic: state management, form, auth
├── styles.css           # Popup styles
├── options.html         # Settings page
├── options.js           # Settings page logic
├── icons/
│   ├── icon16.png       # 16×16 toolbar icon
│   ├── icon48.png       # 48×48 extension management icon
│   └── icon128.png      # 128×128 Chrome Web Store icon
└── README.md            # This file
```

---

## Permissions

| Permission | Reason |
|------------|--------|
| `activeTab` | Read the current tab's URL and inject content script |
| `storage` | Store auth token, CRM URL, and Claude API key locally |
| `scripting` | Fallback extraction when content script isn't available |
| `tabs` | Listen for tab changes to update the badge |
| `<all_urls>` | Allow extraction from any company website |

---

## Privacy & Security

- Your CRM credentials are stored in Chrome's local storage (never synced to Google)
- Your Claude API key is stored locally and only sent directly to Anthropic's API — never to the CRM
- The extension only reads page content when you click the popup icon
- No data is sent to any third party other than your own CRM instance and (optionally) Anthropic

---

## Troubleshooting

**"Cannot reach CRM"** — Check that the CRM server is running and the URL in Options is correct. Use the **Test Connection** button.

**"Not logged in"** — Click the extension icon and sign in with your CRM credentials.

**Form shows no data** — Some pages block content scripts. The extension will still show the domain name and URL; fill in details manually.

**Claude enrichment not working** — Verify your API key in Options starts with `sk-ant-`. Check your Anthropic account has credits.

**Badge not updating** — The badge updates when you navigate to a new page. Reload the current tab if needed.
