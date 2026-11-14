-- Approved education fee matrix for the isolated Neon QA branch only.
-- Pre-change fee rows are preserved in database/neon/backups/education-service-fee-items-pre-20261114.json.
-- Do not apply this migration to production without a separate written approval.

DELETE FROM education.service_fee_items f
USING education.service_catalog s
WHERE f.service_id = s.id
  AND s.service_code IN (
    'student_registration','university_guidance','activity_join',
    'course_registration','program_application','event_registration','general_service'
  );

INSERT INTO education.service_fee_items
  (service_id, fee_code, fee_type, fee_name, amount, currency, calculation_method,
   is_required, condition_rule, payment_stage, display_order, is_active)
SELECT s.id, v.fee_code, v.fee_type, v.fee_name, v.amount, 'SAR', v.calculation_method,
       v.is_required, v.condition_rule::jsonb, v.payment_stage, v.display_order, true
FROM education.service_catalog s
JOIN (VALUES
  ('student_registration','FILE_OPENING','file_opening','فتح الملف والتسجيل',100,'conditional',true,'{"applies_when":"no_existing_file"}','before_acceptance',10),
  ('student_registration','EARLY_UNIFORM_BOOKS','registration','الزي والكتب — سنوي',100,'annual',true,'{"education_stage":"early_childhood","period":"annual"}','before_start',20),
  ('student_registration','EARLY_NURSERY','tuition','رياض الأطفال — سنوي',2100,'annual',true,'{"education_stage":"early_childhood","grade_group":"kindergarten","period":"annual"}','before_start',30),
  ('student_registration','EARLY_NURSERY_TERM','tuition','رياض الأطفال — فصل دراسي',1050,'term',true,'{"education_stage":"early_childhood","grade_group":"kindergarten","period":"term"}','before_start',31),
  ('student_registration','EARLY_KG','tuition','التمهيدي الأول والثاني والثالث — سنوي',1800,'annual',true,'{"education_stage":"early_childhood","grade_group":"preparatory","period":"annual"}','before_start',32),
  ('student_registration','EARLY_KG_TERM','tuition','التمهيدي الأول والثاني والثالث — فصل دراسي',900,'term',true,'{"education_stage":"early_childhood","grade_group":"preparatory","period":"term"}','before_start',33),
  ('student_registration','TUITION_PRIMARY','tuition','الابتدائية — سنوي',1200,'annual',true,'{"education_stage":"primary","period":"annual"}','before_start',40),
  ('student_registration','TUITION_PRIMARY_TERM','tuition','الابتدائية — فصل دراسي',600,'term',true,'{"education_stage":"primary","period":"term"}','before_start',41),
  ('student_registration','TUITION_MIDDLE','tuition','المتوسطة — سنوي',1500,'annual',true,'{"education_stage":"middle","period":"annual"}','before_start',42),
  ('student_registration','TUITION_MIDDLE_TERM','tuition','المتوسطة — فصل دراسي',750,'term',true,'{"education_stage":"middle","period":"term"}','before_start',43),
  ('student_registration','TUITION_SECONDARY','tuition','الثانوية — سنوي باستثناء الثالث الثانوي',2000,'annual',true,'{"education_stage":"secondary","exclude_grade":"الثالث الثانوي","period":"annual"}','before_start',44),
  ('student_registration','TUITION_SECONDARY_TERM','tuition','الثانوية — فصل دراسي باستثناء الثالث الثانوي',1000,'term',true,'{"education_stage":"secondary","exclude_grade":"الثالث الثانوي","period":"term"}','before_start',45),
  ('student_registration','TUITION_GRADE_12','tuition','الثالث الثانوي — سنوي',3000,'annual',true,'{"education_stage":"secondary","grade":"الثالث الثانوي","period":"annual"}','before_start',46),
  ('student_registration','TUITION_GRADE_12_TERM','tuition','الثالث الثانوي — فصل دراسي',1500,'term',true,'{"education_stage":"secondary","grade":"الثالث الثانوي","period":"term"}','before_start',47),
  ('student_registration','LEVEL_OR_EQUIVALENCY','conditional','تحديد المستوى أو معادلة الشهادة أو العمر',200,'conditional',false,'{"applies_when":"level_assessment_or_equivalency_required"}','before_start',50),

  ('university_guidance','FILE_OPENING','file_opening','فتح الملف والتسجيل',200,'once',true,'{"applies_when":"no_existing_file"}','before_acceptance',10),
  ('university_guidance','LEVEL_OR_EQUIVALENCY','conditional','تحديد المستوى أو معادلة الشهادة',300,'conditional',false,'{"applies_when":"level_assessment_or_equivalency_required"}','before_start',20),
  ('university_guidance','TUITION_STANDARD_TERM','tuition','البرامج الجامعية والأكاديمية — فصل دراسي',1400,'term',true,'{"fee_scope":"tuition_only","applies_to":["diploma","bachelor","higher_diploma"],"period":"term"}','before_start',30),
  ('university_guidance','TUITION_STANDARD','tuition','البرامج الجامعية والأكاديمية — سنوي',2800,'annual',true,'{"fee_scope":"tuition_only","applies_to":["diploma","bachelor","higher_diploma"],"period":"annual"}','before_start',31),
  ('university_guidance','TUITION_GRADUATE_TERM','tuition','التعليم العالي والدراسات العليا — فصل دراسي',1500,'term',true,'{"fee_scope":"tuition_only","applies_to":["masters","doctorate","postgraduate_studies","other_graduate"],"period":"term"}','before_start',32),
  ('university_guidance','TUITION_GRADUATE','tuition','التعليم العالي والدراسات العليا — سنوي',3000,'annual',true,'{"fee_scope":"tuition_only","applies_to":["masters","doctorate","postgraduate_studies","other_graduate"],"period":"annual"}','before_start',33),

  ('activity_join','FILE_OPENING','file_opening','فتح الملف والتسجيل',50,'once',true,'{"applies_when":"no_existing_file"}','before_acceptance',10),
  ('activity_join','PATHS_3','subscription','ثلاثة مسارات — شهري',150,'monthly',true,'{"path_count":3,"period":"monthly"}','before_start',20),
  ('activity_join','PATHS_5','subscription','خمسة مسارات — شهري',200,'monthly',true,'{"path_count":5,"period":"monthly"}','before_start',21),

  ('course_registration','FILE_OPENING','file_opening','فتح الملف والتسجيل',200,'once',true,'{"applies_when":"no_existing_file"}','before_acceptance',10),
  ('course_registration','PROFESSIONAL_TERM','tuition','التدريب المهني — فصل دراسي',1000,'term',true,'{"training_type":"professional","period":"term"}','before_start',20),
  ('course_registration','PROFESSIONAL_ANNUAL','tuition','التدريب المهني — سنوي',2000,'annual',true,'{"training_type":"professional","period":"annual"}','before_start',21),
  ('course_registration','TECHNICAL_TERM','tuition','التدريب التقني — فصل دراسي',1200,'term',true,'{"training_type":"technical","period":"term"}','before_start',22),
  ('course_registration','TECHNICAL_ANNUAL','tuition','التدريب التقني — سنوي',2400,'annual',true,'{"training_type":"technical","period":"annual"}','before_start',23),

  ('program_application','FILE_OPENING','file_opening','فتح الملف والتسجيل',50,'once',true,'{"applies_when":"no_existing_file"}','before_acceptance',10),
  ('program_application','REGISTRATION','subscription','الاشتراك الأساسي — شهري',150,'monthly',true,'{"period":"monthly"}','before_start',20),
  ('event_registration','FILE_OPENING','file_opening','فتح الملف والتسجيل',50,'once',true,'{"applies_when":"no_existing_file"}','before_acceptance',10),
  ('event_registration','REGISTRATION','subscription','الاشتراك الأساسي — شهري',150,'monthly',true,'{"period":"monthly"}','before_start',20),
  ('general_service','FILE_OPENING','file_opening','فتح الملف والتسجيل',50,'once',true,'{"applies_when":"no_existing_file"}','before_acceptance',10),
  ('general_service','REGISTRATION','subscription','الاشتراك الأساسي — شهري',150,'monthly',true,'{"period":"monthly"}','before_start',20)
) AS v(service_code, fee_code, fee_type, fee_name, amount, calculation_method, is_required, condition_rule, payment_stage, display_order)
  ON s.service_code = v.service_code
WHERE s.is_active = true;

UPDATE education.service_catalog
SET registration_method_label = 'طلب الالتحاق بالحزمة الجامعية'
WHERE service_code = 'university_guidance';
