"use client";

import { useState } from "react";
import AddEventSheet from "@/components/AddEventSheet";

export default function AddEventButton({ tz }: { tz: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="add-event-btn" onClick={() => setOpen(true)}>
        + Add event
      </button>
      {open && <AddEventSheet tz={tz} onClose={() => setOpen(false)} />}
    </>
  );
}
