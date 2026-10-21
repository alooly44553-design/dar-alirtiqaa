-- Additive role-aware read access for authenticated teachers, learners, and linked guardians.
-- No public writes are granted here. Existing administration policies remain in place.
-- Safe to rerun: each policy name is dropped/recreated only for this migration's own policies.

ALTER TABLE public.edu_parent_observer_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_virtual_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_virtual_session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_virtual_session_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_teacher_schedule_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_school_schedule_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_schedule_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_class_sections ENABLE ROW LEVEL SECURITY;

-- Parents can view only their own active observer grants. This does not grant
-- classroom participation, speaking, writing, sharing, or permission changes.
DROP POLICY IF EXISTS guardian_read_own_observer_grants ON public.edu_parent_observer_access;
CREATE POLICY guardian_read_own_observer_grants
ON public.edu_parent_observer_access
FOR SELECT TO authenticated
USING (parent_user_id = (SELECT auth.uid()) AND active IS TRUE);

-- Parent/guardian visibility is restricted to rows explicitly linked to the
-- authenticated guardian, with a limited legacy guardian_user_id fallback.
DROP POLICY IF EXISTS guardian_read_linked_learners ON public.learners;
CREATE POLICY guardian_read_linked_learners
ON public.learners
FOR SELECT TO authenticated
USING (
  guardian_user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.edu_guardians g
    JOIN public.edu_guardian_learners gl ON gl.guardian_id = g.id
    WHERE g.auth_user_id = (SELECT auth.uid())
      AND g.is_active IS TRUE
      AND gl.learner_id = learners.id
  )
);

DROP POLICY IF EXISTS guardian_read_linked_enrollments ON public.enrollments;
CREATE POLICY guardian_read_linked_enrollments
ON public.enrollments
FOR SELECT TO authenticated
USING (
  status IN ('active', 'enrolled')
  AND EXISTS (
    SELECT 1 FROM public.learners l
    WHERE l.id = enrollments.learner_id
      AND (
        l.guardian_user_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.edu_guardians g
          JOIN public.edu_guardian_learners gl ON gl.guardian_id = g.id
          WHERE g.auth_user_id = (SELECT auth.uid())
            AND g.is_active IS TRUE
            AND gl.learner_id = l.id
        )
      )
  )
);

DROP POLICY IF EXISTS guardian_read_linked_school_lessons ON public.school_lessons;
CREATE POLICY guardian_read_linked_school_lessons
ON public.school_lessons
FOR SELECT TO authenticated
USING (
  status = 'published'
  AND classroom_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.learners l ON l.id = e.learner_id
    WHERE e.classroom_id = school_lessons.classroom_id
      AND e.status IN ('active', 'enrolled')
      AND (
        l.guardian_user_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.edu_guardians g
          JOIN public.edu_guardian_learners gl ON gl.guardian_id = g.id
          WHERE g.auth_user_id = (SELECT auth.uid())
            AND g.is_active IS TRUE
            AND gl.learner_id = l.id
        )
      )
  )
);

DROP POLICY IF EXISTS guardian_read_linked_school_assignments ON public.school_assignments;
CREATE POLICY guardian_read_linked_school_assignments
ON public.school_assignments
FOR SELECT TO authenticated
USING (
  status = 'published'
  AND classroom_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.learners l ON l.id = e.learner_id
    JOIN public.school_lessons lesson ON lesson.id = school_assignments.lesson_id
    WHERE e.classroom_id = school_assignments.classroom_id
      AND e.status IN ('active', 'enrolled')
      AND lesson.status = 'published'
      AND (
        l.guardian_user_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.edu_guardians g
          JOIN public.edu_guardian_learners gl ON gl.guardian_id = g.id
          WHERE g.auth_user_id = (SELECT auth.uid())
            AND g.is_active IS TRUE
            AND gl.learner_id = l.id
        )
      )
  )
);

DROP POLICY IF EXISTS guardian_read_linked_school_submissions ON public.school_submissions;
CREATE POLICY guardian_read_linked_school_submissions
ON public.school_submissions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.learners l
    WHERE l.id = school_submissions.learner_id
      AND (
        l.guardian_user_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.edu_guardians g
          JOIN public.edu_guardian_learners gl ON gl.guardian_id = g.id
          WHERE g.auth_user_id = (SELECT auth.uid())
            AND g.is_active IS TRUE
            AND gl.learner_id = l.id
        )
      )
  )
);

