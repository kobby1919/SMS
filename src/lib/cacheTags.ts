import { revalidateTag } from "next/cache";

export type ReferenceDataResource =
  | "classes"
  | "grades"
  | "students"
  | "subjects"
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
