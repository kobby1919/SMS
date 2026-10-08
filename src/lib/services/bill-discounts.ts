import { Prisma, type DiscountType } from "@/src/generated/prisma";

export class BillDiscountError extends Error {}

async function lockBill(tx: Prisma.TransactionClient, schoolId: string, billId: number) {
  await tx.$queryRaw`SELECT "id" FROM "StudentBill" WHERE "id" = ${billId} AND "schoolId" = ${schoolId} FOR UPDATE`;
  const bill = await tx.studentBill.findFirst({ where: { id: billId, schoolId }, include: { student: { select: { name: true, surname: true } } } });
  if (!bill) throw new BillDiscountError("Bill not found for this school.");
  if (bill.status === "WAIVED") throw new BillDiscountError("Discounts cannot be changed on a waived bill.");
  return bill;
}

async function updateBalance(tx: Prisma.TransactionClient, bill: Awaited<ReturnType<typeof lockBill>>, discountAmount: Prisma.Decimal) {
  const balance = bill.totalAmount.minus(bill.amountPaid).minus(discountAmount).toDecimalPlaces(2);
  const status = balance.lt(0) ? "OVERPAID" : balance.eq(0) ? "PAID" : bill.amountPaid.gt(0) ? "PARTIAL" : "UNPAID";
  await tx.studentBill.update({ where: { id: bill.id }, data: { discountAmount, balance, status } });
}

export async function applyDiscountInTransaction(tx: Prisma.TransactionClient, input: {
  schoolId: string; actorId: string; billId: number; type: DiscountType; description: string;
  amount?: number | string | null; percentage?: number | string | null; approvalReference?: string; requestId?: string;
}) {
  if (input.requestId) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${input.schoolId}), hashtext(${`${input.actorId}:${input.requestId}`}))`;
  const bill = await lockBill(tx, input.schoolId, input.billId);
  if ((input.amount == null) === (input.percentage == null)) throw new BillDiscountError("Choose a fixed amount or percentage.");
  if (input.requestId) {
    const audit = await tx.financeAuditLog.findFirst({ where: { schoolId: input.schoolId, action: "DISCOUNT_APPLIED", performedBy: input.actorId, metadata: { path: ["requestId"], equals: input.requestId } } });
    if (audit) {
      const metadata = audit.metadata as Record<string, Prisma.JsonValue>;
      if (metadata.billId !== bill.id || metadata.description !== input.description || metadata.type !== input.type || metadata.requestedAmount !== (input.amount == null ? null : new Prisma.Decimal(input.amount).toString()) || metadata.requestedPercentage !== (input.percentage == null ? null : new Prisma.Decimal(input.percentage).toString())) throw new BillDiscountError("This request was already used with different discount details.");
      const discount = await tx.discount.findFirstOrThrow({ where: { schoolId: input.schoolId, id: Number(audit.entityId) } });
      return { discount, bill, value: new Prisma.Decimal(discount.amount!), replayed: true };
    }
  }
  const percentage = input.percentage == null ? null : new Prisma.Decimal(input.percentage);
  if (percentage && (percentage.lte(0) || percentage.gt(100))) throw new BillDiscountError("Percentage must be greater than zero and at most 100.");
  const value = (input.amount == null ? bill.totalAmount.mul(percentage!).div(100) : new Prisma.Decimal(input.amount)).toDecimalPlaces(2);
  const available = bill.totalAmount.minus(bill.amountPaid).minus(bill.discountAmount);
  if (!value.isFinite() || value.lte(0) || value.gt(available)) throw new BillDiscountError("Discount must be positive and cannot exceed the unpaid balance.");
  const discount = await tx.discount.create({ data: { schoolId: input.schoolId, studentBillId: bill.id, type: input.type, description: input.description, amount: value, percentage, approvedBy: input.actorId } });
  await updateBalance(tx, bill, bill.discountAmount.plus(value));
  await tx.financeAuditLog.create({ data: { schoolId: input.schoolId, action: "DISCOUNT_APPLIED", performedBy: input.actorId, entityType: "Discount", entityId: String(discount.id), metadata: { billId: bill.id, discountId: discount.id, amount: value.toFixed(2), percentage: percentage?.toFixed(2) ?? null, description: input.description, type: input.type, ...(input.requestId ? { requestId: input.requestId, requestedAmount: input.amount == null ? null : new Prisma.Decimal(input.amount).toString(), requestedPercentage: percentage?.toString() ?? null } : {}), ...(input.approvalReference ? { approvalReference: input.approvalReference, source: "MIGRATION" } : {}) } } });
  return { discount, bill, value, replayed: false };
}

export async function removeDiscountInTransaction(tx: Prisma.TransactionClient, input: { schoolId: string; actorId: string; discountId: number; reason: string }) {
  const initial = await tx.discount.findFirst({ where: { id: input.discountId, schoolId: input.schoolId } });
  if (!initial) throw new BillDiscountError("Discount not found.");
  const bill = await lockBill(tx, input.schoolId, initial.studentBillId);
  const discount = await tx.discount.findFirstOrThrow({ where: { id: initial.id, schoolId: input.schoolId } });
  if (discount.status !== "ACTIVE") throw new BillDiscountError("This discount has already been removed.");
  let value = discount.amount;
  if (value == null) {
    const audit = await tx.financeAuditLog.findFirst({ where: { schoolId: input.schoolId, action: "DISCOUNT_APPLIED", entityType: "Discount", entityId: String(discount.id) }, orderBy: { createdAt: "asc" } });
    const metadata = audit?.metadata as Record<string, Prisma.JsonValue> | undefined;
    if (typeof metadata?.amount !== "number" && typeof metadata?.amount !== "string") throw new BillDiscountError("Historical discount requires a verified applied amount before removal.");
    value = new Prisma.Decimal(metadata.amount);
  }
  if (!value.isFinite() || value.lte(0) || value.gt(bill.discountAmount)) throw new BillDiscountError("Discount totals need review before removal.");
  await tx.discount.update({ where: { id: discount.id }, data: { amount: value, status: "REMOVED", removedBy: input.actorId, removeReason: input.reason, removedAt: new Date() } });
  await updateBalance(tx, bill, bill.discountAmount.minus(value));
  await tx.financeAuditLog.create({ data: { schoolId: input.schoolId, action: "DISCOUNT_REMOVED", performedBy: input.actorId, entityType: "Discount", entityId: String(discount.id), metadata: { billId: bill.id, amount: value.toFixed(2), reason: input.reason } } });
  return { discount: { ...discount, studentBill: bill }, value };
}
