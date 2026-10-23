import type { ErrorEvent, StackFrame } from "@sentry/nextjs";

export const MONITORING_TEST_MESSAGE = "Edujay monitoring verification";

const errorTypes = new Set(["Error", "TypeError", "RangeError", "ReferenceError", "SyntaxError", "URIError", "EvalError", "AggregateError"]);
const components = new Set(["monitoring-test", "finance-cron", "page-boundary", "dashboard-boundary", "global-boundary"]);

function safeFrame(frame: StackFrame): StackFrame {
  // Basenames and line numbers locate code without sending URLs, paths or locals.
  const basename = frame.filename?.split(/[?#]/, 1)[0]?.split(/[/\\]/).at(-1);
  return {
    filename: basename && /^(?:[a-f0-9_-]{8,80}|page|layout|route|error|global-error|instrumentation(?:-client)?|privacy|index|client|server)\.(?:[cm]?js|tsx?)$/i.test(basename) ? basename : "[source withheld]",
    lineno: Number.isSafeInteger(frame.lineno) ? frame.lineno : undefined,
    colno: Number.isSafeInteger(frame.colno) ? frame.colno : undefined,
    in_app: frame.in_app === true,
  };
}

export function sanitizeMonitoringEvent(event: ErrorEvent): ErrorEvent {
  // Rebuild from an allowlist: unknown SDK fields must not bypass privacy rules.
  const clean: ErrorEvent = {
    type: undefined,
    event_id: event.event_id && /^[a-f0-9]{32}$/i.test(event.event_id) ? event.event_id : undefined,
    timestamp: Number.isFinite(event.timestamp) ? event.timestamp : undefined,
    platform: "javascript",
    level: event.level === "fatal" ? "fatal" : "error",
    environment: ["staging", "production", "preview", "development"].includes(event.environment ?? "") ? event.environment : "unconfigured",
    release: event.release && /^(?:edujay@)?[a-f0-9]{40}$/.test(event.release) ? event.release : undefined,
    tags: { privacy: "strict" },
  };
  const component = event.tags?.component;
  if (typeof component === "string" && components.has(component)) clean.tags!.component = component;
  if (event.exception?.values?.length) {
    clean.exception = { values: event.exception.values.slice(0, 5).map((exception) => {
      const type = errorTypes.has(exception.type ?? "") ? exception.type! : "Error";
      return {
        type,
        value: `Edujay ${type}: message withheld for privacy`,
        stacktrace: exception.stacktrace ? { frames: exception.stacktrace.frames?.slice(-40).map(safeFrame) } : undefined,
      };
    }) };
  } else {
    clean.message = event.message === MONITORING_TEST_MESSAGE ? MONITORING_TEST_MESSAGE : "Edujay application error: message withheld for privacy";
  }
  return clean;
}

export function monitoringOptions() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  const environment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT;
  const configured = Boolean(dsn && ["staging", "production", "preview", "development"].includes(environment ?? ""));
  return {
    dsn,
    enabled: configured,
    environment: environment ?? "unconfigured",
    debug: false,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      frameContextLines: 0,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
    },
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    maxBreadcrumbs: 0,
    integrations: <T extends { name: string }>(defaults: T[]) => defaults.filter((integration) => ![
      "BrowserSession", "ProcessSession", "Console", "ConsoleLogs", "ConsoleLogging",
      "ContextLines", "LocalVariables", "RequestData",
    ].includes(integration.name)),
    beforeBreadcrumb: () => null,
    beforeSendLog: () => null,
    beforeSendMetric: () => null,
    beforeSend: sanitizeMonitoringEvent,
  };
}
