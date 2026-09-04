"use client";

// src/components/MenuClient.tsx
// Updated to include Syllabus and CA links for all relevant roles.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserCircle,
  UsersRound,
  School,
  BookOpen,
  CalendarDays,
  BookMarked,
  GraduationCap,
  ClipboardList,
  FileCheck,
  UserCheck,
  FileText,
  Megaphone,
  Wallet,
  SlidersHorizontal,
  Star,
  ScrollText,
  BellRing,
  ShieldCheck,
} from "lucide-react";

const parentMenuItems = [
  {
    title: "Parent",
    items: [
      {
        icon: LayoutDashboard,
        label: "Home",
        href: "/parent",
        visible: ["parent"],
      },
      {
        icon: BellRing,
        label: "Today",
        href: "/parent/updates",
        visible: ["parent"],
      },
      {
        icon: Wallet,
        label: "Fees",
        href: "/parent/finance",
        visible: ["parent"],
      },
      {
        icon: FileText,
        label: "Results",
        href: "/list/report-cards",
        visible: ["parent"],
      },
    ],
  },
];

const teacherMenuItems = [
  {
    title: "Work",
    items: [
      {
        icon: LayoutDashboard,
        label: "Dashboard",
        href: "/teacher",
        visible: ["teacher"],
      },
      {
        icon: UserCheck,
        label: "Attendance",
        href: "/list/attendance/take",
        visible: ["teacher"],
      },
      {
        icon: Star,
        label: "Assessment",
        href: "/list/ca",
        visible: ["teacher"],
      },
      {
        icon: ClipboardList,
        label: "Homework",
        href: "/list/assignments",
        visible: ["teacher"],
      },
      {
        icon: ShieldCheck,
        label: "Accountability",
        href: "/teacher/accountability",
        visible: ["teacher"],
      },
    ],
  },
  {
    title: "Classroom",
    items: [
      {
        icon: UsersRound,
        label: "Students",
        href: "/list/students",
        visible: ["teacher"],
      },
      {
        icon: ScrollText,
        label: "Syllabus",
        href: "/list/syllabus",
        visible: ["teacher"],
      },
      {
        icon: FileText,
        label: "Report Cards",
        href: "/list/report-cards",
        visible: ["teacher"],
      },
    ],
  },
  {
    title: "School",
    items: [
      {
        icon: Megaphone,
        label: "Notices",
        href: "/list/announcements",
        visible: ["teacher"],
      },
    ],
  },
];

