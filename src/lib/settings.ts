// src/lib/settings.ts

export const ITEM_PER_PAGE = 10;

type RouteAccessMap = {
  [key: string]: string[];
};

export const routeAccessMap: RouteAccessMap = {
  "/admin(.*)":               ["admin"],
  "/student(.*)":             ["student"],
  "/teacher(.*)":             ["teacher"],
  "/parent(.*)":              ["parent"],
  "/list/teachers(.*)":       ["admin", "teacher"],
  "/list/students(.*)":       ["admin", "teacher"],
  "/list/parents(.*)":        ["admin", "teacher"],
  "/list/subjects(.*)":       ["admin"],
  "/list/classes(.*)":        ["admin", "teacher"],
  "/list/lessons(.*)":        ["admin", "teacher"],
  "/list/exams(.*)":          ["admin", "teacher", "student", "parent"],
  "/list/assignments(.*)":    ["admin", "teacher", "student", "parent"],
  "/list/results(.*)":        ["admin", "teacher", "student", "parent"],
  "/list/attendance(.*)":     ["admin", "teacher", "student", "parent"],
  "/list/events(.*)":         ["admin", "teacher", "student", "parent"],
  "/list/announcements(.*)":  ["admin", "teacher", "student", "parent"],
  // ── Continuous Assessment ─────────────────────────────────────────────────
  "/list/ca(.*)":             ["admin", "teacher"],
  "/admin/ca-config(.*)":     ["admin"],
  // ── Report Cards ─────────────────────────────────────────────────────────
  // List (class overview) — teacher and admin only
  "/list/report-cards":       ["admin", "teacher", "student", "parent"],
  // Individual card — all roles (auth guard inside the page handles scoping)
  "/list/report-cards/(.*)":  ["admin", "teacher", "student", "parent"],
};