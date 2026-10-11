-- Education portal identity bridge.
-- Deliberately SECURITY DEFINER because the existing RLS policies intentionally hide
-- staff, class catalogs, and enrollments from non-admin authenticated callers.
-- Every profile/enrollment row is scoped to auth.uid(); catalogs are scoped to the
-- authenticated active staff member's center. No role or user ID is accepted from callers.
CREATE OR REPLACE FUNCTION public.get_school_portal_context()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$function$$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN '{}'::jsonb
    ELSE jsonb_build_object(
      'staff', (
        SELECT jsonb_build_object(
          'id', s.id,
          'full_name', s.full_name,
          'job_title', s.job_title,
          'center_id', s.center_id
        )
        FROM public.staff AS s
        WHERE s.auth_user_id = auth.uid()
          AND s.is_active = true
        ORDER BY s.created_at DESC
        LIMIT 1
      ),
      'learner', (
        SELECT jsonb_build_object(
          'id', l.id,
          'full_name', l.full_name,
          'center_id', l.center_id
        )
        FROM public.learners AS l
        WHERE l.auth_user_id = auth.uid()
          AND l.is_active = true
        ORDER BY l.created_at DESC
        LIMIT 1
      ),
      'enrollments', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'program_id', e.program_id,
          'classroom_id', e.classroom_id
        ) ORDER BY e.enrolled_at DESC)
        FROM public.enrollments AS e
        JOIN public.learners AS l ON l.id = e.learner_id
        WHERE l.auth_user_id = auth.uid()
          AND l.is_active = true
          AND e.status = 'active'
      ), '[]'::jsonb),
      'catalog', jsonb_build_object(
        'programs', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name) ORDER BY p.name)
          FROM public.programs AS p
          WHERE p.is_active = true
            AND p.center_id = (
              SELECT s.center_id FROM public.staff AS s
              WHERE s.auth_user_id = auth.uid() AND s.is_active = true
              ORDER BY s.created_at DESC LIMIT 1
            )
        ), '[]'::jsonb),
        'subjects', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', su.id, 'name', su.name) ORDER BY su.name)
          FROM public.subjects AS su
          WHERE su.is_active = true
            AND su.center_id = (
              SELECT s.center_id FROM public.staff AS s
              WHERE s.auth_user_id = auth.uid() AND s.is_active = true
              ORDER BY s.created_at DESC LIMIT 1
            )
        ), '[]'::jsonb),
        'classrooms', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) ORDER BY c.name)
          FROM public.classrooms AS c
          WHERE c.is_active = true
            AND c.center_id = (
              SELECT s.center_id FROM public.staff AS s
              WHERE s.auth_user_id = auth.uid() AND s.is_active = true
              ORDER BY s.created_at DESC LIMIT 1
            )
        ), '[]'::jsonb)
      )
    )
  END;
$$function$$;

REVOKE ALL ON FUNCTION public.get_school_portal_context() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_school_portal_context() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_school_portal_context() TO authenticated;
