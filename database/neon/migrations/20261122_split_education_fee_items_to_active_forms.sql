-- QA-only repair after splitting the unified registration form into five forms.
-- Target: Neon project still-term-43673824, branch br-late-dawn-azs3g3i2, database neondb.
-- Copy only the already-approved annual early-childhood/basic-education fee items
-- from the inactive legacy student_registration catalog row to the two active forms.
-- Preserve the legacy rows and every existing registration/request record.
-- Re-running is safe because of the unique (service_id, fee_code) key.
BEGIN;

INSERT INTO education.service_fee_items
(service_id, fee_code, fee_type, fee_name, description, amount, currency,
 calculation_method, is_required, condition_rule, payment_stage, display_order,
 is_active, effective_from, effective_to)
SELECT target.id, source.fee_code, source.fee_type, source.fee_name,
       source.description, source.amount, source.currency,
       source.calculation_method, source.is_required, source.condition_rule,
       source.payment_stage, source.display_order, source.is_active,
       source.effective_from, source.effective_to
FROM education.service_catalog target
JOIN education.service_catalog legacy ON legacy.service_code = 'student_registration'
JOIN education.service_fee_items source ON source.service_id = legacy.id
WHERE target.service_code = 'early_childhood_registration'
  AND source.fee_code IN (
    'FILE_OPENING', 'EARLY_UNIFORM_BOOKS', 'EARLY_NURSERY',
    'EARLY_KG', 'LEVEL_OR_EQUIVALENCY'
  )
ON CONFLICT (service_id, fee_code) DO NOTHING;

INSERT INTO education.service_fee_items
(service_id, fee_code, fee_type, fee_name, description, amount, currency,
 calculation_method, is_required, condition_rule, payment_stage, display_order,
 is_active, effective_from, effective_to)
SELECT target.id, source.fee_code, source.fee_type, source.fee_name,
       source.description, source.amount, source.currency,
       source.calculation_method, source.is_required, source.condition_rule,
       source.payment_stage, source.display_order, source.is_active,
       source.effective_from, source.effective_to
FROM education.service_catalog target
JOIN education.service_catalog legacy ON legacy.service_code = 'student_registration'
JOIN education.service_fee_items source ON source.service_id = legacy.id
WHERE target.service_code = 'general_education_registration'
  AND source.fee_code IN (
    'FILE_OPENING', 'TUITION_PRIMARY', 'TUITION_MIDDLE',
    'TUITION_SECONDARY', 'TUITION_GRADE_12', 'LEVEL_OR_EQUIVALENCY'
  )
ON CONFLICT (service_id, fee_code) DO NOTHING;

COMMIT;
