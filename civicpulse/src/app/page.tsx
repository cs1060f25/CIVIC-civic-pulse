import { Card } from "@app/components/ui";

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
          The municipal intelligence layer
        </h1>
        <p className="text-xl sm:text-2xl text-[--color-muted] max-w-3xl mx-auto mb-8">
          Surface local policy trends before they make headlines
        </p>
        <p className="text-lg text-[--color-muted] max-w-2xl mx-auto mb-12">
          CivicPulse turns scattered agendas and minutes into clear, searchable signals across jurisdictions—so you can move fast, brief stakeholders, and never miss what matters.
        </p>
        <p className="text-[--color-muted] text-base">
          Sign in with your Google account (top right) to unlock search and brief-building tools.
        </p>
      </section>

      {/* Value Proposition */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 border-t border-white/10">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold tracking-tight mb-4">
            Stop digging through PDFs. Start seeing patterns.
          </h2>
          <p className="text-lg text-[--color-muted] max-w-2xl mx-auto">
            Find local trends before they break nationally. Track policy shifts across jurisdictions in real time.
          </p>
        </div>

        {/* Feature Callouts */}
        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <Card className="p-6">
            <div className="w-12 h-12 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3">Search & Compare</h3>
            <p className="text-[--color-muted] mb-4">
              Search by keyword, geography, and time. Triage results in seconds with advanced filters and relevance scoring.
            </p>
            <span className="text-[--color-muted] text-sm font-medium">
              Available after sign-in
            </span>
          </Card>

          <Card className="p-6">
            <div className="w-12 h-12 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3">Brief Builder</h3>
            <p className="text-[--color-muted] mb-4">
              Assemble concise briefs with citations and export in one click. Share insights with stakeholders instantly.
            </p>
            <span className="text-[--color-muted] text-sm font-medium">
              Available after sign-in
            </span>
          </Card>

          <Card className="p-6">
            <div className="w-12 h-12 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3">Trends Dashboard</h3>
            <p className="text-[--color-muted] mb-4">
              Heatmaps and timelines reveal where topics emerge and evolve across jurisdictions.
            </p>
            <span className="text-[--color-muted] text-sm font-medium">
              Coming soon
            </span>
          </Card>
        </div>
      </section>

      {/* Use Cases */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 border-t border-white/10">
        <h2 className="text-3xl font-semibold tracking-tight mb-12 text-center">
          Built for professionals who need to stay ahead
        </h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="p-6 rounded-lg border border-white/10 bg-surface/40">
            <h3 className="text-lg font-semibold mb-2">Journalists & Reporters</h3>
            <p className="text-[--color-muted]">
              Identify emerging storylines at the local level. Track policy debates across jurisdictions before they hit the national stage.
            </p>
          </div>
          <div className="p-6 rounded-lg border border-white/10 bg-surface/40">
            <h3 className="text-lg font-semibold mb-2">Policy Analysts & Researchers</h3>
            <p className="text-[--color-muted]">
              Spot trends and patterns across municipalities. Brief legislators with data-driven insights on emerging issues.
            </p>
          </div>
          <div className="p-6 rounded-lg border border-white/10 bg-surface/40">
            <h3 className="text-lg font-semibold mb-2">Advocacy Groups & Organizers</h3>
            <p className="text-[--color-muted]">
              Detect policy shifts early. Coordinate responses and engage with local stakeholders before decisions are finalized.
            </p>
          </div>
          <div className="p-6 rounded-lg border border-white/10 bg-surface/40">
            <h3 className="text-lg font-semibold mb-2">Developers & Strategists</h3>
            <p className="text-[--color-muted]">
              Track zoning changes, incentives, and regulatory shifts. Make informed decisions about where to invest and develop.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">
          Ready to explore CivicPulse?
        </h2>
        <p className="text-lg text-[--color-muted] mb-2 max-w-2xl mx-auto">
          Click “Sign in” at the top right to authenticate with Google, save your workspace, and resume where you left off.
        </p>
        <p className="text-[--color-muted]">
          We’ll remember the briefs you build and any custom tags you apply so your research stays in sync across sessions.
        </p>
      </section>
    </main>
  );
}
