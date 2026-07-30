import prisma from "@/src/lib/prisma";

export const PLATFORM_NAME = "Edujay";
export const DEFAULT_PRIMARY_COLOR = "#2563eb";

export type SchoolBranding = {
  schoolId: string;
  legalName: string;
  displayName: string;
  shortName: string;
  emailFromName: string;
  primaryColor: string;
  logoUrl?: string | null;
  contactEmail?: string | null;
  phone?: string | null;
  address?: string | null;
};

type BrandingSource = {
  id: string;
  name: string;
  legalName?: string | null;
  displayName?: string | null;
  shortName?: string | null;
  emailFromName?: string | null;
  primaryColor?: string | null;
  logoUrl?: string | null;
  contactEmail?: string | null;
  phone?: string | null;
  address?: string | null;
};

function clean(value?: string | null) {
  return value?.trim() || null;
}

export function normalizeSchoolBranding(school: BrandingSource): SchoolBranding {
  const displayName = clean(school.displayName) ?? school.name;
  const legalName = clean(school.legalName) ?? school.name;
  const shortName = clean(school.shortName) ?? displayName;

  return {
    schoolId: school.id,
    legalName,
    displayName,
    shortName,
    emailFromName: clean(school.emailFromName) ?? displayName,
    primaryColor: clean(school.primaryColor) ?? DEFAULT_PRIMARY_COLOR,
    logoUrl: school.logoUrl,
    contactEmail: school.contactEmail,
    phone: school.phone,
    address: school.address,
  };
}

export async function getSchoolBranding(schoolId: string) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      id: true,
      name: true,
      legalName: true,
      displayName: true,
      shortName: true,
      emailFromName: true,
      primaryColor: true,
      logoUrl: true,
      contactEmail: true,
      phone: true,
      address: true,
    },
  });

  if (!school) {
    throw new Error("School branding profile not found.");
  }

  return normalizeSchoolBranding(school);
}

export function poweredByPlatformLine() {
  return `Sent securely via ${PLATFORM_NAME}.`;
}
