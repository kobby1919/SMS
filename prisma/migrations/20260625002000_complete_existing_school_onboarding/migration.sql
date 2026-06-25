-- Preserve existing schools after onboarding is introduced.
-- New schools created through onboarding still start as PENDING_SETUP.

UPDATE "School" s
SET
  "onboardingStatus" = 'COMPLETED',
  "setupStep" = NULL,
  "setupCompletedAt" = COALESCE("setupCompletedAt", CURRENT_TIMESTAMP)
WHERE
  "onboardingStatus" <> 'COMPLETED'
  AND EXISTS (SELECT 1 FROM "Grade" g WHERE g."schoolId" = s."id")
  AND EXISTS (SELECT 1 FROM "Class" c WHERE c."schoolId" = s."id")
  AND EXISTS (SELECT 1 FROM "Subject" sub WHERE sub."schoolId" = s."id");
