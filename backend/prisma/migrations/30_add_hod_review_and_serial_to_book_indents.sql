-- Adds the HOD approval workflow and a monthly-unique serial number to
-- faculty book indent requests.
-- status now flows: Pending -> "In Progress" | "Rejected" -> (procured) -> "Books Arrived"
-- (the old Approved/Ordered/Received values were never reachable from any UI/route,
-- so any row still holding them is remapped to its nearest new-flow equivalent below).

ALTER TABLE public.faculty_book_indent_forms
    ADD COLUMN IF NOT EXISTS serial_no VARCHAR(30),
    ADD COLUMN IF NOT EXISTS hod_remark VARCHAR(500),
    ADD COLUMN IF NOT EXISTS hod_reviewed_by TEXT,
    ADD COLUMN IF NOT EXISTS hod_reviewed_at TIMESTAMP;

ALTER TABLE public.faculty_book_indent_forms DROP CONSTRAINT IF EXISTS chk_fbif_status;

UPDATE public.faculty_book_indent_forms SET status = 'Books Arrived' WHERE status = 'Received';
UPDATE public.faculty_book_indent_forms SET status = 'In Progress' WHERE status IN ('Approved', 'Ordered');

ALTER TABLE public.faculty_book_indent_forms
    ADD CONSTRAINT chk_fbif_status CHECK (status::text = ANY (ARRAY[
        'Pending'::character varying,
        'In Progress'::character varying,
        'Rejected'::character varying,
        'Books Arrived'::character varying
    ]::text[]));

-- Atomic per-month counter backing the human-readable serial number
-- (MM/YYYY-### form), following the same upsert-and-increment pattern as
-- indent_number_counters (see generateIndentNumber.js) to avoid duplicate
-- numbers under concurrent creation.
CREATE TABLE IF NOT EXISTS public.book_indent_serial_counters (
    counter_month CHAR(7) NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT book_indent_serial_counters_pkey PRIMARY KEY (counter_month)
);
