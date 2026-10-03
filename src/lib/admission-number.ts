const ADMISSION_NUMBER_PATTERN = /^([A-Z0-9]{3,6})-(\d{4})-(\d{4,})$/;
export const ADMISSION_NUMBER_FORMAT_LABEL = "SCHOOLCODE-YYYY-0001";

export function normalizeAdmissionNumber(value: string) {
  return value.trim().toUpperCase();
}

export function expectedAdmissionNumberExample(schoolCode: string, year = new Date().getFullYear()) {
  return `${schoolCode.trim().toUpperCase()}-${year}-0001`;
}

export function validateAdmissionNumberForSchool(value: string, schoolCode: string) {
  const admissionNumber = normalizeAdmissionNumber(value);
  const code = schoolCode.trim().toUpperCase();
  const match = ADMISSION_NUMBER_PATTERN.exec(admissionNumber);

  if (!match) {
    return {
      ok: false,
      admissionNumber,
      message: `Admission number must follow ${expectedAdmissionNumberExample(code)} format.`,
    };
  }

  if (match[1] !== code) {
    return {
      ok: false,
      admissionNumber,
      message: `Admission number must start with this school's code: ${code}.`,
    };
  }

  return { ok: true, admissionNumber, message: null };
}
