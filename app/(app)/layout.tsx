import { requireUser } from "@/lib/auth";
import { getOpenTodos, isOnToday } from "@/lib/data";
import { getTimeZone, todayInTz } from "@/lib/tz";
import TabBar from "@/components/TabBar";
import TzSync from "@/components/TzSync";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser(); // gate every app route

  const [open, tz] = await Promise.all([getOpenTodos(), getTimeZone()]);
  const today = todayInTz(tz);
  const overdue = open.filter(
    (t) => t.status !== "waiting" && t.due_date != null && t.due_date < today,
  ).length;
  const todayCount = open.filter((t) => isOnToday(t, today)).length;

  return (
    <div className="shell">
      <TzSync />
      <canvas id="fx" className="fx" aria-hidden="true" />
      {children}
      <TabBar overdue={overdue} todayCount={todayCount} />
    </div>
  );
}
