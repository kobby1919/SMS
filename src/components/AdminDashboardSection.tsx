import { Suspense, type ReactNode } from "react";
import type { DashboardReader, DashboardSectionId } from "@/src/lib/services/admin-dashboard-section";
import DashboardSectionState from "@/src/components/AdminDashboardSectionState";
import AdminDashboardRenderBoundary from "@/src/components/AdminDashboardRenderBoundary";

async function LoadedSection<T>({ id, title, read, load, children }: SectionProps<T>) {
  const result = await read(id, load);
  if (result.state === "UNAVAILABLE") return <DashboardSectionState title={title} limited={result.reason === "LIMIT"} />;
  return children(result.data);
}

type SectionProps<T> = {
  id: DashboardSectionId;
  title: string;
  requestKey: string;
  read: DashboardReader;
  load: () => Promise<T>;
  children: (data: T) => ReactNode;
};

export default function AdminDashboardSection<T>(props: SectionProps<T>) {
  return <AdminDashboardRenderBoundary key={props.requestKey} id={props.id} title={props.title}>
    <Suspense fallback={<DashboardSectionState title={props.title} loading />}>
      <LoadedSection {...props} />
    </Suspense>
  </AdminDashboardRenderBoundary>;
}
