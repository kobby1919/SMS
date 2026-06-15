import Menu from "@/src/components/Menu";
import Navbar from "@/src/components/Navbar";
import Image from "next/image";
import Link from "next/link";
import { requirePageSession } from "@/src/lib/authz";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requirePageSession();

  return (
    <div className="h-screen flex">
      <div className="w-[56px] md:w-[64px] lg:w-[16%] xl:w-[14%] p-3 lg:p-4 border-r border-gray-100 bg-white flex flex-col gap-6 shrink-0">
        <Link
          href="/"
          className="flex items-center justify-center lg:justify-start gap-2"
        >
          <Image src="/school.svg" alt="logo" width={32} height={32} priority />
          <span className="hidden lg:block font-nunito font-extrabold text-lg tracking-tight text-gray-800">
            EduJay
          </span>
        </Link>
        <Menu role={session.role} />
      </div>

      <div className="flex-1 min-w-0 bg-[#F7F8FA] overflow-scroll">
        <Navbar role={session.role} />
        {children}
      </div>
    </div>
  );
}
