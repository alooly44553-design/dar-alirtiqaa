-- Education-only follow-up: complete early-childhood fee catalog and prior-file tracking.
-- Test this migration on the isolated education Neon branch before any production approval.
-- Uniform/books are annual once per academic year; file opening is charged only for a new file.

ALTER TABLE education.student_registrations
  ADD COLUMN IF NOT EXISTS has_existing_file boolean;

UPDATE education.service_fee_items
SET fee_name = 'رسوم فتح الملف والتسجيل',
    description = 'تُدفع مرة واحدة عند فتح ملف جديد للمستفيد فقط.',
    amount = 100.00,
    currency = 'SAR',
    calculation_method = 'conditional',
    is_required = true,
    condition_rule = '{"applies_when":"no_existing_file","period":"once"}'::jsonb,
    updated_at = now()
WHERE service_id = (SELECT id FROM education.service_catalog WHERE service_code = 'student_registration')
  AND fee_code = 'FILE_OPENING';

INSERT INTO education.service_fee_items
(service_id, fee_code, fee_type, fee_name, description, amount, currency,
 calculation_method, is_required, condition_rule, payment_stage, display_order, is_active)
SELECT id, 'EARLY_UNIFORM_BOOKS', 'registration', 'رسوم الزي والكتب',
       'تُحصّل مرة واحدة سنويًا مع بداية كل عام دراسي.',
       100.00, 'SAR', 'annual', true,
       '{"education_stage":"early_childhood","period":"annual"}'::jsonb,
       'before_acceptance', 2, true
FROM education.service_catalog
WHERE service_code = 'student_registration'
ON CONFLICT (service_id, fee_code) DO UPDATE SET
 fee_name = EXCLUDED.fee_name,
 description = EXCLUDED.description,
 amount = EXCLUDED.amount,
 currency = EXCLUDED.currency,
 calculation_method = EXCLUDED.calculation_method,
 is_required = EXCLUDED.is_required,
 condition_rule = EXCLUDED.condition_rule,
 payment_stage = EXCLUDED.payment_stage,
 display_order = EXCLUDED.display_order,
 is_active = true,
 updated_at = now();

INSERT INTO education.service_fee_items
(service_id, fee_code, fee_type, fee_name, description, amount, currency,
 calculation_method, is_required, condition_rule, payment_stage, display_order, is_active)
SELECT c.id, v.fee_code, 'tuition', v.fee_name, v.description, v.amount, 'SAR', 'annual', true,
       jsonb_build_object('education_stage', 'early_childhood', 'grade', v.grade, 'period', 'annual'),
       'before_acceptance', v.display_order, true
FROM education.service_catalog c
CROSS JOIN (VALUES
 ('EARLY_NURSERY', 'الرسوم الدراسية السنوية — الحضانة', 'رسوم الحضانة عن سنة دراسية واحدة.', 2100.00::numeric, 'الحضانة', 10),
 ('EARLY_KG1', 'الرسوم الدراسية السنوية — التمهيدي 1', 'رسوم التمهيدي 1 عن سنة دراسية واحدة.', 2100.00::numeric, 'تمهيدي 1 KG1', 11),
 ('EARLY_KG2', 'الرسوم الدراسية السنوية — التمهيدي 2', 'رسوم التمهيدي 2 عن سنة دراسية واحدة.', 1800.00::numeric, 'تمهيدي 2 KG2', 12),
 ('EARLY_KG3', 'الرسوم الدراسية السنوية — التمهيدي 3', 'رسوم التمهيدي 3 عن سنة دراسية واحدة.', 1800.00::numeric, 'تمهيدي 3 KG3', 13)
) AS v(fee_code, fee_name, description, amount, grade, display_order)
WHERE c.service_code = 'student_registration'
ON CONFLICT (service_id, fee_code) DO UPDATE SET
 fee_name = EXCLUDED.fee_name,
 description = EXCLUDED.description,
 amount = EXCLUDED.amount,
 currency = EXCLUDED.currency,
 calculation_method = EXCLUDED.calculation_method,
 is_required = EXCLUDED.is_required,
 condition_rule = EXCLUDED.condition_rule,
 payment_stage = EXCLUDED.payment_stage,
 display_order = EXCLUDED.display_order,
 is_active = true,
 updated_at = now();

UPDATE education.service_catalog
SET service_name = 'التعليم الجامعي والدراسات العليا',
    service_category = 'التعليم الجامعي والدراسات العليا',
    description = 'طلب الالتحاق ببرامج التعليم والتدريس المباشر والمحدّث في التخصصات الجامعية والدراسات العليا، وفق البرامج المتاحة.',
    updated_at = now()
WHERE service_code = 'university_guidance';
