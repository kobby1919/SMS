// src/app/(dashboard)/list/finance/bills/page.tsx
// All student bills — filterable by class, status, term, year.
// Bursar and admin only.

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import prisma from "@/src/lib/prisma";
import Link from "next/link";
import {
  FileText, ChevronRight, Search,
} from "lucide-react";
import {
  formatGHS,
  BILL_STATUS_STYLES,
} from "@/src/lib/constants/finance";
import { ITEM_PER_PAGE } from "@/src/lib/settings";
import Pagination from "@/src/components/pagination";

export const dynamic = "force-dynamic";

const TERM_LABELS: Record<string, string> = {
  TERM_1: "Term 1", TERM_2: "Term 2", TERM_3: "Term 3",
};

const BillsPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) => {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin" && role !== "bursar") redirect("/");

  const sp              = await searchParams;
  const page            = sp.page ? parseInt(sp.page) : 1;
  const filterStatus    = sp.status      as string | undefined;
  const filterClass     = sp.classId     ? parseInt(sp.classId)     : undefined;
  const filterStructure = sp.structureId ? parseInt(sp.structureId) : undefined;
  const filterYear      = sp.year        as string | undefined;
  const filterTerm      = sp.term        as string | undefined;
  const search          = sp.search      as string | undefined;

  // Build query
  const where: any = {};
  if (filterStatus)    where.status         = filterStatus;
  if (filterStructure) where.feeStructureId = filterStructure;
  if (filterYear || filterTerm) {
    where.feeStructure = {};
    if (filterYear) where.feeStructure.academicYear = filterYear;
    if (filterTerm) where.feeStructure.term         = filterTerm;
  }
  if (filterClass) {
    where.student = { classId: filterClass };
  }
  if (search) {
    where.student = {
      ...where.student,
      OR: [
        { name:    { contains: search, mode: "insensitive" } },
        { surname: { contains: search, mode: "insensitive" } },
      ],
    };
  }

  const [bills, count, classes, structures] = await Promise.all([
    prisma.studentBill.findMany({
      where,
      include: {
        student: {
          select: {
            name:    true,
            surname: true,
            img:     true,
            class:   { select: { name: true } },
          },
        },
        feeStructure: {
          select: { title: true, term: true, academicYear: true },
        },
        payments: {
          where:   { status: "CONFIRMED" },
          select:  { amount: true },
        },
      },
      orderBy: [
        { status: "asc" },
        { balance: "desc" },
      ],
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (page - 1),
    }),
    prisma.studentBill.count({ where }),
    prisma.class.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.feeStructure.findMany({
      where:   { status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      select:  { id: true, title: true },
    }),
  ]);

  // Summary stats
  const [unpaidCount, partialCount, paidCount, totalOutstanding] = await Promise.all([
    prisma.studentBill.count({ where: { ...where, status: "UNPAID"  } }),
    prisma.studentBill.count({ where: { ...where, status: "PARTIAL" } }),
    prisma.studentBill.count({ where: { ...where, status: "PAID"    } }),
    prisma.studentBill.aggregate({
      where:  { ...where, status: { in: ["UNPAID", "PARTIAL"] } },
      _sum:   { balance: true },
    }),
  ]);

  const outstanding = totalOutstanding._sum.balance ?? 0;

  return (
    <div className="flex-1 m-4 mt-0 flex flex-col gap-4">

      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-indigo-50 rounded-2xl flex items-center justify-center shrink-0">
              <FileText size={20} className="text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-800 tracking-tight">Student Bills</h1>
              <p className="text-sm text-gray-400 mt-0.5 font-medium">
                {count} bills · {formatGHS(outstanding)} outstanding
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Unpaid",  count: unpaidCount,  status: "UNPAID"  },
          { label: "Partial", count: partialCount, status: "PARTIAL" },
          { label: "Paid",    count: paidCount,    status: "PAID"    },
          { label: "All",     count,               status: ""        },
        ].map((s) => {
          const style = s.status ? BILL_STATUS_STYLES[s.status] : { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-100", label: "All" };
          return (
            <Link
              key={s.label}
              href={s.status ? `/list/finance/bills?status=${s.status}` : "/list/finance/bills"}
              className={`rounded-2xl p-4 border text-center transition-all hover:shadow-sm ${style.bg} ${style.border}
                ${filterStatus === s.status ? "ring-2 ring-indigo-400" : ""}`}
            >
              <p className={`text-2xl font-black leading-none ${style.text}`}>{s.count}</p>
              <p className={`text-[10px] font-black uppercase tracking-wider mt-1 ${style.text} opacity-70`}>{s.label}</p>
            </Link>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <form className="flex flex-wrap gap-2 items-center">
          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              name="search"
              defaultValue={search ?? ""}
              placeholder="Search student…"
              className="pl-8 pr-3 py-2 ring-[1.5px] ring-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:ring-indigo-500 outline-none w-44"
            />
          </div>

          <select name="status" defaultValue={filterStatus ?? ""} className="appearance-none ring-[1.5px] ring-gray-200 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 outline-none bg-white">
            <option value="">All Status</option>
            {Object.entries(BILL_STATUS_STYLES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          <select name="classId" defaultValue={filterClass ?? ""} className="appearance-none ring-[1.5px] ring-gray-200 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 outline-none bg-white">
            <option value="">All Classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select name="structureId" defaultValue={filterStructure ?? ""} className="appearance-none ring-[1.5px] ring-gray-200 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 outline-none bg-white">
            <option value="">All Structures</option>
            {structures.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>

          <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors">
            Apply
          </button>
          <Link href="/list/finance/bills" className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors">
            Clear
          </Link>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">
            {count} bills found
          </p>
        </div>

        {bills.length === 0 ? (
          <div className="py-16 text-center">
            <FileText size={28} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-400">No bills found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {bills.map((bill) => {
              const style = BILL_STATUS_STYLES[bill.status];
              const paidSoFar = bill.payments.reduce((s, p) => s + Number(p.amount), 0);

              return (
                <Link
                  key={bill.id}
                  href={`/list/finance/bills/${bill.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors group"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-sm font-black text-indigo-600 shrink-0">
                    {bill.student.img
                      ? <img src={bill.student.img} alt="" className="w-full h-full object-cover rounded-xl" />
                      : `${bill.student.name[0]}${bill.student.surname[0]}`
                    }
                  </div>

                  {/* Student info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-gray-800">
                      {bill.student.surname} {bill.student.name}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {bill.student.class?.name} · {TERM_LABELS[bill.feeStructure.term]} {bill.feeStructure.academicYear}
                    </p>
                  </div>

                  {/* Amounts */}
                  <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0">
                    <p className="text-xs text-gray-400">Total</p>
                    <p className="text-sm font-black text-gray-800">{formatGHS(bill.totalAmount)}</p>
                  </div>

                  <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0">
                    <p className="text-xs text-gray-400">Paid</p>
                    <p className="text-sm font-black text-emerald-700">{formatGHS(paidSoFar)}</p>
                  </div>

                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <p className="text-xs text-gray-400">Balance</p>
                    <p className="text-sm font-black text-rose-600">{formatGHS(bill.balance)}</p>
                  </div>

                  {/* Status badge */}
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-xl border shrink-0 ${style.bg} ${style.text} ${style.border}`}>
                    {style.label}
                  </span>

                  <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
                </Link>
              );
            })}
          </div>
        )}

        <div className="border-t border-gray-100">
          <Pagination page={page} count={count} />
        </div>
      </div>
    </div>
  );
};

export default BillsPage;