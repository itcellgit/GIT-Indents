# Git Maintenance System

A full-stack PERN application for managing maintenance requests, faculty indents, and college IT infrastructure.

## Project Structure

- `backend/`: Node.js/Express server with PostgreSql.
- `frontend/`: React/Vite application with responsive design.

## Setup Instructions

UPDATE public."User"
SET department = 'Electrical and Electronics Engineering'
WHERE department = 'Electrtical and Electronics Engineering';



ALTER TABLE "Indent"
ADD COLUMN IF NOT EXISTS "maintainerIds" TEXT[] NOT NULL DEFAULT '{}'::text[];

UPDATE "Indent"
SET "maintainerIds" = CASE
  WHEN "maintainerId" IS NULL THEN '{}'::text[]
  ELSE ARRAY["maintainerId"]
END
WHERE "maintainerIds" = '{}'::text[] AND "maintainerId" IS NOT NULL;








ALTER TABLE "MaterialUsed"
ADD COLUMN "approximately_amount" NUMERIC(12,2);