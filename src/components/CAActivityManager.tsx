"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Lock,
  Loader2,
  Plus,
  Save,
} from "lucide-react";
import type {
  CABucketAggregationMode,
  CAActivityType,
  Term,
} from "@/src/generated/prisma";
import {
  createCAActivityAction,
  createCABucketAction,
  bulkUpsertCAActivityScores,
  lockCAActivityAction,
  lockCABucketAction,
} from "@/src/lib/actions/caActions";
import { TERM_LABELS } from "@/src/lib/caGrades";

type Student = {
  id: string;
  name: string;
  surname: string;
};

type Subject = {
  id: number;
  name: string;
};

type ActivityScore = {
  studentId: string;
  rawScore: number;
  normalizedContribution: number;
};

type Activity = {
  id: number;
  title: string;
  type: CAActivityType;
  rawMaxScore: number;
  allocationMarks: number | null;
  sequence: number;
  isLocked: boolean;
  activityDate: Date;
  teacherName: string;
  scores: ActivityScore[];
};

type Bucket = {
  id: number;
  name: string;
  type: CAActivityType;
  aggregationMode: CABucketAggregationMode;
  allocationMarks: number;
  term: Term;
  academicYear: string;
  subjectId: number;
  isLocked: boolean;
  activities: Activity[];
};

type Props = {
  classId: number;
  className: string;
  students: Student[];
  subjects: Subject[];
  academicYears: string[];
  buckets: Bucket[];
  canLock?: boolean;
};

const activityTypeLabels: Record<CAActivityType, string> = {
  MIDTERM_EXAM: "Midterm Exam",
  CLASS_TEST: "Class Test",
  CLASS_EXERCISE: "Class Exercise",
  QUIZ: "Quiz",
  HOMEWORK: "Homework",
  PROJECT: "Project",
  PRACTICAL: "Practical",
  PARTICIPATION: "Participation",
  OTHER: "Other",
};

const activityTypes = Object.keys(activityTypeLabels) as CAActivityType[];

