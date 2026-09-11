import { MessageCircle, Timer, UserRound } from "lucide-react";
import { requirePageSession } from "@/src/lib/authz";
import prisma from "@/src/lib/prisma";
import TeacherContactRequestActions from "@/src/components/TeacherContactRequestActions";

export const dynamic = "force-dynamic";

function formatDateTime(date: Date | null) {
  if (!date) return "Not set";
  return date.toLocaleString("en-GH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readable(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

function statusClass(status: string) {
  switch (status) {
    case "PENDING":
      return "bg-amber-50 text-amber-700 ring-amber-100";
    case "ACKNOWLEDGED":
      return "bg-blue-50 text-blue-700 ring-blue-100";
    case "RESPONDED":
      return "bg-emerald-50 text-emerald-700 ring-emerald-100";
    case "ESCALATED":
      return "bg-rose-50 text-rose-700 ring-rose-100";
    case "CLOSED":
      return "bg-slate-100 text-slate-600 ring-slate-200";
    default:
      return "bg-gray-50 text-gray-600 ring-gray-100";
  }
}

const TeacherCommunicationsPage = async () => {
  const { userId, schoolId } = await requirePageSession(["teacher"]);
  const requests = await prisma.parentTeacherContactRequest.findMany({
    where: {
      schoolId,
      teacherId: userId,
    },
    include: {
      parent: { select: { name: true, surname: true } },
      student: {
        select: {
          name: true,
          surname: true,
          class: { select: { name: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 8,
      },
    },
    orderBy: [
      { status: "asc" },
      { responseDueAt: "asc" },
      { createdAt: "desc" },
    ],
    take: 60,
  });
  const openRequests = requests.filter((request) => request.status !== "CLOSED" && request.status !== "CANCELLED");
  const closedRequests = requests.filter((request) => request.status === "CLOSED" || request.status === "CANCELLED");
  const overdueCount = openRequests.filter((request) => request.responseDueAt && request.responseDueAt < new Date()).length;

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-sky-400/10 p-2 text-sky-200">
              <MessageCircle size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black">Parent Contacts</h1>
              <p className="mt-1 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
                Respond to parent concerns routed to you by the school policy.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/10 px-3 py-2">
              <p className="text-lg font-black">{openRequests.length}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-300">Open</p>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2">
              <p className="text-lg font-black">{overdueCount}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-300">Overdue</p>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2">
              <p className="text-lg font-black">{closedRequests.length}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-300">Closed</p>
            </div>
          </div>
        </div>
      </div>

      {openRequests.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-black text-gray-900">No open parent contact requests.</p>
          <p className="mt-1 text-sm font-semibold text-gray-400">When a parent sends a routed concern, it will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {openRequests.map((request) => (
            <article key={request.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ring-1 ${statusClass(request.status)}`}>
                      {readable(request.status)}
                    </span>
                    <span className="rounded-full bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600 ring-1 ring-slate-100">
                      {readable(request.category)}
                    </span>
                    <span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-violet-700 ring-1 ring-violet-100">
                      {readable(request.preferredChannel)}
                    </span>
                  </div>
                  <h2 className="mt-3 text-base font-black text-gray-950">{request.subject}</h2>
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-gray-600">{request.message}</p>
                </div>
                <div className="grid shrink-0 gap-2 text-sm font-semibold text-gray-500 sm:grid-cols-2 lg:w-72 lg:grid-cols-1">
                  <p className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                    <UserRound size={15} />
                    {request.student.name} {request.student.surname} · {request.student.class.name}
                  </p>
                  <p className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                    <Timer size={15} />
                    Due {formatDateTime(request.responseDueAt)}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-black uppercase tracking-wide text-gray-400">
                  Conversation history
                </p>
                <div className="mt-3 space-y-2">
                  {request.messages.length > 0 ? (
                    request.messages.map((message) => (
                      <div key={message.id} className="rounded-xl bg-white px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-black uppercase tracking-wide text-gray-500">{readable(message.senderRole)}</p>
                          <p className="text-[10px] font-bold text-gray-400">{formatDateTime(message.createdAt)}</p>
                        </div>
                        <p className="mt-1 text-sm font-semibold leading-relaxed text-gray-700">{message.body}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm font-semibold text-gray-400">No thread messages recorded yet.</p>
                  )}
                </div>
              </div>

              <TeacherContactRequestActions
                requestId={request.id}
                canAcknowledge={request.status === "PENDING"}
                canClose={request.status === "RESPONDED" || request.status === "ACKNOWLEDGED"}
              />
            </article>
          ))}
        </div>
      )}

      {closedRequests.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black text-gray-900">Recently closed</h2>
          <div className="mt-3 space-y-2">
            {closedRequests.slice(0, 5).map((request) => (
              <div key={request.id} className="flex flex-col gap-1 rounded-xl bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-black text-gray-900">{request.subject}</p>
                <p className="text-xs font-semibold text-gray-500">
                  {request.student.name} {request.student.surname} · {formatDateTime(request.closedAt ?? request.updatedAt)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherCommunicationsPage;