DROP POLICY IF EXISTS guardian_read_linked_notifications ON public.edu_notifications;
CREATE POLICY guardian_read_linked_notifications
ON public.edu_notifications
FOR SELECT TO authenticated
USING (
  recipient_user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.edu_guardians g
    WHERE g.id = edu_notifications.guardian_id
      AND g.auth_user_id = (SELECT auth.uid())
      AND g.is_active IS TRUE
  )
  OR EXISTS (
    SELECT 1
    FROM public.learners l
    WHERE l.id = edu_notifications.learner_id
      AND (
        l.guardian_user_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.edu_guardians g
          JOIN public.edu_guardian_learners gl ON gl.guardian_id = g.id
          WHERE g.auth_user_id = (SELECT auth.uid())
            AND g.is_active IS TRUE
            AND gl.learner_id = l.id
        )
      )
  )
);

-- Live sessions are visible only to registered participants and explicitly
-- permitted observing guardians of the linked learner account.
DROP POLICY IF EXISTS participant_read_own_virtual_sessions ON public.edu_virtual_sessions;
CREATE POLICY participant_read_own_virtual_sessions
ON public.edu_virtual_sessions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.edu_virtual_session_participants p
    WHERE p.session_id = edu_virtual_sessions.id
      AND p.user_id = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1
    FROM public.edu_virtual_session_participants p
    JOIN public.edu_parent_observer_access oa
      ON oa.learner_user_id = p.user_id
    WHERE p.session_id = edu_virtual_sessions.id
      AND oa.parent_user_id = (SELECT auth.uid())
      AND oa.active IS TRUE
      AND oa.can_view_live_class IS TRUE
  )
);

DROP POLICY IF EXISTS participant_read_own_or_observed_sessions ON public.edu_virtual_session_participants;
CREATE POLICY participant_read_own_or_observed_sessions
ON public.edu_virtual_session_participants
FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.edu_parent_observer_access oa
    WHERE oa.parent_user_id = (SELECT auth.uid())
      AND oa.learner_user_id = edu_virtual_session_participants.user_id
      AND oa.active IS TRUE
      AND oa.can_view_live_class IS TRUE
  )
);

DROP POLICY IF EXISTS participant_read_own_or_observed_attendance ON public.edu_virtual_session_attendance;
CREATE POLICY participant_read_own_or_observed_attendance
ON public.edu_virtual_session_attendance
FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.edu_parent_observer_access oa
    WHERE oa.parent_user_id = (SELECT auth.uid())
      AND oa.learner_user_id = edu_virtual_session_attendance.user_id
      AND oa.active IS TRUE
      AND oa.can_view_live_class IS TRUE
  )
);

-- Teachers may read only their own schedule assignments, published timetable
-- entries, associated active sections and the periods assigned to them.
DROP POLICY IF EXISTS teacher_read_own_schedule_assignments ON public.edu_teacher_schedule_assignments;
CREATE POLICY teacher_read_own_schedule_assignments
ON public.edu_teacher_schedule_assignments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.id = edu_teacher_schedule_assignments.teacher_id
      AND s.auth_user_id = (SELECT auth.uid())
      AND s.is_active IS TRUE
  )
);

DROP POLICY IF EXISTS teacher_read_own_published_timetable ON public.edu_school_schedule_entries;
CREATE POLICY teacher_read_own_published_timetable
ON public.edu_school_schedule_entries
FOR SELECT TO authenticated
USING (
  is_published IS TRUE
  AND teacher_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.id = edu_school_schedule_entries.teacher_id
      AND s.auth_user_id = (SELECT auth.uid())
      AND s.is_active IS TRUE
  )
);

DROP POLICY IF EXISTS teacher_read_assigned_schedule_periods ON public.edu_schedule_periods;
CREATE POLICY teacher_read_assigned_schedule_periods
ON public.edu_schedule_periods
FOR SELECT TO authenticated
USING (
  is_active IS TRUE
  AND EXISTS (
    SELECT 1 FROM public.edu_teacher_schedule_assignments a
    JOIN public.staff s ON s.id = a.teacher_id
    WHERE a.period_id = edu_schedule_periods.id
      AND s.auth_user_id = (SELECT auth.uid())
      AND s.is_active IS TRUE
  )
);

DROP POLICY IF EXISTS teacher_read_assigned_class_sections ON public.edu_class_sections;
CREATE POLICY teacher_read_assigned_class_sections
ON public.edu_class_sections
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.edu_teacher_schedule_assignments a
    JOIN public.staff s ON s.id = a.teacher_id
    WHERE a.section_id = edu_class_sections.id
      AND s.auth_user_id = (SELECT auth.uid())
      AND s.is_active IS TRUE
  )
  OR EXISTS (
    SELECT 1 FROM public.edu_school_schedule_entries e
    JOIN public.staff s ON s.id = e.teacher_id
    WHERE e.section_id = edu_class_sections.id
      AND e.is_published IS TRUE
      AND s.auth_user_id = (SELECT auth.uid())
      AND s.is_active IS TRUE
  )
);
