import AdminDashboardRefresh from "@/src/components/AdminDashboardRefresh";

export default function DashboardSectionState({ title, loading = false, limited = false }: { title: string; loading?: boolean; limited?: boolean }) {
  return <section aria-label={title} aria-busy={loading} className="min-w-0 border-t border-gray-200 py-6 font-nunito [overflow-wrap:anywhere]">
    <h2 className="text-xl font-black text-gray-950">{title}</h2>
    <p role="status" className="mt-2 text-sm text-gray-600">
      {loading ? "Loading school records..." : limited ? "This section needs a larger-data review. No partial totals are shown." : "This section is temporarily unavailable. No totals can be confirmed. Other sections remain available."}
    </p>
    {!loading && <AdminDashboardRefresh />}
  </section>;
}
