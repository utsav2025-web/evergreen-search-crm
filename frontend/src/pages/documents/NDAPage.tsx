import { useState } from "react";

const NDA_TEMPLATE = `NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into as of [DATE] between:

Disclosing Party: [COMPANY NAME] ("Company")
Receiving Party: [BUYER NAME] ("Buyer")

1. PURPOSE
The parties wish to explore a potential acquisition of the Company by the Buyer. In connection with this evaluation, the Company may disclose certain confidential information to the Buyer.

2. CONFIDENTIAL INFORMATION
"Confidential Information" means any information disclosed by the Company to the Buyer, either directly or indirectly, in writing, orally or by inspection of tangible objects, that is designated as confidential or that reasonably should be understood to be confidential given the nature of the information and the circumstances of disclosure.

3. OBLIGATIONS
The Buyer agrees to:
(a) Hold the Confidential Information in strict confidence;
(b) Not disclose the Confidential Information to any third party without prior written consent;
(c) Use the Confidential Information solely for the purpose of evaluating the potential acquisition;
(d) Limit access to the Confidential Information to those employees or advisors who need to know such information.

4. TERM
This Agreement shall remain in effect for a period of two (2) years from the date of execution.

5. RETURN OF INFORMATION
Upon request, the Buyer shall promptly return or destroy all Confidential Information.

6. GOVERNING LAW
This Agreement shall be governed by the laws of [STATE].

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.

COMPANY:                          BUYER:
_______________________           _______________________
Name: [COMPANY SIGNATORY]         Name: [BUYER SIGNATORY]
Title: [TITLE]                    Title: [TITLE]
Date: _______________             Date: _______________`;

export default function NDAPage() {
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
        <h1 className="text-2xl font-bold text-slate-900">NDA</h1>
        <p className="text-slate-500 text-sm mt-1">
          Draft or paste your Non-Disclosure Agreement below. Use the template as a starting point.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-slate-700">NDA Content</label>
          <button
            onClick={() => setContent(NDA_TEMPLATE)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Load Template
          </button>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={28}
          placeholder="Enter your NDA text here, or click 'Load Template' to start from a standard template..."
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
