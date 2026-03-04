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
      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h1 className="text-xl font-semibold text-zinc-900">Your Bowties</h1>
        <p className="text-sm text-zinc-600">
          Plan: <strong>{plan}</strong>.{" "}
          {Number.isFinite(limit)
            ? `${projects?.length ?? 0}/${limit} active projects.`
            : `${projects?.length ?? 0} active projects.`}
        </p>
      </section>

      <div className="mt-4">
        <CreateProjectForm />
      </div>

      <section className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Recent projects</h2>
        <div className="mt-3 grid gap-2">
          {(projects ?? []).map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="rounded border border-zinc-200 bg-zinc-50 p-3 text-sm hover:bg-zinc-100"
            >
              <div className="font-semibold text-zinc-900">{project.title}</div>
              <div className="text-xs text-zinc-600">
                {project.industry} | Top event: {project.top_event}
              </div>
            </Link>
          ))}
          {projects?.length === 0 ? (
            <p className="rounded border border-dashed border-zinc-300 p-3 text-sm text-zinc-600">
              No projects yet. Create your first bowtie above.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
