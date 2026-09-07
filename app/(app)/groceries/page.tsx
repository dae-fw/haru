import { requireUser } from "@/lib/auth";
import { getGroceries, getGroceryUsuals } from "@/lib/data";
import GroceryList from "@/components/GroceryList";
import Gear from "@/components/Gear";

export const dynamic = "force-dynamic";

export default async function GroceriesPage() {
  await requireUser();
  const [items, usuals] = await Promise.all([getGroceries(), getGroceryUsuals()]);

  return (
    <>
      <header className="screen-head">
        <div className="eyebrow">Groceries</div>
        <h1>Shopping list</h1>
        <div className="sub">Its own list — nothing to do with your todos</div>
        <Gear />
      </header>
      <div className="body">
        <GroceryList items={items} usuals={usuals} />
      </div>
    </>
  );
}
