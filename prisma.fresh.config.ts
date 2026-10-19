import { defineConfig } from "prisma/config";

// Explicitly selected for new installations; never loads the local development URL.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/fresh-migrations" },
  datasource: { url: process.env.EDUJAY_MIGRATION_DATABASE_URL ?? "" },
});
