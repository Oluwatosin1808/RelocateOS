import { NextResponse } from "next/server";
import { newCorrelationId } from "@/lib/logging/logger";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    correlationId: string;
  };
};

export function jsonError(
  status: number,
  code: string,
  message: string,
  correlationId = newCorrelationId(),
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: { code, message, correlationId } }, { status });
}

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, init);
}
