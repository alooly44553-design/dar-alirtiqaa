-- Education-only Neon QA RLS migration.
-- Target: isolated branch br-late-dawn-azs3g3i2, database neondb, schema education.
-- Runtime role: education_preview_app. This migration does not touch production or the public schema.

CREATE OR REPLACE FUNCTION education.request_claims() RETURNS jsonb
LANGUAGE sql STABLE
AS $$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
REVOKE ALL ON FUNCTION education.request_claims() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION education.request_claims() TO education_preview_app;
GRANT USAGE ON SCHEMA education TO education_preview_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA education TO education_preview_app;
REVOKE DELETE ON ALL TABLES IN SCHEMA education FROM education_preview_app;
GRANT DELETE ON education.telegram_conversations TO education_preview_app;

DROP POLICY IF EXISTS "education_documents_admin_insert" ON education."documents";
CREATE POLICY "education_documents_admin_insert" ON education."documents" AS PERMISSIVE FOR INSERT TO "education_preview_app"
WITH CHECK ((education.request_claims() ->> 'app_role'::text) = 'admin'::text);

DROP POLICY IF EXISTS "education_documents_admin_select" ON education."documents";
CREATE POLICY "education_documents_admin_select" ON education."documents" AS PERMISSIVE FOR SELECT TO "education_preview_app"
USING ((education.request_claims() ->> 'app_role'::text) = 'admin'::text);

DROP POLICY IF EXISTS "education_documents_admin_update" ON education."documents";
CREATE POLICY "education_documents_admin_update" ON education."documents" AS PERMISSIVE FOR UPDATE TO "education_preview_app"
USING ((education.request_claims() ->> 'app_role'::text) = 'admin'::text)
WITH CHECK ((education.request_claims() ->> 'app_role'::text) = 'admin'::text);

DROP POLICY IF EXISTS "education_school_assignments_admin_all" ON education."school_assignments";
CREATE POLICY "education_school_assignments_admin_all" ON education."school_assignments" AS PERMISSIVE FOR ALL TO "education_preview_app"
USING ((education.request_claims() ->> 'app_role'::text) = 'admin'::text)
WITH CHECK ((education.request_claims() ->> 'app_role'::text) = 'admin'::text);

DROP POLICY IF EXISTS "education_school_assignments_role_select" ON education."school_assignments";
CREATE POLICY "education_school_assignments_role_select" ON education."school_assignments" AS PERMISSIVE FOR SELECT TO "education_preview_app"
USING (EXISTS ( SELECT 1
   FROM education.school_lessons l
  WHERE ((l.id = school_assignments.lesson_id) AND ((((education.request_claims() ->> 'app_role'::text) = 'teacher'::text) AND ((l.teacher_id)::text = (education.request_claims() ->> 'staff_id'::text))) OR (((education.request_claims() ->> 'app_role'::text) = ANY (ARRAY['student'::text, 'guardian'::text])) AND (school_assignments.status = 'published'::text) AND (l.status = 'published'::text) AND (NOT (school_assignments.classroom_id IS DISTINCT FROM l.classroom_id)) AND (EXISTS ( SELECT 1
           FROM jsonb_to_recordset(COALESCE((education.request_claims() -> 'enrollments'::text), '[]'::jsonb)) en(learner_id uuid, program_id uuid, classroom_id uuid)
          WHERE (((l.program_id IS NULL) OR (l.program_id = en.program_id)) AND ((l.classroom_id IS NULL) OR (l.classroom_id = en.classroom_id)) AND ((school_assignments.classroom_id IS NULL) OR (school_assignments.classroom_id = en.classroom_id)) AND ((((education.request_claims() ->> 'app_role'::text) = 'student'::text) AND ((en.learner_id)::text = (education.request_claims() ->> 'learner_id'::text))) OR (((education.request_claims() ->> 'app_role'::text) = 'guardian'::text) AND ((education.request_claims() -> 'learner_ids'::text) ? (en.learner_id)::text)))))))))));

DROP POLICY IF EXISTS "education_school_assignments_teacher_insert" ON education."school_assignments";
CREATE POLICY "education_school_assignments_teacher_insert" ON education."school_assignments" AS PERMISSIVE FOR INSERT TO "education_preview_app"
WITH CHECK (((education.request_claims() ->> 'app_role'::text) = 'teacher'::text) AND (EXISTS ( SELECT 1
   FROM education.school_lessons l
  WHERE ((l.id = school_assignments.lesson_id) AND ((l.teacher_id)::text = (education.request_claims() ->> 'staff_id'::text)) AND (NOT (school_assignments.classroom_id IS DISTINCT FROM l.classroom_id))))));

