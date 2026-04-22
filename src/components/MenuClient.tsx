"use client";

// src/components/MenuClient.tsx

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const menuItems = [
  {
    title: "Overview",
    items: [
      {
        icon: "/home.png",
        label: "Dashboard",
        href: "/admin",
        visible: ["admin"],
      },
      {
        icon: "/home.png",
        label: "Dashboard",
        href: "/teacher",
        visible: ["teacher"],
      },
      {
        icon: "/home.png",
        label: "Dashboard",
        href: "/student",
        visible: ["student"],
      },
      {
        icon: "/home.png",
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
        icon: "/teacher.png",
        label: "Teachers",
        href: "/list/teachers",
        visible: ["admin", "teacher"],
      },
      {
        icon: "/student.png",
        label: "Students",
        href: "/list/students",
        visible: ["admin", "teacher"],
      },
      {
        icon: "/parent.png",
        label: "Parents",
        href: "/list/parents",
        visible: ["admin", "teacher"],
      },
      {
        icon: "/class.png",
        label: "Classes",
        href: "/list/classes",
        visible: ["admin", "teacher"],
      },
      {
        icon: "/subject.png",
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
        icon: "/calendar.png",
        label: "Timetable",
        href: "/admin/timetable",
        visible: ["admin"],
      },
      {
        icon: "/lesson.png",
        label: "Lessons",
        href: "/list/lessons",
        visible: ["admin", "teacher"],
      },
      {
        icon: "/exam.png",
        label: "Exams",
        href: "/list/exams",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: "/assignment.png",
        label: "Assignments",
        href: "/list/assignments",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: "/result.png",
        label: "Results",
        href: "/list/results",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: "/attendance.png",
        label: "Attendance",
        href: "/list/attendance",
        visible: ["admin", "teacher", "student", "parent"],
      },
    ],
  },
  {
    title: "Communication",
    items: [
      {
        icon: "/calendar.png",
        label: "Events",
        href: "/list/events",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: "/message.png",
        label: "Messages",
        href: "/list/messages",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: "/announcement.png",
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
        icon: "/result.png",
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
        icon: "/profile.png",
        label: "Profile",
        href: "/profile",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: "/setting.png",
        label: "Settings",
        href: "/settings",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: "/logout.png",
        label: "Logout",
        href: "/logout",
        visible: ["admin", "teacher", "student", "parent"],
      },
    ],
  },
];

const MenuClient = ({ role }: { role: string }) => {
  const pathname = usePathname();

  return (
    <div className="mt-4 text-sm flex flex-col gap-0.5">
      {menuItems.map((section) => {
        // Filter items visible to this role
        const visibleItems = section.items.filter((item) =>
          item.visible.includes(role)
        );

        // Skip entire section if no items are visible
        if (visibleItems.length === 0) return null;

        return (
          <div key={section.title} className="flex flex-col gap-0.5 mb-2">
            {/* Section heading */}
            <span className="hidden lg:block text-[9px] font-black text-gray-300 uppercase tracking-[0.15em] mt-4 mb-1 px-3">
              {section.title}
            </span>

            {/* Divider for collapsed sidebar (mobile/icon-only) */}
            <div className="lg:hidden border-t border-gray-100 my-2 mx-2" />

            {visibleItems.map((item) => {
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
                    ${isActive
                      ? "bg-jayPurpleLight text-jayPurple font-semibold"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                    }`}
                >
                  {/* Icon */}
                  <span className="flex-shrink-0 flex items-center justify-center w-5 h-5">
                    <Image
                      src={item.icon}
                      alt=""
                      width={20}
                      height={20}
                      className={`w-5 h-5 transition-opacity ${
                        isActive ? "opacity-100" : "opacity-60 group-hover:opacity-80"
                      }`}
                    />
                  </span>

                  {/* Label */}
                  <span className="hidden lg:block text-sm">{item.label}</span>

                  {/* Active dot */}
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
