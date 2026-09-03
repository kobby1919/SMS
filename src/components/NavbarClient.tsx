"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BellRing,
  BookOpenCheck,
  CalendarDays,
  Check,
  ChevronDown,
  FileText,
  GraduationCap,
  Home,
  Menu,
  MessageCircle,
  Search,
  Settings,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import UserButtonWrapper from "./UserButtonWrapper";
import {
  markParentNotificationRead,
  markParentNotificationsRead,
} from "@/src/lib/actions/parentNotificationActions";

type NavUser = {
  fullName: string | null;
  role: string;
  schoolName?: string;
};

type ParentChild = {
  id: string;
  name: string;
  className: string;
};

type ParentNotification = {
  id: string;
  type: string;
  title: string;
  description: string;
  href: string;
  occurredAt: string;
  readAt: string | null;
  childName: string | null;
};

type TeacherAlert = {
  id: string;
  title: string;
  description: string;
  href: string;
  priority: string;
  status: string;
  dueAt: string;
};

type NavbarClientProps = {
  user: NavUser;
  parentContext?: {
    children: ParentChild[];
    notifications: ParentNotification[];
  };
  teacherContext?: {
    alerts: TeacherAlert[];
  };
};

type SearchItem = {
  label: string;
  description: string;
  href: string;
  keywords: string;
  icon: React.ReactNode;
};

const roleShortcuts: Record<string, SearchItem[]> = {
  admin: [
    { label: "Admin home", description: "School overview", href: "/admin", keywords: "dashboard overview home", icon: <Home size={15} /> },
    { label: "Classes", description: "Manage classes", href: "/list/classes", keywords: "classes class", icon: <GraduationCap size={15} /> },
    { label: "Attendance", description: "Track attendance records", href: "/list/attendance", keywords: "attendance absent late present", icon: <CalendarDays size={15} /> },
    { label: "Finance", description: "Bills and payments", href: "/list/finance/bills", keywords: "finance fees bills payments receipt", icon: <WalletCards size={15} /> },
    { label: "Notifications", description: "Parent notification settings", href: "/admin/notification-settings", keywords: "notifications settings summary", icon: <BellRing size={15} /> },
  ],
  teacher: [
    { label: "Teacher home", description: "Today and classes", href: "/teacher", keywords: "dashboard teacher home", icon: <Home size={15} /> },
    { label: "Take attendance", description: "Mark lessons quickly", href: "/list/attendance/take", keywords: "attendance take absent late present", icon: <CalendarDays size={15} /> },
    { label: "CA records", description: "Activities and exam entry", href: "/list/ca", keywords: "ca continuous assessment scores activities", icon: <BookOpenCheck size={15} /> },
    { label: "Homework", description: "Assignments", href: "/list/assignments", keywords: "homework assignments", icon: <FileText size={15} /> },
  ],
  bursar: [
    { label: "Finance home", description: "Bursar dashboard", href: "/bursar", keywords: "bursar finance dashboard", icon: <Home size={15} /> },
    { label: "Bills", description: "Student bills", href: "/list/finance/bills", keywords: "bills fees balances", icon: <WalletCards size={15} /> },
    { label: "Payments", description: "Receipts and collections", href: "/list/finance/payments", keywords: "payments receipts collections", icon: <FileText size={15} /> },
  ],
  student: [
    { label: "Student home", description: "Academic overview", href: "/student", keywords: "student home dashboard", icon: <Home size={15} /> },
    { label: "Results", description: "Report cards", href: "/list/report-cards", keywords: "results report card", icon: <BookOpenCheck size={15} /> },
    { label: "Homework", description: "Assignments", href: "/list/assignments", keywords: "homework assignments", icon: <FileText size={15} /> },
  ],
  platform_admin: [
    { label: "Onboarding", description: "School requests", href: "/platform/onboarding", keywords: "platform onboarding schools", icon: <Home size={15} /> },
  ],
};

