"use client";

import { z } from "zod";
import type { FieldValues, Path, Resolver, UseFormReturn } from "react-hook-form";

/**
 * Minimal Zod ↔ react-hook-form adapter (no @hookform/resolvers).
 * Works with Zod v4 object schemas and RHF 7's typed Resolver.
 */
export function zodResolver<T extends FieldValues>(schema: z.ZodType<T>): Resolver<T> {
  const resolve = async (values: FieldValues) => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data as T, errors: {} as Record<string, never> };
    }
    const errors: Partial<Record<Path<T>, { type: string; message: string }>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") as Path<T>;
      if (!errors[key]) {
        errors[key] = { type: "validation", message: issue.message };
      }
    }
    return { values: {} as T, errors };
  };
  return resolve as unknown as Resolver<T>;
}

/** Helper for controlled checkbox arrays in RHF (role families, countries…). */
export function toggleInArray(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export type FormApi<T extends FieldValues> = UseFormReturn<T>;
