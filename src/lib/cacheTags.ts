import { revalidateTag } from "next/cache";

export type DashboardResource = "admin";
export type DocumentResource = "daily-finance" | "receipt" | "report-card" | "syllabus";

export type ReferenceDataResource =
  | "bursars"
  | "classes"
  | "grades"
  | "parents"
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

function safeRevalidateTag(tag: string) {
  try {
    revalidateTag(tag, "max");
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`Cache revalidation skipped for ${tag}:`, error);
    }
  }
}

export function revalidateReferenceData(
  schoolId: string,
  resource: ReferenceDataResource,
) {
  safeRevalidateTag(referenceDataTag(schoolId, resource));
}

export function dashboardTag(schoolId: string, resource: DashboardResource) {
  return `school:${schoolId}:dashboard:${resource}`;
}

export function revalidateDashboard(
  schoolId: string,
  resource: DashboardResource = "admin",
) {
  safeRevalidateTag(dashboardTag(schoolId, resource));
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
  safeRevalidateTag(documentTag(schoolId, resource, id));
}
