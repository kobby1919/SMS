-- Create the enum
CREATE TYPE "WaitlistRole" AS ENUM ('HEADMASTER', 'ADMINISTRATOR', 'TEACHER', 'OTHER');

-- Create the table
CREATE TABLE "WaitlistEntry" (
    "id"         TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "email"      TEXT NOT NULL,
    "role"       "WaitlistRole" NOT NULL,
    "message"    TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WaitlistEntry_email_key" ON "WaitlistEntry"("email");
CREATE INDEX "WaitlistEntry_createdAt_idx" ON "WaitlistEntry"("createdAt");