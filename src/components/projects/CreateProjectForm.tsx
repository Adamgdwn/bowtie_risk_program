"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { INDUSTRY_OPTIONS } from "@/lib/constants";
import { TEMPLATES } from "@/lib/bowtie/templates";

export function CreateProjectForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [industry, setIndustry] = useState("General");
  const [topEvent, setTopEvent] = useState("");
  const [contextNotes, setContextNotes] = useState("");
  const [templateId, setTemplateId] = useState("general-starter");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

      {error ? <p className="mt-2 text-sm text-[#C7514A]">{error}</p> : null}
    </form>
  );
}