const menuItems = [
  {
    title: "Overview",
    items: [
      {
        icon: LayoutDashboard,
        label: "Dashboard",
        href: "/admin",
        visible: ["admin"],
      },
      {
        icon: LayoutDashboard,
        label: "Dashboard",
        href: "/teacher",
        visible: ["teacher"],
      },
      {
        icon: LayoutDashboard,
        label: "Dashboard",
        href: "/student",
        visible: ["student"],
      },
      {
        icon: LayoutDashboard,
        label: "Dashboard",
        href: "/parent",
        visible: ["parent"],
      },
      {
        icon: BellRing,
        label: "Daily Updates",
        href: "/parent/updates",
        visible: ["parent"],
      },
      {
        icon: LayoutDashboard,
        label: "Dashboard",
        href: "/bursar",
        visible: ["bursar"],
      },
    ],
  },
  {
    title: "Management",
    items: [
      {
        icon: Users,
        label: "Teachers",
        href: "/list/teachers",
        visible: ["admin", "teacher"],
      },
      {
        icon: UsersRound,
        label: "Students",
        href: "/list/students",
        visible: ["admin", "teacher"],
      },
      {
        icon: UserCircle,
        label: "Parents",
        href: "/list/parents",
        visible: ["admin", "teacher"],
      },
      {
        icon: School,
        label: "Classes",
        href: "/list/classes",
        visible: ["admin", "teacher"],
      },
      {
        icon: BookOpen,
        label: "Subjects",
        href: "/list/subjects",
        visible: ["admin"],
      },
    ],
  },
  {
    title: "Academic",
    items: [
      {
        icon: CalendarDays,
        label: "Timetable",
        href: "/admin/timetable",
        visible: ["admin"],
      },
      {
        icon: BookMarked,
        label: "Lessons",
        href: "/list/lessons",
        visible: ["admin", "teacher"],
      },
      {
        icon: ScrollText,
        label: "Syllabus",
        href: "/list/syllabus",
        visible: ["admin", "teacher"],
      },
      {
        icon: GraduationCap,
        label: "Exams",
        href: "/list/exams",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: ClipboardList,
        label: "Assignments",
        href: "/list/assignments",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: FileCheck,
        label: "Results",
        href: "/list/results",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: UserCheck,
        label: "Attendance",
        href: "/list/attendance",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: Star,
        label: "Continuous Assessment",
        href: "/list/ca",
        visible: ["admin", "teacher"],
      },
      {
        icon: FileText,
        label: "Report Cards",
        href: "/list/report-cards",
        visible: ["admin", "teacher", "student", "parent"],
      },
    ],
  },
  {
    title: "Communication",
    items: [
      {
        icon: CalendarDays,
        label: "Events",
        href: "/list/events",
        visible: ["admin"],
      },
      {
        icon: Megaphone,
        label: "Announcements",
        href: "/list/announcements",
        visible: ["admin"],
      },
    ],
  },
  {
    title: "Finance",
    items: [
      {
        icon: Wallet,
        label: "Fees & Payments",
        href: "/list/finance/payments",
        visible: ["admin", "bursar"],
      },
      {
        icon: Wallet,
        label: "My Fees",
        href: "/parent/finance",
        visible: ["parent"],
      },
    ],
  },
  {
    title: "Other",
    items: [
      {
        icon: SlidersHorizontal,
        label: "CA Settings",
        href: "/admin/ca-config",
        visible: ["admin"],
      },
      {
        icon: BellRing,
        label: "Parent Notifications",
        href: "/admin/notification-settings",
        visible: ["admin"],
      },
      {
        icon: ShieldCheck,
        label: "Teacher Accountability",
        href: "/admin/accountability",
        visible: ["admin"],
      },
      {
        icon: SlidersHorizontal,
        label: "Accountability Settings",
        href: "/admin/accountability-settings",
        visible: ["admin"],
      },
    ],
  },
];

const MenuClient = ({ role }: { role: string }) => {
  const pathname = usePathname();
  const visibleMenuItems =
    role === "parent" ? parentMenuItems :
    role === "teacher" ? teacherMenuItems :
    menuItems;

  return (
    <div className="mt-4 flex flex-col gap-1 text-[0.95rem]">
      {visibleMenuItems.map((section) => {
        const visibleItems = section.items.filter((item) =>
          item.visible.includes(role),
        );
        if (visibleItems.length === 0) return null;

        return (
          <div key={section.title} className="mb-3 flex flex-col gap-1">
            <span className="hidden md:block px-3 pt-4 pb-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-gray-400">
              {section.title}
            </span>
            <div className="md:hidden border-t border-gray-100 my-2 mx-2" />

            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/admin" &&
                  item.href !== "/teacher" &&
                  item.href !== "/student" &&
                  item.href !== "/parent" &&
                  item.href !== "/bursar" &&
                  pathname.startsWith(item.href));

              return (
                <Link
                  href={item.href}
                  key={item.label + item.href}
                  className={`flex items-center justify-center md:justify-start gap-3
                    min-h-11 py-2.5 px-0 md:px-3.5 rounded-xl transition-all group
                    ${
                      isActive
                        ? "bg-slate-950 text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-950"
                    }`}
                >
                  <span className="flex-shrink-0 flex items-center justify-center">
                    <Icon
                      size={21}
                      strokeWidth={isActive ? 2.6 : 2.2}
                      className={`transition-opacity ${isActive ? "opacity-100" : "opacity-75 group-hover:opacity-100"}`}
                    />
                  </span>
                  <span className="hidden min-w-0 truncate text-[0.94rem] font-extrabold md:block">{item.label}</span>
                  {isActive && (
                    <span className="hidden h-1.5 w-1.5 shrink-0 rounded-full bg-white md:ml-auto md:block" />
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export default MenuClient;
