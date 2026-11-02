-- Education-only migration: approved early-childhood fees and higher-education service wording.
-- Review and apply only through the approved education database change process.
-- This file is intentionally NOT executed against production by this change.

BEGIN;

-- Persist the prior-file declaration for audit and first-registration fee handling.
ALTER TABLE education.student_registrations
  ADD COLUMN IF NOT EXISTS has_existing_file boolean;

-- The registration fee is charged only when the learner has no prior file.
UPDATE education.service_fee_items
SET fee_name = 'رسوم فتح الملف والتسجيل',
    description = 'تُدفع مرة واحدة عند التسجيل الأول فقط، ولا تتكرر في السنوات الدراسية التالية.',
    amount = 100.00,
    currency = 'SAR',
    calculation_method = 'conditional',
    is_required = true,
    condition_rule = '{"applies_when":"no_existing_file","period":"once"}'::jsonb,
    updated_at = now()
WHERE service_id = 'e720cd3c-97dc-49a2-9111-22d192d707d8'::uuid
  AND fee_code = 'FILE_OPENING';

-- Uniform and books are also a one-time first-registration fee.
INSERT INTO education.service_fee_items
(service_id, fee_code, fee_type, fee_name, description, amount, currency,
 calculation_method, is_required, condition_rule, payment_stage, display_order, is_active)
VALUES
('e720cd3c-97dc-49a2-9111-22d192d707d8'::uuid, 'EARLY_UNIFORM_BOOKS', 'registration',
 'رسوم الزي والكتب',
 'تُدفع مرة واحدة عند التسجيل الأول فقط، ولا تتكرر في السنوات الدراسية التالية.',
 100.00, 'SAR', 'conditional', true,
 '{"applies_when":"no_existing_file","education_stage":"early_childhood","period":"once"}'::jsonb,
 'before_acceptance', 2, true)
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

-- Annual tuition is charged according to the selected early-childhood grade.
INSERT INTO education.service_fee_items
(service_id, fee_code, fee_type, fee_name, description, amount, currency,
 calculation_method, is_required, condition_rule, payment_stage, display_order, is_active)
VALUES
('e720cd3c-97dc-49a2-9111-22d192d707d8'::uuid, 'EARLY_NURSERY', 'tuition',
 'الرسوم الدراسية السنوية — الحضانة',
 'رسوم الحضانة عن سنة دراسية واحدة.',
 2100.00, 'SAR', 'annual', true,
 '{"education_stage":"early_childhood","grade":"الحضانة","period":"annual"}'::jsonb,
 'before_acceptance', 10, true),
('e720cd3c-97dc-49a2-9111-22d192d707d8'::uuid, 'EARLY_KG1', 'tuition',
 'الرسوم الدراسية السنوية — التمهيدي 1',
 'رسوم التمهيدي 1 عن سنة دراسية واحدة.',
 2100.00, 'SAR', 'annual', true,
 '{"education_stage":"early_childhood","grade":"تمهيدي 1 KG1","period":"annual"}'::jsonb,
 'before_acceptance', 11, true),
('e720cd3c-97dc-49a2-9111-22d192d707d8'::uuid, 'EARLY_KG2', 'tuition',
 'الرسوم الدراسية السنوية — التمهيدي 2',
 'رسوم التمهيدي 2 عن سنة دراسية واحدة.',
 1800.00, 'SAR', 'annual', true,
 '{"education_stage":"early_childhood","grade":"تمهيدي 2 KG2","period":"annual"}'::jsonb,
 'before_acceptance', 12, true),
('e720cd3c-97dc-49a2-9111-22d192d707d8'::uuid, 'EARLY_KG3', 'tuition',
 'الرسوم الدراسية السنوية — التمهيدي 3',
 'رسوم التمهيدي 3 عن سنة دراسية واحدة.',
 1800.00, 'SAR', 'annual', true,
 '{"education_stage":"early_childhood","grade":"تمهيدي 3 KG3","period":"annual"}'::jsonb,
 'before_acceptance', 13, true)
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

-- Rename the user-facing university service; keep its stable internal service_code
-- to avoid breaking existing routes and form handlers.
UPDATE education.service_catalog
SET service_name = 'التعليم الجامعي والدراسات العليا',
    service_category = 'التعليم الجامعي والدراسات العليا',
    description = 'طلب الالتحاق ببرامج التعليم والتدريس المباشر والمحدّث في التخصصات الجامعية والدراسات العليا، وفق البرامج المعتمدة والمتاحة.',
    updated_at = now()
WHERE id = 'eef8d730-709e-493e-bdf5-99905a5c500e'::uuid
  AND service_code = 'university_guidance';

COMMIT;
