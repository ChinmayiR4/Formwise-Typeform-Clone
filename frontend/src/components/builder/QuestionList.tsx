"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, Flag, GitBranch, GripVertical, MoreHorizontal, Plus, Play, Trash2 } from "lucide-react";
import { recallLabel } from "@/lib/format";
import type { Question, ScreenConfig } from "@/lib/types";
import { Menu } from "../ui/Menu";
import { IconButton } from "../ui/primitives";
import { TypeBadge } from "./TypeBadge";

export type Selection = string | "welcome" | "ending";

function SortableItem({
  q,
  index,
  questions,
  selected,
  onSelect,
  onDuplicate,
  onDelete,
}: {
  q: Question;
  index: number;
  questions: Question[];
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
      className={`group relative flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 ${
        selected ? "bg-violet-soft/70 ring-1 ring-violet/25" : "hover:bg-cream-2"
      } ${isDragging ? "bg-surface shadow-[var(--shadow-pop)]" : ""}`}
      onClick={onSelect}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label={`Drag question ${index + 1}`}
        className="-ml-1 cursor-grab touch-none rounded p-0.5 text-muted opacity-0 hover:bg-ink/5 group-hover:opacity-100 active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={14} />
      </button>
      <TypeBadge type={q.type} number={index + 1} size="sm" />
      <span className={`min-w-0 flex-1 truncate text-[13px] ${q.title ? "text-ink" : "text-muted"}`}>
        {q.title ? recallLabel(q.title, questions) : "..."}
      </span>
      {q.logic.length > 0 && <GitBranch size={13} className="shrink-0 text-violet" aria-label="Has logic" />}
      <Menu
        width={180}
        trigger={(p) => (
          <IconButton {...p} label="Question options" className="h-6 w-6 opacity-0 group-hover:opacity-100 aria-expanded:opacity-100">
            <MoreHorizontal size={15} />
          </IconButton>
        )}
        items={[
          { label: "Duplicate", icon: <Copy size={14} />, onClick: onDuplicate },
          { label: "Delete", icon: <Trash2 size={14} />, danger: true, onClick: onDelete },
        ]}
      />
    </div>
  );
}

export function QuestionList({
  questions,
  selection,
  onSelect,
  onReorder,
  onAdd,
  onDuplicate,
  onDelete,
  welcome,
  ending,
}: {
  questions: Question[];
  selection: Selection;
  onSelect: (s: Selection) => void;
  onReorder: (qs: Question[]) => void;
  onAdd: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  welcome: Partial<ScreenConfig>;
  ending: Partial<ScreenConfig>;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = questions.findIndex((q) => q.id === active.id);
    const to = questions.findIndex((q) => q.id === over.id);
    onReorder(arrayMove(questions, from, to));
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <span className="text-[13px] font-semibold">Content</span>
        <IconButton label="Add content" className="h-7 w-7 bg-ink text-white hover:bg-ink-2" onClick={onAdd}>
          <Plus size={16} />
        </IconButton>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <button
          onClick={() => onSelect("welcome")}
          className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] ${
            selection === "welcome" ? "bg-violet-soft/70 ring-1 ring-violet/25" : "hover:bg-cream-2"
          }`}
        >
          <span className="ml-4 inline-flex h-6 w-[38px] items-center justify-center rounded-md bg-cream-2 text-ink-2">
            <Play size={12} />
          </span>
          <span className={welcome.enabled ? "text-ink" : "text-muted"}>
            Welcome screen {welcome.enabled ? "" : "(off)"}
          </span>
        </button>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-0.5">
              {questions.map((q, i) => (
                <SortableItem
                  key={q.id}
                  q={q}
                  index={i}
                  questions={questions}
                  selected={selection === q.id}
                  onSelect={() => onSelect(q.id)}
                  onDuplicate={() => onDuplicate(q.id)}
                  onDelete={() => onDelete(q.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <button onClick={onAdd} className="mt-2 flex w-full items-center gap-2 rounded-lg border border-dashed border-line-2 px-3 py-2 text-[13px] text-muted hover:border-violet hover:text-violet">
          <Plus size={14} /> Add content
        </button>

        <div className="mt-5 px-2 section-label">Endings</div>
        <button
          onClick={() => onSelect("ending")}
          className={`mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] ${
            selection === "ending" ? "bg-violet-soft/70 ring-1 ring-violet/25" : "hover:bg-cream-2"
          }`}
        >
          <span className="ml-4 inline-flex h-6 w-[38px] items-center justify-center rounded-md bg-cream-2 text-ink-2">
            <Flag size={12} />
          </span>
          <span className="truncate">{ending.title || "Thank you screen"}</span>
        </button>
      </div>
    </div>
  );
}
