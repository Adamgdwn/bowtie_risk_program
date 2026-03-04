-- Enable UUID support
create extension if not exists "pgcrypto";

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  industry text not null,
  top_event text not null,
  context_notes text,
  workflow_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nodes (
  id text primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null,
  title text not null,
  description text default '',
  position_x numeric not null default 0,
  position_y numeric not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.edges (
  id text primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  source_node_id text not null,
  target_node_id text not null,
  type text default 'smoothstep',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_api_key text,
  has_encrypted_api_key boolean not null default false,
  byok_provider text not null default 'auto' check (byok_provider in ('auto', 'openai', 'openrouter', 'anthropic', 'gemini')),
  selected_model text not null default 'byok',
  plan_tier text not null default 'free' check (plan_tier in ('free', 'pro', 'team')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.nodes enable row level security;
alter table public.edges enable row level security;
alter table public.user_settings enable row level security;

create policy "projects_select_own" on public.projects
for select using (auth.uid() = owner_id);
create policy "projects_insert_own" on public.projects
for insert with check (auth.uid() = owner_id);
create policy "projects_update_own" on public.projects
for update using (auth.uid() = owner_id);
create policy "projects_delete_own" on public.projects
for delete using (auth.uid() = owner_id);

create policy "nodes_select_project_owner" on public.nodes
for select using (
  exists (
    select 1 from public.projects p where p.id = nodes.project_id and p.owner_id = auth.uid()
  )
);
create policy "nodes_insert_project_owner" on public.nodes
for insert with check (
  exists (
    select 1 from public.projects p where p.id = nodes.project_id and p.owner_id = auth.uid()
  )
);
create policy "nodes_update_project_owner" on public.nodes
for update using (
  exists (
    select 1 from public.projects p where p.id = nodes.project_id and p.owner_id = auth.uid()
  )
);
create policy "nodes_delete_project_owner" on public.nodes
for delete using (
  exists (
    select 1 from public.projects p where p.id = nodes.project_id and p.owner_id = auth.uid()
  )
);

create policy "edges_select_project_owner" on public.edges
for select using (
  exists (
    select 1 from public.projects p where p.id = edges.project_id and p.owner_id = auth.uid()
  )
);
create policy "edges_insert_project_owner" on public.edges
for insert with check (
  exists (
    select 1 from public.projects p where p.id = edges.project_id and p.owner_id = auth.uid()
  )
);
create policy "edges_update_project_owner" on public.edges
for update using (
  exists (
    select 1 from public.projects p where p.id = edges.project_id and p.owner_id = auth.uid()
  )
);
create policy "edges_delete_project_owner" on public.edges
for delete using (
  exists (
    select 1 from public.projects p where p.id = edges.project_id and p.owner_id = auth.uid()
  )
);

create policy "user_settings_select_own" on public.user_settings
for select using (auth.uid() = user_id);
create policy "user_settings_insert_own" on public.user_settings
for insert with check (auth.uid() = user_id);
create policy "user_settings_update_own" on public.user_settings
for update using (auth.uid() = user_id);
create policy "user_settings_delete_own" on public.user_settings
for delete using (auth.uid() = user_id);
