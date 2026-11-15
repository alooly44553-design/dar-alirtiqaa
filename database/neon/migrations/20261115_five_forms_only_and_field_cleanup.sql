-- QA-only: retain exactly the five approved education registration forms and remove the fields explicitly rejected by management.
-- Scope: Neon QA branch br-late-dawn-azs3g3i2 only. Existing requests and historical records are preserved.
BEGIN;

UPDATE education.service_catalog
SET is_active = (service_code IN (
  'early_childhood_registration',
  'general_education_registration',
  'university_guidance',
  'course_registration',
  'activity_join'
)),
updated_at = now();

UPDATE education.service_catalog
SET service_name = CASE service_code
  WHEN 'early_childhood_registration' THEN 'التسجيل في الطفولة المبكرة والتأسيس'
  WHEN 'general_education_registration' THEN 'التسجيل في التعليم الأساسي والعام'
  WHEN 'university_guidance' THEN 'التعليم الجامعي والدراسات العليا'
  WHEN 'course_registration' THEN 'التدريب المهني والتقني'
  WHEN 'activity_join' THEN 'الالتحاق ببرنامج تعليمي ومسارات متنوعة'
  ELSE service_name
END,
description = CASE service_code
  WHEN 'early_childhood_registration' THEN 'استمارة مستقلة لرياض الأطفال والتمهيدي، مع بيانات الطفل وولي الأمر والمرحلة والصف ومرجع المنهج والمحتوى المطلوب.'
  WHEN 'general_education_registration' THEN 'استمارة مستقلة للمرحلة الابتدائية والمتوسطة والثانوية، مع بيانات الطالب وولي الأمر والصف ومرجع المنهج والمحتوى المطلوب.'
  WHEN 'university_guidance' THEN 'طلب الالتحاق ببرامج التعليم والتدريس المباشر والمحدّث في التخصصات الجامعية والدراسات العليا، وفق البرامج المتاحة.'
  WHEN 'course_registration' THEN 'استمارة مستقلة للتدريب المهني والتقني.'
  WHEN 'activity_join' THEN 'استمارة مستقلة للالتحاق ببرنامج تعليمي ومسارات متنوعة.'
  ELSE description
END,
display_order = CASE service_code
  WHEN 'early_childhood_registration' THEN 1
  WHEN 'general_education_registration' THEN 2
  WHEN 'university_guidance' THEN 3
  WHEN 'course_registration' THEN 4
  WHEN 'activity_join' THEN 5
  ELSE display_order
END,
updated_at = now()
WHERE service_code IN (
  'early_childhood_registration','general_education_registration',
  'university_guidance','course_registration','activity_join'
);

UPDATE education.service_catalog AS s
SET form_fields = COALESCE((
  SELECT jsonb_agg(f.field ORDER BY f.ord)
  FROM jsonb_array_elements(s.form_fields) WITH ORDINALITY AS f(field, ord)
  WHERE NOT (
    (s.service_code IN ('early_childhood_registration','general_education_registration')
      AND f.field->>'key' = ANY(ARRAY['learning_content','tuition_period']))
    OR
    (s.service_code = 'university_guidance'
      AND f.field->>'key' = ANY(ARRAY[
        'country_interest','academic_system','budget_range','notes','study_period',
        'learning_content','curriculum_track','curriculum_country',
        'curriculum_reference','curriculum_reference_other','tuition_period','installment_count'
      ]))
    OR
    (s.service_code = 'course_registration'
      AND f.field->>'key' = ANY(ARRAY[
        'preferred_schedule','study_period','learning_content','tuition_period',
        'curriculum_track','curriculum_country','country_interest'
      ]))
  )
), '[]'::jsonb),
updated_at = now()
WHERE service_code IN (
  'early_childhood_registration','general_education_registration',
  'university_guidance','course_registration'
);

COMMIT;
