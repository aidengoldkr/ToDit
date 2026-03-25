ALTER TABLE public.saved_todo
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS document_type TEXT,
  ADD COLUMN IF NOT EXISTS plan_version INTEGER NOT NULL DEFAULT 1;

UPDATE public.saved_todo
SET
  document_type = COALESCE(document_type, plan->>'category'),
  category = category,
  plan_version = CASE
    WHEN plan ? 'root' THEN 2
    ELSE 1
  END
WHERE category IS NULL
   OR document_type IS NULL
   OR plan_version IS NULL
   OR plan_version = 1;
