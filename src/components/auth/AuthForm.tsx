"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AuthForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">(() => {
    if (typeof window === "undefined") return "login";
    return new URLSearchParams(window.location.search).get("mode") === "signup"
      ? "signup"
      : "login";
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    if (mode === "login") {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } else {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      setMessage(
        error
          ? error.message
          : "Account created. Check your email for verification before first login.",
      );
    }

    setLoading(false);
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
      <h1 className="text-lg font-semibold text-zinc-900">Log in or Create Account</h1>
      <p className="text-sm text-zinc-600">
        Sign-up sends an email verification link through Supabase Auth.
      </p>

      <input
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@company.com"
        className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
      />
      <input
        type="password"
        required
        minLength={6}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
        className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
      />

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
        >
          {loading ? "Working..." : mode === "login" ? "Log In" : "Create Account"}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="rounded border border-zinc-300 px-4 py-2 text-sm"
        >
          {mode === "login" ? "Need account?" : "Have account?"}
        </button>
      </div>

      {message ? <p className="text-sm text-amber-700">{message}</p> : null}
    </form>
  );
}
