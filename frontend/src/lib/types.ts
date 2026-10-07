export type QuestionType =
  | "short_text"
  | "long_text"
  | "multiple_choice"
  | "dropdown"
  | "email"
  | "number"
  | "yes_no"
  | "rating";

export type LogicOperator =
  | "always"
  | "is"
  | "is_not"
  | "contains"
  | "not_contains"
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte";

export interface Choice {
  id: string;
  label: string;
}

export interface LogicRule {
  id: string;
  operator: LogicOperator;
  value: string | null;
  /** null = jump to the end (thank-you screen) */
  target_question_id: string | null;
}

export interface QuestionProperties {
  placeholder?: string;
  max_length?: number;
  min?: number | null;
  max?: number | null;
  allow_multiple?: boolean;
  randomize?: boolean;
  alphabetical?: boolean;
  steps?: number;
  shape?: "star" | "heart" | "circle";
}

export interface Question {
  id: string;
  position?: number;
  type: QuestionType;
  title: string;
  description: string | null;
  required: boolean;
  properties: QuestionProperties;
  choices: Choice[];
  logic: LogicRule[];
}

export interface Theme {
  preset: string;
  background: string;
  question_color: string;
  answer_color: string;
  button_color: string;
  button_text_color: string;
  font: string;
}

export interface ScreenConfig {
  enabled: boolean;
  title: string;
  description: string | null;
  button_text: string | null;
}

export interface FormSettings {
  show_progress_bar: boolean;
  show_question_numbers: boolean;
  show_artwork?: boolean;
}

export type FormStatus = "draft" | "published";

export interface FormSummary {
  id: number;
  workspace_id: number;
  title: string;
  slug: string;
  status: FormStatus;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  response_count: number;
  question_count: number;
  theme: Partial<Theme>;
}

export interface FormDetail extends FormSummary {
  welcome_screen: ScreenConfig;
  thankyou_screen: ScreenConfig;
  settings: FormSettings;
  questions: Question[];
}

/** What the respondent runner needs (public endpoint shape). */
export interface RunnableForm {
  slug: string;
  title: string;
  theme: Partial<Theme>;
  welcome_screen: Partial<ScreenConfig>;
  thankyou_screen: Partial<ScreenConfig>;
  settings: Partial<FormSettings>;
  questions: Question[];
}

export interface Workspace {
  id: number;
  name: string;
  form_count: number;
}

export type AnswerValue = string | number | boolean | string[] | null;
export type Answers = Record<string, AnswerValue>;

export interface ResponseAnswer {
  question_id: string;
  value: AnswerValue;
  display: string;
}

export interface FormResponse {
  id: number;
  status: "in_progress" | "completed";
  started_at: string;
  submitted_at: string | null;
  duration_seconds: number | null;
  user_agent: string | null;
  answers: ResponseAnswer[];
}

export interface StatBucket {
  id?: string;
  value?: number;
  label?: string;
  count: number;
  percent: number;
}

export interface QuestionStats {
  question_id: string;
  type: QuestionType;
  title: string;
  answered: number;
  skipped: number;
  choices?: StatBucket[];
  distribution?: StatBucket[];
  average?: number | null;
  median?: number | null;
  min?: number | null;
  max?: number | null;
  latest?: string[];
}

export interface FormMetrics {
  views: number;
  unique_views: number;
  starts: number;
  submissions: number;
  completion_rate: number;
  start_rate: number;
  avg_duration_seconds: number | null;
}

export interface FormSummaryStats {
  metrics: FormMetrics;
  drop_off: { question_id: string; answered: number }[];
  questions: QuestionStats[];
}

export interface Insight {
  question_id: string;
  title: string;
  count: number;
  summary: string;
  themes: string[];
  sentiment: string;
  source: "hf" | "fallback";
}
