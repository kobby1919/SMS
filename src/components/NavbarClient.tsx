"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  ReceiptText,
  Search,
  Settings,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import UserButtonWrapper from "./UserButtonWrapper";
import {
  markAppNotificationRead,
  markAppNotificationsRead,
} from "@/src/lib/actions/appNotificationActions";

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

type AppBellNotification = {
  id: string;
  type: string;
  category: string;
  priority: string;
  title: string;
  description: string;
  href: string;
  createdAt: string;
  readAt: string | null;
};

type NavbarClientProps = {
  user: NavUser;
  parentContext?: {
    children: ParentChild[];
  };
  appNotifications?: AppBellNotification[];
  appNotificationUnreadCount?: number;
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
    { label: "My students", description: "Students grouped by class", href: "/list/students", keywords: "students learners class profile", icon: <GraduationCap size={15} /> },
    { label: "CA records", description: "Activities and exam entry", href: "/list/ca", keywords: "ca continuous assessment scores activities", icon: <BookOpenCheck size={15} /> },
    { label: "Report cards", description: "Build exam results", href: "/list/report-cards", keywords: "report cards results exam entry", icon: <FileText size={15} /> },
    { label: "Homework", description: "Assignments", href: "/list/assignments", keywords: "homework assignments", icon: <FileText size={15} /> },
    { label: "Syllabus", description: "Curriculum progress", href: "/list/syllabus", keywords: "syllabus curriculum topics progress", icon: <BookOpenCheck size={15} /> },
    { label: "Notices", description: "School announcements", href: "/list/announcements", keywords: "notices announcements message school", icon: <BellRing size={15} /> },
    { label: "Accountability", description: "Duties and escalations", href: "/teacher/accountability", keywords: "accountability duties escalations history", icon: <Check size={15} /> },
  ],
  bursar: [
    { label: "Finance home", description: "Bursar dashboard", href: "/bursar", keywords: "bursar finance dashboard", icon: <Home size={15} /> },
    { label: "Bills", description: "Student bills", href: "/list/finance/bills", keywords: "bills fees balances outstanding", icon: <WalletCards size={15} /> },
    { label: "Payments", description: "Receipts and collections", href: "/list/finance/payments", keywords: "payments receipts collections", icon: <FileText size={15} /> },
    { label: "Receipts", description: "Official payment proof", href: "/list/finance/receipts", keywords: "receipts proof download print paid receipt number", icon: <ReceiptText size={15} /> },
    { label: "Fee Structures", description: "Term fee setup", href: "/list/finance/fee-structures", keywords: "fee structures term setup bills", icon: <WalletCards size={15} /> },
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

function parentSearchItems(children: ParentChild[], notifications: AppBellNotification[]): SearchItem[] {
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
      description: notification.category.replaceAll("_", " ").toLowerCase(),
      href: notification.href,
      keywords: `${notification.title} ${notification.description} ${notification.category}`,
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
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const matches = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return items.slice(0, mobile ? 8 : 5);
    return items
      .filter((item) => `${item.label} ${item.description} ${item.keywords}`.toLowerCase().includes(value))
      .slice(0, mobile ? 10 : 6);
  }, [items, mobile, query]);

  useEffect(() => {
    if (mobile) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [mobile]);

  const handleNavigate = () => {
    setQuery("");
    setOpen(false);
    onNavigate?.();
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-sm transition focus-within:border-blue-200 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50">
        <Search size={16} className="shrink-0 text-gray-400" />
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          placeholder="Search Edujay..."
          className="w-full min-w-0 bg-transparent text-sm font-semibold text-gray-700 outline-none placeholder:text-gray-400"
        />
      </div>
      {(mobile || open) && (
        <div className={`${mobile ? "mt-3" : "absolute left-0 top-12 z-30"} w-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl`}>
          {matches.length > 0 ? matches.map((item) => (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              onClick={handleNavigate}
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

function notificationTone(priority: string) {
  if (priority === "URGENT") return "bg-rose-600 text-white";
  if (priority === "HIGH") return "bg-amber-500 text-white";
  if (priority === "LOW") return "bg-gray-300 text-gray-700";
  return "bg-blue-600 text-white";
}

function AppNotificationBell({
  notifications,
  unreadCount,
}: {
  notifications: AppBellNotification[];
  unreadCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [localNotifications, setLocalNotifications] = useState(notifications);
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const [localUnreadCount, setLocalUnreadCount] = useState(unreadCount);


  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const markLocallyRead = (notificationIds: string[]) => {
    const now = new Date().toISOString();
    const unreadMarked = localNotifications.filter((notification) =>
      notificationIds.includes(notification.id) && !notification.readAt,
    ).length;

    setLocalNotifications((current) =>
      current.map((notification) =>
        notificationIds.includes(notification.id) ? { ...notification, readAt: notification.readAt ?? now } : notification,
      ),
    );
    setLocalUnreadCount((current) => Math.max(0, current - unreadMarked));
  };

  const openNotification = (notification: AppBellNotification) => {
    setOpen(false);
    if (!notification.readAt) {
      markLocallyRead([notification.id]);
      startTransition(async () => {
        await markAppNotificationRead(notification.id);
        router.push(notification.href);
        router.refresh();
      });
      return;
    }

    router.push(notification.href);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-100 bg-white text-gray-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
        aria-label="Open notifications"
      >
        <BellRing size={18} />
        {localUnreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-black text-white">
            {localUnreadCount > 99 ? "99+" : localUnreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 z-40 max-h-[calc(100dvh-5rem)] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[min(23rem,calc(100vw-1.5rem))]">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <p className="text-sm font-black text-gray-900">Notifications</p>
              <p className="text-xs font-semibold text-gray-400">{localUnreadCount} unread</p>
            </div>
            <button
              type="button"
              disabled={isPending || localUnreadCount === 0}
              onClick={() => {
                markLocallyRead(localNotifications.filter((notification) => !notification.readAt).map((notification) => notification.id));
                setLocalUnreadCount(0);
                startTransition(async () => {
                  await markAppNotificationsRead();
                  router.refresh();
                });
              }}
              className="rounded-full bg-gray-50 px-3 py-1.5 text-[11px] font-black text-gray-600 disabled:opacity-40"
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-[calc(100dvh-11rem)] overflow-y-auto sm:max-h-[24rem]">
            {localNotifications.length > 0 ? localNotifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => openNotification(notification)}
                className="block w-full border-b border-gray-50 px-4 py-3 text-left last:border-0 hover:bg-blue-50"
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-1 flex h-2.5 w-2.5 shrink-0 rounded-full ${notification.readAt ? "bg-gray-200" : notificationTone(notification.priority)}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="line-clamp-1 text-sm font-black text-gray-900">{notification.title}</span>
                      {!notification.readAt && (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${notificationTone(notification.priority)}`}>
                          {notification.priority.toLowerCase()}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 line-clamp-2 block whitespace-pre-line text-xs font-semibold text-gray-500">
                      {notification.description}
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-wide text-gray-400">
                      <span>{notification.category.replaceAll("_", " ")}</span>
                      <span>{formatTime(notification.createdAt)}</span>
                    </span>
                  </span>
                </div>
              </button>
            )) : (
              <div className="px-4 py-8 text-center">
                <Check className="mx-auto mb-2 text-emerald-500" size={22} />
                <p className="text-sm font-black text-gray-800">All clear</p>
                <p className="text-xs font-semibold text-gray-400">No notifications right now.</p>
              </div>
            )}
          </div>
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

const NavbarClient = ({ user, parentContext, appNotifications = [], appNotificationUnreadCount = 0 }: NavbarClientProps) => {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const pathname = usePathname();
  const isParent = user.role === "parent";
  const children = parentContext?.children ?? [];
  const searchItems = isParent
    ? parentSearchItems(children, appNotifications)
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
          <SearchBox key={`desktop-${pathname}`} items={searchItems} />
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

          {isParent && <ParentQuickActions />}
          {user.role !== "student" && (
            <AppNotificationBell
              key={`${appNotificationUnreadCount}-${appNotifications.map((notification) => `${notification.id}:${notification.readAt ?? "unread"}`).join("|")}`}
              notifications={appNotifications}
              unreadCount={appNotificationUnreadCount}
            />
          )}

          {!isParent && user.role === "student" && (
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
          <SearchBox key={`mobile-${pathname}`} items={searchItems} mobile onNavigate={() => setMobileSearchOpen(false)} />
        </div>
      )}
    </motion.header>
  );
};

export default NavbarClient;
