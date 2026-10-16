-- Completion and subject correction for the four early-childhood levels.
-- Year/term are deliberately scoped to the current seeded schedule (2026/2027, all).
-- Idempotent: safe to rerun once all 120 target slots exist.
-- The assigned staff rows are explicitly AI personas, not human employee accounts.
-- This inserts schedule metadata only; it does not create learners or virtual meeting links.

with slot_map(grade_code, day_of_week, period_number, activity_name_ar, catalog_subject_name) as (
 values
('NURSERY',0,1,'التواصل واللغة المبكرة','اللغة العربية والقراءة والكتابة'),
('NURSERY',0,2,'الاستكشاف العلمي والحسي','العلوم العامة'),
('NURSERY',0,3,'الحركة والصحة والعادات اليومية','الصحة واللياقة والتربية البدنية'),
('NURSERY',0,4,'القصة والاستماع والتعبير','اللغة العربية والقراءة والكتابة'),
('NURSERY',0,5,'القيم والمهارات الاجتماعية','المهارات الحياتية والاجتماعية'),
('NURSERY',0,6,'مفاهيم الرياضيات المبكرة','الرياضيات والحساب'),
('NURSERY',1,1,'الفنون والخيال والإبداع','الفنون والتصميم والإبداع'),
('NURSERY',1,2,'التعلم المنزلي الموجّه للأسرة','الإرشاد والتطوير الشخصي'),
('NURSERY',1,3,'التواصل واللغة المبكرة','اللغة العربية والقراءة والكتابة'),
('NURSERY',1,4,'الاستكشاف العلمي والحسي','العلوم العامة'),
('NURSERY',1,5,'الحركة والصحة والعادات اليومية','الصحة واللياقة والتربية البدنية'),
('NURSERY',1,6,'القصة والاستماع والتعبير','اللغة العربية والقراءة والكتابة'),
('NURSERY',2,1,'القيم والمهارات الاجتماعية','المهارات الحياتية والاجتماعية'),
('NURSERY',2,2,'مفاهيم الرياضيات المبكرة','الرياضيات والحساب'),
('NURSERY',2,3,'التواصل واللغة المبكرة','اللغة العربية والقراءة والكتابة'),
('NURSERY',2,4,'الفنون والخيال والإبداع','الفنون والتصميم والإبداع'),
('NURSERY',2,5,'الاستكشاف العلمي والحسي','العلوم العامة'),
('NURSERY',2,6,'الحركة والصحة والعادات اليومية','الصحة واللياقة والتربية البدنية'),
('NURSERY',3,1,'القصة والاستماع والتعبير','اللغة العربية والقراءة والكتابة'),
('NURSERY',3,2,'القيم والمهارات الاجتماعية','المهارات الحياتية والاجتماعية'),
('NURSERY',3,3,'مفاهيم الرياضيات المبكرة','الرياضيات والحساب'),
('NURSERY',3,4,'التواصل واللغة المبكرة','اللغة العربية والقراءة والكتابة'),
('NURSERY',3,5,'التعلم المنزلي الموجّه للأسرة','الإرشاد والتطوير الشخصي'),
('NURSERY',3,6,'الفنون والخيال والإبداع','الفنون والتصميم والإبداع'),
('NURSERY',4,1,'الاستكشاف العلمي والحسي','العلوم العامة'),
('NURSERY',4,2,'الحركة والصحة والعادات اليومية','الصحة واللياقة والتربية البدنية'),
('NURSERY',4,3,'القصة والاستماع والتعبير','اللغة العربية والقراءة والكتابة'),
('NURSERY',4,4,'القيم والمهارات الاجتماعية','المهارات الحياتية والاجتماعية'),
('NURSERY',4,5,'مفاهيم الرياضيات المبكرة','الرياضيات والحساب'),
('NURSERY',4,6,'التواصل واللغة المبكرة','اللغة العربية والقراءة والكتابة'),
('KG1',0,1,'اللغة العربية والاستعداد للقراءة','اللغة العربية والقراءة والكتابة'),
('KG1',0,2,'مفاهيم الرياضيات المبكرة','الرياضيات والحساب'),
('KG1',0,3,'الاستكشاف العلمي والحسي','العلوم العامة'),
('KG1',0,4,'القصة والاستماع والتعبير','اللغة العربية والقراءة والكتابة'),
('KG1',0,5,'التعلم المنزلي الموجّه للأسرة','الإرشاد والتطوير الشخصي'),
('KG1',0,6,'الحركة والصحة والعادات اليومية','الصحة واللياقة والتربية البدنية'),
('KG1',1,1,'القيم والمهارات الاجتماعية','المهارات الحياتية والاجتماعية'),
('KG1',1,2,'اللغة العربية والاستعداد للقراءة','اللغة العربية والقراءة والكتابة'),
('KG1',1,3,'الفنون والخيال والإبداع','الفنون والتصميم والإبداع'),
('KG1',1,4,'مفاهيم الرياضيات المبكرة','الرياضيات والحساب'),
('KG1',1,5,'الاستكشاف العلمي والحسي','العلوم العامة'),
('KG1',1,6,'القصة والاستماع والتعبير','اللغة العربية والقراءة والكتابة'),
('KG1',2,1,'اللغة العربية والاستعداد للقراءة','اللغة العربية والقراءة والكتابة'),
('KG1',2,2,'التعلم المنزلي الموجّه للأسرة','الإرشاد والتطوير الشخصي'),
('KG1',2,3,'مفاهيم الرياضيات المبكرة','الرياضيات والحساب'),
('KG1',2,4,'الحركة والصحة والعادات اليومية','الصحة واللياقة والتربية البدنية'),
('KG1',2,5,'القيم والمهارات الاجتماعية','المهارات الحياتية والاجتماعية'),
('KG1',2,6,'اللغة العربية والاستعداد للقراءة','اللغة العربية والقراءة والكتابة'),
('KG1',3,1,'الاستكشاف العلمي والحسي','العلوم العامة'),
('KG1',3,2,'القصة والاستماع والتعبير','اللغة العربية والقراءة والكتابة'),
('KG1',3,3,'مفاهيم الرياضيات المبكرة','الرياضيات والحساب'),
('KG1',3,4,'الفنون والخيال والإبداع','الفنون والتصميم والإبداع'),
('KG1',3,5,'اللغة العربية والاستعداد للقراءة','اللغة العربية والقراءة والكتابة'),
('KG1',3,6,'التعلم المنزلي الموجّه للأسرة','الإرشاد والتطوير الشخصي'),
('KG1',4,1,'الحركة والصحة والعادات اليومية','الصحة واللياقة والتربية البدنية'),
('KG1',4,2,'القيم والمهارات الاجتماعية','المهارات الحياتية والاجتماعية'),
('KG1',4,3,'الاستكشاف العلمي والحسي','العلوم العامة'),
('KG1',4,4,'القصة والاستماع والتعبير','اللغة العربية والقراءة والكتابة'),
('KG1',4,5,'مفاهيم الرياضيات المبكرة','الرياضيات والحساب'),
('KG1',4,6,'اللغة العربية والاستعداد للقراءة','اللغة العربية والقراءة والكتابة'),
('KG2',0,1,'اللغة العربية والوعي الصوتي','اللغة العربية والقراءة والكتابة'),
('KG2',0,2,'العد والأنماط وحل المشكلات','الرياضيات والحساب'),
('KG2',0,3,'الاستكشاف العلمي والحسي','العلوم العامة'),
('KG2',0,4,'القصة والفهم الشفهي والتعبير','اللغة العربية والقراءة والكتابة'),
('KG2',0,5,'التعلم المنزلي الموجّه للأسرة','الإرشاد والتطوير الشخصي'),
('KG2',0,6,'الحركة والصحة والعادات اليومية','الصحة واللياقة والتربية البدنية'),
('KG2',1,1,'القيم والمهارات الاجتماعية','المهارات الحياتية والاجتماعية'),
('KG2',1,2,'اللغة العربية والوعي الصوتي','اللغة العربية والقراءة والكتابة'),
('KG2',1,3,'الفنون والخيال والإبداع','الفنون والتصميم والإبداع'),
('KG2',1,4,'العد والأنماط وحل المشكلات','الرياضيات والحساب'),
('KG2',1,5,'الاستكشاف العلمي والحسي','العلوم العامة'),
('KG2',1,6,'القصة والفهم الشفهي والتعبير','اللغة العربية والقراءة والكتابة'),
('KG2',2,1,'اللغة العربية والوعي الصوتي','اللغة العربية والقراءة والكتابة'),
('KG2',2,2,'التعلم المنزلي الموجّه للأسرة','الإرشاد والتطوير الشخصي'),
('KG2',2,3,'العد والأنماط وحل المشكلات','الرياضيات والحساب'),
('KG2',2,4,'الحركة والصحة والعادات اليومية','الصحة واللياقة والتربية البدنية'),
('KG2',2,5,'القيم والمهارات الاجتماعية','المهارات الحياتية والاجتماعية'),
('KG2',2,6,'اللغة العربية والوعي الصوتي','اللغة العربية والقراءة والكتابة'),
('KG2',3,1,'الاستكشاف العلمي والحسي','العلوم العامة'),
('KG2',3,2,'القصة والفهم الشفهي والتعبير','اللغة العربية والقراءة والكتابة'),
('KG2',3,3,'العد والأنماط وحل المشكلات','الرياضيات والحساب'),
('KG2',3,4,'الفنون والخيال والإبداع','الفنون والتصميم والإبداع'),
('KG2',3,5,'اللغة العربية والوعي الصوتي','اللغة العربية والقراءة والكتابة'),
('KG2',3,6,'التعلم المنزلي الموجّه للأسرة','الإرشاد والتطوير الشخصي'),
('KG2',4,1,'الحركة والصحة والعادات اليومية','الصحة واللياقة والتربية البدنية'),
('KG2',4,2,'القيم والمهارات الاجتماعية','المهارات الحياتية والاجتماعية'),
('KG2',4,3,'الاستكشاف العلمي والحسي','العلوم العامة'),
('KG2',4,4,'القصة والفهم الشفهي والتعبير','اللغة العربية والقراءة والكتابة'),
('KG2',4,5,'العد والأنماط وحل المشكلات','الرياضيات والحساب'),
('KG2',4,6,'اللغة العربية والوعي الصوتي','اللغة العربية والقراءة والكتابة'),
('KG3',0,1,'القراءة المبكرة والكتابة التمهيدية','اللغة العربية والقراءة والكتابة'),
('KG3',0,2,'الأعداد والأنماط والتفكير الرياضي','الرياضيات والحساب'),
('KG3',0,3,'الاستكشاف العلمي والملاحظة','العلوم العامة'),
('KG3',0,4,'القصة والفهم والاستعداد المدرسي','اللغة العربية والقراءة والكتابة'),
('KG3',0,5,'الحركة والصحة والعادات اليومية','الصحة واللياقة والتربية البدنية'),
('KG3',0,6,'القيم والمهارات الاجتماعية','المهارات الحياتية والاجتماعية'),
('KG3',1,1,'القراءة المبكرة والكتابة التمهيدية','اللغة العربية والقراءة والكتابة'),
('KG3',1,2,'التعلم المنزلي الموجّه للأسرة','الإرشاد والتطوير الشخصي'),
('KG3',1,3,'الفنون والخيال والإبداع','الفنون والتصميم والإبداع'),
('KG3',1,4,'الأعداد والأنماط والتفكير الرياضي','الرياضيات والحساب'),
('KG3',1,5,'القراءة المبكرة والكتابة التمهيدية','اللغة العربية والقراءة والكتابة'),
('KG3',1,6,'الاستكشاف العلمي والملاحظة','العلوم العامة'),
('KG3',2,1,'القصة والفهم والاستعداد المدرسي','اللغة العربية والقراءة والكتابة'),
('KG3',2,2,'الحركة والصحة والعادات اليومية','الصحة واللياقة والتربية البدنية'),
('KG3',2,3,'القراءة المبكرة والكتابة التمهيدية','اللغة العربية والقراءة والكتابة'),
('KG3',2,4,'الأعداد والأنماط والتفكير الرياضي','الرياضيات والحساب'),
('KG3',2,5,'القيم والمهارات الاجتماعية','المهارات الحياتية والاجتماعية'),
('KG3',2,6,'الاستكشاف العلمي والملاحظة','العلوم العامة'),
('KG3',3,1,'القصة والفهم والاستعداد المدرسي','اللغة العربية والقراءة والكتابة'),
('KG3',3,2,'القراءة المبكرة والكتابة التمهيدية','اللغة العربية والقراءة والكتابة'),
('KG3',3,3,'الأعداد والأنماط والتفكير الرياضي','الرياضيات والحساب'),
('KG3',3,4,'التعلم المنزلي الموجّه للأسرة','الإرشاد والتطوير الشخصي'),
('KG3',3,5,'الفنون والخيال والإبداع','الفنون والتصميم والإبداع'),
('KG3',3,6,'القراءة المبكرة والكتابة التمهيدية','اللغة العربية والقراءة والكتابة'),
('KG3',4,1,'الحركة والصحة والعادات اليومية','الصحة واللياقة والتربية البدنية'),
('KG3',4,2,'القيم والمهارات الاجتماعية','المهارات الحياتية والاجتماعية'),
('KG3',4,3,'الاستكشاف العلمي والملاحظة','العلوم العامة'),
('KG3',4,4,'القصة والفهم والاستعداد المدرسي','اللغة العربية والقراءة والكتابة'),
('KG3',4,5,'الأعداد والأنماط والتفكير الرياضي','الرياضيات والحساب'),
('KG3',4,6,'القراءة المبكرة والكتابة التمهيدية','اللغة العربية والقراءة والكتابة')
),
target as materialized (
 select sm.grade_code, sm.day_of_week, sm.period_number,
        sm.activity_name_ar, sm.catalog_subject_name,
        g.id as grade_level_id, s.id as section_id, s.center_id,
        p.id as period_id, sub.id as subject_id, sub.name as subject_name_ar,
        e.id as existing_entry_id,
        row_number() over(partition by p.id order by sm.grade_code) as slot_rank
 from slot_map sm
 join public.edu_grade_levels g on g.code=sm.grade_code and g.is_active
 join public.edu_class_sections s on s.grade_level_id=g.id
      and s.section_code=sm.grade_code||'-A'
      and s.academic_year='2026/2027' and s.term='all' and s.is_active
 join public.edu_schedule_periods p on p.day_of_week=sm.day_of_week and p.period_number=sm.period_number and p.is_active
 join public.subjects sub on sub.name=sm.catalog_subject_name
 left join public.edu_school_schedule_entries e
      on e.academic_year='2026/2027' and e.term='all'
     and e.section_id=s.id and e.period_id=p.id
),
preflight as (
 select count(*) as target_count,
        count(*) filter(where existing_entry_id is not null) as existing_count,
        count(*) filter(where existing_entry_id is null) as missing_count,
        (count(*)=120 and count(*) filter(where existing_entry_id is null) in (0,60)
          and count(distinct grade_code)=4) as ok
 from target
),
missing_slots as (
 select t.*,
        row_number() over(partition by t.period_id order by t.grade_code) as missing_slot_rank
 from target t
 where t.existing_entry_id is null
),
workload as (
 select t.id as teacher_id, count(a.id) as weekly_load
 from public.staff t
 left join public.edu_teacher_schedule_assignments a
   on a.teacher_id=t.id and a.academic_year='2026/2027' and a.term='all'
 group by t.id
),
candidate_pool as (
 select mp.period_id, t.id as teacher_id, coalesce(w.weekly_load,0) as weekly_load,
        row_number() over(partition by mp.period_id order by coalesce(w.weekly_load,0), t.id) as candidate_rank,
        count(*) over(partition by mp.period_id) as candidate_count
 from (select distinct period_id from missing_slots) mp
 cross join public.staff t
 left join workload w on w.teacher_id=t.id
 where t.is_active and t.job_title ilike '%معلم%'
   and not exists (
     select 1 from public.edu_teacher_schedule_assignments a2
     where a2.teacher_id=t.id and a2.academic_year='2026/2027'
       and a2.term='all' and a2.period_id=mp.period_id
   )
),
selected_missing as (
 select m.*, c.teacher_id
 from missing_slots m
 join candidate_pool c on c.period_id=m.period_id
  and c.candidate_rank =
    1 + (((m.day_of_week::int*6 + m.period_number::int - 1)*4
           + m.missing_slot_rank - 1) % c.candidate_count)
 cross join preflight pf
 where pf.ok and c.candidate_count>=4
),
updated_entries as (
 update public.edu_school_schedule_entries e
 set subject_id=t.subject_id,
     subject_name_ar=t.subject_name_ar,
     activity_name_ar=t.activity_name_ar,
     entry_type='online',
     notes='جدول داخلي لمستوى الطفولة المبكرة. النشاط التفصيلي مُراجع عمريًا بوصفه اقتراحًا للمنصة؛ المعلم دور ذكاء اصطناعي افتراضي لا يمثل موظفًا بشريًا. هذا السجل لا ينشئ رابط جلسة مباشرة ولا يثبت ربط حساب متعلم.'
 from target t cross join preflight pf
 where pf.ok and t.existing_entry_id=e.id
 returning e.id
),
new_entries as (
 insert into public.edu_school_schedule_entries
  (academic_year,term,center_id,section_id,period_id,teacher_id,subject_id,
   subject_name_ar,entry_type,activity_name_ar,room_id,notes,is_published)
 select '2026/2027','all',m.center_id,m.section_id,m.period_id,m.teacher_id,m.subject_id,
        m.subject_name_ar,'online',m.activity_name_ar,null,
        'خانة مكملة لست حصص يومية في الطفولة المبكرة؛ توزيع داخلي مقترح للمراجعة. المعلم دور ذكاء اصطناعي افتراضي لا يمثل موظفًا بشريًا. لا رابط جلسة مباشرة قبل ربط حساب المتعلم واختبار الفصل الافتراضي.',
        true
 from selected_missing m
 cross join preflight pf
 where pf.ok
 returning id,academic_year,term,teacher_id,period_id,section_id,subject_id,activity_name_ar
),
updated_assignments as (
 update public.edu_teacher_schedule_assignments a
 set subject_id=t.subject_id,
     title_ar=t.activity_name_ar,
     notes='تكليف تخطيطي لمستوى الطفولة المبكرة؛ المعلم هو دور ذكاء اصطناعي افتراضي ولا يمثل موظفًا بشريًا. رابط الجلسة لم يُنشأ بهذه العملية.'
 from target t cross join preflight pf
 where pf.ok and t.existing_entry_id is not null
   and a.academic_year='2026/2027' and a.term='all'
   and a.section_id=t.section_id and a.period_id=t.period_id
 returning a.id
),
inserted_assignments as (
 insert into public.edu_teacher_schedule_assignments
  (academic_year,term,teacher_id,period_id,section_id,subject_id,assignment_type,
   title_ar,is_counted_toward_30,notes,virtual_staff_names,zoom_host_required)
 select n.academic_year,n.term,n.teacher_id,n.period_id,n.section_id,n.subject_id,'lesson',
        n.activity_name_ar,true,
        'تكليف تخطيطي مكمل للجدول؛ شخصية معلم افتراضية بالذكاء الاصطناعي وليست موظفًا بشريًا. رابط الفصل المباشر غير مُنشأ حتى الآن.',
        array['معلم افتراضي بالذكاء الاصطناعي']::text[],true
 from new_entries n
 returning id
)
select pf.ok as preflight_ok,pf.target_count,pf.existing_count,pf.missing_count,
       (select count(*) from updated_entries) as corrected_existing_schedule_rows,
       (select count(*) from new_entries) as inserted_schedule_rows,
       (select count(*) from updated_assignments) as corrected_existing_assignments,
       (select count(*) from inserted_assignments) as inserted_assignments
from preflight pf;
