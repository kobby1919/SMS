"use client";

// src/components/SyllabusTopicEditor.tsx


import { useState, useTransition } from "react";
import {
  Plus, Trash2, ChevronUp, ChevronDown, Save,
  Loader2, AlertCircle, CheckCircle2, Globe, Lock, X,
} from "lucide-react";
import {
  upsertSyllabusTopic,
  deleteSyllabusTopic,
  reorderTopics,
  publishSyllabus,
  unpublishSyllabus,
} from "@/src/lib/actions/syllabusActions";

// ─── Types ────────────────────────────────────────────────────────────────────
type Topic = {
  id?:               number;
  weekNumber:        number;
  durationWeeks:     number;
  order:             number;
  title:             string;
  subtopics:         string[];
  objectives:        string[];
  coreCompetencies:  string[];
  teachingResources: string;
};

type Props = {
  syllabusId:     number;
  syllabusStatus: string;
  initialTopics:  Topic[];
};

// ─── Tag input ────────────────────────────────────────────────────────────────
function TagInput({
  label, values, onChange, placeholder,
}: {
  label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
      setInput("");
    }
  };

  const remove = (idx: number) => onChange(values.filter((_, i) => i !== idx));

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">{label}</label>
      {/* Tags */}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1">
          {values.map((v, i) => (
            <span key={i} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-violet-50 text-violet-700 border border-violet-100 rounded-lg">
              {v}
              <button type="button" onClick={() => remove(i)} className="hover:text-rose-500 transition-colors">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 ring-[1.5px] ring-gray-200 px-3 py-2 rounded-xl text-xs text-gray-700 focus:ring-violet-500 outline-none"
        />
        <button
          type="button"
          onClick={add}
          className="px-3 py-2 bg-violet-50 text-violet-600 rounded-xl text-xs font-bold hover:bg-violet-100 transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ─── Empty topic factory ──────────────────────────────────────────────────────
function emptyTopic(order: number): Topic {
  return {
    weekNumber: 1, durationWeeks: 1, order,
    title: "", subtopics: [], objectives: [], coreCompetencies: [], teachingResources: "",
  };
}

// ─── Main component ───────────────────────────────────────────────────────────
const SyllabusTopicEditor = ({ syllabusId, syllabusStatus, initialTopics }: Props) => {
  const [topics,    setTopics]    = useState<Topic[]>(initialTopics);
  const [editing,   setEditing]   = useState<number | null>(null); // index of topic being edited
  const [status,    setStatus]    = useState(syllabusStatus);
  const [error,     setError]     = useState<string | null>(null);
  const [toast,     setToast]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // ── Add new blank topic ───────────────────────────────────────────────────
  const addTopic = () => {
    const newTopic = emptyTopic(topics.length + 1);
    setTopics([...topics, newTopic]);
    setEditing(topics.length); // open the new one immediately
  };

  // ── Update local state for a topic field ──────────────────────────────────
  const updateLocal = <K extends keyof Topic>(idx: number, field: K, value: Topic[K]) => {
    setTopics((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  // ── Save a topic ──────────────────────────────────────────────────────────
  const saveTopic = (idx: number) => {
    const t = topics[idx];
    if (!t.title.trim()) { setError("Topic title is required."); return; }
    setError(null);

    startTransition(async () => {
      try {
        await upsertSyllabusTopic({
          id:                t.id,
          syllabusId,
          weekNumber:        t.weekNumber,
          durationWeeks:     t.durationWeeks,
          order:             idx + 1,
          title:             t.title,
          subtopics:         t.subtopics,
          objectives:        t.objectives,
          coreCompetencies:  t.coreCompetencies,
          teachingResources: t.teachingResources,
        });
        showToast("Topic saved ✓");
        setEditing(null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to save topic.");
      }
    });
  };

  // ── Delete a topic ────────────────────────────────────────────────────────
  const deleteTopic = (idx: number) => {
    const t = topics[idx];
    startTransition(async () => {
      try {
        if (t.id) await deleteSyllabusTopic(t.id, syllabusId);
        setTopics((prev) => prev.filter((_, i) => i !== idx));
        if (editing === idx) setEditing(null);
        showToast("Topic deleted");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to delete topic.");
      }
    });
  };

  // ── Move topic up/down ────────────────────────────────────────────────────
  const moveTopic = (idx: number, dir: "up" | "down") => {
    const newIdx = dir === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= topics.length) return;

    const next = [...topics];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    setTopics(next);

    startTransition(async () => {
      try {
        const savedIds = next.filter((t) => t.id).map((t) => t.id!);
        if (savedIds.length === next.length) await reorderTopics(syllabusId, savedIds);
      } catch { /* reorder errors are non-critical */ }
    });
  };

  // ── Publish / unpublish ───────────────────────────────────────────────────
  const togglePublish = () => {
    startTransition(async () => {
      try {
        if (status === "PUBLISHED") {
          await unpublishSyllabus(syllabusId);
          setStatus("DRAFT");
          showToast("Moved back to Draft");
        } else {
          await publishSyllabus(syllabusId);
          setStatus("PUBLISHED");
          showToast("Syllabus Published ✓");
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to update status.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl
            ${status === "PUBLISHED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {status === "PUBLISHED" ? <Globe size={11} /> : <Lock size={11} />}
            {status === "PUBLISHED" ? "Published" : "Draft"}
          </span>
          <span className="text-xs text-gray-400 font-semibold">{topics.length} topic{topics.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePublish}
            disabled={isPending}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50
              ${status === "PUBLISHED"
                ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"}`}
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : status === "PUBLISHED" ? <Lock size={13} /> : <Globe size={13} />}
            {status === "PUBLISHED" ? "Unpublish" : "Publish Syllabus"}
          </button>
          <button
            type="button"
            onClick={addTopic}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition-colors shadow-sm"
          >
            <Plus size={14} /> Add Topic
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle2 size={14} className="text-emerald-500" />
          <p className="text-xs font-semibold text-emerald-700">{toast}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
          <AlertCircle size={14} className="text-rose-500 shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-rose-700">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {topics.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <p className="text-sm font-bold text-gray-400 mb-2">No topics yet</p>
          <p className="text-xs text-gray-300 mb-4">Click &quot;Add Topic&quot; to get started.</p>
          <button
            type="button"
            onClick={addTopic}
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition-colors"
          >
            <Plus size={14} /> Add First Topic
          </button>
        </div>
      )}

      {/* Topics */}
      <div className="flex flex-col gap-3">
        {topics.map((topic, idx) => {
          const isOpen = editing === idx;

          return (
            <div key={idx} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Topic header row */}
              <div className="flex items-center gap-3 px-5 py-4">
                {/* Reorder buttons */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveTopic(idx, "up")}
                    disabled={idx === 0 || isPending}
                    className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-100 text-gray-400 hover:bg-gray-200 disabled:opacity-30 transition-colors"
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveTopic(idx, "down")}
                    disabled={idx === topics.length - 1 || isPending}
                    className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-100 text-gray-400 hover:bg-gray-200 disabled:opacity-30 transition-colors"
                  >
                    <ChevronDown size={12} />
                  </button>
                </div>

                {/* Week badge */}
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-xs font-black text-violet-600 shrink-0">
                  W{topic.weekNumber}
                </div>

                {/* Title (or placeholder) */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-black truncate ${topic.title ? "text-gray-800" : "text-gray-300"}`}>
                    {topic.title || "Untitled topic"}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {topic.durationWeeks} week{topic.durationWeeks !== 1 ? "s" : ""}
                    {topic.subtopics.length > 0 && ` · ${topic.subtopics.length} subtopics`}
                    {topic.objectives.length > 0  && ` · ${topic.objectives.length} objectives`}
                    {topic.id ? "" : " · unsaved"}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditing(isOpen ? null : idx)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors
                      ${isOpen ? "bg-gray-100 text-gray-600 hover:bg-gray-200" : "bg-violet-50 text-violet-600 hover:bg-violet-100"}`}
                  >
                    {isOpen ? "Collapse" : "Edit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteTopic(idx)}
                    disabled={isPending}
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Expanded editor */}
              {isOpen && (
                <div className="border-t border-gray-100 px-5 py-5 flex flex-col gap-4">

                  {/* Week + Duration */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">Week Number</label>
                      <input
                        type="number"
                        min={1}
                        value={topic.weekNumber}
                        onChange={(e) => updateLocal(idx, "weekNumber", parseInt(e.target.value) || 1)}
                        className="ring-[1.5px] ring-gray-200 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-700 focus:ring-violet-500 outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">Duration (weeks)</label>
                      <input
                        type="number"
                        min={1}
                        value={topic.durationWeeks}
                        onChange={(e) => updateLocal(idx, "durationWeeks", parseInt(e.target.value) || 1)}
                        className="ring-[1.5px] ring-gray-200 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-700 focus:ring-violet-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Title */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">Topic Title *</label>
                    <input
                      type="text"
                      value={topic.title}
                      onChange={(e) => updateLocal(idx, "title", e.target.value)}
                      placeholder="e.g. Fractions and Decimals"
                      className="ring-[1.5px] ring-gray-200 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-700 focus:ring-violet-500 outline-none"
                    />
                  </div>

                  {/* Subtopics */}
                  <TagInput
                    label="Subtopics"
                    values={topic.subtopics}
                    onChange={(v) => updateLocal(idx, "subtopics", v)}
                    placeholder="e.g. Adding fractions — press Enter or Add"
                  />

                  {/* Objectives */}
                  <TagInput
                    label="Learning Objectives"
                    values={topic.objectives}
                    onChange={(v) => updateLocal(idx, "objectives", v)}
                    placeholder="e.g. Students will be able to… — press Enter or Add"
                  />

                  {/* Core competencies */}
                  <TagInput
                    label="Core Competencies"
                    values={topic.coreCompetencies}
                    onChange={(v) => updateLocal(idx, "coreCompetencies", v)}
                    placeholder="e.g. Critical Thinking — press Enter or Add"
                  />

                  {/* Teaching resources */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                      Teaching Resources <span className="font-normal normal-case text-gray-300">(optional)</span>
                    </label>
                    <textarea
                      rows={2}
                      value={topic.teachingResources}
                      onChange={(e) => updateLocal(idx, "teachingResources", e.target.value)}
                      placeholder="e.g. Textbook pp. 34–40, ruler, fraction strips…"
                      className="ring-[1.5px] ring-gray-200 px-3 py-2.5 rounded-xl text-sm text-gray-700 focus:ring-violet-500 outline-none resize-none"
                    />
                  </div>

                  {/* Save button */}
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => saveTopic(idx)}
                      disabled={isPending}
                      className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition-colors disabled:opacity-50 shadow-sm"
                    >
                      {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      {isPending ? "Saving…" : "Save Topic"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom add button (convenience) */}
      {topics.length > 0 && (
        <button
          type="button"
          onClick={addTopic}
          className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm font-bold text-gray-400 hover:border-violet-300 hover:text-violet-500 transition-colors"
        >
          <Plus size={15} /> Add Another Topic
        </button>
      )}
    </div>
  );
};

export default SyllabusTopicEditor;
