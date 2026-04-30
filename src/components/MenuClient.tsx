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
  MessageSquare,
  Megaphone,
  Wallet,
  Settings,
  LogOut,
  SlidersHorizontal,
  Star,
  ScrollText,
} from "lucide-react";

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
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: MessageSquare,
        label: "Messages",
        href: "/list/messages",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: Megaphone,
        label: "Announcements",
        href: "/list/announcements",
        visible: ["admin", "teacher", "student", "parent"],
      },
    ],
  },
  {
    title: "Finance",
    items: [
      {
        icon: Wallet,
        label: "Fees & Payments",
        href: "/list/finance",
        visible: ["admin"],
      },
    ],
  },
  {
    title: "Other",
    items: [
      {
        icon: UserCircle,
        label: "Profile",
        href: "/profile",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: Settings,
        label: "Settings",
        href: "/settings",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: LogOut,
        label: "Logout",
        href: "/logout",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: SlidersHorizontal,
        label: "CA Settings",
        href: "/admin/ca-config",
        visible: ["admin"],
      },
    ],
  },
];

const MenuClient = ({ role }: { role: string }) => {
  const pathname = usePathname();

  return (
    <div className="mt-4 text-sm flex flex-col gap-0.5">
      {menuItems.map((section) => {
        const visibleItems = section.items.filter((item) =>
          item.visible.includes(role),
        );
        if (visibleItems.length === 0) return null;

        return (
          <div key={section.title} className="flex flex-col gap-0.5 mb-2">
            <span className="hidden lg:block text-[9px] font-black text-gray-300 uppercase tracking-[0.15em] mt-4 mb-1 px-3">
              {section.title}
            </span>
            <div className="lg:hidden border-t border-gray-100 my-2 mx-2" />

            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/admin" &&
                  item.href !== "/teacher" &&
                  item.href !== "/student" &&
                  item.href !== "/parent" &&
                  pathname.startsWith(item.href));

              return (
                <Link
                  href={item.href}
                  key={item.label + item.href}
                  className={`flex items-center justify-center lg:justify-start gap-3
                    py-2.5 px-0 lg:px-3 rounded-xl transition-all group
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
                  <span className="hidden lg:block text-sm">{item.label}</span>
                  {isActive && (
                    <span className="hidden lg:block ml-auto w-1.5 h-1.5 rounded-full bg-jayPurple" />
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
