import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { dealsApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Briefcase } from "lucide-react";

export default function DealsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["deals"],
    queryFn: () => dealsApi.list(),
  });

  const deals = data?.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors">
          + New Deal
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading…</div>
        ) : deals.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No deals yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Deal</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Stage</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Ask Price</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Assigned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deals.map((d: any) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/deals/${d.id}`} className="font-medium text-brand-600 hover:underline">
                        {d.deal_name ?? `Deal #${d.id}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full capitalize">
                        {d.stage?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{formatCurrency(d.asking_price, true)}</td>
                    <td className="px-4 py-3 hidden md:table-cell capitalize">{d.assigned_to ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
