import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();

  return (
    <div className="min-h-screen bg-zinc-100">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm font-semibold text-zinc-900">
              Bowtie Risk Builder
            </Link>
            <nav className="flex items-center gap-3 text-sm text-zinc-700">
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/settings">Settings</Link>
              <Link href="/billing">Billing</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">{user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
