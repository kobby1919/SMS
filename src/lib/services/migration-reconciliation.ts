import "server-only";
import { createHash } from "node:crypto";
import prisma from "@/src/lib/prisma";
import { Prisma } from "@/src/generated/prisma";
import { getMigrationInventory } from "@/src/lib/services/migration-inventory";
import { inventorySchema } from "@/src/lib/migration/inventory";
import { MigrationRecoveryError, requireMigrationRecovery } from "@/src/lib/services/migration-recovery";
import { approvalSchema, evidenceKeys, evidenceSchema, moneyDisplay, moneyMinor, type MigrationEvidence } from "@/src/lib/migration/reconciliation";

export class MigrationReconciliationError extends Error {}
const metadata = (value: Prisma.JsonValue): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export async function buildMigrationReconciliation(schoolId: string, tx: Prisma.TransactionClient) {
  const inventory = await getMigrationInventory(schoolId, tx);
  const logs = await tx.onboardingAuditLog.findMany({ where: { schoolId, action: "IMPORT_RECORDED" }, orderBy: { id: "asc" }, take: 1001 });
  const pending = await tx.migrationStagedUpload.findMany({ where: { schoolId, status: "VALIDATED", expiresAt: { gt: new Date() } }, select: { id: true, checksum: true, inventoryVersion: true }, orderBy: { id: "asc" }, take: 21 });
  const blockers: string[] = [];
  if (!inventory || inventory.status !== "CONFIRMED" || !inventorySchema.safeParse(inventory).success) blockers.push("Confirm a valid migration inventory before school approval.");
  if (logs.length > 1000) throw new MigrationReconciliationError("This migration exceeds the review limit. Arrange a dedicated reconciliation before approval.");
  if (pending.length) blockers.push(`${pending.length} saved upload(s) still await import or cancellation.`);
  const ids = Object.fromEntries(evidenceKeys.map((key) => [key, new Set<string>()])) as Record<typeof evidenceKeys[number], Set<string>>;
  type Controls = NonNullable<MigrationEvidence["controls"]>;
  const controls = {
    feeLines: new Map<string, Controls["feeLines"][number]>(),
    discounts: new Map<string, Controls["discounts"][number]>(),
    guardianLinks: new Map<string, Controls["guardianLinks"][number]>(),
    studentPlacements: new Map<string, Controls["studentPlacements"][number]>(),
  };
  function mergeControls<T extends { id: string }>(target: Map<string, T>, entries: T[]) {
    for (const entry of entries) {
      const previous = target.get(entry.id);
      if (previous && JSON.stringify(previous) !== JSON.stringify(entry)) blockers.push("Import batches contain conflicting record-level controls. Resolve them before approval.");
      target.set(entry.id, entry);
      if (target.size > 50000) throw new MigrationReconciliationError("Record-level review limit exceeded. Arrange a dedicated reconciliation.");
    }
  }
  let gross = BigInt(0), paid = BigInt(0), discounts = BigInt(0);
  const batches = logs.map((log) => {
    const data = metadata(log.metadata);
    const parsed = evidenceSchema.safeParse(data.evidence);
    if (!parsed.success) blockers.push(`Import ${log.id} has no complete record-level evidence; it requires a separate verified reconciliation.`);
    if (data.problematic === true) blockers.push(`Import ${log.id} is marked problematic. Resolve and document it before approval.`);
    if (parsed.success) {
      for (const key of evidenceKeys) for (const id of parsed.data.records[key]) {
        ids[key].add(id);
        if (ids[key].size > 50000) throw new MigrationReconciliationError("Record-level review limit exceeded. Arrange a dedicated reconciliation.");
      }
      if (parsed.data.controls) {
        mergeControls(controls.feeLines, parsed.data.controls.feeLines);
        mergeControls(controls.discounts, parsed.data.controls.discounts);
        mergeControls(controls.guardianLinks, parsed.data.controls.guardianLinks);
        mergeControls(controls.studentPlacements, parsed.data.controls.studentPlacements);
      }
      gross += BigInt(parsed.data.finance.gross);
      paid += BigInt(parsed.data.finance.paid);
      discounts += BigInt(parsed.data.finance.discounts);
    }
    return { id: log.id, fileName: typeof data.fileName === "string" ? data.fileName : "Recorded import", importedRows: typeof data.importedRows === "number" ? data.importedRows : 0, skippedRows: typeof data.skippedRows === "number" ? data.skippedRows : 0, hasEvidence: parsed.success, problematic: data.problematic === true };
  });
  for (const [recordKey, controlKey] of [["fees", "feeLines"], ["discounts", "discounts"], ["parentLinks", "guardianLinks"], ["students", "studentPlacements"]] as const) {
    if (ids[recordKey].size !== controls[controlKey].size || [...ids[recordKey]].some((id) => !controls[controlKey].has(id))) blockers.push(`Imported ${recordKey} need complete per-record controls before automatic approval. Legacy records require verified reconciliation.`);
  }
  if (Object.values(ids).some((set) => set.size > 50000)) throw new MigrationReconciliationError("Record-level review limit exceeded. Arrange a dedicated reconciliation.");
  const stringIds = (key: typeof evidenceKeys[number]) => [...ids[key]].sort();
  const numberIds = (key: typeof evidenceKeys[number]) => stringIds(key).map((id) => {
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) throw new MigrationReconciliationError("Invalid numeric record provenance.");
    return Number(id);
  });
  // Read only the imported identities, never whole-school totals or another school's records.
  const records = {
    classes: await tx.class.findMany({ where: { schoolId, id: { in: numberIds("classes") } }, orderBy: { id: "asc" } }),
    subjects: await tx.subject.findMany({ where: { schoolId, id: { in: numberIds("subjects") } }, orderBy: { id: "asc" } }),
    students: await tx.student.findMany({ where: { schoolId, class: { schoolId }, id: { in: stringIds("students") } }, include: { class: { select: { name: true } } }, orderBy: { id: "asc" } }),
    parents: await tx.parent.findMany({ where: { schoolId, id: { in: stringIds("parents") } }, orderBy: { id: "asc" } }),
    parentLinks: await tx.parentStudentRelationship.findMany({ where: { schoolId, parent: { schoolId }, student: { schoolId }, id: { in: stringIds("parentLinks") } }, include: { parent: { select: { name: true, surname: true } }, student: { select: { admissionNumber: true } } }, orderBy: { id: "asc" } }),
    teachers: await tx.teacher.findMany({ where: { schoolId, id: { in: stringIds("teachers") } }, orderBy: { id: "asc" } }),
    bursars: await tx.bursar.findMany({ where: { schoolId, id: { in: stringIds("bursars") } }, orderBy: { id: "asc" } }),
    feeStructures: await tx.feeItem.findMany({ where: { feeStructure: { schoolId }, id: { in: numberIds("feeStructures") } }, orderBy: { id: "asc" } }),
    fees: await tx.billLineItem.findMany({ where: { studentBill: { schoolId, student: { schoolId } }, feeItem: { feeStructure: { schoolId } }, id: { in: numberIds("fees") } }, orderBy: { id: "asc" } }),
    discounts: await tx.discount.findMany({ where: { schoolId, studentBill: { schoolId, student: { schoolId } }, id: { in: numberIds("discounts") } }, orderBy: { id: "asc" } }),
  };
  for (const key of evidenceKeys) if (records[key].length !== ids[key].size) blockers.push(`Imported ${key} records are missing or outside this school's scope.`);
  if (records.parentLinks.some((link) => link.status !== "ACTIVE")) blockers.push("An imported guardian relationship is no longer active. Review ward access.");
  if (records.students.some((student) => !records.parentLinks.some((link) => link.studentId === student.id && link.parentId === student.parentId && link.status === "ACTIVE"))) blockers.push("An imported student's primary guardian does not match the saved relationship evidence.");
  if (records.discounts.some((discount) => discount.status !== "ACTIVE")) blockers.push("An imported discount has been removed. Reconcile the approved opening controls.");
  if (records.parentLinks.some((link) => {
    const control = controls.guardianLinks.get(link.id);
    return control && (link.parentId !== control.parentId || link.studentId !== control.studentId || link.role !== control.role);
  })) blockers.push("A guardian relationship no longer matches its original parent, student or responsibility.");
  if (records.students.some((student) => {
    const control = controls.studentPlacements.get(student.id);
    return control && (student.classId !== control.classId || student.gradeId !== control.gradeId || student.parentId !== control.parentId);
  })) blockers.push("A student placement no longer matches the committed class, grade or guardian.");
  if (records.fees.some((line) => {
    const control = controls.feeLines.get(String(line.id));
    return control && (line.studentBillId !== control.billId || line.feeItemId !== control.feeItemId || moneyMinor(line.amount.toFixed(2)) !== BigInt(control.amount) || moneyMinor(line.amountPaid.toFixed(2)) !== BigInt(control.paid));
  })) blockers.push("An individual opening fee line changed even if the overall totals still match.");
  if (records.discounts.some((discount) => {
    const control = controls.discounts.get(String(discount.id));
    return !discount.amount || discount.amount.lte(0) || (control && (discount.studentBillId !== control.billId || moneyMinor(discount.amount.toFixed(2)) !== BigInt(control.amount)));
  })) blockers.push("An individual opening discount is invalid or no longer matches its original bill and amount.");
  const openingBillIds = new Set(records.fees.map((line) => line.studentBillId));
  if (inventory?.finance && records.discounts.some((discount) => !openingBillIds.has(discount.studentBillId))) blockers.push("An opening discount applies to a bill outside the imported opening bill scope.");
  const liveGross = records.fees.reduce((total, line) => total + moneyMinor(line.amount.toFixed(2)), BigInt(0));
  const livePaid = records.fees.reduce((total, line) => total + moneyMinor(line.amountPaid.toFixed(2)), BigInt(0));
  const liveDiscount = records.discounts.reduce((total, discount) => total + (discount.amount ? moneyMinor(discount.amount.toFixed(2)) : BigInt(0)), BigInt(0));
  if (liveGross !== gross || livePaid !== paid || liveDiscount !== discounts) blockers.push("Imported opening amounts have changed or do not match the committed import evidence.");
  const billIds = [...new Set([...records.fees.map((line) => line.studentBillId), ...records.discounts.map((discount) => discount.studentBillId)])].sort((a, b) => a - b);
  const bills = await tx.studentBill.findMany({ where: { schoolId, id: { in: billIds } }, include: { lineItems: { orderBy: { id: "asc" } }, discounts: { where: { status: "ACTIVE" }, orderBy: { id: "asc" } } }, orderBy: { id: "asc" } });
  if (bills.length !== billIds.length) blockers.push("An affected opening bill is missing.");
  const billStudents = new Map(bills.map((bill) => [bill.id, bill.studentId]));
  if ([...controls.feeLines.values(), ...controls.discounts.values()].some((control) => billStudents.get(control.billId) !== control.studentId)) blockers.push("An opening financial record no longer belongs to its original student.");
  if (bills.some((bill) => bill.lineItems.some((line) => line.amount.lt(0) || line.amountPaid.lt(0) || line.amountPaid.gt(line.amount) || !line.amount.minus(line.amountPaid).eq(line.balance) || line.isPaid !== line.balance.lte(0)))) blockers.push("An affected bill has an invalid fee-line balance or paid state.");
  if (bills.some((bill) => !bill.totalAmount.minus(bill.amountPaid).minus(bill.discountAmount).eq(bill.balance))) blockers.push("An affected bill has inconsistent charge, discount, paid or balance totals.");
  if (bills.some((bill) => !bill.totalAmount.eq(bill.lineItems.reduce((total, line) => total.plus(line.amount), new Prisma.Decimal(0))) || !bill.amountPaid.eq(bill.lineItems.reduce((total, line) => total.plus(line.amountPaid), new Prisma.Decimal(0))) || !bill.discountAmount.eq(bill.discounts.reduce((total, discount) => total.plus(discount.amount ?? 0), new Prisma.Decimal(0))))) blockers.push("An affected bill does not match its fee lines or active discounts.");
  const units: Record<string, string> = { parents: "Unique guardian profiles (including student-file guardians)", feeStructures: "Fee items", fees: "Opening bill line items" };
  const rows = (inventory?.rows ?? []).filter((row) => row.disposition === "INCLUDE").map((row) => {
    const key = row.key as typeof evidenceKeys[number];
    const imported = ids[key]?.size ?? 0;
    const present = records[key]?.length ?? 0;
    const difference = present - row.expectedRecords;
    if (difference !== 0) blockers.push(`${row.key}: expected ${row.expectedRecords}, verified ${present}. Review missing records or revise the agreed scope.`);
    return { key, expected: row.expectedRecords, imported, present, difference, unit: units[key] ?? "Unique records" };
  });
  const outstanding = gross - paid - discounts;
  if ((inventory?.finance || ids.fees.size > 0) && outstanding < BigInt(0)) blockers.push("Imported opening controls produce a negative outstanding balance.");
  const actualFinance = { gross: moneyDisplay(gross), discounts: moneyDisplay(discounts), paid: moneyDisplay(paid), outstanding: moneyDisplay(outstanding) };
  const minorFinance = { gross, discounts, paid, outstanding };
  if (inventory?.finance) for (const key of ["gross", "discounts", "paid", "outstanding"] as const) if (moneyMinor(inventory.finance[key]) !== minorFinance[key]) blockers.push(`Opening ${key} does not match the school's declared control total.`);
  const fingerprint = createHash("sha256").update(JSON.stringify({ schoolId, inventory, logs, pending, records, bills })).digest("hex");
  const previous = await tx.onboardingAuditLog.findFirst({ where: { schoolId, action: "MIGRATION_RECONCILIATION_APPROVED" }, orderBy: { id: "desc" } });
  const approved = previous && metadata(previous.metadata).fingerprint === fingerprint && blockers.length === 0;
  const samples = {
    students: records.students.slice(0, 5).map((student) => ({ admissionNumber: student.admissionNumber, name: `${student.name} ${student.surname}`, className: student.class.name })),
    guardians: records.parentLinks.slice(0, 5).map((link) => ({ admissionNumber: link.student.admissionNumber, name: `${link.parent.name} ${link.parent.surname}`, role: link.role })),
  };
  const scope = (inventory?.rows ?? []).map((row) => ({ key: row.key, disposition: row.disposition, reason: row.reason }));
  return { fingerprint, inventoryVersion: inventory?.version ?? 0, rows, scope, batches, samples, finance: { expected: inventory?.finance ?? null, actual: actualFinance }, blockers: [...new Set(blockers)], canApprove: blockers.length === 0 && rows.length > 0, approval: approved ? { at: previous.createdAt.toISOString(), by: previous.performedBy, representative: String(metadata(previous.metadata).representative) } : null };
}

