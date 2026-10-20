"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { Button, Spinner } from "@/components/ui/button";
import { Input, FormField } from "@/components/ui/form-controls";
import { Card, CardBody } from "@/components/ui/card";
import { signInWithEmail, signUpWithEmail } from "@/lib/auth/client";
import { useToast } from "@/components/ui/toast";

const schema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

type Mode = "signin" | "signup";

export function AuthForm({ mode: initialMode }: { mode: Mode }) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = React.useState<Mode>(initialMode);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      if (mode === "signin") {
        await signInWithEmail(parsed.data.email, parsed.data.password);
      } else {
        await signUpWithEmail(parsed.data.email, parsed.data.password);
      }
      toast.push(mode === "signin" ? "Signed in." : "Account created.", "success");
      router.replace("/");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error && /auth\/|Firebase/i.test(err.message)
          ? friendlyAuthError(err.message)
          : err instanceof Error
            ? err.message
            : "Sign-in failed. Please try again.";
      setFormError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardBody className="space-y-5">
        <div className="space-y-1">
          <p className="eyebrow">RelocateOS</p>
          <h1 className="text-[1.25rem]">
            {mode === "signin" ? "Sign in" : "Create your account"}
          </h1>
          <p className="text-[0.8125rem] text-ink-muted">
            Your private job-hunting operations workspace.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField label="Email" htmlFor="email" required error={errors.email}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(errors.email)}
              required
            />
          </FormField>
          <FormField label="Password" htmlFor="password" required error={errors.password}>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(errors.password)}
              required
            />
          </FormField>

          {formError && (
            <p role="alert" className="rounded-control bg-danger-subtle px-3 py-2 text-[0.8125rem] text-danger">
              {formError}
            </p>
          )}

          <Button type="submit" className="w-full" loading={loading}>
            {loading ? <Spinner className="size-3.5" /> : null}
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="text-center text-[0.8125rem] text-ink-muted">
          {mode === "signin" ? "Need an account?" : "Already have an account?"}{" "}
          <button
            type="button"
            className="font-medium text-accent hover:underline"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setErrors({});
              setFormError(null);
            }}
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
        <p className="text-center text-[0.75rem] text-ink-subtle">
          <Link href="/privacy" className="hover:underline">
            Privacy notice
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}

function friendlyAuthError(code: string): string {
  if (/auth\/invalid-credential|auth\/wrong-password|auth\/user-not-found/.test(code)) {
    return "Email or password is incorrect.";
  }
  if (/auth\/email-already-in-use/.test(code)) return "An account with this email already exists.";
  if (/auth\/weak-password/.test(code)) return "Password is too weak. Use at least 6 characters.";
  if (/auth\/too-many-requests/.test(code)) return "Too many attempts. Please wait and try again.";
  if (/auth\/network-request-failed/.test(code)) {
    return "Network error. Is the Firebase emulator running (npm run dev)?";
  }
  return "Sign-in failed. Please check your details and try again.";
}