const formatTime = (value: string) =>
  new Date(value).toLocaleString("en-GH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function parentSearchItems(children: ParentChild[], notifications: ParentNotification[]): SearchItem[] {
  return [
    { label: "Parent home", description: "Simple ward overview", href: "/parent", keywords: "home dashboard wards children", icon: <Home size={15} /> },
    { label: "Today", description: "Daily school update", href: "/parent/updates", keywords: "today daily weekly update notification", icon: <BellRing size={15} /> },
    { label: "Fees", description: "Bills, balances, and receipts", href: "/parent/finance", keywords: "fees bills finance payments receipt balance", icon: <WalletCards size={15} /> },
    { label: "Results", description: "Report-card progress", href: "/list/report-cards", keywords: "results report card ca assessment", icon: <BookOpenCheck size={15} /> },
    { label: "Preferences", description: "Notification delivery settings", href: "/parent/updates#preferences", keywords: "preferences email sms whatsapp notifications", icon: <Settings size={15} /> },
    ...children.map((child) => ({
      label: child.name,
      description: `Open ${child.className} ward checkup`,
      href: `/parent/children/${child.id}`,
      keywords: `${child.name} ${child.className} ward child attendance ca fees results homework`,
      icon: <UserRound size={15} />,
    })),
    ...notifications.slice(0, 5).map((notification) => ({
      label: notification.title,
      description: notification.childName ?? "School update",
      href: notification.href,
      keywords: `${notification.title} ${notification.description} ${notification.childName ?? ""}`,
      icon: <BellRing size={15} />,
    })),
  ];
}

