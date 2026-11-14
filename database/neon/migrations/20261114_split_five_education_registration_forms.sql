-- QA-only: split the unified student registration into the five approved field forms.
-- Apply only to Neon QA branch br-late-dawn-azs3g3i2.
BEGIN;

INSERT INTO education.service_catalog
(service_code, service_name, service_category, description, registration_method, registration_method_label, form_fields, consent_text, requires_management_review, is_active, display_order)
VALUES
(
 'early_childhood_registration',
 'التسجيل في الطفولة المبكرة والتأسيس',
 'الطفولة المبكرة والتأسيس',
 'استمارة مستقلة لرياض الأطفال والتمهيدي، مع بيانات الطفل وولي الأمر والمرحلة والصف ومرجع المنهج والمحتوى المطلوب.',
 'data_form',
 'استمارة تسجيل الطفولة المبكرة والتأسيس',
 '[
  {"key":"applicant_name","type":"text","label":"اسم ولي الأمر / مقدم الطلب","required":true},
  {"key":"applicant_phone","type":"tel","label":"رقم تواصل ولي الأمر","required":true},
  {"key":"applicant_email","type":"email","label":"البريد الإلكتروني"},
  {"key":"student_name","type":"text","label":"اسم الطفل/الطفلة","required":true},
  {"key":"gender","type":"select","label":"النوع","required":true,"options":[{"label":"طفل","value":"male"},{"label":"طفلة","value":"female"}]},
  {"key":"date_of_birth","type":"date","label":"تاريخ الميلاد","required":true},
  {"key":"guardian_name","type":"text","label":"اسم الأب أو الأم أو ولي الأمر","required":true},
  {"key":"guardian_relationship","type":"text","label":"صلة القرابة","required":true},
  {"key":"guardian_phone","type":"tel","label":"هاتف ولي الأمر","required":true},
  {"key":"education_grade","type":"select","label":"المرحلة / الصف","required":true,"options":[{"label":"رياض الأطفال","value":"الحضانة"},{"label":"تمهيدي أول KG1","value":"تمهيدي 1 KG1"},{"label":"تمهيدي ثانٍ KG2","value":"تمهيدي 2 KG2"},{"label":"تمهيدي ثالث KG3","value":"تمهيدي 3 KG3"}]},
  {"key":"learning_content","type":"select","label":"المحتوى التعليمي المطلوب","required":true,"options":[{"label":"الاستعداد للتعلم والتهيئة المدرسية","value":"school_readiness"},{"label":"اللغة العربية والوعي الصوتي والقصص","value":"arabic_language_stories"},{"label":"المفاهيم العددية والأشكال والأنماط","value":"early_numeracy"},{"label":"اللغة الإنجليزية التمهيدية","value":"early_english"},{"label":"المهارات الحركية والفنية والاجتماعية","value":"motor_arts_social"}]},
  {"key":"address","type":"text","label":"العنوان"},
  {"key":"notes","type":"textarea","label":"ملاحظات"}
 ]'::jsonb,
 'أوافق على صحة البيانات المدخلة وعلى مراجعة طلب تسجيل الطفل والتواصل مع ولي الأمر.',
 true, true, 1
),
(
 'general_education_registration',
 'التسجيل في التعليم الأساسي والعام',
 'التعليم الأساسي والعام',
 'استمارة مستقلة للمرحلة الابتدائية والمتوسطة والثانوية، مع بيانات الطالب وولي الأمر والصف ومرجع المنهج والمحتوى المطلوب.',
 'data_form',
 'استمارة تسجيل التعليم الأساسي والعام',
 '[
  {"key":"applicant_name","type":"text","label":"اسم ولي الأمر / مقدم الطلب","required":true},
  {"key":"applicant_phone","type":"tel","label":"رقم تواصل ولي الأمر","required":true},
  {"key":"applicant_email","type":"email","label":"البريد الإلكتروني"},
  {"key":"student_name","type":"text","label":"اسم الطالب/الطالبة","required":true},
  {"key":"gender","type":"select","label":"النوع","required":true,"options":[{"label":"طالب","value":"male"},{"label":"طالبة","value":"female"}]},
  {"key":"date_of_birth","type":"date","label":"تاريخ الميلاد","required":true},
  {"key":"guardian_name","type":"text","label":"اسم الأب أو الأم أو ولي الأمر","required":true},
  {"key":"guardian_relationship","type":"text","label":"صلة القرابة","required":true},
  {"key":"guardian_phone","type":"tel","label":"هاتف ولي الأمر","required":true},
  {"key":"education_grade","type":"select","label":"الصف الدراسي","required":true,"options":[{"label":"الأول الابتدائي","value":"الأول الابتدائي"},{"label":"الثاني الابتدائي","value":"الثاني الابتدائي"},{"label":"الثالث الابتدائي","value":"الثالث الابتدائي"},{"label":"الرابع الابتدائي","value":"الرابع الابتدائي"},{"label":"الخامس الابتدائي","value":"الخامس الابتدائي"},{"label":"السادس الابتدائي","value":"السادس الابتدائي"},{"label":"الأول المتوسط","value":"الأول المتوسط"},{"label":"الثاني المتوسط","value":"الثاني المتوسط"},{"label":"الثالث المتوسط","value":"الثالث المتوسط"},{"label":"الأول الثانوي","value":"الأول الثانوي"},{"label":"الثاني الثانوي","value":"الثاني الثانوي"},{"label":"الثالث الثانوي","value":"الثالث الثانوي"}]},
  {"key":"learning_content","type":"select","label":"المحتوى التعليمي المطلوب","required":true,"options":[{"label":"اللغة العربية والقراءة والكتابة","value":"arabic_reading_writing"},{"label":"الرياضيات والتفكير الكمي","value":"mathematics_quantitative"},{"label":"العلوم والاستقصاء والتجارب","value":"science_inquiry"},{"label":"اللغة الإنجليزية والتواصل","value":"english_communication"},{"label":"المهارات الرقمية والاجتماعية والتعلم الذاتي","value":"digital_social_learning"}]},
  {"key":"previous_education","type":"text","label":"المدرسة أو الصف السابق"},
  {"key":"notes","type":"textarea","label":"ملاحظات"}
 ]'::jsonb,
 'أوافق على صحة البيانات المدخلة وعلى مراجعة طلب التسجيل والتواصل مع ولي الأمر أو مقدم الطلب.',
 true, true, 2
)
ON CONFLICT (service_code) DO UPDATE SET
 service_name=EXCLUDED.service_name,
 service_category=EXCLUDED.service_category,
 description=EXCLUDED.description,
 registration_method=EXCLUDED.registration_method,
 registration_method_label=EXCLUDED.registration_method_label,
 form_fields=EXCLUDED.form_fields,
 consent_text=EXCLUDED.consent_text,
 requires_management_review=true,
 is_active=true,
 display_order=EXCLUDED.display_order,
 updated_at=now();

