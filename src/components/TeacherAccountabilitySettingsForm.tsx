"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  BellRing,
  BookOpenCheck,
  CalendarClock,
  ClipboardCheck,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import type { TeacherAccountabilitySetting } from "@/src/generated/prisma";
import {
  updateTeacherAccountabilitySettingsWithState,
  type TeacherAccountabilitySettingsActionState,
} from "@/src/lib/actions/teacherAccountabilitySettingsActions";

const initialState: TeacherAccountabilitySettingsActionState = {
  status: "idle",
  message: "",
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      disabled={pending}
      className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
    >
      {pending ? "Saving..." : "Save accountability settings"}
    </button>
  );
}

function NumberField({
  label,
  name,
  defaultValue,
  min = 0,
  max = 360,
  helper,
}: {
  label: string;
  name: keyof TeacherAccountabilitySetting;
  defaultValue: number;
  min?: number;
  max?: number;
  helper: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-black uppercase tracking-wide text-gray-400">
        {label}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        name={name}
        defaultValue={defaultValue}
        className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-400"
      />
      <span className="text-xs font-semibold leading-relaxed text-gray-400">
        {helper}
      </span>
    </label>
  );
}

function ToggleField({
  label,
  name,
  defaultChecked,
  helper,
}: {
  label: string;
  name: keyof TeacherAccountabilitySetting;
  defaultChecked: boolean;
  helper: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-1"
      />
      <span>
        <span className="block text-sm font-black text-gray-800">{label}</span>
        <span className="mt-1 block text-xs font-semibold leading-relaxed text-gray-400">
          {helper}
        </span>
      </span>
    </label>
  );
}

