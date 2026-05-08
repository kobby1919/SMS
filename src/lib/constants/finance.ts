import { Prisma } from "@/src/generated/prisma";


// 1. Payment Method Labels
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  MTN_MOMO: "MTN Mobile Money",
  VODAFONE_CASH: "Vodafone Cash",
  AIRTELTIGO_MONEY: "AirtelTigo Money",
  BANK_TRANSFER: "Bank Transfer",
  CHEQUE: "Cheque",
  OTHER: "Other",
};

// 2. Fee Category Labels
export const FEE_CATEGORY_LABELS: Record<string, string> = {
  TUITION: "Tuition",
  LEVY: "Levy",
  EXAM: "Exam Fee",
  FEEDING: "Feeding",
  TRANSPORT: "Transport",
  UNIFORM: "Uniform",
  LIBRARY: "Library",
  SPORTS: "Sports",
  OTHER: "Other",
};

// 3. Discount Type Labels
export const DISCOUNT_TYPE_LABELS: Record<string, string> = {
  SCHOLARSHIP: "Scholarship",
  SIBLING: "Sibling Discount",
  STAFF_CHILD: "Staff Child",
  BURSARY: "Bursary",
  OTHER: "Other",
};

// 4. Bill Status Styles
export const BILL_STATUS_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  UNPAID:   { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200",    label: "Unpaid"   },
  PARTIAL:  { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   label: "Partial"  },
  PAID:     { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "Paid"     },
  OVERPAID: { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    label: "Overpaid" },
  WAIVED:   { bg: "bg-gray-50",    text: "text-gray-600",    border: "border-gray-200",    label: "Waived"   },
};

// 5. Currency Formatter (Works on Client and Server)
export function formatGHS(amount: Prisma.Decimal | number | string): string {
  // Use instance check to safely access .toNumber()
  const num = amount instanceof Prisma.Decimal
    ? amount.toNumber()
    : Number(amount);

  return `GHS ${num.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
