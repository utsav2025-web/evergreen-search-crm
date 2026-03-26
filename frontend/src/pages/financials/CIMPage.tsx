import { useState } from "react";

export default function CIMPage() {
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
        <h1 className="text-2xl font-bold text-slate-900">CIM Notes</h1>
        <p className="text-slate-500 text-sm mt-1">
          Paste or type key information from the Confidential Information Memorandum here for reference.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">CIM Content / Notes</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={28}
          placeholder="Paste CIM text or enter key highlights here — business overview, financials, growth drivers, risks, deal terms..."
          className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y leading-relaxed"
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
