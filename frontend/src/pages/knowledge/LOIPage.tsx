import { useState } from "react";

const LOI_TEMPLATE = `LETTER OF INTENT

Date: 

[SELLER NAME]
[SELLER ADDRESS]

Re: Letter of Intent to Acquire [COMPANY NAME]

Dear [SELLER NAME],

This Letter of Intent ("LOI") sets forth the principal terms and conditions under which [BUYER NAME] ("Buyer") proposes to acquire [COMPANY NAME] ("Company").

1. PURCHASE PRICE
The proposed purchase price for 100% of the equity interests of the Company is $[PURCHASE_PRICE], subject to adjustment as described herein.

2. STRUCTURE
The transaction is proposed to be structured as an asset purchase.

3. FINANCING
Buyer intends to finance the acquisition through a combination of:
- SBA 7(a) loan: approximately $[SBA_AMOUNT]
- Seller note: approximately $[SELLER_NOTE] (payable over [YEARS] years at [RATE]% interest)
- Equity: approximately $[EQUITY_AMOUNT]

4. WORKING CAPITAL
A normalized working capital target will be agreed upon during due diligence.

5. SELLER TRANSITION
Seller agrees to remain available for a transition period of [TRANSITION_MONTHS] months following closing.

6. EXCLUSIVITY
Upon acceptance of this LOI, Seller agrees to grant Buyer an exclusive negotiating period of [EXCLUSIVITY_DAYS] days.

7. DUE DILIGENCE
Buyer will conduct customary due diligence including financial, legal, operational, and customer review.

8. CONFIDENTIALITY
The parties agree to maintain the confidentiality of this LOI and all related discussions.

9. NON-BINDING
This LOI is non-binding except for the provisions regarding exclusivity and confidentiality.

Sincerely,

[BUYER NAME]
[BUYER TITLE]
[DATE]`;

export default function LOIPage() {
  const [content, setContent] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">LOI Drafting</h1>
        <p className="text-slate-500 text-sm mt-1">Draft your Letter of Intent below. Use the template as a starting point.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-slate-700">LOI Content</label>
          <button
            onClick={() => setContent(LOI_TEMPLATE)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Load Template
          </button>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={28}
          placeholder="Enter your LOI text here, or click 'Load Template' to start from a standard template..."
          className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono leading-relaxed"
        />
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleCopy}
            disabled={!content}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {copied ? "Copied!" : "Copy to Clipboard"}
          </button>
          <button
            onClick={() => setContent("")}
            disabled={!content}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-600 text-sm font-medium rounded-lg transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
