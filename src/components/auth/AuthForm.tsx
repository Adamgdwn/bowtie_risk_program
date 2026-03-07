"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

export function AuthForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [mode, setMode] = useState<"login" | "signup">(() => {
    if (typeof window === "undefined") return "login";
    return new URLSearchParams(window.location.search).get("mode") === "signup"
      ? "signup"
      : "login";
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [usernameLookup, setUsernameLookup] = useState<"available" | "taken" | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);

  const normalizedUsername = useMemo(() => username.trim().toLowerCase(), [username]);
  const usernameStatus = useMemo<"idle" | "checking" | "available" | "taken" | "invalid">(() => {
    if (mode !== "signup") return "idle";
    if (!normalizedUsername) return "idle";
    if (!USERNAME_PATTERN.test(normalizedUsername)) return "invalid";
    if (usernameChecking) return "checking";
    if (usernameLookup === "available") return "available";
    if (usernameLookup === "taken") return "taken";
    return "idle";
  }, [mode, normalizedUsername, usernameChecking, usernameLookup]);

  useEffect(() => {
    if (mode !== "signup") {
      return;
    }
    if (!normalizedUsername || !USERNAME_PATTERN.test(normalizedUsername)) return;

    const timeout = window.setTimeout(async () => {
      setUsernameChecking(true);
      try {
        const response = await fetch("/api/auth/username-availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: normalizedUsername }),
        });
        const payload = (await response.json().catch(() => ({}))) as { available?: boolean };
        setUsernameLookup(payload.available ? "available" : "taken");
      } catch {
        setUsernameLookup(null);
      } finally {
        setUsernameChecking(false);
      }
    }, 280);

    return () => window.clearTimeout(timeout);
  }, [mode, normalizedUsername]);

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
      if (!USERNAME_PATTERN.test(normalizedUsername)) {
        setMessage("Username must be 3-24 chars: lowercase letters, numbers, or underscore.");
        setLoading(false);
        return;
      }
      if (usernameStatus !== "available") {
        setMessage("Please choose an available username.");
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            username: normalizedUsername,
          },
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
    <form onSubmit={onSubmit} className="brand-card w-full max-w-md space-y-3 rounded-2xl p-5">
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
        className="brand-input w-full rounded-lg px-3 py-2 text-sm"
      />
      <input
        type="password"
        required
        minLength={6}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
        className="brand-input w-full rounded-lg px-3 py-2 text-sm"
      />
      {mode === "signup" ? (
        <div>
          <input
            type="text"
            required
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              setUsernameLookup(null);
              setUsernameChecking(false);
            }}
            placeholder="Username (lowercase, numbers, underscore)"
            className="brand-input w-full rounded-lg px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-[#1F2933]/70">
            {usernameStatus === "checking" ? "Checking username..." : null}
            {usernameStatus === "available" ? "Username is available." : null}
            {usernameStatus === "taken" ? "Username is already in use." : null}
            {usernameStatus === "invalid"
              ? "Use 3-24 chars: lowercase letters, numbers, underscore."
              : null}
            {usernameStatus === "idle" ? "Choose a unique username for account lookup." : null}
          </p>
        </div>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="brand-btn-primary rounded-lg px-4 py-2 text-sm font-semibold"
        >
          {loading ? "Working..." : mode === "login" ? "Log In" : "Create Account"}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setUsernameLookup(null);
            setUsernameChecking(false);
          }}
          className="brand-btn-secondary rounded-lg px-4 py-2 text-sm"
        >
          {mode === "login" ? "Need account?" : "Have account?"}
        </button>
      </div>

      {message ? <p className="text-sm text-[#325D88]">{message}</p> : null}
    </form>
  );
}
