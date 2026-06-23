import { revalidateTag } from "next/cache";

export type DashboardResource = "admin";
export type DocumentResource = "daily-finance" | "receipt" | "report-card" | "syllabus";

export type ReferenceDataResource =
  | "classes"
  | "grades"
  | "students"
  | "subjects"
  | "timetable"
  | "teachers";

export function referenceDataTag(
  schoolId: string,
  resource: ReferenceDataResource,
) {
  return `school:${schoolId}:reference:${resource}`;
}

export function revalidateReferenceData(
  schoolId: string,
  resource: ReferenceDataResource,
) {
  revalidateTag(referenceDataTag(schoolId, resource), "max");
}

export function dashboardTag(schoolId: string, resource: DashboardResource) {
  return `school:${schoolId}:dashboard:${resource}`;
}

export function revalidateDashboard(
  schoolId: string,
  resource: DashboardResource = "admin",
) {
  revalidateTag(dashboardTag(schoolId, resource), "max");
}

export function documentTag(
  schoolId: string,
  resource: DocumentResource,
  id?: string | number,
) {
  return `school:${schoolId}:document:${resource}${id === undefined ? "" : `:${id}`}`;
}

export function revalidateDocument(
  schoolId: string,
  resource: DocumentResource,
  id?: string | number,
) {
  revalidateTag(documentTag(schoolId, resource, id), "max");
}
