alter table if exists public.projects
add column if not exists workflow_state jsonb not null default '{}'::jsonb;
