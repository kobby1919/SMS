import { Prisma } from "@/src/generated/prisma";
import type {
  BillStatus,
  FeeStructureStatus,
  PaymentStatus,
} from "@/src/generated/prisma";

export function assertDraftFeeStructure(status: FeeStructureStatus) {
  if (status !== "DRAFT") {
    throw new Error("Published fee structures are locked and cannot be edited.");
  }
}

export function assertCanPublishFeeStructure(input: {
  status: FeeStructureStatus;
  feeItemCount: number;
  mandatoryFeeItemCount: number;
}) {
  if (input.status === "PUBLISHED") {
    throw new Error("This fee structure is already published.");
  }

  if (input.feeItemCount === 0) {
    throw new Error("Add at least one fee item before publishing this structure.");
  }

  if (input.mandatoryFeeItemCount === 0) {
    throw new Error(
      "At least one fee item must be non-optional. A structure with only optional items cannot be published.",
    );
  }
}

export function assertCanGenerateBills(status: FeeStructureStatus) {
  if (status !== "PUBLISHED") {
    throw new Error("Bills can only be generated from a published fee structure.");
  }
}

export function assertCanRecordPayment(status: BillStatus) {
  if (status === "WAIVED") {
    throw new Error("Cannot record a payment on a waived bill.");
  }

  if (status === "PAID") {
    throw new Error("This bill is already fully paid.");
  }
}

export function assertPaymentWithinAllowedOverpay(input: {
  amount: Prisma.Decimal.Value;
  currentBalance: Prisma.Decimal.Value;
}) {
  const amount = new Prisma.Decimal(input.amount);
  const currentBalance = new Prisma.Decimal(input.currentBalance);

  if (amount.gt(currentBalance.mul(1.5))) {
    throw new Error(
      `Payment amount (GHS ${amount.toFixed(2)}) is more than 150% of the ` +
      `outstanding balance (GHS ${currentBalance.toFixed(2)}). Please verify the amount before proceeding.`,
    );
  }
}

export function assertCanReversePayment(input: {
  status: PaymentStatus;
  hasReversal: boolean;
}) {
  if (input.hasReversal || input.status === "REVERSED") {
    throw new Error("This payment has already been reversed.");
  }
}

export function assertCanWaiveBill(status: BillStatus) {
  if (status === "PAID") {
    throw new Error("Cannot waive a bill that has already been paid.");
  }

  if (status === "WAIVED") {
    throw new Error("This bill is already waived.");
  }
}

export function computeBillStatus(input: {
  totalAmount: Prisma.Decimal.Value;
  amountPaid: Prisma.Decimal.Value;
  discountAmount: Prisma.Decimal.Value;
  currentStatus: BillStatus;
}): { balance: Prisma.Decimal; status: BillStatus } {
  const total = new Prisma.Decimal(input.totalAmount);
  const paid = new Prisma.Decimal(input.amountPaid);
  const discount = new Prisma.Decimal(input.discountAmount);
  const balance = total.sub(paid).sub(discount);

  if (input.currentStatus === "WAIVED") {
    return { balance: new Prisma.Decimal(0), status: "WAIVED" };
  }

  if (balance.lessThan(0)) {
    return { balance: balance.toDecimalPlaces(2), status: "OVERPAID" };
  }

  if (balance.equals(0)) {
    return { balance: balance.toDecimalPlaces(2), status: "PAID" };
  }

  if (paid.greaterThan(0)) {
    return { balance: balance.toDecimalPlaces(2), status: "PARTIAL" };
  }

  return { balance: balance.toDecimalPlaces(2), status: "UNPAID" };
}