DROP POLICY IF EXISTS "education_school_assignments_teacher_update" ON education."school_assignments";
CREATE POLICY "education_school_assignments_teacher_update" ON education."school_assignments" AS PERMISSIVE FOR UPDATE TO "education_preview_app"
USING (((education.request_claims() ->> 'app_role'::text) = 'teacher'::text) AND (EXISTS ( SELECT 1
   FROM education.school_lessons l
  WHERE ((l.id = school_assignments.lesson_id) AND ((l.teacher_id)::text = (education.request_claims() ->> 'staff_id'::text))))))
WITH CHECK (((education.request_claims() ->> 'app_role'::text) = 'teacher'::text) AND (EXISTS ( SELECT 1
   FROM education.school_lessons l
  WHERE ((l.id = school_assignments.lesson_id) AND ((l.teacher_id)::text = (education.request_claims() ->> 'staff_id'::text)) AND (NOT (school_assignments.classroom_id IS DISTINCT FROM l.classroom_id))))));

DROP POLICY IF EXISTS "education_school_lessons_admin_all" ON education."school_lessons";
CREATE POLICY "education_school_lessons_admin_all" ON education."school_lessons" AS PERMISSIVE FOR ALL TO "education_preview_app"
USING ((education.request_claims() ->> 'app_role'::text) = 'admin'::text)
WITH CHECK ((education.request_claims() ->> 'app_role'::text) = 'admin'::text);

DROP POLICY IF EXISTS "education_school_lessons_learner_select" ON education."school_lessons";
CREATE POLICY "education_school_lessons_learner_select" ON education."school_lessons" AS PERMISSIVE FOR SELECT TO "education_preview_app"
USING (((education.request_claims() ->> 'app_role'::text) = ANY (ARRAY['student'::text, 'guardian'::text])) AND (status = 'published'::text) AND (EXISTS ( SELECT 1
   FROM jsonb_to_recordset(COALESCE((education.request_claims() -> 'enrollments'::text), '[]'::jsonb)) en(learner_id uuid, program_id uuid, classroom_id uuid)
  WHERE (((school_lessons.program_id IS NULL) OR (school_lessons.program_id = en.program_id)) AND ((school_lessons.classroom_id IS NULL) OR (school_lessons.classroom_id = en.classroom_id)) AND ((((education.request_claims() ->> 'app_role'::text) = 'student'::text) AND ((en.learner_id)::text = (education.request_claims() ->> 'learner_id'::text))) OR (((education.request_claims() ->> 'app_role'::text) = 'guardian'::text) AND ((education.request_claims() -> 'learner_ids'::text) ? (en.learner_id)::text)))))));

DROP POLICY IF EXISTS "education_school_lessons_teacher_insert" ON education."school_lessons";
CREATE POLICY "education_school_lessons_teacher_insert" ON education."school_lessons" AS PERMISSIVE FOR INSERT TO "education_preview_app"
WITH CHECK (((education.request_claims() ->> 'app_role'::text) = 'teacher'::text) AND ((teacher_id)::text = (education.request_claims() ->> 'staff_id'::text)));

DROP POLICY IF EXISTS "education_school_lessons_teacher_select" ON education."school_lessons";
CREATE POLICY "education_school_lessons_teacher_select" ON education."school_lessons" AS PERMISSIVE FOR SELECT TO "education_preview_app"
USING (((education.request_claims() ->> 'app_role'::text) = 'teacher'::text) AND ((teacher_id)::text = (education.request_claims() ->> 'staff_id'::text)));

DROP POLICY IF EXISTS "education_school_lessons_teacher_update" ON education."school_lessons";
CREATE POLICY "education_school_lessons_teacher_update" ON education."school_lessons" AS PERMISSIVE FOR UPDATE TO "education_preview_app"
USING (((education.request_claims() ->> 'app_role'::text) = 'teacher'::text) AND ((teacher_id)::text = (education.request_claims() ->> 'staff_id'::text)))
WITH CHECK (((education.request_claims() ->> 'app_role'::text) = 'teacher'::text) AND ((teacher_id)::text = (education.request_claims() ->> 'staff_id'::text)));

