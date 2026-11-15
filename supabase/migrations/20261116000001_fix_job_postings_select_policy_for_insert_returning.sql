-- Allow company users to read their own postings directly from the row.
-- This is important for INSERT ... RETURNING: a SELECT policy that calls
-- can_view_posting(id) queries job_postings before the inserted row is visible.
-- The direct predicates preserve tenant isolation and published visibility.

drop policy if exists job_postings_select on public.job_postings;

create policy job_postings_select on public.job_postings
  for select to authenticated
  using (
    company_id = (select public.auth_company_id())
    or (select public.is_platform_admin())
    or (
      status = 'published'
      and (
        visibility = 'all_universities'
        or exists (
          select 1
          from public.posting_universities pu
          where pu.posting_id = job_postings.id
            and pu.university_id = (select public.auth_university_id())
        )
      )
    )
  );
