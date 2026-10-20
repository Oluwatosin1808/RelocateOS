/**
 * Structured JSON logger with secret/PII redaction.
 * One JSON line per event so Cloud Logging and local dev both work.
 */

const SECRET_KEY_PATTERN =
  /(token|secret|password|key|authorization|cookie|private|credential|api[-_]?key)/i;

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export type LogFields = Record<string, unknown>;

const REDACTED = "[redacted]";

export function redactValue(value: unknown, keyHint?: string): unknown {
  if (keyHint && SECRET_KEY_PATTERN.test(keyHint)) {
    return REDACTED;
  }
  if (typeof value === "string") {
    if (EMAIL_PATTERN.test(value)) {
      return value.replace(EMAIL_PATTERN, REDACTED);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redactValue(v));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactValue(v, k);
    }
    return out;
  }
  return value;
}

export function redactFields(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = redactValue(v, k);
  }
  return out;
}

export type Logger = {
  info: (msg: string, fields?: LogFields) => void;
  warn: (msg: string, fields?: LogFields) => void;
  error: (msg: string, fields?: LogFields) => void;
  child: (bindings: LogFields) => Logger;
};

function emit(
  level: "info" | "warn" | "error",
  bindings: LogFields,
  msg: string,
  fields?: LogFields,
): void {
  const line = JSON.stringify({
    level,
    msg,
    time: new Date().toISOString(),
    ...redactFields(bindings),
    ...(fields ? redactFields(fields) : {}),
  });
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function createLogger(bindings: LogFields = {}): Logger {
  return {
    info: (msg, fields) => emit("info", bindings, msg, fields),
    warn: (msg, fields) => emit("warn", bindings, msg, fields),
    error: (msg, fields) => emit("error", bindings, msg, fields),
    child: (extra) => createLogger({ ...bindings, ...extra }),
  };
}

export function newCorrelationId(): string {
  return crypto.randomUUID();
}