DROP POLICY IF EXISTS "education_school_submissions_admin_all" ON education."school_submissions";
CREATE POLICY "education_school_submissions_admin_all" ON education."school_submissions" AS PERMISSIVE FOR ALL TO "education_preview_app"
USING ((education.request_claims() ->> 'app_role'::text) = 'admin'::text)
WITH CHECK ((education.request_claims() ->> 'app_role'::text) = 'admin'::text);

DROP POLICY IF EXISTS "education_school_submissions_role_select" ON education."school_submissions";
CREATE POLICY "education_school_submissions_role_select" ON education."school_submissions" AS PERMISSIVE FOR SELECT TO "education_preview_app"
USING ((((education.request_claims() ->> 'app_role'::text) = 'student'::text) AND ((learner_id)::text = (education.request_claims() ->> 'learner_id'::text))) OR (((education.request_claims() ->> 'app_role'::text) = 'guardian'::text) AND ((education.request_claims() -> 'learner_ids'::text) ? (learner_id)::text)) OR (((education.request_claims() ->> 'app_role'::text) = 'teacher'::text) AND (EXISTS ( SELECT 1
   FROM (education.school_assignments a
     JOIN education.school_lessons l ON ((l.id = a.lesson_id)))
  WHERE ((a.id = school_submissions.assignment_id) AND ((l.teacher_id)::text = (education.request_claims() ->> 'staff_id'::text)))))));

DROP POLICY IF EXISTS "education_school_submissions_student_insert" ON education."school_submissions";
CREATE POLICY "education_school_submissions_student_insert" ON education."school_submissions" AS PERMISSIVE FOR INSERT TO "education_preview_app"
WITH CHECK (((education.request_claims() ->> 'app_role'::text) = 'student'::text) AND ((learner_id)::text = (education.request_claims() ->> 'learner_id'::text)) AND (EXISTS ( SELECT 1
   FROM (education.school_assignments a
     JOIN education.school_lessons l ON ((l.id = a.lesson_id)))
  WHERE ((a.id = school_submissions.assignment_id) AND (a.status = 'published'::text) AND (l.status = 'published'::text) AND (NOT (a.classroom_id IS DISTINCT FROM l.classroom_id)) AND (EXISTS ( SELECT 1
           FROM jsonb_to_recordset(COALESCE((education.request_claims() -> 'enrollments'::text), '[]'::jsonb)) en(learner_id uuid, program_id uuid, classroom_id uuid)
          WHERE ((en.learner_id = school_submissions.learner_id) AND ((l.program_id IS NULL) OR (l.program_id = en.program_id)) AND ((l.classroom_id IS NULL) OR (l.classroom_id = en.classroom_id)) AND ((a.classroom_id IS NULL) OR (a.classroom_id = en.classroom_id)))))))));

DROP POLICY IF EXISTS "education_school_submissions_student_update" ON education."school_submissions";
CREATE POLICY "education_school_submissions_student_update" ON education."school_submissions" AS PERMISSIVE FOR UPDATE TO "education_preview_app"
USING (((education.request_claims() ->> 'app_role'::text) = 'student'::text) AND ((learner_id)::text = (education.request_claims() ->> 'learner_id'::text)) AND (score IS NULL) AND (feedback IS NULL))
WITH CHECK (((education.request_claims() ->> 'app_role'::text) = 'student'::text) AND ((learner_id)::text = (education.request_claims() ->> 'learner_id'::text)) AND (score IS NULL) AND (feedback IS NULL) AND (status = ANY (ARRAY['draft'::text, 'submitted'::text])));

DROP POLICY IF EXISTS "education_school_submissions_teacher_update" ON education."school_submissions";
CREATE POLICY "education_school_submissions_teacher_update" ON education."school_submissions" AS PERMISSIVE FOR UPDATE TO "education_preview_app"
USING (((education.request_claims() ->> 'app_role'::text) = 'teacher'::text) AND (EXISTS ( SELECT 1
   FROM (education.school_assignments a
     JOIN education.school_lessons l ON ((l.id = a.lesson_id)))
  WHERE ((a.id = school_submissions.assignment_id) AND ((l.teacher_id)::text = (education.request_claims() ->> 'staff_id'::text))))))
