-- Books for a requisition often arrive in batches rather than all at once, so
-- the librarian needs to record how many copies have shown up so far instead
-- of a single all-or-nothing "Arrived" flip.
-- status flow: Pending -> "In Progress" | "Rejected" -> "Partially Arrived" (0..N times) -> "Books Arrived"

ALTER TABLE public.faculty_book_indent_forms
    ADD COLUMN IF NOT EXISTS received_quantity INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.faculty_book_indent_forms
    DROP CONSTRAINT IF EXISTS chk_fbif_received_quantity;
ALTER TABLE public.faculty_book_indent_forms
    ADD CONSTRAINT chk_fbif_received_quantity CHECK (received_quantity >= 0 AND received_quantity <= required_quantity);

ALTER TABLE public.faculty_book_indent_forms DROP CONSTRAINT IF EXISTS chk_fbif_status;
ALTER TABLE public.faculty_book_indent_forms
    ADD CONSTRAINT chk_fbif_status CHECK (status::text = ANY (ARRAY[
        'Pending'::character varying,
        'In Progress'::character varying,
        'Rejected'::character varying,
        'Partially Arrived'::character varying,
        'Books Arrived'::character varying
    ]::text[]));

-- Backfill: a row already marked fully arrived should read as fully received.
UPDATE public.faculty_book_indent_forms
    SET received_quantity = required_quantity
    WHERE status = 'Books Arrived' AND received_quantity < required_quantity;
