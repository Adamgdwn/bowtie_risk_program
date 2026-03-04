import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-zinc-100 p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 py-10 md:flex-row md:items-start">
        <section className="flex-1">
          <h1 className="text-3xl font-bold text-zinc-900">Bowtie Risk Builder</h1>
          <p className="mt-2 max-w-lg text-zinc-700">
            Build credible bowties in one session with guided structure, visual editor lanes, AI support, and export.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm text-blue-700 underline">
            Back to landing page
          </Link>
        </section>
        <AuthForm />
      </div>
    </main>
  );
}
