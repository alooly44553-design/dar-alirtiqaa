-- QA-only follow-up: add approved fee selectors to the two dedicated school forms.
BEGIN;
UPDATE education.service_catalog
SET form_fields = form_fields || CASE service_code
  WHEN 'early_childhood_registration' THEN
    '[{"key":"tuition_period","type":"select","label":"الفترة الدراسية","required":true,"options":[{"label":"فصل دراسي","value":"term"},{"label":"سنة دراسية","value":"annual"}]}]'::jsonb
  WHEN 'general_education_registration' THEN
    '[{"key":"tuition_period","type":"select","label":"الفترة الدراسية","required":true,"options":[{"label":"فصل دراسي","value":"term"},{"label":"سنة دراسية","value":"annual"}]},{"key":"needs_level_assessment","type":"select","label":"هل يحتاج الطالب إلى تحديد مستوى أو معادلة؟","required":true,"options":[{"label":"نعم","value":"yes"},{"label":"لا","value":"no"}]}]'::jsonb
  ELSE '[]'::jsonb
END,
updated_at=now()
WHERE service_code IN ('early_childhood_registration','general_education_registration');

UPDATE education.service_catalog
SET form_fields = (
  SELECT jsonb_agg(
    CASE WHEN field->>'key' IN ('guardian_name','guardian_relationship','guardian_phone')
      THEN jsonb_set(field,'{required}','false'::jsonb,true)
      ELSE field END
    ORDER BY ord
  )
  FROM jsonb_array_elements(form_fields) WITH ORDINALITY AS f(field,ord)
),
updated_at=now()
WHERE service_code='general_education_registration';

UPDATE education.service_catalog
SET form_fields = form_fields || '[{"key":"has_existing_file","type":"select","label":"هل سبق فتح ملف للطالب؟","required":true,"options":[{"label":"لا، تسجيل أول مرة","value":"no"},{"label":"نعم، يوجد ملف سابق","value":"yes"}]}]'::jsonb,
updated_at=now()
WHERE service_code IN ('early_childhood_registration','general_education_registration')
AND NOT (form_fields @> '[{"key":"has_existing_file"}]'::jsonb);

COMMIT;
