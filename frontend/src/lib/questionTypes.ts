import {
  AlignLeft,
  Calendar,
  CheckSquare,
  ChevronDownSquare,
  CreditCard,
  Hash,
  Image as ImageIcon,
  ListOrdered,
  Mail,
  Phone,
  Star,
  ThumbsUp,
  Type,
  Upload,
  Gauge,
  Grid3x3,
  type LucideIcon,
} from "lucide-react";
import { newId } from "./ids";
import type { Question, QuestionType } from "./types";

export interface TypeMeta {
  type: QuestionType;
  label: string;
  icon: LucideIcon;
  /** badge background / foreground */
  bg: string;
  fg: string;
  category: Category;
  hint: string;
}

export type Category = "Contact info" | "Choice" | "Rating & ranking" | "Text" | "Other";

export const TYPE_META: Record<QuestionType, TypeMeta> = {
  email: { type: "email", label: "Email", icon: Mail, bg: "#FDECEF", fg: "#B4234A", category: "Contact info", hint: "Collect a valid email address" },
  multiple_choice: { type: "multiple_choice", label: "Multiple Choice", icon: CheckSquare, bg: "#EEF0FF", fg: "#3B4CCA", category: "Choice", hint: "Pick one or more options" },
  dropdown: { type: "dropdown", label: "Dropdown", icon: ChevronDownSquare, bg: "#EEF0FF", fg: "#3B4CCA", category: "Choice", hint: "Long list of options, searchable" },
  yes_no: { type: "yes_no", label: "Yes/No", icon: ThumbsUp, bg: "#EEF0FF", fg: "#3B4CCA", category: "Choice", hint: "A simple Yes or No" },
  rating: { type: "rating", label: "Rating", icon: Star, bg: "#FFF4DE", fg: "#A15C00", category: "Rating & ranking", hint: "Stars from 1 to N" },
  long_text: { type: "long_text", label: "Long Text", icon: AlignLeft, bg: "#E8F4FD", fg: "#14639E", category: "Text", hint: "Multi-line free text" },
  short_text: { type: "short_text", label: "Short Text", icon: Type, bg: "#E8F4FD", fg: "#14639E", category: "Text", hint: "One line of free text" },
  number: { type: "number", label: "Number", icon: Hash, bg: "#E6F6F1", fg: "#11795A", category: "Other", hint: "Numbers only, with min/max" },
};

/** Typeform question types we show in the picker as "Coming soon". */
export const COMING_SOON: { label: string; icon: LucideIcon; category: Category }[] = [
  { label: "Phone Number", icon: Phone, category: "Contact info" },
  { label: "Picture Choice", icon: ImageIcon, category: "Choice" },
  { label: "Opinion Scale", icon: Gauge, category: "Rating & ranking" },
  { label: "Ranking", icon: ListOrdered, category: "Rating & ranking" },
  { label: "Matrix", icon: Grid3x3, category: "Rating & ranking" },
  { label: "Date", icon: Calendar, category: "Other" },
  { label: "File Upload", icon: Upload, category: "Other" },
  { label: "Payment", icon: CreditCard, category: "Other" },
];

export const CATEGORIES: Category[] = ["Contact info", "Choice", "Rating & ranking", "Text", "Other"];

export const isChoiceType = (t: QuestionType) => t === "multiple_choice" || t === "dropdown";

export function blankQuestion(type: QuestionType): Question {
  const base: Question = {
    id: newId(),
    type,
    title: "",
    description: null,
    required: false,
    properties: {},
    choices: [],
    logic: [],
  };
  if (isChoiceType(type)) {
    base.choices = [
      { id: newId(), label: "Choice A" },
      { id: newId(), label: "Choice B" },
    ];
  }
  if (type === "rating") base.properties = { steps: 5, shape: "star" };
  return base;
}

/** Change a question's type while keeping as much content as possible. */
export function convertQuestion(q: Question, type: QuestionType): Question {
  const next = blankQuestion(type);
  return {
    ...next,
    id: q.id,
    title: q.title,
    description: q.description,
    required: q.required,
    choices: isChoiceType(type) && q.choices.length ? q.choices : next.choices,
    logic: [], // operators differ per type, so reset rules
  };
}
