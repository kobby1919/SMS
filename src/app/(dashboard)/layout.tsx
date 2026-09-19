import Menu from "@/src/components/Menu";
import Navbar from "@/src/components/Navbar";
import Link from "next/link";
import { requirePageSession } from "@/src/lib/authz";
import NavigationProgress from "@/src/components/NavigationProgress";
import EdujayBrandLogo from "@/src/components/EdujayBrandLogo";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requirePageSession();

  return (
    <div className="h-dvh min-h-dvh overflow-hidden flex bg-[#F7F8FA]">
      <div className="w-14 md:w-56 lg:w-60 xl:w-64 p-3 lg:p-4 border-r border-gray-100 bg-white flex flex-col gap-6 shrink-0 overflow-y-auto overflow-x-hidden no-scrollbar">
        <Link
          href="/"
          className="flex items-center justify-center md:justify-start"
          aria-label="Edujay dashboard"
        >
          <EdujayBrandLogo size="sm" showWordmark={false} priority className="md:hidden" />
          <EdujayBrandLogo size="md" priority className="hidden md:inline-flex" />
        </Link>
        <Menu role={session.role} />
      </div>

      <div className="flex-1 min-w-0 h-full bg-[#F7F8FA] overflow-y-auto overflow-x-hidden">
        <Navbar role={session.role} userId={session.userId} schoolId={session.schoolId} />
        <NavigationProgress />
        {children}
      </div>
    </div>
  );
}
