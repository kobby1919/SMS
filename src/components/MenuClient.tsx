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
        href: "/list/attendance",
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
        icon: GraduationCap,
        label: "Exams",
        href: "/list/exams",
        visible: ["teacher"],
      },
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
    <div className="mt-4 text-sm flex flex-col gap-0.5">
      {visibleMenuItems.map((section) => {
        const visibleItems = section.items.filter((item) =>
          item.visible.includes(role),
        );
        if (visibleItems.length === 0) return null;

        return (
          <div key={section.title} className="flex flex-col gap-0.5 mb-2">
            <span className="hidden md:block text-[9px] font-black text-gray-300 uppercase tracking-[0.15em] mt-4 mb-1 px-3">
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
                    py-2.5 px-0 md:px-3 rounded-xl transition-all group
                    ${
                      isActive
                        ? "bg-jayPurpleLight text-jayPurple font-semibold"
                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                    }`}
                >
                  <span className="flex-shrink-0 flex items-center justify-center">
                    <Icon
                      size={20}
                      strokeWidth={isActive ? 2.5 : 2}
                      className={`transition-opacity ${isActive ? "opacity-100" : "opacity-60 group-hover:opacity-80"}`}
                    />
                  </span>
                  <span className="hidden md:block min-w-0 truncate text-sm">{item.label}</span>
                  {isActive && (
                    <span className="hidden md:block ml-auto w-1.5 h-1.5 rounded-full bg-jayPurple shrink-0" />
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
