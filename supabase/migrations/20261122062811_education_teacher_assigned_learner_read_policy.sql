-- Allow teachers to read only active learners enrolled in a class/program
-- covered by one of their own assigned lessons. Existing learner/self,
-- guardian, and admin policies remain unchanged.
create policy "qa_teacher_assigned_learners"
on public.learners
for select
to authenticated
using (
  is_active
  and exists (
    select 1
    from public.school_lessons l
    join public.staff s on s.id = l.teacher_id
    join public.enrollments e
      on e.classroom_id = l.classroom_id
     and e.program_id = l.program_id
    where s.auth_user_id = (select auth.uid())
      and s.is_active
      and l.teacher_id = s.id
      and l.classroom_id is not null
      and l.program_id is not null
      and e.learner_id = learners.id
      and e.status in ('active', 'enrolled')
  )
);
