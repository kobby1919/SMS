export type TitledPerson = {
  name?: string | null;
  surname?: string | null;
  sex?: "MALE" | "FEMALE" | null;
};

export function formatTitledFirstName(
  person: TitledPerson | null | undefined,
  fallback: string,
) {
  const name = person?.name?.trim() || fallback;
  if (person?.sex === "MALE") return `Mr. ${name}`;
  if (person?.sex === "FEMALE") return `Ms. ${name}`;
  return name;
}

export function formatTitledFullName(
  person: TitledPerson | null | undefined,
  fallback: string,
) {
  const fullName = [person?.name, person?.surname]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ");
  const name = fullName || fallback;
  if (person?.sex === "MALE") return `Mr. ${name}`;
  if (person?.sex === "FEMALE") return `Ms. ${name}`;
  return name;
}
