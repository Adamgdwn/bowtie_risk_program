alter table if exists public.user_settings
add column if not exists byok_provider text not null default 'auto'
check (byok_provider in ('auto', 'openai', 'openrouter', 'anthropic', 'gemini'));