function SearchBox({
  items,
  mobile = false,
  onNavigate,
}: {
  items: SearchItem[];
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return items.slice(0, mobile ? 8 : 5);
    return items
      .filter((item) => `${item.label} ${item.description} ${item.keywords}`.toLowerCase().includes(value))
      .slice(0, mobile ? 10 : 6);
  }, [items, mobile, query]);

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-sm transition focus-within:border-blue-200 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50">
        <Search size={16} className="shrink-0 text-gray-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search Edujay..."
          className="w-full min-w-0 bg-transparent text-sm font-semibold text-gray-700 outline-none placeholder:text-gray-400"
        />
      </div>
      {(query || mobile) && (
        <div className={`${mobile ? "mt-3" : "absolute left-0 top-12 z-30"} w-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl`}>
          {matches.length > 0 ? matches.map((item) => (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              onClick={onNavigate}
              className="flex items-center gap-3 border-b border-gray-50 px-3 py-3 last:border-0 hover:bg-blue-50"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-500">
                {item.icon}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-gray-800">{item.label}</span>
                <span className="block truncate text-xs font-semibold text-gray-400">{item.description}</span>
              </span>
            </Link>
          )) : (
            <p className="px-4 py-5 text-sm font-semibold text-gray-400">No matching shortcut found.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ParentBell({ notifications }: { notifications: ParentNotification[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-100 bg-white text-gray-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
        aria-label="Open parent notifications"
      >
        <BellRing size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-black text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-40 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <p className="text-sm font-black text-gray-900">Parent updates</p>
              <p className="text-xs font-semibold text-gray-400">{unreadCount} unread</p>
            </div>
            <button
              type="button"
              disabled={isPending || unreadCount === 0}
              onClick={() => startTransition(() => markParentNotificationsRead())}
              className="rounded-full bg-gray-50 px-3 py-1.5 text-[11px] font-black text-gray-600 disabled:opacity-40"
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-[24rem] overflow-y-auto">
            {notifications.length > 0 ? notifications.map((notification) => (
              <Link
                key={notification.id}
                href={notification.href}
                onClick={() => {
                  setOpen(false);
                  if (!notification.readAt) {
                    startTransition(() => markParentNotificationRead(notification.id));
                  }
                }}
                className="block border-b border-gray-50 px-4 py-3 last:border-0 hover:bg-blue-50"
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notification.readAt ? "bg-gray-200" : "bg-blue-600"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-gray-900">{notification.title}</span>
                    <span className="mt-1 line-clamp-2 block whitespace-pre-line text-xs font-semibold text-gray-500">
                      {notification.description}
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-wide text-gray-400">
                      {notification.childName && <span>{notification.childName}</span>}
                      <span>{formatTime(notification.occurredAt)}</span>
                    </span>
                  </span>
                </div>
              </Link>
            )) : (
              <div className="px-4 py-8 text-center">
                <Check className="mx-auto mb-2 text-emerald-500" size={22} />
                <p className="text-sm font-black text-gray-800">All clear</p>
                <p className="text-xs font-semibold text-gray-400">No parent updates yet.</p>
              </div>
            )}
          </div>
          <Link
            href="/parent/updates"
            onClick={() => setOpen(false)}
            className="block border-t border-gray-100 bg-gray-50 px-4 py-3 text-center text-xs font-black text-blue-700"
          >
            View all updates
          </Link>
        </div>
      )}
    </div>
  );
}

function ParentQuickActions() {
  const [open, setOpen] = useState(false);
  const actions = [
    { label: "Today", href: "/parent/updates", icon: <BellRing size={15} /> },
    { label: "Fees", href: "/parent/finance", icon: <WalletCards size={15} /> },
    { label: "Results", href: "/list/report-cards", icon: <BookOpenCheck size={15} /> },
    { label: "Message school", href: "/parent/updates#preferences", icon: <MessageCircle size={15} /> },
  ];

  return (
    <div className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 items-center gap-2 rounded-full border border-gray-100 bg-white px-3 text-xs font-black text-gray-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
      >
        Quick actions
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-30 w-52 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 border-b border-gray-50 px-4 py-3 text-sm font-bold text-gray-700 last:border-0 hover:bg-blue-50"
            >
              <span className="text-gray-400">{action.icon}</span>
              {action.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function TeacherBell({ alerts }: { alerts: TeacherAlert[] }) {
  const urgentCount = alerts.filter((alert) =>
    ["HIGH", "CRITICAL"].includes(alert.priority) ||
    ["MISSED", "ESCALATED"].includes(alert.status),
  ).length;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (alerts.length === 0) return;
    const timer = window.setTimeout(() => setOpen(true), 0);
    return () => window.clearTimeout(timer);
  }, [alerts.length]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-100 bg-white text-gray-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
        aria-label="Open teacher alerts"
      >
        <BellRing size={18} />
        {alerts.length > 0 && (
          <span className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black text-white ${urgentCount > 0 ? "bg-rose-600" : "bg-indigo-600"}`}>
            {alerts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-40 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-black text-gray-900">Teacher alerts</p>
            <p className="text-xs font-semibold text-gray-400">
              {alerts.length > 0 ? `${alerts.length} active item${alerts.length === 1 ? "" : "s"} today` : "No urgent duty is waiting"}
            </p>
          </div>
          <div className="max-h-[24rem] overflow-y-auto">
            {alerts.length > 0 ? alerts.map((alert) => (
              <Link
                key={alert.id}
                href={alert.href}
                onClick={() => setOpen(false)}
                className="block border-b border-gray-50 px-4 py-3 last:border-0 hover:bg-indigo-50"
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${["HIGH", "CRITICAL"].includes(alert.priority) ? "bg-rose-600" : "bg-indigo-600"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-gray-900">{alert.title}</span>
                    <span className="mt-1 whitespace-pre-line text-xs font-semibold text-gray-500">
                      {alert.description}
                    </span>
                    <span className="mt-2 block text-[10px] font-black uppercase tracking-wide text-gray-400">
                      {alert.status.replaceAll("_", " ")} - {formatTime(alert.dueAt)}
                    </span>
                  </span>
                </div>
              </Link>
            )) : (
              <div className="px-4 py-8 text-center">
                <Check className="mx-auto mb-2 text-emerald-500" size={22} />
                <p className="text-sm font-black text-gray-800">All clear</p>
                <p className="text-xs font-semibold text-gray-400">No teacher alerts right now.</p>
              </div>
            )}
          </div>
          <Link
            href="/teacher/accountability"
            onClick={() => setOpen(false)}
            className="block border-t border-gray-100 bg-gray-50 px-4 py-3 text-center text-xs font-black text-indigo-700"
          >
            Open accountability
          </Link>
        </div>
      )}
    </div>
  );
}

const NavbarClient = ({ user, parentContext, teacherContext }: NavbarClientProps) => {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const isParent = user.role === "parent";
  const isTeacher = user.role === "teacher";
  const children = parentContext?.children ?? [];
  const notifications = parentContext?.notifications ?? [];
  const teacherAlerts = teacherContext?.alerts ?? [];
  const searchItems = isParent
    ? parentSearchItems(children, notifications)
    : roleShortcuts[user.role] ?? roleShortcuts.admin;
  const contextLabel = isParent
    ? children.length === 0
      ? "No ward linked"
      : children.length === 1
        ? children[0].name
        : `${children.length} wards`
    : user.schoolName ?? "Edujay";

  return (
    <motion.header
      suppressHydrationWarning
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 px-3 py-3 backdrop-blur sm:px-4 lg:px-6"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-gray-900 sm:text-base">
            {isParent ? contextLabel : user.schoolName ?? "Edujay"}
          </p>
          <p className="truncate text-[11px] font-bold capitalize text-gray-400">
            {isParent ? user.schoolName ?? "Edujay" : user.role.replace("_", " ")}
          </p>
        </div>

        <div className="hidden min-w-[16rem] max-w-md flex-1 md:block">
          <SearchBox items={searchItems} />
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setMobileSearchOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-100 bg-white text-gray-600 shadow-sm md:hidden"
            aria-label="Open search"
          >
            <Search size={18} />
          </button>

          {isParent ? (
            <>
              <ParentQuickActions />
              <ParentBell notifications={notifications} />
            </>
          ) : isTeacher ? (
            <>
              <TeacherBell alerts={teacherAlerts} />
              <Link
                href={searchItems[0]?.href ?? "/teacher"}
                className="hidden h-10 items-center gap-2 rounded-full border border-gray-100 bg-white px-3 text-xs font-black text-gray-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 sm:flex"
              >
                <Menu size={15} />
                Shortcuts
              </Link>
            </>
          ) : (
            <Link
              href={searchItems[0]?.href ?? `/${user.role}`}
              className="hidden h-10 items-center gap-2 rounded-full border border-gray-100 bg-white px-3 text-xs font-black text-gray-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 sm:flex"
            >
              <Menu size={15} />
              Shortcuts
            </Link>
          )}

          <div className="hidden h-8 w-px bg-gray-100 sm:block" />

          <div className="hidden min-w-0 flex-col items-end sm:flex">
            <span className="max-w-36 truncate text-xs font-black text-gray-800">
              {user.fullName || "User"}
            </span>
            <span className="text-[10px] font-bold capitalize text-gray-400">
              {user.role.replace("_", " ")}
            </span>
          </div>

          <div className="flex items-center rounded-full border border-gray-100 bg-white px-1.5 py-1 shadow-sm">
            <UserButtonWrapper />
          </div>
        </div>
      </div>

      {mobileSearchOpen && (
        <div className="fixed inset-0 z-50 bg-white p-4 md:hidden">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-base font-black text-gray-900">Search</p>
              <p className="text-xs font-semibold text-gray-400">{contextLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => setMobileSearchOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-gray-600"
              aria-label="Close search"
            >
              <X size={18} />
            </button>
          </div>
          <SearchBox items={searchItems} mobile onNavigate={() => setMobileSearchOpen(false)} />
        </div>
      )}
    </motion.header>
  );
};

export default NavbarClient;
