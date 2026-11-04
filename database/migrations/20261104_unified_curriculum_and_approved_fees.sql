-- Unified education catalog and approved fee schedule.
-- Apply only after review and validation on the existing education test environment.
-- This migration does not create curriculum-specific databases or separate domain branches.

ALTER TABLE education.student_registrations
  ADD COLUMN IF NOT EXISTS curriculum_reference text,
  ADD COLUMN IF NOT EXISTS tuition_period text,
  ADD COLUMN IF NOT EXISTS installment_count smallint;

UPDATE education.service_catalog
SET service_name = 'التعليم الجامعي والدراسات العليا',
    service_category = 'التعليم الجامعي والدراسات العليا',
    registration_method_label = 'التسجيل في الحزمة التعليمية',
    description = 'حزمة التعليم الجامعي والدراسات العليا: الدبلوم والدبلوم العالي والبكالوريوس والماجستير والدراسات العليا، وفق البرامج المتاحة.',
    updated_at = now()
WHERE service_code = 'university_guidance';

-- Remove every legacy fee item; only the explicitly approved catalog below is recreated.
-- No foreign-key references to service_fee_items exist in the current education schema.
DELETE FROM education.service_fee_items;

WITH approved AS (
  SELECT * FROM (VALUES
    ('student_registration','FILE_OPENING','registration','فتح الملف والتسجيل','مرة واحدة للمستجدين فقط.',100.00,'SAR','once',true,'{"applies_when":"no_existing_file"}'::jsonb,1),
    ('student_registration','EARLY_UNIFORM_BOOKS','registration','رسوم الزي والكتب','رسوم سنوية للزي والكتب معًا.',100.00,'SAR','annual',true,'{"education_stage":"early_childhood","period":"annual"}'::jsonb,2),
    ('student_registration','EARLY_NURSERY','tuition','الحضانة والتمهيدي 1 — سنوي','رسوم السنة الدراسية.',2100.00,'SAR','annual',true,'{"education_stage":"early_childhood","grades":["الحضانة","تمهيدي 1 KG1"],"period":"annual"}'::jsonb,10),
    ('student_registration','EARLY_NURSERY_TERM','tuition','الحضانة والتمهيدي 1 — فصل دراسي','رسوم الفصل الدراسي.',1050.00,'SAR','term',true,'{"education_stage":"early_childhood","grades":["الحضانة","تمهيدي 1 KG1"],"period":"term"}'::jsonb,11),
    ('student_registration','EARLY_KG','tuition','رياض الأطفال والتمهيدي — سنوي','رسوم السنة الدراسية.',1800.00,'SAR','annual',true,'{"education_stage":"early_childhood","grades":["تمهيدي 2 KG2","تمهيدي 3 KG3"],"period":"annual"}'::jsonb,12),
    ('student_registration','EARLY_KG_TERM','tuition','رياض الأطفال والتمهيدي — فصل دراسي','رسوم الفصل الدراسي.',900.00,'SAR','term',true,'{"education_stage":"early_childhood","grades":["تمهيدي 2 KG2","تمهيدي 3 KG3"],"period":"term"}'::jsonb,13),
    ('student_registration','TUITION_PRIMARY','tuition','المرحلة الابتدائية — سنوي','رسوم السنة الدراسية.',1500.00,'SAR','annual',true,'{"education_stage":"primary","period":"annual"}'::jsonb,20),
    ('student_registration','TUITION_PRIMARY_TERM','tuition','المرحلة الابتدائية — فصل دراسي','رسوم الفصل الدراسي.',750.00,'SAR','term',true,'{"education_stage":"primary","period":"term"}'::jsonb,21),
    ('student_registration','TUITION_MIDDLE','tuition','المرحلة المتوسطة — سنوي','رسوم السنة الدراسية.',1800.00,'SAR','annual',true,'{"education_stage":"middle","period":"annual"}'::jsonb,22),
    ('student_registration','TUITION_MIDDLE_TERM','tuition','المرحلة المتوسطة — فصل دراسي','رسوم الفصل الدراسي.',900.00,'SAR','term',true,'{"education_stage":"middle","period":"term"}'::jsonb,23),
    ('student_registration','TUITION_SECONDARY','tuition','المرحلة الثانوية — سنوي','باستثناء الصف الثالث الثانوي.',2100.00,'SAR','annual',true,'{"education_stage":"secondary","exclude_grade":"الثالث الثانوي","period":"annual"}'::jsonb,24),
    ('student_registration','TUITION_SECONDARY_TERM','tuition','المرحلة الثانوية — فصل دراسي','باستثناء الصف الثالث الثانوي.',1050.00,'SAR','term',true,'{"education_stage":"secondary","exclude_grade":"الثالث الثانوي","period":"term"}'::jsonb,25),
    ('student_registration','TUITION_GRADE_12','tuition','الصف الثالث الثانوي — سنوي','رسوم السنة الدراسية.',3000.00,'SAR','annual',true,'{"education_stage":"secondary","grade":"الثالث الثانوي","period":"annual"}'::jsonb,26),
    ('student_registration','TUITION_GRADE_12_TERM','tuition','الصف الثالث الثانوي — فصل دراسي','رسوم الفصل الدراسي.',1500.00,'SAR','term',true,'{"education_stage":"secondary","grade":"الثالث الثانوي","period":"term"}'::jsonb,27),
    ('student_registration','LEVEL_ASSESSMENT','conditional','تحديد المستوى','حسب الحاجة فقط.',200.00,'SAR','conditional',false,'{"applies_when":"level_assessment_required"}'::jsonb,30),
    ('student_registration','CERTIFICATE_EQUIVALENCY','conditional','معادلة الشهادة أو الأعمار','حسب الحاجة فقط.',200.00,'SAR','conditional',false,'{"applies_when":"certificate_or_age_equivalency_required"}'::jsonb,31),
    ('university_guidance','FILE_OPENING','registration','فتح الملف','مرة واحدة للمستجدين فقط.',100.00,'SAR','once',true,'{"applies_when":"no_existing_file"}'::jsonb,1),
    ('university_guidance','LEVEL_ASSESSMENT','conditional','تحديد المستوى','حسب الحاجة فقط.',200.00,'SAR','conditional',false,'{"applies_when":"level_assessment_required"}'::jsonb,2),
    ('university_guidance','CERTIFICATE_EQUIVALENCY','conditional','معادلة الشهادة أو الأعمار','حسب الحاجة فقط.',200.00,'SAR','conditional',false,'{"applies_when":"certificate_or_age_equivalency_required"}'::jsonb,3),
    ('university_guidance','TUITION_STANDARD_TERM','tuition','الدبلوم والدبلوم العالي والبكالوريوس — فصل دراسي','رسوم الفصل الدراسي.',900.00,'SAR','term',true,'{"fee_scope":"tuition_only","applies_to":["diploma","bachelor","higher_diploma"],"period":"term"}'::jsonb,10),
    ('university_guidance','TUITION_STANDARD','tuition','الدبلوم والدبلوم العالي والبكالوريوس — سنوي','رسوم السنة وفق الخطة التعليمية.',2700.00,'SAR','annual',true,'{"fee_scope":"tuition_only","applies_to":["diploma","bachelor","higher_diploma"],"period":"annual"}'::jsonb,11),
    ('university_guidance','TUITION_GRADUATE_TERM','tuition','الدراسات العليا والماجستير — فصل دراسي','رسوم الفصل الدراسي.',1000.00,'SAR','term',true,'{"fee_scope":"tuition_only","applies_to":["masters","doctorate","postgraduate_studies"],"period":"term"}'::jsonb,12),
    ('university_guidance','TUITION_GRADUATE','tuition','الدراسات العليا والماجستير — سنوي','رسوم السنة وفق الخطة التعليمية.',3000.00,'SAR','annual',true,'{"fee_scope":"tuition_only","applies_to":["masters","doctorate","postgraduate_studies"],"period":"annual"}'::jsonb,13),
    ('program_application','FILE_OPENING','registration','فتح الملف','مرة واحدة للمستفيد.',50.00,'SAR','once',true,'{"applies_when":"no_existing_file"}'::jsonb,1),
    ('program_application','REGISTRATION','subscription','الاشتراك في البرنامج التعليمي','اشتراك شهري.',150.00,'SAR','monthly',true,'{"period":"monthly"}'::jsonb,2),
    ('course_registration','FILE_OPENING','registration','فتح الملف','مرة واحدة للمستفيد.',50.00,'SAR','once',true,'{"applies_when":"no_existing_file"}'::jsonb,1),
    ('course_registration','REGISTRATION','subscription','الاشتراك في الدورة التعليمية','اشتراك شهري.',150.00,'SAR','monthly',true,'{"period":"monthly"}'::jsonb,2)
  ) AS v(service_code,fee_code,fee_type,fee_name,description,amount,currency,calculation_method,is_required,condition_rule,display_order)
)
INSERT INTO education.service_fee_items
  (service_id,fee_code,fee_type,fee_name,description,amount,currency,calculation_method,is_required,condition_rule,payment_stage,display_order,is_active,updated_at)