export function reconciliationCsv(report: Awaited<ReturnType<typeof getMigrationReconciliation>>) {
  const rows: unknown[][] = [
    ["Section", "Item", "Agreed", "Verified", "Difference / Detail"],
    ["Review", "Inventory revision", report.inventoryVersion, "", ""],
    ["Review", "Fingerprint", "", report.fingerprint, ""],
    ["Approval", report.approval ? "APPROVED" : "NOT_APPROVED", "", report.approval?.representative ?? "", report.approval?.at ?? ""],
    ...report.rows.map((row) => ["Records", row.key, row.expected, row.present, `${row.difference}; ${row.unit}`]),
    ...report.scope.filter((row) => row.disposition !== "INCLUDE").map((row) => ["Outside approval", row.key, row.disposition, "", row.reason]),
    ...report.batches.map((batch) => ["Batch", batch.fileName, "", batch.importedRows, `${batch.skippedRows} held outside this batch; ${batch.hasEvidence ? "evidence saved" : "legacy evidence required"}`]),
    ...report.blockers.map((blocker) => ["Blocker", "Review required", "", "", blocker]),
  ];
  if (report.finance.expected) for (const key of ["gross", "discounts", "paid", "outstanding"] as const) rows.push(["Opening GHS", key, report.finance.expected[key], report.finance.actual[key], "Opening paid is a historical credit, not a new payment"]);
  return rows.map((row) => row.map((value) => {
    const raw = String(value ?? "");
    const safe = /^\s*[=+\-@]/.test(raw) || /^[\t\r\n]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replaceAll('"', '""')}"`;
  }).join(",")).join("\r\n");
}

