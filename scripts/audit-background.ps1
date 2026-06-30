param(
  [switch]$SkipBuild,
  [switch]$SkipSupabase
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

function Write-Section {
  param([string]$Title)

  Write-Host ""
  Write-Host "== $Title ==" -ForegroundColor Cyan
}

function Invoke-AuditStep {
  param(
    [string]$Name,
    [string]$Command,
    [string[]]$Arguments
  )

  Write-Section $Name
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE."
  }
}

function Invoke-SupabaseQuery {
  param(
    [string]$Name,
    [string]$Sql
  )

  Write-Section $Name
  $NormalizedSql = $Sql -replace "\s+", " "
  & npx supabase db query --linked $NormalizedSql.Trim()
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE."
  }
}

Write-Host "BRQ Delivery Coverage Hub - background audit" -ForegroundColor Green
Write-Host "Scope: read-only quality checks, build validation, and Supabase consistency queries."
Write-Host "No database writes, no git operations, and no deploy will be executed."

Invoke-AuditStep "TypeScript typecheck" "npm" @("run", "typecheck")
Invoke-AuditStep "ESLint" "npm" @("run", "lint")

if (-not $SkipBuild) {
  Invoke-AuditStep "Production build" "npm" @("run", "build")
}
else {
  Write-Section "Production build"
  Write-Host "Skipped by -SkipBuild."
}

if (-not $SkipSupabase) {
  Invoke-SupabaseQuery "Supabase: managers with renewal target but no customer assignment" @"
select count(*) as missing_manager_assignments
from public.revenue_target_allocations allocation
join public.people person on person.id = allocation.person_id
left join public.person_customer_assignments assignment
  on assignment.person_id = allocation.person_id
 and assignment.customer_id = allocation.customer_id
where allocation.target_type = 'farmer_renewal'
  and allocation.amount > 0
  and coalesce(person.is_manager, false) = true
  and person.role_type not in ('Executive', 'Director', 'Staff')
  and assignment.person_id is null;
"@

  Invoke-SupabaseQuery "Supabase: target allocations assigned to non-assignable roles" @"
select count(*) as non_assignable_target_allocations
from public.revenue_target_allocations allocation
join public.people person on person.id = allocation.person_id
where allocation.amount > 0
  and person.role_type in ('Executive', 'Director', 'Staff');
"@

  Invoke-SupabaseQuery "Supabase: customers with no director" @"
select count(*) as customers_without_director
from public.customers customer
left join public.people director on director.id = customer.director_responsible_id
where customer.director_responsible_id is null
   or director.id is null;
"@

  Invoke-SupabaseQuery "Supabase: orphan person-customer assignments" @"
select count(*) as orphan_assignments
from public.person_customer_assignments assignment
left join public.people person on person.id = assignment.person_id
left join public.customers customer on customer.id = assignment.customer_id
where person.id is null
   or customer.id is null;
"@

  Invoke-SupabaseQuery "Supabase: duplicated hunter ownership by customer" @"
select count(*) as customers_with_multiple_hunters
from (
  select assignment.customer_id
  from public.person_customer_assignments assignment
  join public.people person on person.id = assignment.person_id
  where person.role_type in ('Hunter', 'Hunter + Farmer')
  group by assignment.customer_id
  having count(distinct assignment.person_id) > 1
) duplicated_hunters;
"@

  Invoke-SupabaseQuery "Supabase: duplicated hunter ownership details" @"
select
  customer.name as customer_name,
  string_agg(person.name, ', ' order by person.name) as hunters,
  count(distinct assignment.person_id) as hunter_count
from public.person_customer_assignments assignment
join public.people person on person.id = assignment.person_id
join public.customers customer on customer.id = assignment.customer_id
where person.role_type in ('Hunter', 'Hunter + Farmer')
group by customer.id, customer.name
having count(distinct assignment.person_id) > 1
order by customer.name;
"@

  Invoke-SupabaseQuery "Supabase: customers where allocated people targets exceed customer total target" @"
select count(*) as customers_over_allocated
from (
  select
    customer.id,
    customer.name,
    coalesce(customer.revenue, 0) as customer_target,
    coalesce(sum(allocation.amount), 0) as allocated_target
  from public.customers customer
  left join public.revenue_target_allocations allocation
    on allocation.customer_id = customer.id
   and allocation.target_year = 2026
  group by customer.id, customer.name, customer.revenue
  having coalesce(sum(allocation.amount), 0) > coalesce(customer.revenue, 0) + 0.01
) over_allocated;
"@
}
else {
  Write-Section "Supabase consistency queries"
  Write-Host "Skipped by -SkipSupabase."
}

Write-Section "Audit completed"
Write-Host "Command execution finished. Review any non-zero counters above before treating the data as fully reconciled." -ForegroundColor Yellow
