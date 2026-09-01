"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginCard() {
  const [loading, setLoading] = useState(false);
  const denied = useSearchParams().get("denied");

  async function signIn() {
    setLoading(true);
    const supabase = createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${siteUrl}/auth/callback` },
    });
    if (error) {
      setLoading(false);
      alert(error.message);
    }
  }

  return (
    <div className="card">
      <h1>Haru</h1>
      <p>A calm plan for the day. Sign in to continue.</p>
      <button className="btn primary" onClick={signIn} disabled={loading}>
        {loading ? "Redirecting…" : "Continue with Google"}
      </button>
      {denied && (
        <p className="denied">
          That account isn&apos;t allowed. Haru is a single-user app.
        </p>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="login">
      <Suspense fallback={<div className="card" />}>
        <LoginCard />
      </Suspense>
    </div>
  );
}
