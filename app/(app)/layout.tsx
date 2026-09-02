import { requireUser } from "@/lib/auth";
import { getOpenTodos, isOnToday } from "@/lib/data";
import { todayInTz } from "@/lib/tz";
import { getTimeZone } from "@/lib/tz.server";
import TabBar from "@/components/TabBar";
import TzSync from "@/components/TzSync";
import ThemeSync from "@/components/ThemeSync";
import OfflineBar from "@/components/OfflineBar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireUser(); // gate every app route

  const [open, tz] = await Promise.all([getOpenTodos(), getTimeZone()]);
  const today = todayInTz(tz);
  const overdue = open.filter(
    (t) => t.status !== "waiting" && t.due_date != null && t.due_date < today,
  ).length;
  const todayCount = open.filter((t) => isOnToday(t, today)).length;

  const meta = user.user_metadata as { palette?: "a" | "b" | "c"; theme?: "light" | "dark" | "system" };

  return (
    <div className="shell">
      <OfflineBar />
      <TzSync />
      <ThemeSync palette={meta.palette} theme={meta.theme} />
      <canvas id="fx" className="fx" aria-hidden="true" />
      {children}
      <TabBar overdue={overdue} todayCount={todayCount} />
    </div>
  );
}
