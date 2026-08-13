-- Atomic per-day counter for human-readable indent numbers (fixes race condition
-- in generateIndentNumber.js: two concurrent indent creations could previously
-- read the same COUNT(*) and generate the same indentNumber, causing the second
-- insert to fail on the unique constraint).

CREATE TABLE IF NOT EXISTS "indent_number_counters" (
    "counter_date" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "indent_number_counters_pkey" PRIMARY KEY ("counter_date")
);
