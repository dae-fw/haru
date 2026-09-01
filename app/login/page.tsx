"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginCard() {
  const router = useRouter();
  const denied = useSearchParams().get("denied");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form className="card" onSubmit={signIn}>
      <h1>Haru</h1>
      <p>A calm plan for the day.</p>
      <input
        type="email"
        placeholder="Email"
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        style={{ padding: "12px 14px", borderRadius: "var(--radius)", border: "1px solid var(--hair)", background: "var(--surface)" }}
      />
      <input
        type="password"
        placeholder="Password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        style={{ padding: "12px 14px", borderRadius: "var(--radius)", border: "1px solid var(--hair)", background: "var(--surface)" }}
      />
      <button className="btn primary" type="submit" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
      {error && <p className="denied">{error}</p>}
      {denied && !error && (
        <p className="denied">That account isn&apos;t allowed. Haru is a single-user app.</p>
      )}
    </form>
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
