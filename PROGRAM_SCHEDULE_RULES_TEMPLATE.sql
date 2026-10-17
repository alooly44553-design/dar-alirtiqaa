-- Add proposed scheduling rules to existing program templates only.
-- Idempotent: missing rules are inserted, existing rules are not duplicated.
-- Does NOT create actual programs, cohorts, learner enrolments, or live sessions.
with proposed(title_ar,session_period,day_count_per_week,sessions_per_day,session_minutes,weekly_hours,timezone,live_required,self_paced_allowed,hybrid_allowed,notes_ar) as (
 values
('شهادة مهنية في إدارة المشاريع','صباحي',4,2,60,8,'Asia/Riyadh',true,true,true,'قالب مقترح: 8 ساعات اتصال أسبوعيًا في نافذة الدورات 09:00–11:00 لأربعة أيام؛ تضيف الخطة الذاتية جهدًا مستقلًا حسب وصف الشهادة.'),
('شهادة مهنية في إدارة المشاريع','مسائي',4,2,60,8,'Asia/Riyadh',true,true,true,'قالب مقترح: 17:00–19:00 أربعة أيام أسبوعيًا؛ ينبغي تجميع ساعات الشهادة النهائية من توصيفها المعتمد.'),
('شهادة مهنية في إدارة المشاريع','تعلم إلكتروني',3,2,60,6,'Asia/Riyadh',false,true,true,'قالب مرن غير متزامن؛ يلزم تقدير جهد إضافي للوصول إلى إجمالي ساعات الشهادة، ولا يُنشئ موعد بث تلقائيًا.'),
('دبلوم تطوير البرمجيات التطبيقي','صباحي',5,4,60,20,'Asia/Riyadh',true,true,true,'قالب مقترح: أربع جلسات من 60 دقيقة داخل النافذة الصباحية، مع مختبر ومشروع تخرج وفق الخطة المعتمدة.'),
('دبلوم تطوير البرمجيات التطبيقي','مسائي',5,3,75,18.75,'Asia/Riyadh',true,true,true,'قالب مقترح: ثلاث جلسات من 75 دقيقة داخل نافذة 16:00–20:00، مع مختبر ومشروع حسب الخطة المعتمدة.'),
('دبلوم تطوير البرمجيات التطبيقي','تعلم إلكتروني',5,2,60,10,'Asia/Riyadh',false,true,true,'قالب تعلم مرن؛ تمثل الخانات وحدات/لقاءات افتراضية مقترحة، وليس موعدًا حيًا حتى إسناد المدرب والمجموعة.'),
('دبلوم تربوي للمعلمين','صباحي',5,4,60,20,'Asia/Riyadh',true,true,true,'قالب مقترح أولي: 20 ساعة اتصال أسبوعيًا؛ يلزم بيان مستقل للتطبيق التربوي والملف المهني والساعات المتبقية من إجمالي البرنامج قبل القبول.'),
('دبلوم تربوي للمعلمين','مسائي',5,4,60,20,'Asia/Riyadh',true,true,true,'قالب مقترح أولي ضمن نافذة 16:00–20:00؛ لا يعتمد مجموع 900 ساعة أو متطلبات الممارسة قبل مراجعة توصيف الدبلوم.'),
('دبلوم تربوي للمعلمين','تعلم إلكتروني',5,2,60,10,'Asia/Riyadh',false,true,true,'قالب تعلم ذاتي/مدمج؛ يتطلب وحدات تطبيق وملاحظة صفية وتقييمًا بشريًا مؤهلًا حسب التوصيف.'),
('مسار مهني في الطاقة المتجددة','صباحي',5,4,60,20,'Asia/Riyadh',true,true,true,'قالب مقترح: 20 ساعة اتصال أسبوعيًا؛ لا تُدرج الورش أو ساعات المختبر إلا بعد تأكيد المعدات والمدرب والسلامة.'),
('مسار مهني في الطاقة المتجددة','مسائي',5,3,75,18.75,'Asia/Riyadh',true,true,true,'قالب مقترح مرن ضمن نافذة التدريب 16:00–20:00؛ يجب فصل التدريب العملي عن اللقاءات النظرية.'),
('مسار مهني في الطاقة المتجددة','تعلم إلكتروني',5,2,60,10,'Asia/Riyadh',false,true,true,'قالب مدمج للتعلم النظري؛ لا يعوض تدريب المختبر أو التقييم الميداني الذي يتطلب حضورًا وتجهيزات فعلية.')
),
mapped as materialized (
 select b.id as blueprint_id,p.*
 from proposed p
 join public.edu_global_program_blueprints b on b.title_ar=p.title_ar and b.active and b.status='template'
),
preflight as (
 select count(*) as mapped_rules,
        count(distinct blueprint_id) as mapped_templates,
        count(*)=12 and count(distinct blueprint_id)=4 as ok
 from mapped
),
to_add as (
 select m.*
 from mapped m cross join preflight pf
 where pf.ok and not exists(
   select 1 from public.edu_program_schedule_rules r
   where r.blueprint_id=m.blueprint_id and r.session_period=m.session_period
 )
),
inserted as (
 insert into public.edu_program_schedule_rules
  (blueprint_id,session_period,day_count_per_week,sessions_per_day,session_minutes,weekly_hours,timezone,live_required,self_paced_allowed,hybrid_allowed,notes_ar)
 select blueprint_id,session_period,day_count_per_week,sessions_per_day,session_minutes,weekly_hours,timezone,live_required,self_paced_allowed,hybrid_allowed,notes_ar
 from to_add
 returning id
)
select pf.ok as preflight_ok,pf.mapped_rules,pf.mapped_templates,
       (select count(*) from inserted) as inserted_rules
from preflight pf;
