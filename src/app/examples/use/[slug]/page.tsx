import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { EXAMPLE_PROJECTS_BY_SLUG } from "@/lib/bowtie/examples";
import { createProjectWithGraph, ensureProjectCreationAllowed } from "@/lib/projects/create-project";

export default async function UseExamplePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const example = EXAMPLE_PROJECTS_BY_SLUG[slug];

  if (!example) {
    redirect("/examples");
  }

  const { user, supabase } = await requireUser(`/examples/use/${slug}`);
  const projectLimitError = await ensureProjectCreationAllowed(supabase, user.id);

  if (projectLimitError) {
    return (
      <main className="brand-page min-h-screen p-6">
        <div className="mx-auto max-w-2xl py-16">
          <section className="brand-card rounded-3xl bg-white p-8">
            <p className="brand-accent-chip inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              Example Template
            </p>
            <h1 className="brand-heading mt-4 text-3xl font-bold tracking-tight">Can&apos;t create another project yet</h1>
            <p className="brand-text-muted mt-3 text-sm">{projectLimitError}</p>
            <p className="brand-text-muted mt-2 text-sm">
              Delete an older project or upgrade your plan, then try using <strong>{example.title}</strong> again.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/dashboard" className="brand-btn-secondary rounded-xl px-5 py-3 text-sm font-semibold">
                Go to Dashboard
              </Link>
              <Link href="/billing" className="brand-btn-primary rounded-xl px-5 py-3 text-sm font-semibold">
                View Plans
              </Link>
              <Link href={`/examples/${slug}`} className="brand-btn-secondary rounded-xl px-5 py-3 text-sm font-semibold">
                Back to Example
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const { error, project } = await createProjectWithGraph(supabase, user.id, {
    title: example.title,
    industry: example.industry,
    topEvent: example.topEvent,
    contextNotes: example.contextNotes,
    nodes: example.nodes,
    edges: example.edges,
  });

  if (error || !project) {
    return (
      <main className="brand-page min-h-screen p-6">
        <div className="mx-auto max-w-2xl py-16">
          <section className="brand-card rounded-3xl bg-white p-8">
            <h1 className="brand-heading text-3xl font-bold tracking-tight">Couldn&apos;t create the example project</h1>
            <p className="brand-text-muted mt-3 text-sm">{error ?? "Something went wrong while copying the example."}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={`/examples/${slug}`} className="brand-btn-secondary rounded-xl px-5 py-3 text-sm font-semibold">
                Back to Example
              </Link>
              <Link href="/dashboard" className="brand-btn-primary rounded-xl px-5 py-3 text-sm font-semibold">
                Go to Dashboard
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  redirect(`/projects/${project.id}`);
}
