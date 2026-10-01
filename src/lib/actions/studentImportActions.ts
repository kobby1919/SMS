"use server";

import { requireRole } from "@/src/lib/authz";
import {
  importStudentsFromCsv,
  StudentImportError,
  type StudentImportResult,
} from "@/src/lib/services/student-import";

export type StudentImportState = {
  ok: boolean;
  message: string | null;
  errors?: string[];
  result?: StudentImportResult;
};

const MAX_IMPORT_FILE_BYTES = 750_000;

export async function importStudentsWithState(
  _prevState: StudentImportState,
  formData: FormData,
): Promise<StudentImportState> {
  try {
    const { schoolId } = await requireRole(["admin"]);
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return { ok: false, message: "Choose a CSV file before importing." };
    }

    if (file.size <= 0) {
      return { ok: false, message: "The CSV file is empty." };
    }

    if (file.size > MAX_IMPORT_FILE_BYTES) {
      return { ok: false, message: "Import file is too large. Upload a smaller CSV, up to 500 students." };
    }

    const fileName = file.name.toLowerCase();
    if (fileName && !fileName.endsWith(".csv")) {
      return { ok: false, message: "Upload a .csv file exported from your spreadsheet." };
    }

    const csv = await file.text();
    const result = await importStudentsFromCsv(schoolId, csv);

    return {
      ok: true,
      message: `Imported ${result.imported} student${result.imported === 1 ? "" : "s"} successfully.`,
      result,
    };
  } catch (error) {
    if (error instanceof StudentImportError) {
      return {
        ok: false,
        message: error.message,
        errors: error.errors.slice(0, 12),
      };
    }

    console.error("[student-import] import failed", error);
    return { ok: false, message: "Student import failed. Please review the CSV and try again." };
  }
}
