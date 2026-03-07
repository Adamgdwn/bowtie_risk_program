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

      <div className="mt-4">
        <CreateProjectForm />
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
