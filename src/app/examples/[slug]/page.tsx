import Link from "next/link";
import { notFound } from "next/navigation";
import { BowtieEditor } from "@/components/editor/BowtieEditor";
import { EXAMPLE_PROJECTS, EXAMPLE_PROJECTS_BY_SLUG } from "@/lib/bowtie/examples";

export function generateStaticParams() {
  return EXAMPLE_PROJECTS.map((example) => ({ slug: example.slug }));
}

export default async function ExampleProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const example = EXAMPLE_PROJECTS_BY_SLUG[slug];

  if (!example) {
    notFound();
  }

  return (
    <div className="brand-page min-h-screen">
      <header className="border-b border-[#9CA3AF] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="brand-heading text-sm font-semibold tracking-wide">Bowtie Risk Builder</p>
            <p className="brand-text-muted text-xs">
              Public example canvas: {example.title} | {example.industry}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/examples" className="brand-btn-secondary rounded-lg px-4 py-2 text-sm font-semibold">
              All Examples
            </Link>
            <Link
              href={`/examples/use/${example.slug}`}
              className="brand-btn-secondary rounded-lg px-4 py-2 text-sm font-semibold"
            >
              Use as Template
            </Link>
            <Link href="/login?mode=signup" className="brand-btn-primary rounded-lg px-4 py-2 text-sm font-semibold">
              Start Free
            </Link>
          </div>
        </div>
      </header>

      <BowtieEditor
        projectId={`example-${example.slug}`}
        projectMeta={{
          title: `Example Bowtie: ${example.title}`,
          industry: example.industry,
          topEvent: example.topEvent,
          contextNotes: example.contextNotes,
        }}
        initialNodes={example.nodes}
        initialEdges={example.edges}
        readOnly
      />
    </div>
  );
}
