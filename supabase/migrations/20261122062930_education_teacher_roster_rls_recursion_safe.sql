-- Replace the direct cross-table learner policy to avoid RLS recursion.
drop policy if exists "qa_teacher_assigned_learners" on public.learners;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

create or replace function private.teacher_can_read_learner(p_learner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select auth.uid()) is not null
     and exists (
       select 1
       from public.school_lessons l
       join public.staff s on s.id = l.teacher_id
       join public.enrollments e
         on e.classroom_id = l.classroom_id
        and e.program_id = l.program_id
       join public.learners learner on learner.id = e.learner_id
       where s.auth_user_id = (select auth.uid())
         and s.is_active
         and l.teacher_id = s.id
         and l.classroom_id is not null
         and l.program_id is not null
         and e.learner_id = p_learner_id
         and e.status in ('active', 'enrolled')
         and learner.is_active
     );
$function$;

revoke all on function private.teacher_can_read_learner(uuid) from public;
revoke all on function private.teacher_can_read_learner(uuid) from anon;
grant execute on function private.teacher_can_read_learner(uuid) to authenticated;

create policy "qa_teacher_assigned_learners"
on public.learners
for select
to authenticated
using (private.teacher_can_read_learner(id));
