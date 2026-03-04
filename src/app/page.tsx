export default function Home() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fef3c7,transparent_35%),radial-gradient(circle_at_bottom_right,#dbeafe,transparent_30%),#f8fafc]">
      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-20">
        <section className="max-w-3xl">
          <h1 className="text-5xl font-bold tracking-tight text-zinc-900">Bowtie Risk Builder</h1>
          <p className="mt-4 text-lg text-zinc-700">
            Build credible Bowtie Method diagrams with structured guidance, drag-and-drop lanes,
            contextual AI suggestions, and shareable exports.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">Free</h2>
            <p className="mt-1 text-sm text-zinc-600">Two projects, bring your own API key.</p>
          </article>
          <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">Pro $10</h2>
            <p className="mt-1 text-sm text-zinc-600">Unlimited projects with BYOK AI support.</p>
          </article>
          <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">Team $30</h2>
            <p className="mt-1 text-sm text-zinc-600">Managed model selection placeholder included.</p>
          </article>
        </section>

        <a
          className="inline-flex w-fit rounded bg-zinc-900 px-5 py-3 text-sm font-semibold text-white"
          href="/login"
        >
          Log in or Create Account
        </a>
      </main>
    </div>
  );
}
