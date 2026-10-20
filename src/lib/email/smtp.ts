import nodemailer from "nodemailer";
import type { ServerEnv } from "@/lib/configuration/env";

/**
 * Sends a plain-text email over SMTP (e.g. Gmail app password, Brevo, any
 * provider that speaks SMTP). Returns the provider message id.
 */
export async function sendSmtpEmail(
  env: ServerEnv,
  opts: { to: string; from: string; subject: string; text: string },
): Promise<{ messageId: string }> {
  const cfg = env.email.smtp;
  if (!cfg?.host || !cfg.user || !cfg.pass) {
    throw new Error("SMTP is not fully configured (host/user/pass missing).");
  }
  const port = cfg.port ?? 465;
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port,
    secure: port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  const info = await transport.sendMail({
    from: opts.from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
  });
  return { messageId: info.messageId ?? "" };
}
