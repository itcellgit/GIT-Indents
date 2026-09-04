-- Adds the HOD approval step to department stationary indents.
-- status now flows: Pending -> "HOD Approved" | "HOD Rejected" -> (grant) -> Received
ALTER TABLE public.dept_stationary_indents
    ADD COLUMN IF NOT EXISTS hod_remark VARCHAR(500),
    ADD COLUMN IF NOT EXISTS hod_reviewed_by TEXT,
    ADD COLUMN IF NOT EXISTS hod_reviewed_at TIMESTAMP;

-- Backfill: any indent that was already granted under the old (no-approval) flow
-- is treated as HOD-approved so the Office and coordinator screens keep working.
UPDATE public.dept_stationary_indents d
SET status = 'HOD Approved',
    hod_reviewed_at = COALESCE(d.updated_at, NOW())
WHERE COALESCE(d.status, 'Pending') = 'Pending'
  AND EXISTS (
    SELECT 1 FROM public.stationary_indent_and_grants g
    WHERE g.dept_stationary_indent_id = d.id AND g.grant_quantity > 0
  );
