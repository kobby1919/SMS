// src/lib/settings.ts

export const ITEM_PER_PAGE = 10;

type RouteAccessMap = { [key: string]: string[] };

export const routeAccessMap: RouteAccessMap = {
  // ── Role dashboards ───────────────────────────────────────────────────────
  "/platform(.*)":                ["platform_admin"],
  "/admin(.*)":                   ["admin"],
  "/student(.*)":                 ["student"],
  "/teacher(.*)":                 ["teacher"],
  "/parent(.*)":                  ["parent"],

  // ── Bursar dashboard ──────────────────────────────────────────────────────
  // Bursar gets their own dashboard — no access to academic management
  "/bursar(.*)":                  ["bursar", "admin"],

  // ── People management ─────────────────────────────────────────────────────
  "/list/teachers(.*)":           ["admin", "teacher"],
  "/list/students(.*)":           ["admin", "teacher", "bursar"],
  "/list/parents(.*)":            ["admin", "teacher", "bursar"],
  "/list/subjects(.*)":           ["admin"],
  "/list/classes(.*)":            ["admin", "teacher"],
  "/list/lessons(.*)":            ["admin", "teacher"],

  // ── Academic features ─────────────────────────────────────────────────────
  "/list/exams(.*)":              ["admin", "teacher", "student", "parent"],
  "/list/assignments(.*)":        ["admin", "teacher", "student", "parent"],
  "/list/results(.*)":            ["admin", "teacher", "student", "parent"],
  "/list/attendance(.*)":         ["admin", "teacher", "student", "parent"],
  "/list/events(.*)":             ["admin", "teacher", "student", "parent"],
  "/list/announcements(.*)":      ["admin", "teacher", "student", "parent"],
  "/list/ca(.*)":                 ["admin", "teacher"],
  "/admin/ca-config(.*)":         ["admin"],
  "/list/report-cards":           ["admin", "teacher"],
  "/list/report-cards/(.*)":      ["admin", "teacher", "student", "parent"],
  "/list/syllabus":               ["admin", "teacher"],
  "/list/syllabus/new":           ["admin"],
  "/list/syllabus/(.*)/edit":     ["admin"],
  "/list/syllabus/(.*)":          ["admin", "teacher"],

  // ── Finance ───────────────────────────────────────────────────────────────
  // Main finance dashboard
  "/list/finance":                ["admin", "bursar"],

  // Fee structures — bursar manages, admin oversees
  "/list/finance/fee-structures":           ["admin", "bursar"],
  "/list/finance/fee-structures/new":       ["admin", "bursar"],
  "/list/finance/fee-structures/(.*)":      ["admin", "bursar"],

  // Bills — bursar manages
  "/list/finance/bills":                    ["admin", "bursar"],
  "/list/finance/bills/(.*)":               ["admin", "bursar"],

  // Payments — bursar records, admin views
  "/list/finance/payments":                 ["admin", "bursar"],
  "/list/finance/payments/(.*)":            ["admin", "bursar"],

  // Discounts — both can view, both can apply (audit tracked)
  "/list/finance/discounts":                ["admin", "bursar"],

  // Reports — both can view and export
  "/list/finance/reports":                  ["admin", "bursar"],

  // Audit log — admin only (bursar cannot see who did what)
  "/list/finance/audit":                    ["admin"],

  // API routes for finance PDF / Excel exports
  "/api/finance/(.*)":                      ["admin", "bursar"],
};
