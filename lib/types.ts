export type RecurrenceType = "weekly" | "monthly" | "everyN";

export interface Recurrence {
  type: RecurrenceType;
  weekdays?: number[]; // 0 = Sunday .. 6 = Saturday  (weekly)
  dayOfMonth?: number; // 1..31  (monthly)
  n?: number; // every N days  (everyN)
}

export type TodoStatus = "open" | "done" | "waiting";

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  sort: number;
}

export interface Todo {
  id: string;
  user_id: string;
  title: string;
  project_id: string | null;
  notes: string | null;
  due_date: string | null; // yyyy-mm-dd
  due_time: string | null; // "HH:MM" 24h
  status: TodoStatus;
  flagged: boolean;
  recurrence: Recurrence | null;
  streak: number;
  wake_at: string | null;
  waiting_on: string | null;
  snooze_until: string | null;
  subtasks: Subtask[];
  source: "app" | "capture" | "google_tasks";
  google_tasks_id: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Idea {
  id: string;
  body: string;
  project_id: string | null;
  theme: string | null;
  created_at: string;
}

export interface Reference {
  id: string;
  user_id: string;
  label: string | null;
  body: string;
  updated_at: string;
}
