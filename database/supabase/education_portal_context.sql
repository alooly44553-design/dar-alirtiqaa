-- Safe RLS policies for the education portal.
-- This migration intentionally does not use SECURITY DEFINER.
-- All reads remain scoped by the authenticated user's own profile and center.

DROP POLICY IF EXISTS school_staff_read_own_profile ON public.staff;\n\nCREATE POLICY school_staff_read_own_profile
ON public.staff FOR SELECT TO authenticated
USING (auth_user_id = (SELECT auth.uid()) AND is_active = true);

DROP POLICY IF EXISTS school_teacher_read_center_programs ON public.programs;\n\nCREATE POLICY school_teacher_read_center_programs
ON public.programs FOR SELECT TO authenticated
USING (
  is_active = true AND EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.auth_user_id = (SELECT auth.uid())
      AND s.is_active = true
      AND s.center_id = programs.center_id
  )
);

DROP POLICY IF EXISTS school_teacher_read_center_subjects ON public.subjects;\n\nCREATE POLICY school_teacher_read_center_subjects
ON public.subjects FOR SELECT TO authenticated
USING (
  is_active = true AND EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.auth_user_id = (SELECT auth.uid())
      AND s.is_active = true
      AND s.center_id = subjects.center_id
  )
);

DROP POLICY IF EXISTS school_teacher_read_center_classrooms ON public.classrooms;\n\nCREATE POLICY school_teacher_read_center_classrooms
ON public.classrooms FOR SELECT TO authenticated
USING (
  is_active = true AND EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.auth_user_id = (SELECT auth.uid())
      AND s.is_active = true
      AND s.center_id = classrooms.center_id
  )
);

DROP POLICY IF EXISTS school_learner_read_own_enrollments ON public.enrollments;\n\nCREATE POLICY school_learner_read_own_enrollments
ON public.enrollments FOR SELECT TO authenticated
USING (
  status = 'active' AND EXISTS (
    SELECT 1 FROM public.learners l
    WHERE l.id = enrollments.learner_id
      AND l.auth_user_id = (SELECT auth.uid())
      AND l.is_active = true
  )
);
