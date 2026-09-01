import { requireUser } from "@/lib/auth";
import { getOpenTodos, isOnToday } from "@/lib/data";
import { todayISO } from "@/lib/recurrence";
import TabBar from "@/components/TabBar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser(); // gate every app route

  const open = await getOpenTodos();
  const today = todayISO();
  const overdue = open.filter(
    (t) => t.status !== "waiting" && t.due_date != null && t.due_date < today,
  ).length;
  const todayCount = open.filter(isOnToday).length;

  return (
    <div className="shell">
      <canvas id="fx" className="fx" aria-hidden="true" />
      {children}
      <TabBar overdue={overdue} todayCount={todayCount} />
    </div>
  );
}
