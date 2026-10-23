import * as Sentry from "@sentry/nextjs";
import { monitoringOptions } from "@/src/lib/monitoring/privacy";

Sentry.init({ ...monitoringOptions(), includeServerName: false });
