import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";

export default function LoginPage() {
  return (
    <main className="brand-page min-h-screen p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 py-10 md:flex-row md:items-start">
        <section className="flex-1">
          <p className="brand-accent-chip inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            secure access
          </p>
          <h1 className="brand-heading text-3xl font-bold">Bowtie Risk Builder</h1>
          <p className="brand-text-muted mt-2 max-w-lg">
            Build credible bowties in one session with guided structure, visual editor lanes, AI support, and export.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm text-[#325D88] underline underline-offset-2">
            Back to landing page
          </Link>
        </section>
        <AuthForm />
      </div>
    </main>
  );
}