WITH CHECK (((education.request_claims() ->> 'app_role'::text) = 'teacher'::text) AND (EXISTS ( SELECT 1
   FROM (education.school_assignments a
     JOIN education.school_lessons l ON ((l.id = a.lesson_id)))
  WHERE ((a.id = school_submissions.assignment_id) AND ((l.teacher_id)::text = (education.request_claims() ->> 'staff_id'::text))))));

DROP POLICY IF EXISTS "education_service_catalog_admin_insert" ON education."service_catalog";
CREATE POLICY "education_service_catalog_admin_insert" ON education."service_catalog" AS PERMISSIVE FOR INSERT TO "education_preview_app"
WITH CHECK ((education.request_claims() ->> 'app_role'::text) = 'admin'::text);

DROP POLICY IF EXISTS "education_service_catalog_admin_update" ON education."service_catalog";
CREATE POLICY "education_service_catalog_admin_update" ON education."service_catalog" AS PERMISSIVE FOR UPDATE TO "education_preview_app"
USING ((education.request_claims() ->> 'app_role'::text) = 'admin'::text)
WITH CHECK ((education.request_claims() ->> 'app_role'::text) = 'admin'::text);

DROP POLICY IF EXISTS "education_service_catalog_public_select" ON education."service_catalog";
CREATE POLICY "education_service_catalog_public_select" ON education."service_catalog" AS PERMISSIVE FOR SELECT TO "education_preview_app"
USING ((is_active = true) AND ((education.request_claims() ->> 'app_role'::text) = ANY (ARRAY['public_catalog'::text, 'public_service_request'::text, 'admin'::text])));

DROP POLICY IF EXISTS "education_service_fee_items_admin_insert" ON education."service_fee_items";
CREATE POLICY "education_service_fee_items_admin_insert" ON education."service_fee_items" AS PERMISSIVE FOR INSERT TO "education_preview_app"
WITH CHECK ((education.request_claims() ->> 'app_role'::text) = 'admin'::text);

DROP POLICY IF EXISTS "education_service_fee_items_admin_update" ON education."service_fee_items";
CREATE POLICY "education_service_fee_items_admin_update" ON education."service_fee_items" AS PERMISSIVE FOR UPDATE TO "education_preview_app"
USING ((education.request_claims() ->> 'app_role'::text) = 'admin'::text)
WITH CHECK ((education.request_claims() ->> 'app_role'::text) = 'admin'::text);

DROP POLICY IF EXISTS "education_service_fee_items_public_select" ON education."service_fee_items";
CREATE POLICY "education_service_fee_items_public_select" ON education."service_fee_items" AS PERMISSIVE FOR SELECT TO "education_preview_app"
USING (((education.request_claims() ->> 'app_role'::text) = ANY (ARRAY['public_catalog'::text, 'admin'::text])) AND (EXISTS ( SELECT 1
   FROM education.service_catalog s
  WHERE ((s.id = service_fee_items.service_id) AND (s.is_active = true)))));

DROP POLICY IF EXISTS "education_service_requests_admin_select" ON education."service_requests";
CREATE POLICY "education_service_requests_admin_select" ON education."service_requests" AS PERMISSIVE FOR SELECT TO "education_preview_app"
USING ((education.request_claims() ->> 'app_role'::text) = 'admin'::text);

DROP POLICY IF EXISTS "education_service_requests_admin_update" ON education."service_requests";
CREATE POLICY "education_service_requests_admin_update" ON education."service_requests" AS PERMISSIVE FOR UPDATE TO "education_preview_app"
USING ((education.request_claims() ->> 'app_role'::text) = 'admin'::text)
WITH CHECK ((education.request_claims() ->> 'app_role'::text) = 'admin'::text);

DROP POLICY IF EXISTS "education_service_requests_public_insert" ON education."service_requests";
CREATE POLICY "education_service_requests_public_insert" ON education."service_requests" AS PERMISSIVE FOR INSERT TO "education_preview_app"
WITH CHECK (((education.request_claims() ->> 'app_role'::text) = 'public_service_request'::text) AND (consent_given = true) AND (status = 'new'::text));

DROP POLICY IF EXISTS "education_student_registrations_admin_select" ON education."student_registrations";
CREATE POLICY "education_student_registrations_admin_select" ON education."student_registrations" AS PERMISSIVE FOR SELECT TO "education_preview_app"
USING ((education.request_claims() ->> 'app_role'::text) = 'admin'::text);

