-- Keep the approved university package wording and require an academic-plan reference.
-- Safe and idempotent: preserves unrelated form fields and replaces only these two reference fields.
BEGIN;

UPDATE education.service_catalog AS target
SET service_name = 'فتح حزمة التعليم الجامعي والدراسات العليا',
    form_fields = (
      SELECT jsonb_agg(item ORDER BY sort_key)
      FROM (
        SELECT f.item,
               CASE WHEN f.item->>'key'='has_existing_file' THEN 10 ELSE f.ordinality END AS sort_key
        FROM jsonb_array_elements(target.form_fields) WITH ORDINALITY AS f(item, ordinality)
        WHERE f.item->>'key' NOT IN ('curriculum_reference','curriculum_reference_other')
        UNION ALL
        SELECT jsonb_build_object(
          'key','curriculum_reference',
          'type','select',
          'label','مرجع الخطة الأكاديمية',
          'required',true,
          'options',jsonb_build_array(
            jsonb_build_object('label','الخطة الدراسية المنشورة للجامعة أو الجهة','value','institution_study_plan'),
            jsonb_build_object('label','الإطار الوطني للمؤهلات','value','national_qualifications_framework'),
            jsonb_build_object('label','نظام الساعات الأوروبي ECTS','value','ects_framework'),
            jsonb_build_object('label','إطار الساعات الأكاديمية البريطاني','value','uk_credit_framework'),
            jsonb_build_object('label','نظام الساعات المعتمدة الأمريكي','value','us_credit_hours'),
            jsonb_build_object('label','مرجع آخر','value','other')
          )
        ), 8
        UNION ALL
        SELECT jsonb_build_object(
          'key','curriculum_reference_other',
          'type','text',
          'label','اسم المرجع الآخر (عند اختيار مرجع آخر)',
          'required',false
        ), 9
      ) AS ordered_fields
    )
WHERE target.service_code='university_guidance';

COMMIT;
