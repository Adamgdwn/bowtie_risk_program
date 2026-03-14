import Link from "next/link";
import { EXAMPLE_PROJECTS } from "@/lib/bowtie/examples";

export default function ExamplesIndexPage() {
  return (
    <div className="brand-page min-h-screen">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <header className="brand-card flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white/90 px-5 py-4 shadow-sm backdrop-blur">
          <div>
            <p className="brand-heading text-sm font-semibold tracking-wide">Bowtie Risk Builder</p>
            <h1 className="brand-heading mt-1 text-3xl font-bold tracking-tight">Public Example Bowties</h1>
            <p className="brand-text-muted mt-2 max-w-3xl text-sm">
              Review complete sample canvases across AI governance, utilities, industrial operations, and healthcare.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="brand-btn-secondary rounded-lg px-4 py-2 text-sm font-semibold">
              Back Home
            </Link>
            <Link href="/login?mode=signup" className="brand-btn-primary rounded-lg px-4 py-2 text-sm font-semibold">
              Start Free
            </Link>
          </div>
        </header>

        <main className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {EXAMPLE_PROJECTS.map((example) => (
            <article key={example.slug} className="brand-card rounded-3xl bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="brand-accent-chip inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider">
                    {example.industry}
                  </p>
                  <h2 className="brand-heading mt-3 text-xl font-semibold">{example.title}</h2>
                </div>
              </div>
              <p className="brand-text-muted mt-3 text-sm">{example.summary}</p>
              <p className="mt-4 text-sm font-semibold text-[#1F2933]">Top event</p>
              <p className="brand-text-muted mt-1 text-sm">{example.topEvent}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {example.highlights.map((highlight) => (
                  <span
                    key={highlight}
                    className="rounded-full border border-[#9CA3AF] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#1F2933]/80"
                  >
                    {highlight}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href={`/examples/${example.slug}`}
                  className="brand-btn-secondary inline-flex rounded-xl px-4 py-2 text-sm font-semibold"
                >
                  Open Example
                </Link>
                <Link
                  href={`/examples/use/${example.slug}`}
                  className="brand-btn-primary inline-flex rounded-xl px-4 py-2 text-sm font-semibold"
                >
                  Use as Template
                </Link>
              </div>
            </article>
          ))}
        </main>
      </div>
    </div>
  );
}
