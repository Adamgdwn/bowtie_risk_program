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
      <section className="brand-card rounded-xl p-4">
        <h1 className="brand-heading text-xl font-semibold">Your Bowties</h1>
        <p className="brand-text-muted text-sm">
          Plan: <strong>{plan}</strong>.{" "}
          {Number.isFinite(limit)
            ? `${projects?.length ?? 0}/${limit} active projects.`
            : `${projects?.length ?? 0} active projects.`}
        </p>
      </section>

      <div className="mt-4">
        <CreateProjectForm />
      </div>

      <section className="brand-card mt-4 rounded-xl p-4">
        <h2 className="brand-heading text-sm font-semibold">Recent projects</h2>
        <div className="mt-3 grid gap-2">
          {(projects ?? []).map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="rounded border border-[#9CA3AF] bg-[#F5F3F0] p-3 text-sm hover:bg-[#ece8e2]"
            >
              <div className="brand-heading font-semibold">{project.title}</div>
              <div className="brand-text-muted text-xs">
                {project.industry} | Top event: {project.top_event}
              </div>
            </Link>
          ))}
          {projects?.length === 0 ? (
            <p className="brand-text-muted rounded border border-dashed border-[#9CA3AF] p-3 text-sm">
              No projects yet. Create your first bowtie above.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
