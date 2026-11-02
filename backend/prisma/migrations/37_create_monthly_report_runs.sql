-- One row per monthly indent-statistics email (period = the month reported on,
-- 'YYYY-MM'). The scheduler claims a period with an atomic upsert before
-- sending, so restarts, multiple server processes, or a re-run on a later day
-- of the month never send the same month's report twice.
-- status flow: 'sending' -> 'sent' (a failed send deletes the row so the next
-- hourly check retries; a 'sending' row older than 30 min is treated as a
-- crashed attempt and may be re-claimed).

CREATE TABLE IF NOT EXISTS public.monthly_report_runs
(
    period VARCHAR(7) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'sending',
    recipients INTEGER NOT NULL DEFAULT 0,
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,

    CONSTRAINT monthly_report_runs_pkey PRIMARY KEY (period),
    CONSTRAINT chk_mrr_status CHECK (status IN ('sending', 'sent'))
);
