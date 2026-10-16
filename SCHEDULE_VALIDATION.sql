-- Read-only timetable and readiness checks. No DML statements.
-- Run in Supabase SQL Editor with an authorized operator account.

-- A. Verify the six-part daily clock and the half-hour break.
select day_of_week,
       count(*) filter (where is_active) as active_periods,
       count(*) filter (where is_active and period_type = 'lesson' and lesson_minutes = 30) as thirty_min_lessons,
       max(end_time) filter (where period_number = 3) as period3_end,
       min(start_time) filter (where period_number = 4) as period4_start,
       extract(epoch from (
         min(start_time) filter (where period_number = 4) -
         max(end_time) filter (where period_number = 3)
       ))/60 as break_minutes
from public.edu_schedule_periods
group by day_of_week
order by day_of_week;

-- B. Weekly schedule coverage by active general-education grade.
-- Target after schedule is properly built: 30 weekly slots per active grade.
select g.code, g.name_ar, count(e.id) as entries,
       count(e.id) filter (where e.is_published) as entries_marked_published,
       count(distinct p.day_of_week) as represented_days,
       count(distinct (p.day_of_week,p.period_number)) as weekly_slots
from public.edu_grade_levels g
join public.edu_class_sections s on s.grade_level_id=g.id and s.is_active
left join public.edu_school_schedule_entries e on e.section_id=s.id
left join public.edu_schedule_periods p on p.id=e.period_id
where g.is_general_education and g.is_active
group by g.code,g.name_ar,g.level_order
order by g.level_order;

-- C. Foreign-key integrity against the actual subjects table.
select count(*) as total_entries,
       count(*) filter(where e.is_published) as flagged_published,
       count(*) filter(where s.id is null) as orphan_sections,
       count(*) filter(where p.id is null) as orphan_periods,
       count(*) filter(where sub.id is null) as orphan_subjects,
       count(*) filter(where st.id is null) as orphan_staff,
       count(*) filter(where e.teacher_id is null) as missing_teacher_id
from public.edu_school_schedule_entries e
left join public.edu_class_sections s on s.id=e.section_id
left join public.edu_schedule_periods p on p.id=e.period_id
left join public.subjects sub on sub.id=e.subject_id
left join public.staff st on st.id=e.teacher_id;

-- D. Same teacher booked into simultaneous schedule periods: expected zero rows.
select p.day_of_week,p.period_number,a.teacher_id,count(*) as simultaneous_assignments
from public.edu_teacher_schedule_assignments a
join public.edu_schedule_periods p on p.id=a.period_id
group by p.day_of_week,p.period_number,a.teacher_id
having count(*) > 1
order by p.day_of_week,p.period_number;

-- E. Compare real program/course schedules to templates.
select 'edu_global_program_blueprints' as table_name,count(*) as rows from public.edu_global_program_blueprints
union all select 'edu_program_schedule_rules',count(*) from public.edu_program_schedule_rules
union all select 'edu_program_schedules',count(*) from public.edu_program_schedules
union all select 'edu_university_schedule',count(*) from public.edu_university_schedule
union all select 'edu_vocational_schedule',count(*) from public.edu_vocational_schedule
union all select 'edu_elearning_courses',count(*) from public.edu_elearning_courses
union all select 'edu_elearning_schedule',count(*) from public.edu_elearning_schedule
union all select 'edu_university_programs',count(*) from public.edu_university_programs
union all select 'edu_vocational_programs',count(*) from public.edu_vocational_programs;

-- F. Aggregate login linkage only; never export personal names/emails.
select 'staff' as entity,count(*) as rows,
       count(*) filter(where auth_user_id is not null) as linked_accounts
from public.staff
union all
select 'learners',count(*),count(*) filter(where auth_user_id is not null)
from public.learners;
