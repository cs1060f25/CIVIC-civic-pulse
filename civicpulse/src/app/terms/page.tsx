import Link from "next/link";
import { Button } from "@/components/ui";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[--color-background]">
      {/* Header */}
      <div className="bg-[--color-surface] border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[--color-brand-600] rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <span className="text-[--color-foreground] font-semibold">CivicPulse</span>
          </Link>
          <Link href="/register">
            <Button variant="secondary">Back to Sign Up</Button>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="card p-8">
          <h1 className="text-3xl font-bold text-[--color-foreground] mb-6">Terms of Service</h1>
          
          <div className="prose prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-[--color-foreground] mb-4">1. Acceptance of Terms</h2>
              <p className="text-[--color-muted] leading-relaxed">
                By accessing and using CivicPulse, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-[--color-foreground] mb-4">2. Description of Service</h2>
              <p className="text-[--color-muted] leading-relaxed mb-4">
                CivicPulse is a platform that aggregates and provides access to Kansas municipal government documents, including agendas, minutes, ordinances, and other public records. Our service includes:
              </p>
              <ul className="list-disc list-inside text-[--color-muted] space-y-2">
                <li>Document search and filtering capabilities</li>
                <li>AI-powered summaries and analysis</li>
                <li>Custom alerts and notifications</li>
                <li>Personalized document collections</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-[--color-foreground] mb-4">3. User Accounts</h2>
              <p className="text-[--color-muted] leading-relaxed mb-4">
                To access certain features of CivicPulse, you must register for an account. You agree to:
              </p>
              <ul className="list-disc list-inside text-[--color-muted] space-y-2">
                <li>Provide accurate, current, and complete information during registration</li>
                <li>Maintain and update your account information</li>
                <li>Keep your password secure and confidential</li>
                <li>Accept responsibility for all activities under your account</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-[--color-foreground] mb-4">4. Acceptable Use</h2>
              <p className="text-[--color-muted] leading-relaxed mb-4">
                You agree to use CivicPulse only for lawful purposes and in accordance with these Terms. You agree not to:
              </p>
              <ul className="list-disc list-inside text-[--color-muted] space-y-2">
                <li>Use the service for any illegal or unauthorized purpose</li>
                <li>Violate any international, federal, provincial, or local laws</li>
                <li>Infringe upon or violate our intellectual property rights</li>
                <li>Harass, abuse, or harm other users</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Use automated tools to access the service excessively</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-[--color-foreground] mb-4">5. Privacy and Data Protection</h2>
              <p className="text-[--color-muted] leading-relaxed">
                Your privacy is important to us. Please review our Privacy Policy, which also governs your use of the Service, to understand our practices.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-[--color-foreground] mb-4">6. Intellectual Property</h2>
              <p className="text-[--color-muted] leading-relaxed mb-4">
                The service and its original content, features, and functionality are and will remain the exclusive property of CivicPulse and its licensors. The service is protected by copyright, trademark, and other laws.
              </p>
              <p className="text-[--color-muted] leading-relaxed">
                Government documents available through our service are public records and remain the property of the respective government entities.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-[--color-foreground] mb-4">7. Disclaimers</h2>
              <p className="text-[--color-muted] leading-relaxed mb-4">
                CivicPulse provides access to government documents "as is" without warranties of any kind, either express or implied. We do not guarantee:
              </p>
              <ul className="list-disc list-inside text-[--color-muted] space-y-2">
                <li>The accuracy, completeness, or timeliness of documents</li>
                <li>The availability or functionality of the service</li>
                <li>The security of data transmission</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-[--color-foreground] mb-4">8. Limitation of Liability</h2>
              <p className="text-[--color-muted] leading-relaxed">
                In no event shall CivicPulse, its directors, employees, partners, agents, suppliers, or affiliates be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-[--color-foreground] mb-4">9. Termination</h2>
              <p className="text-[--color-muted] leading-relaxed">
                We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-[--color-foreground] mb-4">10. Changes to Terms</h2>
              <p className="text-[--color-muted] leading-relaxed">
                We reserve the right to modify or replace these Terms at any time. If a revision is material, we will try to provide at least 30 days notice prior to any new terms taking effect.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-[--color-foreground] mb-4">11. Contact Information</h2>
              <p className="text-[--color-muted] leading-relaxed">
                If you have any questions about these Terms, please contact us at: legal@civicpulse.org
              </p>
            </section>

            <div className="mt-12 p-4 bg-[--color-surface-2] rounded-lg border border-white/10">
              <p className="text-sm text-[--color-muted]">
                <strong>Last Updated:</strong> November 16, 2025<br/>
                <strong>Effective Date:</strong> November 16, 2025
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