export default function TeacherAccountabilitySettingsForm({
  settings,
}: {
  settings: TeacherAccountabilitySetting;
}) {
  const [state, formAction] = useActionState(
    updateTeacherAccountabilitySettingsWithState,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-xl bg-sky-50 p-2 text-sky-700">
            <CalendarClock size={18} />
          </div>
          <div>
            <h2 className="text-base font-black text-gray-900">
              Timetable-based attendance
            </h2>
            <p className="mt-1 text-sm font-medium leading-relaxed text-gray-500">
              Edujay uses each lesson period from the master timetable to decide
              when attendance opens, becomes late, and escalates.
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <NumberField
            label="Open before lesson"
            name="attendanceOpenMinutesBeforeLesson"
            defaultValue={settings.attendanceOpenMinutesBeforeLesson}
            max={120}
            helper="Minutes before lesson start."
          />
          <NumberField
            label="Grace after lesson"
            name="attendanceGraceMinutesAfterLesson"
            defaultValue={settings.attendanceGraceMinutesAfterLesson}
            max={180}
            helper="Minutes after lesson end before late."
          />
          <NumberField
            label="Escalate after lesson"
            name="attendanceEscalateMinutesAfterLesson"
            defaultValue={settings.attendanceEscalateMinutesAfterLesson}
            max={360}
            helper="Minutes after lesson end before management sees it."
          />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <ToggleField
            label="Allow early marking"
            name="allowEarlyAttendanceMarking"
            defaultChecked={settings.allowEarlyAttendanceMarking}
            helper="Teachers can mark within the opening window before class starts."
          />
          <ToggleField
            label="Require late note"
            name="requireLateAttendanceNote"
            defaultChecked={settings.requireLateAttendanceNote}
            helper="Late students need a teacher note before saving attendance."
          />
          <ToggleField
            label="Require correction reason"
            name="requireAttendanceCorrectionReason"
            defaultChecked={settings.requireAttendanceCorrectionReason}
            helper="Attendance corrections must explain what changed."
          />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
              <GraduationCap size={18} />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900">
                CA publishing discipline
              </h2>
              <p className="mt-1 text-sm font-medium leading-relaxed text-gray-500">
                CA accountability starts only after a teacher creates an
                activity.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField
              label="Publish window"
              name="caScorePublishWindowSchoolDays"
              defaultValue={settings.caScorePublishWindowSchoolDays}
              min={1}
              max={20}
              helper="School days allowed to publish scores."
            />
            <NumberField
              label="Reminder day"
              name="caReminderAfterSchoolDays"
              defaultValue={settings.caReminderAfterSchoolDays}
              min={1}
              max={20}
              helper="Teacher reminder after activity date."
            />
            <NumberField
              label="Escalation day"
              name="caEscalateAfterSchoolDays"
              defaultValue={settings.caEscalateAfterSchoolDays}
              min={1}
              max={30}
              helper="Management visibility after activity date."
            />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <div className="rounded-xl bg-amber-50 p-2 text-amber-700">
              <ClipboardCheck size={18} />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900">
                Homework checking discipline
              </h2>
              <p className="mt-1 text-sm font-medium leading-relaxed text-gray-500">
                Homework must be checked and closed after it is assigned.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="Checking window"
              name="homeworkCheckWindowSchoolDays"
              defaultValue={settings.homeworkCheckWindowSchoolDays}
              max={20}
              helper="School days after due date."
            />
            <NumberField
              label="Escalation day"
              name="homeworkEscalateAfterSchoolDays"
              defaultValue={settings.homeworkEscalateAfterSchoolDays}
              max={30}
              helper="Management visibility after due date."
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-xl bg-violet-50 p-2 text-violet-700">
            <BookOpenCheck size={18} />
          </div>
          <div>
            <h2 className="text-base font-black text-gray-900">
              Syllabus and close-out
            </h2>
            <p className="mt-1 text-sm font-medium leading-relaxed text-gray-500">
              Define when teachers should update taught topics and when Edujay
              should review the day.
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-gray-400">
              Syllabus update expectation
            </span>
            <select
              name="syllabusUpdateExpectation"
              defaultValue={settings.syllabusUpdateExpectation}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-400"
            >
              <option value="SAME_DAY">Same day after teaching</option>
              <option value="WEEKLY">Weekly progress review</option>
              <option value="MANUAL">Manual management review</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-gray-400">
              Teacher close-out time
            </span>
            <input
              type="time"
              name="teacherCloseoutTime"
              defaultValue={settings.teacherCloseoutTime}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-400"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-xl bg-rose-50 p-2 text-rose-700">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h2 className="text-base font-black text-gray-900">
              Reminders, escalation, and corrections
            </h2>
            <p className="mt-1 text-sm font-medium leading-relaxed text-gray-500">
              Control how Edujay nudges teachers and protects sensitive records.
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <ToggleField
            label="Enable reminders"
            name="remindersEnabled"
            defaultChecked={settings.remindersEnabled}
            helper="Teachers receive reminders before issues become escalations."
          />
          <ToggleField
            label="Enable escalations"
            name="escalationsEnabled"
            defaultChecked={settings.escalationsEnabled}
            helper="Headmaster/owner can see unresolved teacher obligations."
          />
          <ToggleField
            label="Require approval for corrections"
            name="correctionApprovalRequired"
            defaultChecked={settings.correctionApprovalRequired}
            helper="Protected records cannot be changed silently."
          />
        </div>
      </section>

      <div className="flex flex-col items-end gap-3">
        <SubmitButton />
        {state.status !== "idle" && (
          <p
            role="status"
            className={`rounded-xl px-4 py-2 text-sm font-black ${
              state.status === "success"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            }`}
          >
            {state.message}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-relaxed text-slate-600">
        <div className="mb-2 flex items-center gap-2 font-black text-slate-900">
          <BellRing size={16} />
          Future steps will use these settings
        </div>
        Attendance will read lesson times from the timetable. CA will start its
        clock when an activity is created. Homework will start its checking
        window from the due date. Correction approvals will protect sensitive
        records after save.
      </div>
    </form>
  );
}