export async function getMigrationReconciliation(schoolId: string) {
  return prisma.$transaction((tx) => buildMigrationReconciliation(schoolId, tx), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 15000, timeout: 45000 });
}

export async function approveMigrationReconciliation(schoolId: string, actorId: string, raw: unknown) {
  const input = approvalSchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    const school = await tx.$queryRaw<Array<{ id: string }>>`UPDATE "School" SET "updatedAt" = clock_timestamp() WHERE "id" = ${schoolId} RETURNING "id"`;
    if (school.length !== 1) throw new MigrationReconciliationError("School not found.");
    const report = await buildMigrationReconciliation(schoolId, tx);
    if (input.fingerprint !== report.fingerprint) throw new MigrationReconciliationError("The migration changed. Refresh and review the latest report before approval.");
    if (!report.canApprove) throw new MigrationReconciliationError("Resolve the reconciliation differences before approval.");
    if (report.approval) return report.approval;
    const approval = await tx.onboardingAuditLog.create({ data: { schoolId, performedBy: actorId, action: "MIGRATION_RECONCILIATION_APPROVED", metadata: { ...input, inventoryVersion: report.inventoryVersion, rows: report.rows, finance: report.finance, batchIds: report.batches.map((batch) => batch.id) } } });
    return { at: approval.createdAt.toISOString(), by: actorId, representative: input.representative };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 15000, timeout: 45000 });
}

