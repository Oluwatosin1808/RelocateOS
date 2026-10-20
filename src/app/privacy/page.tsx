import Link from "next/link";

export const metadata = { title: "Privacy notice" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="eyebrow">RelocateOS</p>
      <h1 className="mt-1">Privacy notice</h1>
      <div className="mt-6 space-y-4 text-[0.875rem] leading-6 text-ink-muted">
        <p>
          RelocateOS is a personal tool. It stores the career information you choose to enter
          (contact details, work history, skills, documents and application records) in your
          private Firebase project. Data is isolated per account; nobody else can read it.
        </p>
        <p>
          <strong className="text-ink">AI processing.</strong> When an AI provider is
          configured, selected job descriptions and your profile facts are sent to that
          provider to produce match explanations and draft documents. When no provider is
          configured, analysis falls back to deterministic rule-based processing and no
          profile data leaves this application.
        </p>
        <p>
          <strong className="text-ink">Email.</strong> When an email provider is configured,
          digests and alerts are delivered through it. CVs are never attached to emails by
          default.
        </p>
        <p>
          <strong className="text-ink">Your controls.</strong> You can export all of your data
          or delete your account and records from Settings at any time. Automated application
          submission is off until you enable and authorise it; discovery never counts as an
          application.
        </p>
        <p>
          This notice is operational information about the software, not legal advice about
          GDPR, NDPR or other regimes. Verify your obligations independently.
        </p>
        <p>
          <Link href="/login" className="font-medium text-accent hover:underline">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
