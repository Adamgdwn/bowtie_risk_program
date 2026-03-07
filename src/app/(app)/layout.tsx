import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();

  return (
    <div className="brand-page min-h-screen">
      <header className="brand-card border-x-0 border-t-0">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="brand-heading text-sm font-semibold">
              Bowtie Risk Builder
            </Link>
            <nav className="flex items-center gap-3 text-sm text-[#1f2933]">
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/settings">Settings</Link>
              <Link href="/billing">Billing</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#1f2933]/65">{user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