export async function withApprovedMigration<T>(schoolId: string, work: (tx: Prisma.TransactionClient) => Promise<T>, requireInventory = false, expectedSteps: readonly string[] = []) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "School" WHERE "id" = ${schoolId} FOR UPDATE`;
    const school = await tx.school.findUnique({ where: { id: schoolId }, select: { code: true, onboardingStatus: true, setupStep: true, _count: { select: { grades: true, classes: true, subjects: true } } } });
    if (!school) throw new MigrationReconciliationError("School not found.");
    if (school.onboardingStatus === "COMPLETED") throw new MigrationReconciliationError("This school has already completed onboarding.");
    if (expectedSteps.length && !expectedSteps.includes(school.setupStep ?? "")) throw new MigrationReconciliationError("Complete the current setup stage before moving to this step.");
    if (expectedSteps.length && (!school.code || school._count.grades === 0 || school._count.classes === 0 || school._count.subjects === 0)) throw new MigrationReconciliationError("Complete the school identity and academic foundation before continuing setup.");
    const inventory = await getMigrationInventory(schoolId, tx);
    if ((requireInventory || school.setupStep === "migration") && !inventory) throw new MigrationReconciliationError("Confirm and reconcile the migration inventory before readiness review.");
    if (inventory) {
      try { await requireMigrationRecovery(schoolId, inventory.version, tx); }
      catch (error) {
        if (error instanceof MigrationRecoveryError) throw new MigrationReconciliationError(error.message);
        throw error;
      }
      const report = await buildMigrationReconciliation(schoolId, tx);
      if (!report.approval) throw new MigrationReconciliationError("Review and approve the latest migration reconciliation before continuing setup.");
    }
    return work(tx);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 15000, timeout: 45000 });
}
