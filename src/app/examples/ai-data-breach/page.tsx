import Link from "next/link";
import { BowtieEditor } from "@/components/editor/BowtieEditor";
import {
  EXAMPLE_PROJECT_EDGES,
  EXAMPLE_PROJECT_META,
  EXAMPLE_PROJECT_NODES,
} from "@/lib/bowtie/example-project";

export default function ExampleAiDataBreachPage() {
  return (
    <div className="brand-page min-h-screen">
      <header className="border-b border-[#9CA3AF] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="brand-heading text-sm font-semibold tracking-wide">Bowtie Risk Builder</p>
            <p className="brand-text-muted text-xs">Public example canvas: AI data breach</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="brand-btn-secondary rounded-lg px-4 py-2 text-sm font-semibold">
              Back Home
            </Link>
            <Link href="/login?mode=signup" className="brand-btn-primary rounded-lg px-4 py-2 text-sm font-semibold">
              Start Free
            </Link>
          </div>
        </div>
      </header>

      <BowtieEditor
        projectId="example-ai-data-breach"
        projectMeta={EXAMPLE_PROJECT_META}
        initialNodes={EXAMPLE_PROJECT_NODES}
        initialEdges={EXAMPLE_PROJECT_EDGES}
        readOnly
      />
    </div>
  );
}
