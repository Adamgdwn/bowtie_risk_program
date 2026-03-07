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
    <form onSubmit={onSubmit} className="brand-card w-full max-w-md space-y-3 rounded-xl p-5">
      <h1 className="brand-heading text-lg font-semibold">Log in or Create Account</h1>
      <p className="brand-text-muted text-sm">
        Sign-up sends an email verification link through Supabase Auth.
      </p>

      <input
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@company.com"
        className="w-full rounded border border-[#9CA3AF] bg-white px-3 py-2 text-sm"
      />
      <input
        type="password"
        required
        minLength={6}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
        className="w-full rounded border border-[#9CA3AF] bg-white px-3 py-2 text-sm"
      />

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="brand-btn-primary rounded px-4 py-2 text-sm font-semibold"
        >
          {loading ? "Working..." : mode === "login" ? "Log In" : "Create Account"}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="brand-btn-secondary rounded px-4 py-2 text-sm"
        >
          {mode === "login" ? "Need account?" : "Have account?"}
        </button>
      </div>

      {message ? <p className="text-sm text-[#325D88]">{message}</p> : null}
    </form>
  );
}