SELECT c.id,a.fee_code,a.fee_type,a.fee_name,a.description,a.amount,a.currency,a.calculation_method,a.is_required,a.condition_rule,'before_acceptance',a.display_order,true,now()
FROM approved a
JOIN education.service_catalog c ON c.service_code=a.service_code
ON CONFLICT (service_id,fee_code) DO UPDATE SET
  fee_type=EXCLUDED.fee_type,
  fee_name=EXCLUDED.fee_name,
  description=EXCLUDED.description,
  amount=EXCLUDED.amount,
  currency=EXCLUDED.currency,
  calculation_method=EXCLUDED.calculation_method,
  is_required=EXCLUDED.is_required,
  condition_rule=EXCLUDED.condition_rule,
  payment_stage=EXCLUDED.payment_stage,
  display_order=EXCLUDED.display_order,
  is_active=true,
  updated_at=now();

DO $
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'education_student_tuition_period_check') THEN
    ALTER TABLE education.student_registrations
      ADD CONSTRAINT education_student_tuition_period_check
      CHECK (tuition_period IS NULL OR tuition_period IN ('term','annual'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'education_student_installment_count_check') THEN
    ALTER TABLE education.student_registrations
      ADD CONSTRAINT education_student_installment_count_check
      CHECK (installment_count IS NULL OR installment_count IN (2,3));
  END IF;
END $;
