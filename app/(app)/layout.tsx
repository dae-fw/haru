import { requireUser } from "@/lib/auth";
import TabBar from "@/components/TabBar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser(); // gate every app route

  return (
    <div className="shell">
      {children}
      <TabBar />
    </div>
  );
}
