"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { INDUSTRY_OPTIONS } from "@/lib/constants";
import { TEMPLATES } from "@/lib/bowtie/templates";

type RecentProject = {
  id: string;
  title: string;
  industry: string;
  top_event: string | null;
};

type CreateProjectFormProps = {
  initialProjects: RecentProject[];
};

export function CreateProjectForm({ initialProjects }: CreateProjectFormProps) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [title, setTitle] = useState("");
  const [industry, setIndustry] = useState("General");
  const [topEvent, setTopEvent] = useState("");
  const [contextNotes, setContextNotes] = useState("");
  const [templateId, setTemplateId] = useState("general-starter");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, industry, topEvent, contextNotes, templateId }),
    });
    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to create project.");
      return;
    }

    router.push(`/projects/${payload.project.id}`);
  }

  async function deleteProject(projectId: string, projectTitle: string) {
    const confirmed = window.confirm(`Delete "${projectTitle}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setDeletingProjectId(projectId);
    setError("");

    const response = await fetch(`/api/projects/${projectId}`, {
      method: "DELETE",
    });
    const payload = await response.json();

    setDeletingProjectId(null);

    if (!response.ok) {
      setError(payload.error ?? "Unable to delete project.");
      return;
    }

    setProjects((currentProjects) => currentProjects.filter((project) => project.id !== projectId));
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="brand-card rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="brand-heading text-sm font-semibold">Create New Bowtie</h2>
        <span className="brand-accent-chip rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
          start in minutes
        </span>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <input
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title"
          className="brand-input rounded-lg px-3 py-2 text-sm"
        />
        <select
          value={industry}
          onChange={(event) => setIndustry(event.target.value)}
          className="brand-select rounded-lg px-3 py-2 text-sm"
        >
          {INDUSTRY_OPTIONS.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </div>

      <input
        required
        value={topEvent}
        onChange={(event) => setTopEvent(event.target.value)}
        placeholder="Top Event (required)"
        className="brand-input mt-2 w-full rounded-lg px-3 py-2 text-sm"
      />

      <textarea
        value={contextNotes}
        onChange={(event) => setContextNotes(event.target.value)}
        placeholder="Optional context notes (site/process/asset)"
        className="brand-textarea mt-2 h-24 w-full rounded-lg px-3 py-2 text-sm"
      />

      <select
        value={templateId}
        onChange={(event) => setTemplateId(event.target.value)}
        className="brand-select mt-2 w-full rounded-lg px-3 py-2 text-sm"
      >
        <option value="general-starter">Template: General starter</option>
        {TEMPLATES.filter((template) => template.id !== "general-starter").map((template) => (
          <option key={template.id} value={template.id}>
            Template: {template.name}
          </option>
        ))}
      </select>

      <button disabled={loading} className="brand-btn-primary mt-2 rounded-lg px-4 py-2 text-sm font-semibold">
        {loading ? "Creating..." : "Create Project"}
      </button>

      <div className="mt-5 border-t border-[#9CA3AF]/70 pt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="brand-heading text-sm font-semibold">Recent projects</h3>
          <span className="brand-stat-pill rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#1F2933]/80">
            most recent first
          </span>
        </div>

        <div className="grid gap-2">
          {projects.map((project) => (
            <div
              key={project.id}
              className="flex items-center gap-3 rounded-xl border border-[#9CA3AF] bg-white/85 p-3 text-sm transition hover:border-[#325D88] hover:bg-white"
            >
              <button
                type="button"
                onClick={() => router.push(`/projects/${project.id}`)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="brand-heading truncate font-semibold">{project.title}</div>
                <div className="brand-text-muted mt-0.5 text-xs">
                  {project.industry} | Top event: {project.top_event || "Not set"}
                </div>
              </button>
              <button
                type="button"
                onClick={() => deleteProject(project.id, project.title)}
                disabled={deletingProjectId === project.id}
                className="shrink-0 rounded-lg border border-[#C7514A]/50 px-3 py-2 text-xs font-semibold text-[#8F2D27] transition hover:bg-[#C7514A]/8 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingProjectId === project.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          ))}

          {projects.length === 0 ? (
            <p className="brand-text-muted rounded-xl border border-dashed border-[#9CA3AF] p-3 text-sm">
              No projects yet. Create your first bowtie above.
            </p>
          ) : null}
        </div>
      </div>

      {error ? <p className="mt-2 text-sm text-[#C7514A]">{error}</p> : null}
    </form>
  );
}
