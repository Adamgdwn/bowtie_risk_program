import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { CreateProjectForm } from "@/components/projects/CreateProjectForm";
import { PLAN_LIMITS } from "@/lib/constants";

export default async function DashboardPage() {
  const { user, supabase } = await requireUser();

  const [{ data: projects }, { data: settings }] = await Promise.all([
    supabase.from("projects").select("*").eq("owner_id", user.id).order("updated_at", { ascending: false }),
    supabase
      .from("user_settings")
      .select("plan_tier")
      .eq("user_id", user.id)
      .single(),
  ]);

  const plan = settings?.plan_tier ?? "free";
  const limit = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];

  return (
    <main className="mx-auto max-w-7xl p-4">
      <section className="brand-card rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="brand-heading text-xl font-semibold">Your Bowties</h1>
            <p className="brand-text-muted text-sm">
              Plan: <strong className="capitalize">{plan}</strong>.{" "}
              {Number.isFinite(limit)
                ? `${projects?.length ?? 0}/${limit} active projects.`
                : `${projects?.length ?? 0} active projects.`}
            </p>
          </div>
          <span className="brand-accent-chip rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            governance workspace
          </span>
        </div>
        <p className="brand-text-muted mt-2 text-xs">
          Structured bowtie builder, worksheet guidance, and export-ready output.
        </p>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <CreateProjectForm />
        <aside className="brand-card h-fit rounded-2xl p-4 lg:sticky lg:top-24">
          <h2 className="brand-heading text-sm font-semibold">Quickstart Guide</h2>
          <p className="brand-text-muted mt-1 text-xs">
            Set up a strong first bowtie and unlock AI guidance in under 5 minutes.
          </p>

          <div className="mt-3 space-y-3 text-xs text-[#1F2933]">
            <div className="rounded-xl border border-[#9CA3AF] bg-white/80 p-3">
              <p className="font-semibold">1. Create New Bowtie</p>
              <ul className="brand-text-muted mt-1 list-disc space-y-1 pl-4">
                <li>Enter a clear title and choose your industry.</li>
                <li>Write one specific Top Event statement.</li>
                <li>Optional: add context notes and choose a template.</li>
                <li>Click <strong>Create Project</strong>.</li>
              </ul>
            </div>

            <div className="rounded-xl border border-[#9CA3AF] bg-white/80 p-3">
              <p className="font-semibold">2. Add Your API Key (BYOK)</p>
              <ul className="brand-text-muted mt-1 list-disc space-y-1 pl-4">
                <li>Get an API key from your LLM provider account.</li>
                <li>
                  Open <Link href="/settings" className="text-[#325D88] underline">Settings</Link> and paste it into{" "}
                  <strong>AI Provider API Key (BYOK)</strong>.
                </li>
                <li>Select your BYOK provider and click <strong>Save Settings</strong>.</li>
              </ul>
            </div>

            <div className="rounded-xl border border-[#9CA3AF] bg-white/80 p-3">
              <p className="font-semibold">3. Build + Export</p>
              <ul className="brand-text-muted mt-1 list-disc space-y-1 pl-4">
                <li>Use + buttons to grow threats, barriers, and consequences.</li>
                <li>Use AI actions in the Inspector to draft better controls.</li>
                <li>Export Canvas, Worksheet, or Both as PNG/PDF.</li>
              </ul>
            </div>
          </div>
        </aside>
      </div>

      <section className="brand-card mt-4 rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="brand-heading text-sm font-semibold">Recent projects</h2>
          <span className="brand-stat-pill rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#1F2933]/80">
            most recent first
          </span>
        </div>
        <div className="grid gap-2">
          {(projects ?? []).map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="rounded-xl border border-[#9CA3AF] bg-white/85 p-3 text-sm transition hover:border-[#325D88] hover:bg-white"
            >
              <div className="brand-heading font-semibold">{project.title}</div>
              <div className="brand-text-muted mt-0.5 text-xs">
                {project.industry} | Top event: {project.top_event || "Not set"}
              </div>
            </Link>
          ))}
          {projects?.length === 0 ? (
            <p className="brand-text-muted rounded-xl border border-dashed border-[#9CA3AF] p-3 text-sm">
              No projects yet. Create your first bowtie above.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
