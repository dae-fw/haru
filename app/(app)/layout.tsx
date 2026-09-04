import { requireUser } from "@/lib/auth";
import { getIdeas, getOpenTodos, getPrefs, isOnToday } from "@/lib/data";
import { looseEndsCount } from "@/lib/organize";
import { todayInTz } from "@/lib/tz";
import { getTimeZone } from "@/lib/tz.server";
import TabBar from "@/components/TabBar";
import TzSync from "@/components/TzSync";
import ThemeSync from "@/components/ThemeSync";
import OfflineBar from "@/components/OfflineBar";
import OfflineSync from "@/components/OfflineSync";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser(); // gate every app route

  const [open, tz, prefs, ideas] = await Promise.all([
    getOpenTodos(),
    getTimeZone(),
    getPrefs(),
    getIdeas(),
  ]);
  const today = todayInTz(tz);
  const overdue = open.filter(
    (t) => t.status !== "waiting" && t.due_date != null && t.due_date < today,
  ).length;
  const todayCount = open.filter((t) => isOnToday(t, today)).length;
  const loose = looseEndsCount(open, ideas.length);

  return (
    <div className="shell">
      <OfflineBar />
      <OfflineSync />
      <TzSync />
      <ThemeSync palette={prefs?.palette ?? undefined} theme={prefs?.theme ?? undefined} />
      <canvas id="fx" className="fx" aria-hidden="true" />
      {children}
      <TabBar overdue={overdue} todayCount={todayCount} loose={loose} />
    </div>
  );
}
