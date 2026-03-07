import Link from "next/link";

const problemPoints = [
  "Bowties are scattered across slides, docs, and whiteboards.",
  "Control ownership is unclear when incidents are reviewed.",
  "Barrier quality varies between teams and projects.",
  "Regulator and board reporting takes too much manual effort.",
];

const solutionPoints = [
  "Build in one structured workspace with guided bowtie lanes.",
  "Assign owners, standards, and verification fields per barrier.",
  "Use templates and AI guidance to improve consistency.",
  "Export audit-ready visuals for governance conversations fast.",
];

const workflowSteps = [
  {
    title: "Define Top Event",
    description: "Capture hazard context and state the precise loss-of-control event.",
  },
  {
    title: "Map Threats + Consequences",
    description: "Build the left and right side of exposure with clear cause and impact statements.",
  },
  {
    title: "Add Barriers + Ownership",
    description: "Insert preventive and mitigative controls with accountable owners and standards.",
  },
  {
    title: "Export + Share",
    description: "Generate board-ready outputs and align teams on critical event controls.",
  },
];

const features = [
  {
    title: "Template Library",
    description: "Start quickly with safety, cyber, AI governance, and operations bowtie starters.",
  },
  {
    title: "Governance Fields",
    description: "Capture owners, review notes, assurance details, and control categories by block.",
  },
  {
    title: "Change Tracking",
    description: "Keep an evolving record of updates, assumptions, and workshop decisions.",
  },
  {
    title: "Multi-Project Dashboard",
    description: "Manage all active bowties in one view with tier-based project controls.",
  },
  {
    title: "Barrier Evidence",
    description: "Attach support context and verification methods to strengthen assurance quality.",
  },
  {
    title: "Export Options",
    description: "Produce PNG and JSON outputs for reviews, reports, and governance packs.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <header className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white/90 px-5 py-3 shadow-sm backdrop-blur">
          <div className="text-sm font-semibold tracking-wide text-zinc-800">Bowtie Risk Builder</div>
          <nav className="hidden items-center gap-6 text-sm text-zinc-600 md:flex">
            <a href="#how-it-works" className="hover:text-zinc-900">
              How It Works
            </a>
            <a href="#features" className="hover:text-zinc-900">
              Features
            </a>
            <a href="#pricing" className="hover:text-zinc-900">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-cyan-500 hover:text-cyan-700"
            >
              Sign In
            </Link>
            <Link
              href="/login?mode=signup"
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700"
            >
              Sign Up
            </Link>
          </div>
        </header>

        <main className="space-y-20 py-10">
          <section className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-700">
                Audit-ready Bowtie Workflow
              </p>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-zinc-900 md:text-6xl">
                Build defensible bowtie risk assessments in minutes.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-zinc-600">
                A structured bowtie platform for safety, governance, and risk teams aligned to ISO 31000 style
                thinking, control assurance, and critical event readiness.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/login?mode=signup"
                  className="rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700"
                >
                  Start Free Project
                </Link>
                <Link
                  href="/login?mode=signup"
                  className="rounded-xl border border-cyan-300 bg-cyan-50 px-5 py-3 text-sm font-semibold text-cyan-800 transition hover:border-cyan-500"
                >
                  Sign Up
                </Link>
                <Link
                  href="/login"
                  className="rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 transition hover:border-zinc-500"
                >
                  View Example Bowtie
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl shadow-zinc-200/70">
              <div className="mb-3 flex items-center gap-2 border-b border-zinc-200 pb-3">
                <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                <span className="ml-2 text-xs text-zinc-500">Bowtie Risk Builder</span>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <div className="grid grid-cols-5 overflow-hidden rounded-lg border border-zinc-200 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  <div className="bg-cyan-100/70 p-2 text-center">Threats</div>
                  <div className="bg-amber-100/70 p-2 text-center">Preventive</div>
                  <div className="bg-orange-100/70 p-2 text-center">Top Event</div>
                  <div className="bg-sky-100/70 p-2 text-center">Mitigative</div>
                  <div className="bg-indigo-100/70 p-2 text-center">Consequences</div>
                </div>
                <div className="mt-3 grid grid-cols-5 gap-2 text-xs">
                  <div className="rounded border border-red-300 bg-red-50 p-2">Corrosion leading to rupture</div>
                  <div className="rounded border border-amber-300 bg-amber-50 p-2">Inspection + integrity management</div>
                  <div className="rounded border border-orange-300 bg-orange-50 p-2 font-semibold">Loss of containment</div>
                  <div className="rounded border border-sky-300 bg-sky-50 p-2">Emergency isolation response</div>
                  <div className="rounded border border-indigo-300 bg-indigo-50 p-2">Public safety impact</div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 rounded-3xl border border-zinc-200 bg-white p-8 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Common Risk Program Friction</h2>
              <ul className="mt-4 space-y-3 text-sm text-zinc-600">
                {problemPoints.map((point) => (
                  <li key={point} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-cyan-700">What Changes With Bowtie Risk Builder</h2>
              <ul className="mt-4 space-y-3 text-sm text-zinc-700">
                {solutionPoints.map((point) => (
                  <li key={point} className="rounded-lg border border-cyan-200 bg-cyan-50/60 px-3 py-2">
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section id="how-it-works" className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">How It Works</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {workflowSteps.map((step, index) => (
                <article
                  key={step.title}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-cyan-600 text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600">{step.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="features" className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Bowtie-Specific Capabilities</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <article
                  key={feature.title}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-cyan-300 hover:shadow-md"
                >
                  <h3 className="text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600">{feature.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white p-8">
            <h2 className="text-3xl font-bold tracking-tight">Built for Governance Confidence</h2>
            <p className="mt-3 max-w-4xl text-sm text-zinc-600">
              Aligned with modern risk frameworks and concepts including ISO 31000, COSO, NIST AI RMF, and
              ISO/IEC 42001-informed governance practices.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                “Audit and leadership discussions now start from one trusted view of controls.”
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                “The worksheet flow makes cross-functional workshops faster and more concrete.”
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                “Barrier ownership and assurance details are much clearer than in slide-based bowties.”
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <span className="rounded-full border border-zinc-300 px-3 py-1">Built for Municipalities</span>
              <span className="rounded-full border border-zinc-300 px-3 py-1">Built for Utilities</span>
              <span className="rounded-full border border-zinc-300 px-3 py-1">Built for Regulated Operations</span>
            </div>
          </section>

          <section id="pricing" className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Simple Pricing, Fast Start</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <article className="rounded-2xl border border-zinc-300 bg-white p-6 shadow-sm">
                <h3 className="text-xl font-semibold">Free</h3>
                <p className="mt-1 text-sm text-zinc-600">2 active projects, core bowtie builder, exports.</p>
                <p className="mt-4 text-3xl font-bold">$0</p>
              </article>
              <article className="rounded-2xl border border-cyan-300 bg-cyan-50/50 p-6 shadow-sm">
                <h3 className="text-xl font-semibold">Pro / Team</h3>
                <p className="mt-1 text-sm text-zinc-700">
                  More projects, collaboration workflows, custom templates, advanced governance capability.
                </p>
                <p className="mt-4 text-3xl font-bold">$10 / $30</p>
              </article>
            </div>
            <p className="text-sm font-semibold text-zinc-700">No credit card required to start.</p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/login?mode=signup"
                className="rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700"
              >
                Start Free Project
              </Link>
              <Link
                href="/login?mode=signup"
                className="rounded-xl border border-cyan-300 bg-cyan-50 px-5 py-3 text-sm font-semibold text-cyan-800 transition hover:border-cyan-500"
              >
                Sign Up
              </Link>
              <a
                href="mailto:hello@bowtieriskbuilder.com"
                className="rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 transition hover:border-zinc-500"
              >
                Book a Walkthrough
              </a>
            </div>
          </section>
        </main>

        <footer className="border-t border-zinc-200 py-8 text-sm text-zinc-600">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p>© {new Date().getFullYear()} Bowtie Risk Builder</p>
            <div className="flex flex-wrap gap-4">
              <a href="#" className="hover:text-zinc-900">
                About
              </a>
              <a href="#" className="hover:text-zinc-900">
                Contact
              </a>
              <a href="#" className="hover:text-zinc-900">
                Terms
              </a>
              <a href="#" className="hover:text-zinc-900">
                Privacy
              </a>
              <a href="#" className="hover:text-zinc-900">
                Documentation
              </a>
              <a href="#" className="hover:text-zinc-900">
                Support
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
