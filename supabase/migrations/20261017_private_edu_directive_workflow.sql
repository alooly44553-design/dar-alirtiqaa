-- Private, in-place directives for review and decision tracking.
-- Safe to re-run: objects are additive; policies are replaced deterministically.

create table if not exists public.edu_directive_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 180),
  details text not null default '' check (char_length(details) <= 8000),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  recipient_user_id uuid not null references auth.users(id) on delete restrict,
  recipient_staff_id uuid null references public.staff(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','viewed','in_review','discussion_requested','update_requested','accepted','rejected')),
  selected_action text null check (selected_action is null or selected_action in ('view','review','discuss','update','accept','reject')),
  response_note text null check (response_note is null or char_length(response_note) <= 2000),
  due_at timestamptz null,
  last_action_by uuid null references auth.users(id) on delete set null,
  last_action_at timestamptz null,
  final_decision_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists edu_directive_tasks_recipient_created_idx
  on public.edu_directive_tasks (recipient_user_id, created_at desc);
create index if not exists edu_directive_tasks_creator_created_idx
  on public.edu_directive_tasks (created_by, created_at desc);
create index if not exists edu_directive_tasks_status_due_idx
  on public.edu_directive_tasks (status, due_at);

create table if not exists public.edu_directive_events (
  id bigint generated always as identity primary key,
  directive_id uuid not null references public.edu_directive_tasks(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('created','view','review','discuss','update','accept','reject')),
  note text null check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists edu_directive_events_task_created_idx
  on public.edu_directive_events (directive_id, created_at desc);

alter table public.edu_directive_tasks enable row level security;
alter table public.edu_directive_events enable row level security;

drop policy if exists edu_directive_tasks_visible_to_parties on public.edu_directive_tasks;
create policy edu_directive_tasks_visible_to_parties
on public.edu_directive_tasks
for select to authenticated
using (
  recipient_user_id = (select auth.uid())
  or created_by = (select auth.uid())
  or (select public.is_center_management_admin())
);

drop policy if exists edu_directive_events_visible_to_parties on public.edu_directive_events;
create policy edu_directive_events_visible_to_parties
on public.edu_directive_events
for select to authenticated
using (
  exists (
    select 1 from public.edu_directive_tasks d
    where d.id = directive_id
      and (
        d.recipient_user_id = (select auth.uid())
        or d.created_by = (select auth.uid())
        or (select public.is_center_management_admin())
      )
  )
);

revoke all on table public.edu_directive_tasks from anon, authenticated;
revoke all on table public.edu_directive_events from anon, authenticated;
grant select on table public.edu_directive_tasks to authenticated;
grant select on table public.edu_directive_events to authenticated;

create or replace function public.create_edu_directive(
  p_title text,
  p_details text default '',
  p_recipient_staff_id uuid default null,
  p_priority text default 'normal',
  p_due_at timestamptz default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_actor uuid;
  v_recipient uuid;
  v_directive_id uuid;
  v_priority text;
begin
  v_actor := auth.uid();
  if v_actor is null or not coalesce(public.is_center_management_admin(), false) then
    raise exception using errcode = '42501', message = 'يتطلب إنشاء التوجيه حساب مدير إداري معتمد.';
  end if;

  if p_title is null or char_length(btrim(p_title)) < 3 or char_length(btrim(p_title)) > 180 then
    raise exception using errcode = '22023', message = 'عنوان التوجيه يجب أن يكون بين 3 و180 حرفًا.';
  end if;
  if char_length(coalesce(p_details,'')) > 8000 then
    raise exception using errcode = '22023', message = 'تفاصيل التوجيه تتجاوز الحد المسموح.';
  end if;

  v_priority := coalesce(p_priority, 'normal');
  if v_priority not in ('low','normal','high','urgent') then
    raise exception using errcode = '22023', message = 'درجة الأولوية غير معتمدة.';
  end if;

  if p_recipient_staff_id is null then
    v_recipient := v_actor;
  else
    select s.auth_user_id into v_recipient
      from public.staff s
     where s.id = p_recipient_staff_id
       and s.is_active = true;
    if not found or v_recipient is null then
      raise exception using errcode = '22023', message = 'المقصود المحدد لا يملك حساب دخول موثقًا مرتبطًا بسجل الطاقم؛ لم يُنشأ أي حساب تلقائيًا.';
    end if;
  end if;

  insert into public.edu_directive_tasks
    (title, details, priority, recipient_user_id, recipient_staff_id, created_by, due_at)
  values
    (btrim(p_title), coalesce(p_details,''), v_priority, v_recipient, p_recipient_staff_id, v_actor, p_due_at)
  returning id into v_directive_id;

  insert into public.edu_directive_events (directive_id, actor_user_id, action, note)
  values (v_directive_id, v_actor, 'created', null);

  return v_directive_id;
end
$function$;

create or replace function public.act_on_edu_directive(
  p_directive_id uuid,
  p_action text,
  p_note text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_actor uuid;
  v_task public.edu_directive_tasks%rowtype;
  v_new_status text;
  v_action text;
  v_note text;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception using errcode = '42501', message = 'يلزم تسجيل الدخول لتنفيذ هذا الإجراء.';
  end if;

  v_action := lower(coalesce(p_action,''));
  if v_action not in ('view','review','discuss','update','accept','reject') then
    raise exception using errcode = '22023', message = 'نوع الإجراء غير معتمد.';
  end if;

  v_note := nullif(btrim(coalesce(p_note,'')), '');
  if v_note is not null and char_length(v_note) > 2000 then
    raise exception using errcode = '22023', message = 'الملاحظة تتجاوز 2000 حرف.';
  end if;

  select * into v_task
    from public.edu_directive_tasks
   where id = p_directive_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'التوجيه غير موجود أو غير متاح.';
  end if;
  if v_task.recipient_user_id <> v_actor then
    raise exception using errcode = '42501', message = 'خيارات الإجراء متاحة للحساب المقصود فقط.';
  end if;

  if v_task.status in ('accepted','rejected') and v_action <> 'view' then
    raise exception using errcode = '55000', message = 'تم إغلاق هذا التوجيه بقرار نهائي؛ لا يمكن تغييره من هذه الشاشة.';
  end if;

  v_new_status := case v_action
    when 'view' then case when v_task.status = 'pending' then 'viewed' else v_task.status end
    when 'review' then 'in_review'
    when 'discuss' then 'discussion_requested'
    when 'update' then 'update_requested'
    when 'accept' then 'accepted'
    when 'reject' then 'rejected'
  end;

  update public.edu_directive_tasks
     set status = v_new_status,
         selected_action = case when v_task.status in ('accepted','rejected') then v_task.selected_action else v_action end,
         response_note = coalesce(v_note, response_note),
         last_action_by = v_actor,
         last_action_at = now(),
         final_decision_at = case when v_action in ('accept','reject') then now() else final_decision_at end,
         updated_at = now()
   where id = p_directive_id;

  insert into public.edu_directive_events (directive_id, actor_user_id, action, note)
  values (p_directive_id, v_actor, v_action, v_note);

  return p_directive_id;
end
$function$;

revoke all on function public.create_edu_directive(text, text, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.create_edu_directive(text, text, uuid, text, timestamptz) to authenticated;

revoke all on function public.act_on_edu_directive(uuid, text, text) from public, anon, authenticated;
grant execute on function public.act_on_edu_directive(uuid, text, text) to authenticated;