DROP POLICY IF EXISTS "education_student_registrations_admin_update" ON education."student_registrations";
CREATE POLICY "education_student_registrations_admin_update" ON education."student_registrations" AS PERMISSIVE FOR UPDATE TO "education_preview_app"
USING ((education.request_claims() ->> 'app_role'::text) = 'admin'::text)
WITH CHECK ((education.request_claims() ->> 'app_role'::text) = 'admin'::text);

DROP POLICY IF EXISTS "education_student_registrations_public_insert" ON education."student_registrations";
CREATE POLICY "education_student_registrations_public_insert" ON education."student_registrations" AS PERMISSIVE FOR INSERT TO "education_preview_app"
WITH CHECK (((education.request_claims() ->> 'app_role'::text) = 'public_registration'::text) AND (consent_given = true) AND (status = 'pending'::text) AND (approval_status = 'pending'::text));

DROP POLICY IF EXISTS "education_tasks_admin_insert" ON education."tasks";
CREATE POLICY "education_tasks_admin_insert" ON education."tasks" AS PERMISSIVE FOR INSERT TO "education_preview_app"
WITH CHECK ((education.request_claims() ->> 'app_role'::text) = 'admin'::text);

DROP POLICY IF EXISTS "education_tasks_admin_select" ON education."tasks";
CREATE POLICY "education_tasks_admin_select" ON education."tasks" AS PERMISSIVE FOR SELECT TO "education_preview_app"
USING ((education.request_claims() ->> 'app_role'::text) = 'admin'::text);

DROP POLICY IF EXISTS "education_tasks_admin_update" ON education."tasks";
CREATE POLICY "education_tasks_admin_update" ON education."tasks" AS PERMISSIVE FOR UPDATE TO "education_preview_app"
USING ((education.request_claims() ->> 'app_role'::text) = 'admin'::text)
WITH CHECK ((education.request_claims() ->> 'app_role'::text) = 'admin'::text);

DROP POLICY IF EXISTS "education_tasks_public_intake_insert" ON education."tasks";
CREATE POLICY "education_tasks_public_intake_insert" ON education."tasks" AS PERMISSIVE FOR INSERT TO "education_preview_app"
WITH CHECK (((education.request_claims() ->> 'app_role'::text) = ANY (ARRAY['public_registration'::text, 'public_service_request'::text])) AND (status = 'open'::text) AND (assigned_to = 'منسق القبول والسجلات التعليمية — ذكاء اصطناعي'::text) AND ((title ~~ 'مراجعة تسجيل طالب/طالبة — EDU-%'::text) OR (title ~~ 'مراجعة طلب خدمة % — EDU-SVC-%'::text)));

DROP POLICY IF EXISTS "education_telegram_conversations_delete" ON education."telegram_conversations";
CREATE POLICY "education_telegram_conversations_delete" ON education."telegram_conversations" AS PERMISSIVE FOR DELETE TO "education_preview_app"
USING (((education.request_claims() ->> 'app_role'::text) = 'telegram_service'::text) AND ((chat_id = (education.request_claims() ->> 'chat_id'::text)) OR (((education.request_claims() ->> 'maintenance'::text) = 'true'::text) AND (updated_at < (now() - '30 days'::interval)))));

DROP POLICY IF EXISTS "education_telegram_conversations_insert" ON education."telegram_conversations";
CREATE POLICY "education_telegram_conversations_insert" ON education."telegram_conversations" AS PERMISSIVE FOR INSERT TO "education_preview_app"
WITH CHECK (((education.request_claims() ->> 'app_role'::text) = ANY (ARRAY['telegram_service'::text, 'teacher_ai'::text])) AND (chat_id = (education.request_claims() ->> 'chat_id'::text)));

DROP POLICY IF EXISTS "education_telegram_conversations_select" ON education."telegram_conversations";
CREATE POLICY "education_telegram_conversations_select" ON education."telegram_conversations" AS PERMISSIVE FOR SELECT TO "education_preview_app"
USING (((education.request_claims() ->> 'app_role'::text) = ANY (ARRAY['telegram_service'::text, 'teacher_ai'::text])) AND (chat_id = (education.request_claims() ->> 'chat_id'::text)));

