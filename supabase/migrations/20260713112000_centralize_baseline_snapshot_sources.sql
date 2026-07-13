-- Add source metadata to Studio baseline snapshots so imports can be centralized
-- by origin (PX, Aliancas, Mobile, Analytics, GENAI or general Studios).

alter table public.studio_baseline_snapshots
  add column if not exists source_code text not null default 'studio_general',
  add column if not exists source_name text not null default 'Baseline geral de Studios';

create index if not exists studio_baseline_snapshots_source_year_created_idx
  on public.studio_baseline_snapshots(source_code, baseline_year, created_at desc);

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'studio_baseline_snapshots'
      and column_name = 'source_code'
  ) then
    raise exception 'source_code was not added to studio_baseline_snapshots';
  end if;
end $$;

notify pgrst, 'reload schema';
