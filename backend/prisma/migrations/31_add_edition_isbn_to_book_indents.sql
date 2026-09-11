-- Adds mandatory Book Edition and ISBN fields to faculty book indent requests.
-- Added nullable first so existing rows don't fail the NOT NULL check, backfilled
-- with a placeholder, then locked to NOT NULL to make the fields mandatory going
-- forward (matching the existing app-layer validation on the new request form).

ALTER TABLE public.faculty_book_indent_forms
    ADD COLUMN IF NOT EXISTS book_edition VARCHAR(50),
    ADD COLUMN IF NOT EXISTS isbn VARCHAR(20);

UPDATE public.faculty_book_indent_forms SET book_edition = 'Not specified' WHERE book_edition IS NULL;
UPDATE public.faculty_book_indent_forms SET isbn = 'Not specified' WHERE isbn IS NULL;

ALTER TABLE public.faculty_book_indent_forms
    ALTER COLUMN book_edition SET NOT NULL,
    ALTER COLUMN isbn SET NOT NULL;
