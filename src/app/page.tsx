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
    <div className="brand-page min-h-screen">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <header className="brand-card flex items-center justify-between rounded-2xl bg-white/90 px-5 py-3 shadow-sm backdrop-blur">
          <div className="brand-heading text-sm font-semibold tracking-wide">Bowtie Risk Builder</div>
          <nav className="brand-text-muted hidden items-center gap-6 text-sm md:flex">
            <a href="#how-it-works" className="hover:text-[#1F2933]">
              How It Works
            </a>
            <a href="#features" className="hover:text-[#1F2933]">
              Features
            </a>
            <a href="#pricing" className="hover:text-[#1F2933]">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="brand-btn-secondary rounded-lg px-4 py-2 text-sm font-semibold">
              Sign In
            </Link>
            <Link href="/login?mode=signup" className="brand-btn-primary rounded-lg px-4 py-2 text-sm font-semibold">
              Sign Up
            </Link>
          </div>
        </header>

        <main className="space-y-20 py-10">
          <section className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="brand-accent-chip inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                Audit-ready Bowtie Workflow
              </p>
              <h1 className="brand-heading mt-4 text-4xl font-bold tracking-tight md:text-6xl">
                Build defensible bowtie risk assessments in minutes.
              </h1>
              <p className="brand-text-muted mt-5 max-w-xl text-lg leading-relaxed">
                A structured bowtie platform for safety, governance, and risk teams aligned to ISO 31000 style
                thinking, control assurance, and critical event readiness.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/login?mode=signup"
                  className="brand-btn-primary rounded-xl px-5 py-3 text-sm font-semibold shadow-sm"
                >
                  Start Free Project
                </Link>
                <Link
                  href="/login?mode=signup"
                  className="brand-btn-secondary rounded-xl px-5 py-3 text-sm font-semibold"
                >
                  Sign Up
                </Link>
                <Link href="/examples/ai-data-breach" className="brand-btn-secondary rounded-xl px-5 py-3 text-sm font-semibold">
                  View Example Bowtie
                </Link>
              </div>
            </div>

            <div className="brand-card rounded-2xl bg-white p-4 shadow-xl shadow-zinc-300/50">
              <div className="mb-3 flex items-center gap-2 border-b border-[#9CA3AF] pb-3">
                <span className="h-2.5 w-2.5 rounded-full bg-[#C7514A]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#D4A547]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#4CAF50]" />
                <span className="brand-text-muted ml-2 text-xs">Bowtie Risk Builder</span>
              </div>
              <div className="rounded-xl border border-[#9CA3AF] bg-[#F5F3F0] p-3">
                <div className="brand-text-muted grid grid-cols-5 overflow-hidden rounded-lg border border-[#9CA3AF] text-[10px] font-semibold uppercase tracking-wider">
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

          <section className="brand-card grid gap-6 rounded-3xl bg-white p-8 lg:grid-cols-2">
            <div>
              <h2 className="brand-heading text-2xl font-bold tracking-tight">Common Risk Program Friction</h2>
              <ul className="brand-text-muted mt-4 space-y-3 text-sm">
                {problemPoints.map((point) => (
                  <li key={point} className="rounded-lg border border-[#9CA3AF] bg-[#F5F3F0] px-3 py-2">
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-[#325D88]">What Changes With Bowtie Risk Builder</h2>
              <ul className="mt-4 space-y-3 text-sm text-[#1F2933]">
                {solutionPoints.map((point) => (
                  <li key={point} className="rounded-lg border border-[#9CA3AF] bg-white px-3 py-2">
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section id="how-it-works" className="space-y-6">
            <h2 className="brand-heading text-3xl font-bold tracking-tight">How It Works</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {workflowSteps.map((step, index) => (
                <article
                  key={step.title}
                  className="brand-card rounded-2xl bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="brand-btn-primary inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
                    {index + 1}
                  </div>
                  <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
                  <p className="brand-text-muted mt-2 text-sm">{step.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="features" className="space-y-6">
            <h2 className="brand-heading text-3xl font-bold tracking-tight">Bowtie-Specific Capabilities</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <article
                  key={feature.title}
                  className="brand-card rounded-2xl bg-white p-5 shadow-sm transition hover:border-[#325D88] hover:shadow-md"
                >
                  <h3 className="text-lg font-semibold">{feature.title}</h3>
                  <p className="brand-text-muted mt-2 text-sm">{feature.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="brand-card rounded-3xl bg-white p-8">
            <h2 className="brand-heading text-3xl font-bold tracking-tight">Built for Governance Confidence</h2>
            <p className="brand-text-muted mt-3 max-w-4xl text-sm">
              Aligned with modern risk frameworks and concepts including ISO 31000, COSO, NIST AI RMF, and
              ISO/IEC 42001-informed governance practices.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-[#9CA3AF] bg-[#F5F3F0] p-4 text-sm text-[#1F2933]">
                Audit and leadership discussions now start from one trusted view of controls.
              </div>
              <div className="rounded-xl border border-[#9CA3AF] bg-[#F5F3F0] p-4 text-sm text-[#1F2933]">
                The worksheet flow makes cross-functional workshops faster and more concrete.
              </div>
              <div className="rounded-xl border border-[#9CA3AF] bg-[#F5F3F0] p-4 text-sm text-[#1F2933]">
                Barrier ownership and assurance details are much clearer than in slide-based bowties.
              </div>
            </div>
            <div className="brand-text-muted mt-6 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wider">
              <span className="rounded-full border border-[#9CA3AF] px-3 py-1">Built for Municipalities</span>
              <span className="rounded-full border border-[#9CA3AF] px-3 py-1">Built for Utilities</span>
              <span className="rounded-full border border-[#9CA3AF] px-3 py-1">Built for Regulated Operations</span>
            </div>
          </section>

          <section id="pricing" className="space-y-6">
            <h2 className="brand-heading text-3xl font-bold tracking-tight">Simple Pricing, Fast Start</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <article className="brand-card rounded-2xl bg-white p-6 shadow-sm">
                <h3 className="text-xl font-semibold">Free</h3>
                <p className="brand-text-muted mt-1 text-sm">2 active projects, core bowtie builder, exports.</p>
                <p className="mt-4 text-3xl font-bold">$0</p>
              </article>
              <article className="brand-card rounded-2xl bg-white p-6 shadow-sm">
                <h3 className="text-xl font-semibold">Pro / Team</h3>
                <p className="mt-1 text-sm text-[#1F2933]">
                  More projects, collaboration workflows, custom templates, advanced governance capability.
                </p>
                <p className="mt-4 text-3xl font-bold">$10 / $30</p>
              </article>
            </div>
            <p className="text-sm font-semibold text-[#1F2933]">No credit card required to start.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/login?mode=signup" className="brand-btn-primary rounded-xl px-5 py-3 text-sm font-semibold">
                Start Free Project
              </Link>
              <Link href="/login?mode=signup" className="brand-btn-secondary rounded-xl px-5 py-3 text-sm font-semibold">
                Sign Up
              </Link>
              <a
                href="mailto:hello@bowtieriskbuilder.com"
                className="brand-btn-secondary rounded-xl px-5 py-3 text-sm font-semibold"
              >
                Book a Walkthrough
              </a>
            </div>
          </section>
        </main>

        <footer className="border-t border-[#9CA3AF] py-8 text-sm text-[#1F2933]/70">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p>(c) {new Date().getFullYear()} Bowtie Risk Builder</p>
            <div className="flex flex-wrap gap-4">
              <a href="#" className="hover:text-[#1F2933]">
                About
              </a>
              <a href="#" className="hover:text-[#1F2933]">
                Contact
              </a>
              <a href="#" className="hover:text-[#1F2933]">
                Terms
              </a>
              <a href="#" className="hover:text-[#1F2933]">
                Privacy
              </a>
              <a href="#" className="hover:text-[#1F2933]">
                Documentation
              </a>
              <a href="#" className="hover:text-[#1F2933]">
                Support
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