UPDATE education.service_catalog
SET form_fields = CASE
 WHEN NOT (form_fields @> '[{"key":"learning_content"}]'::jsonb)
 THEN form_fields || CASE service_code
  WHEN 'university_guidance' THEN '[{"key":"learning_content","type":"select","label":"المحتوى الأكاديمي المطلوب","required":true,"options":[{"label":"مناهج البحث العلمي وتصميم الدراسات","value":"research_methods"},{"label":"الكتابة الأكاديمية والتواصل العلمي","value":"academic_writing"},{"label":"الإحصاء وتحليل البيانات","value":"statistics_data"},{"label":"المقررات الأساسية للتخصص","value":"major_core_courses"},{"label":"الندوات ومشروع البحث أو الرسالة","value":"seminars_thesis"}]}]'::jsonb
  WHEN 'course_registration' THEN '[{"key":"learning_content","type":"select","label":"المحتوى التدريبي المطلوب","required":true,"options":[{"label":"المعارف والأساسيات المهنية أو التقنية","value":"professional_technical_fundamentals"},{"label":"التطبيقات والورش العملية","value":"practical_workshops"},{"label":"الأدوات والبرامج الرقمية","value":"digital_tools"},{"label":"السلامة والجودة وممارسات العمل","value":"safety_quality"},{"label":"مشروع تطبيقي وتقييم المهارات","value":"applied_project"}]}]'::jsonb
  WHEN 'activity_join' THEN '[{"key":"learning_content","type":"select","label":"المحتوى أو المسار المطلوب","required":true,"options":[{"label":"مهارات التعلم والقراءة والمعرفة","value":"learning_reading"},{"label":"التواصل واللغة والحوار","value":"communication_language"},{"label":"المهارات الحياتية والأسرية","value":"life_family_skills"},{"label":"القيادة والمبادرة وريادة الأعمال","value":"leadership_initiative"},{"label":"الفنون والرياضة والأنشطة الثقافية","value":"arts_sports_culture"}]}]'::jsonb
  ELSE form_fields
 END
 ELSE form_fields
END,
updated_at=now()
WHERE service_code IN ('university_guidance','course_registration','activity_join');

UPDATE education.service_catalog
SET is_active=false, updated_at=now()
WHERE service_code='student_registration';

COMMIT;
