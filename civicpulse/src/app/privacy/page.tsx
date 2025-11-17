import Link from "next/link";
import { Button } from "@/components/ui";

export default function PrivacyPage() {
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
          <h1 className="text-3xl font-bold text-[--color-foreground] mb-6">Privacy Policy</h1>
          
          <div className="prose prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-[--color-foreground] mb-4">1. Introduction</h2>
              <p className="text-[--color-muted] leading-relaxed">
                CivicPulse ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform for accessing Kansas municipal government documents.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-[--color-foreground] mb-4">2. Information We Collect</h2>
              
              <h3 className="text-lg font-medium text-[--color-foreground] mb-3">Information You Provide</h3>
              <ul className="list-disc list-inside text-[--color-muted] space-y-2 mb-4">
                <li><strong>Account Information:</strong> Name, email address, organization, and role when you register</li>
                <li><strong>Preferences:</strong> Jurisdictions, topics, and alert settings you configure</li>
                <li><strong>Saved Content:</strong> Documents you save, brief items, and follow preferences</li>
                <li><strong>Communications:</strong> Messages you send to us through contact forms</li>
              </ul>

              <h3 className="text-lg font-medium text-[--color-foreground] mb-3">Automatically Collected Information</h3>
              <ul className="list-disc list-inside text-[--color-muted] space-y-2">
                <li><strong>Usage Data:</strong> Pages visited, search queries, and features used</li>
                <li><strong>Device Information:</strong> Browser type, operating system, and IP address</li>
                <li><strong>Log Data:</strong> Access times, referring pages, and click patterns</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-[--color-foreground] mb-4">3. How We Use Your Information</h2>
              <p className="text-[--color-muted] leading-relaxed mb-4">We use your information to:</p>
              <ul className="list-disc list-inside text-[--color-muted] space-y-2">
                <li>Provide, maintain, and improve our services</li>
                <li>Process your searches and deliver relevant documents</li>
                <li>Send you notifications and alerts you've requested</li>
                <li>Personalize your experience with saved preferences</li>
                <li>Analyze usage patterns to optimize performance</li>
                <li>Respond to your questions and support requests</li>
                <li>Comply with legal obligations and protect our rights</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-[--color-foreground] mb-4">4. Information Sharing</h2>
              
              <h3 className="text-lg font-medium text-[--color-foreground] mb-3">We Do Not Sell Your Personal Information</h3>
              <p className="text-[--color-muted] leading-relaxed mb-4">
                We never sell, rent, or trade your personal information to third parties for marketing purposes.
              </p>

              <h3 className="text-lg font-medium text-[--color-foreground] mb-3">Limited Sharing</h3>
              <p className="text-[--color-muted] leading-relaxed mb-4">We may share your information only in the following circumstances:</p>
              <ul className="list-disc list-inside text-[--color-muted] space-y-2">
                <li><strong>Service Providers:</strong> With trusted third parties who assist in operating our service</li>
                <li><strong>Legal Requirements:</strong> When required by law, court order, or government request</li>
                <li><strong>Safety and Security:</strong> To protect our users, prevent fraud, or ensure security</li>
                <li><strong>Business Transfers:</strong> In connection with mergers, acquisitions, or asset sales</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-[--color-foreground] mb-4">5. Data Security</h2>
              <p className="text-[--color-muted] leading-relaxed mb-4">
                We implement appropriate technical and organizational measures to protect your information, including:
              </p>
              <ul className="list-disc list-inside text-[--color-muted] space-y-2">
                <li>SSL/TLS encryption for data transmission</li>
                <li>Secure password storage using industry-standard hashing</li>
                <li>Regular security audits and vulnerability assessments</li>
                <li>Access controls and authentication systems</li>
              </ul>
              <p className="text-[--color-muted] leading-relaxed">
                However, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-[--color-foreground] mb-4">6. Data Retention</h2>
              <p className="text-[--color-muted] leading-relaxed mb-4">
                We retain your information only as long as necessary to fulfill the purposes outlined in this policy, unless a longer retention period is required or permitted by law.
              </p>
              <p className="text-[--color-muted] leading-relaxed">
                You may request deletion of your account and associated data at any time through your account settings or by contacting us.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-[--color-foreground] mb-4">7. Your Rights</h2>
              <p className="text-[--color-muted] leading-relaxed mb-4">Depending on your location, you may have the right to:</p>
              <ul className="list-disc list-inside text-[--color-muted] space-y-2">
                <li>Access and review your personal information</li>
                <li>Correct inaccurate or incomplete information</li>
                <li>Request deletion of your personal information</li>
                <li>Opt out of certain data processing activities</li>
                <li>Request a copy of your data in a portable format</li>
                <li>Object to processing of your information</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-[--color-foreground] mb-4">8. Cookies and Tracking</h2>
              <p className="text-[--color-muted] leading-relaxed mb-4">
                We use cookies and similar technologies to enhance your experience, analyze usage, and maintain security. You can control cookie settings through your browser preferences.
              </p>
              <p className="text-[--color-muted] leading-relaxed">
                Essential cookies are required for basic functionality. Optional cookies enhance features and analytics.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-[--color-foreground] mb-4">9. Third-Party Links</h2>
              <p className="text-[--color-muted] leading-relaxed">
                Our service may contain links to third-party websites, including government agency sites. We are not responsible for the privacy practices of these external sites. We encourage you to review their privacy policies.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-[--color-foreground] mb-4">10. Children's Privacy</h2>
              <p className="text-[--color-muted] leading-relaxed">
                Our service is not intended for children under 13. We do not knowingly collect personal information from children under 13. If we become aware of such collection, we will take steps to delete it promptly.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-[--color-foreground] mb-4">11. Changes to This Policy</h2>
              <p className="text-[--color-muted] leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last Updated" date. Material changes will be highlighted or communicated via email.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-[--color-foreground] mb-4">12. Contact Us</h2>
              <p className="text-[--color-muted] leading-relaxed mb-4">
                If you have any questions about this Privacy Policy or want to exercise your rights, please contact us:
              </p>
              <div className="bg-[--color-surface-2] p-4 rounded-lg border border-white/10">
                <p className="text-[--color-muted]">
                  <strong>Email:</strong> privacy@civicpulse.org<br/>
                  <strong>Mail:</strong> CivicPulse Privacy Team<br/>
                  <strong>Response Time:</strong> We will respond to your inquiry within 30 days
                </p>
              </div>
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