function formatMark(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

const CAActivityManager = ({
  classId,
  className,
  students,
  subjects,
  academicYears,
  buckets,
  canLock = false,
}: Props) => {
  const router = useRouter();
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | "">(subjects[0]?.id ?? "");
  const [selectedTerm, setSelectedTerm] = useState<Term>("TERM_2");
  const [selectedYear, setSelectedYear] = useState(academicYears[0] ?? "2025/26");
  const [bucketName, setBucketName] = useState("Midterm Exam");
  const [bucketType, setBucketType] = useState<CAActivityType>("MIDTERM_EXAM");
  const [aggregationMode, setAggregationMode] = useState<CABucketAggregationMode>("AVERAGE_TO_BUCKET");
  const [bucketAllocation, setBucketAllocation] = useState("15");
  const [selectedBucketId, setSelectedBucketId] = useState<number | "">("");
  const [rawMaxScore, setRawMaxScore] = useState("100");
  const [activityTitle, setActivityTitle] = useState("");
  const [activityAllocation, setActivityAllocation] = useState("");
  const [selectedActivityId, setSelectedActivityId] = useState<number | "">("");
  const [scoreEdits, setScoreEdits] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const scopedBuckets = useMemo(
    () =>
      buckets.filter(
        (bucket) =>
          bucket.subjectId === selectedSubjectId &&
          bucket.term === selectedTerm &&
          bucket.academicYear === selectedYear,
      ),
    [buckets, selectedSubjectId, selectedTerm, selectedYear],
  );

  const selectedBucket = scopedBuckets.find((bucket) => bucket.id === selectedBucketId) ?? scopedBuckets[0];
  const activities = selectedBucket?.activities ?? [];
  const selectedActivity = activities.find((activity) => activity.id === selectedActivityId) ?? activities[0];

  const usedAllocation = scopedBuckets.reduce((sum, bucket) => sum + bucket.allocationMarks, 0);

  const handleCreateBucket = async () => {
    if (pendingAction) return;
    setError(null);
    setMessage(null);
    if (!selectedSubjectId) {
      setError("Select a subject first.");
      return;
    }

    setPendingAction("bucket");
    try {
      const bucket = await createCABucketAction({
        classId,
        subjectId: selectedSubjectId as number,
        term: selectedTerm,
        academicYear: selectedYear,
        name: bucketName,
        type: bucketType,
        aggregationMode,
        allocationMarks: Number(bucketAllocation),
      });
      setSelectedBucketId(bucket.id);
      setMessage("CA bucket added successfully.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create CA bucket.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleCreateActivity = async () => {
    if (pendingAction) return;
    setError(null);
    setMessage(null);
    const bucket = selectedBucket;
    if (!bucket) {
      setError("Create or select a CA bucket first.");
      return;
    }
    if (bucket.isLocked) {
      setError("This CA bucket is locked. Admin correction is required before adding activities.");
      return;
    }

    setPendingAction("activity");
    try {
      const activity = await createCAActivityAction({
        bucketId: bucket.id,
        title: activityTitle || undefined,
        type: bucket.type,
        rawMaxScore: Number(rawMaxScore),
        allocationMarks:
          bucket.aggregationMode === "SUM_ACTIVITIES"
            ? Number(activityAllocation)
            : null,
      });
      setSelectedActivityId(activity.id);
      setActivityTitle("");
      setMessage("Activity added successfully. You can now enter student scores.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create activity.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleSaveScores = async () => {
    if (pendingAction) return;
    setError(null);
    setMessage(null);
    if (!selectedActivity) {
      setError("Select an activity first.");
      return;
    }
    if (selectedActivity.isLocked || selectedBucket?.isLocked) {
      setError("This CA activity is locked. Admin correction is required before changing scores.");
      return;
    }

    const rows = Object.entries(scoreEdits)
      .filter(([, rawScore]) => rawScore !== "")
      .map(([studentId, rawScore]) => ({ studentId, rawScore: Number(rawScore) }));

    if (rows.length === 0) {
      setError("Enter at least one student score.");
      return;
    }

    setPendingAction("scores");
    setMessage("Saving scores and preparing parent updates...");

    try {
      const result = await bulkUpsertCAActivityScores({
        activityId: selectedActivity.id,
        rows,
      });
      setMessage(
        `Scores saved successfully. Saved ${result.count} score${result.count === 1 ? "" : "s"}. ${
          result.eventCount > 0
            ? `${result.eventCount} parent update${result.eventCount === 1 ? "" : "s"} prepared.`
            : "No parent update was needed."
        }`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save scores.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleLockBucket = async (bucketId: number) => {
    if (pendingAction) return;
    setError(null);
    setMessage(null);
    setPendingAction(`lock-bucket-${bucketId}`);
    try {
      await lockCABucketAction(bucketId);
      setMessage("CA bucket locked. Future changes now require an audited correction.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not lock CA bucket.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleLockActivity = async (activityId: number) => {
    if (pendingAction) return;
    setError(null);
    setMessage(null);
    setPendingAction(`lock-activity-${activityId}`);
    try {
      await lockCAActivityAction(activityId);
      setMessage("CA activity locked. Future score changes now require an audited correction.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not lock CA activity.");
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black text-gray-800 tracking-tight">Activity-Based CA</h1>
        <p className="text-sm text-gray-400 font-medium">
          {className} · build CA from midterms, class tests, exercises, homework, projects, and more.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle size={15} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-amber-800">{error}</p>
        </div>
      )}
      {message && (
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle2 size={15} className="text-emerald-500" />
          <p className="text-xs font-semibold text-emerald-700">{message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-gray-500 font-black uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen size={11} /> Subject
          </span>
          <select
            value={selectedSubjectId}
            onChange={(event) => {
              setSelectedSubjectId(Number(event.target.value) || "");
              setSelectedBucketId("");
              setSelectedActivityId("");
            }}
            className="w-full ring-[1.5px] ring-gray-200 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-700 focus:ring-indigo-500 outline-none bg-white"
          >
            {subjects.length === 0 && <option value="">No subjects available</option>}
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>{subject.name}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-gray-500 font-black uppercase tracking-wider">Term</span>
          <select
            value={selectedTerm}
            onChange={(event) => setSelectedTerm(event.target.value as Term)}
            className="w-full ring-[1.5px] ring-gray-200 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-700 focus:ring-indigo-500 outline-none bg-white"
          >
            {Object.entries(TERM_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-gray-500 font-black uppercase tracking-wider">Academic Year</span>
          <select
            value={selectedYear}
            onChange={(event) => setSelectedYear(event.target.value)}
            className="w-full ring-[1.5px] ring-gray-200 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-700 focus:ring-indigo-500 outline-none bg-white"
          >
            {academicYears.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-gray-800">1. CA Buckets</h2>
              <p className="text-xs font-medium text-gray-400">
                Used allocation: {formatMark(usedAllocation)} marks
              </p>
            </div>
            <ClipboardList size={18} className="text-indigo-500" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={bucketName}
              onChange={(event) => setBucketName(event.target.value)}
              placeholder="Bucket name"
              className="ring-[1.5px] ring-gray-200 px-3 py-2.5 rounded-xl text-sm font-semibold outline-none focus:ring-indigo-500"
            />
            <select
              value={bucketType}
              onChange={(event) => {
                const next = event.target.value as CAActivityType;
                setBucketType(next);
                setBucketName(activityTypeLabels[next]);
              }}
              className="ring-[1.5px] ring-gray-200 px-3 py-2.5 rounded-xl text-sm font-semibold outline-none focus:ring-indigo-500 bg-white"
            >
              {activityTypes.map((type) => (
                <option key={type} value={type}>{activityTypeLabels[type]}</option>
              ))}
            </select>
            <select
              value={aggregationMode}
              onChange={(event) => setAggregationMode(event.target.value as CABucketAggregationMode)}
              className="ring-[1.5px] ring-gray-200 px-3 py-2.5 rounded-xl text-sm font-semibold outline-none focus:ring-indigo-500 bg-white"
            >
              <option value="AVERAGE_TO_BUCKET">Average activities into bucket</option>
              <option value="SUM_ACTIVITIES">Each activity has own allocation</option>
            </select>
            <input
              type="number"
              min={0}
              step={0.5}
              value={bucketAllocation}
              onChange={(event) => setBucketAllocation(event.target.value)}
              placeholder="CA marks"
              className="ring-[1.5px] ring-gray-200 px-3 py-2.5 rounded-xl text-sm font-semibold outline-none focus:ring-indigo-500"
            />
          </div>

          <button
            type="button"
            onClick={handleCreateBucket}
            disabled={pendingAction !== null || !selectedSubjectId}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {pendingAction === "bucket" ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {pendingAction === "bucket" ? "Adding Bucket..." : "Add Bucket"}
          </button>

          <div className="mt-4 space-y-2">
            {scopedBuckets.length === 0 ? (
              <p className="rounded-xl bg-gray-50 px-3 py-3 text-xs font-bold text-gray-400">
                No CA bucket created for this subject yet.
              </p>
            ) : scopedBuckets.map((bucket) => (
              <button
                key={bucket.id}
                type="button"
                onClick={() => {
                  setSelectedBucketId(bucket.id);
                  setSelectedActivityId("");
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left ${
                  selectedBucket?.id === bucket.id ? "border-indigo-200 bg-indigo-50" : "border-gray-100 bg-white"
                }`}
              >
                <span>
                  <span className="flex items-center gap-2 text-sm font-black text-gray-800">
                    {bucket.name}
                    {bucket.isLocked && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase text-amber-700">
                        <Lock size={10} /> Locked
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] font-semibold text-gray-400">
                    {activityTypeLabels[bucket.type]} · {bucket.aggregationMode === "AVERAGE_TO_BUCKET" ? "average" : "allocated"}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-xs font-black text-indigo-600">{formatMark(bucket.allocationMarks)} marks</span>
                  {canLock && !bucket.isLocked && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleLockBucket(bucket.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          handleLockBucket(bucket.id);
                        }
                      }}
                      className="inline-flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 p-1.5 text-amber-700"
                      title="Lock bucket"
                    >
                      {pendingAction === `lock-bucket-${bucket.id}` ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-gray-800">2. Activities</h2>
              <p className="text-xs font-medium text-gray-400">
                {selectedBucket ? `${selectedBucket.name} · ${activities.length} recorded` : "Select a bucket first"}
              </p>
            </div>
            <ChevronDown size={18} className="text-indigo-500" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={activityTitle}
              onChange={(event) => setActivityTitle(event.target.value)}
              placeholder="Optional title"
              className="ring-[1.5px] ring-gray-200 px-3 py-2.5 rounded-xl text-sm font-semibold outline-none focus:ring-indigo-500"
            />
            <input
              type="number"
              min={0}
              step={0.5}
              value={rawMaxScore}
              onChange={(event) => setRawMaxScore(event.target.value)}
              placeholder="Raw max score"
              className="ring-[1.5px] ring-gray-200 px-3 py-2.5 rounded-xl text-sm font-semibold outline-none focus:ring-indigo-500"
            />
            {selectedBucket?.aggregationMode === "SUM_ACTIVITIES" && (
              <input
                type="number"
                min={0}
                step={0.5}
                value={activityAllocation}
                onChange={(event) => setActivityAllocation(event.target.value)}
                placeholder="Activity CA allocation"
                className="sm:col-span-2 ring-[1.5px] ring-gray-200 px-3 py-2.5 rounded-xl text-sm font-semibold outline-none focus:ring-indigo-500"
              />
            )}
          </div>

          <button
            type="button"
            onClick={handleCreateActivity}
            disabled={pendingAction !== null || !selectedBucket || selectedBucket.isLocked}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {pendingAction === "activity" ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {pendingAction === "activity" ? "Adding Activity..." : "Add Activity"}
          </button>

          <div className="mt-4 space-y-2">
            {activities.length === 0 ? (
              <p className="rounded-xl bg-gray-50 px-3 py-3 text-xs font-bold text-gray-400">
                No activity has been created in this bucket yet.
              </p>
            ) : activities.map((activity) => (
              <button
                key={activity.id}
                type="button"
                onClick={() => {
                  setSelectedActivityId(activity.id);
                  setScoreEdits(
                    Object.fromEntries(activity.scores.map((score) => [score.studentId, String(score.rawScore)])),
                  );
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left ${
                  selectedActivity?.id === activity.id ? "border-slate-300 bg-slate-50" : "border-gray-100 bg-white"
                }`}
              >
                <span>
                  <span className="flex items-center gap-2 text-sm font-black text-gray-800">
                    {activity.title}
                    {activity.isLocked && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase text-amber-700">
                        <Lock size={10} /> Locked
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] font-semibold text-gray-400">
                    /{formatMark(activity.rawMaxScore)} · {activity.teacherName}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-600">{activity.scores.length}/{students.length}</span>
                  {canLock && !activity.isLocked && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleLockActivity(activity.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          handleLockActivity(activity.id);
                        }
                      }}
                      className="inline-flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 p-1.5 text-amber-700"
                      title="Lock activity"
                    >
                      {pendingAction === `lock-activity-${activity.id}` ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-gray-800">3. Enter Scores</h2>
            <p className="text-xs font-medium text-gray-400">
              {selectedActivity
                ? `${selectedActivity.title} · raw score out of ${formatMark(selectedActivity.rawMaxScore)}`
                : "Select an activity to enter marks"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSaveScores}
            disabled={pendingAction !== null || !selectedActivity || selectedActivity.isLocked || Boolean(selectedBucket?.isLocked)}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {pendingAction === "scores" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {pendingAction === "scores" ? "Saving Scores..." : "Save Scores"}
          </button>
        </div>

        {!selectedActivity ? (
          <p className="rounded-xl bg-gray-50 px-3 py-5 text-center text-sm font-bold text-gray-400">
            Create or select an activity before entering student scores.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-100">
            <div className="min-w-[560px] divide-y divide-gray-50">
              {students.map((student) => {
                const existing = selectedActivity.scores.find((score) => score.studentId === student.id);
                const value = scoreEdits[student.id] ?? (existing ? String(existing.rawScore) : "");
                const raw = Number(value);
                const markPreview = value === "" || Number.isNaN(raw)
                  ? null
                  : selectedBucket?.aggregationMode === "SUM_ACTIVITIES" && selectedActivity.allocationMarks
                    ? (raw / selectedActivity.rawMaxScore) * selectedActivity.allocationMarks
                    : (raw / selectedActivity.rawMaxScore) * (selectedBucket?.allocationMarks ?? 0);

                return (
                  <div key={student.id} className="grid grid-cols-[2fr_1fr_1fr] items-center gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-gray-800">{student.name} {student.surname}</p>
                      <p className="text-[10px] font-semibold text-gray-400">{student.id}</p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={selectedActivity.rawMaxScore}
                      step={0.5}
                      value={value}
                      onChange={(event) =>
                        setScoreEdits((prev) => ({ ...prev, [student.id]: event.target.value }))
                      }
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-center text-sm font-black text-gray-800 outline-none focus:border-indigo-500"
                    />
                    <p className="text-right text-xs font-black text-indigo-600">
                      {markPreview === null ? "—" : `${formatMark(markPreview)} CA marks`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default CAActivityManager;
