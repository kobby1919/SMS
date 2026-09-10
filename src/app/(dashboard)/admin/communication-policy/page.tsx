import { MessageCircle } from "lucide-react";
import { requirePageSession } from "@/src/lib/authz";
import CommunicationPolicyForm from "@/src/components/CommunicationPolicyForm";
import {
  ensureSchoolCommunicationPolicy,
  ensureSchoolCommunicationRoutes,
} from "@/src/lib/services/school-communication-policy";
import prisma from "@/src/lib/prisma";

export const dynamic = "force-dynamic";

const AdminCommunicationPolicyPage = async () => {
  const { schoolId } = await requirePageSession(["admin"]);
  const [policy, routes, teachers] = await Promise.all([
    ensureSchoolCommunicationPolicy(schoolId),
    ensureSchoolCommunicationRoutes(schoolId),
    prisma.teacher.findMany({
      where: { schoolId },
      select: { id: true, name: true, surname: true },
      orderBy: [{ name: "asc" }, { surname: "asc" }],
    }),
  ]);

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-sky-400/10 p-2 text-sky-200">
            <MessageCircle size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black">Communication Policy</h1>
            <p className="mt-1 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
              Decide how parents may contact teachers, which channels are allowed, and when messages should escalate.
            </p>
          </div>
        </div>
      </div>

      <CommunicationPolicyForm policy={policy} routes={routes} teachers={teachers} />
    </div>
  );
};

export default AdminCommunicationPolicyPage;
