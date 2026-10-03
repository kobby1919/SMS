-- Add a strict school code used for Edujay-generated admission numbers.
-- Existing schools can remain null until their admin completes/repairs onboarding.
ALTER TABLE "School" ADD COLUMN "code" TEXT;

CREATE UNIQUE INDEX "School_code_key" ON "School"("code");