DROP POLICY IF EXISTS "education_telegram_conversations_update" ON education."telegram_conversations";
CREATE POLICY "education_telegram_conversations_update" ON education."telegram_conversations" AS PERMISSIVE FOR UPDATE TO "education_preview_app"
USING (((education.request_claims() ->> 'app_role'::text) = ANY (ARRAY['telegram_service'::text, 'teacher_ai'::text])) AND (chat_id = (education.request_claims() ->> 'chat_id'::text)))
WITH CHECK (((education.request_claims() ->> 'app_role'::text) = ANY (ARRAY['telegram_service'::text, 'teacher_ai'::text])) AND (chat_id = (education.request_claims() ->> 'chat_id'::text)));

DROP POLICY IF EXISTS "education_telegram_tasks_insert" ON education."telegram_tasks";
CREATE POLICY "education_telegram_tasks_insert" ON education."telegram_tasks" AS PERMISSIVE FOR INSERT TO "education_preview_app"
WITH CHECK (((education.request_claims() ->> 'app_role'::text) = 'telegram_service'::text) AND (chat_id = (education.request_claims() ->> 'chat_id'::text)));

DROP POLICY IF EXISTS "education_telegram_tasks_select" ON education."telegram_tasks";
CREATE POLICY "education_telegram_tasks_select" ON education."telegram_tasks" AS PERMISSIVE FOR SELECT TO "education_preview_app"
USING (((education.request_claims() ->> 'app_role'::text) = 'telegram_service'::text) AND (chat_id = (education.request_claims() ->> 'chat_id'::text)));

DROP POLICY IF EXISTS "education_telegram_tasks_update" ON education."telegram_tasks";
CREATE POLICY "education_telegram_tasks_update" ON education."telegram_tasks" AS PERMISSIVE FOR UPDATE TO "education_preview_app"
USING (((education.request_claims() ->> 'app_role'::text) = 'telegram_service'::text) AND (chat_id = (education.request_claims() ->> 'chat_id'::text)))
WITH CHECK (((education.request_claims() ->> 'app_role'::text) = 'telegram_service'::text) AND (chat_id = (education.request_claims() ->> 'chat_id'::text)));

DROP POLICY IF EXISTS "education_telegram_video_jobs_insert" ON education."telegram_video_jobs";
CREATE POLICY "education_telegram_video_jobs_insert" ON education."telegram_video_jobs" AS PERMISSIVE FOR INSERT TO "education_preview_app"
WITH CHECK (((education.request_claims() ->> 'app_role'::text) = 'telegram_service'::text) AND (chat_id = (education.request_claims() ->> 'chat_id'::text)));

DROP POLICY IF EXISTS "education_telegram_video_jobs_select" ON education."telegram_video_jobs";
CREATE POLICY "education_telegram_video_jobs_select" ON education."telegram_video_jobs" AS PERMISSIVE FOR SELECT TO "education_preview_app"
USING (((education.request_claims() ->> 'app_role'::text) = 'telegram_service'::text) AND (chat_id = (education.request_claims() ->> 'chat_id'::text)));

DROP POLICY IF EXISTS "education_telegram_video_jobs_update" ON education."telegram_video_jobs";
CREATE POLICY "education_telegram_video_jobs_update" ON education."telegram_video_jobs" AS PERMISSIVE FOR UPDATE TO "education_preview_app"
USING (((education.request_claims() ->> 'app_role'::text) = 'telegram_service'::text) AND (chat_id = (education.request_claims() ->> 'chat_id'::text)))
WITH CHECK (((education.request_claims() ->> 'app_role'::text) = 'telegram_service'::text) AND (chat_id = (education.request_claims() ->> 'chat_id'::text)));

DROP POLICY IF EXISTS "education_zoom_meetings_admin_all" ON education."zoom_meetings";
CREATE POLICY "education_zoom_meetings_admin_all" ON education."zoom_meetings" AS PERMISSIVE FOR ALL TO "education_preview_app"
USING ((education.request_claims() ->> 'app_role'::text) = 'admin'::text)
WITH CHECK ((education.request_claims() ->> 'app_role'::text) = 'admin'::text);

ALTER TABLE education."documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE education."school_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE education."school_lessons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE education."school_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE education."service_catalog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE education."service_fee_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE education."service_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE education."student_registrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE education."tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE education."telegram_conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE education."telegram_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE education."telegram_video_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE education."zoom_meetings" ENABLE ROW LEVEL SECURITY;
