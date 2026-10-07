-- School operational loop: lessons -> assignments -> submissions -> review
alter table public.enrollments add column if not exists classroom_id uuid references public.classrooms(id);
create table if not exists public.school_lessons (
 id uuid primary key default gen_random_uuid(), program_id uuid references public.programs(id), subject_id uuid references public.subjects(id),
 teacher_id uuid references public.staff(id), classroom_id uuid references public.classrooms(id), title text not null, explanation text,
 objectives text, resources jsonb not null default '[]'::jsonb, ai_generated boolean not null default false,
 status text not null default 'draft' check (status in ('draft','published','archived')), scheduled_for timestamptz,
 created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.school_assignments (
 id uuid primary key default gen_random_uuid(), lesson_id uuid references public.school_lessons(id) on delete cascade,
 classroom_id uuid references public.classrooms(id), subject_id uuid references public.subjects(id), title text not null,
 instructions text, due_at timestamptz, max_score numeric not null default 100 check (max_score > 0),
 status text not null default 'draft' check (status in ('draft','published','closed')), created_by uuid,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.school_submissions (
 id uuid primary key default gen_random_uuid(), assignment_id uuid not null references public.school_assignments(id) on delete cascade,
 learner_id uuid not null references public.learners(id) on delete cascade, answer_text text, attachments jsonb not null default '[]'::jsonb,
 submitted_at timestamptz, status text not null default 'submitted' check (status in ('draft','submitted','reviewed','returned')),
 score numeric check (score is null or score >= 0), feedback text, ai_feedback text,
 ai_review_status text not null default 'not_requested' check (ai_review_status in ('not_requested','pending','ready','approved')),
 reviewed_by uuid, reviewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(assignment_id, learner_id)
);
create index if not exists idx_school_lessons_classroom on public.school_lessons(classroom_id);
create index if not exists idx_school_assignments_classroom on public.school_assignments(classroom_id);
create index if not exists idx_school_submissions_learner on public.school_submissions(learner_id);
alter table public.school_lessons enable row level security;
alter table public.school_assignments enable row level security;
alter table public.school_submissions enable row level security;
-- Policies are intentionally scoped to the authenticated teacher/learner profile.
