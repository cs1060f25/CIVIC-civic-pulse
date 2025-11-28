"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { FeedItem } from "@app/lib/types";
import { SplitViewer } from "@app/components/SplitViewer";
import { TranscriptViewer } from "@app/components/TranscriptViewer";
import Link from "next/link";
import { Button, Card, Badge } from "@app/components/ui";
import { useAppState } from "@app/lib/state";
import { formatTopicLabel } from "@app/lib/format";
import ReactMarkdown from "react-markdown";

// Mock documents for testing (same as Search/Brief pages)
const MOCK_DOCUMENTS: FeedItem[] = [
  {
    id: "mock-doc-1",
    sourceId: "johnson_county_planning",
    fileUrl: "https://example.com/mock-agenda.pdf",
    contentHash: "mock-hash-1",
    bytesSize: 524288,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    title: "[MOCK] Proposed Solar Energy Facility Regulations",
    entity: "Johnson County Planning Commission",
    jurisdiction: "Johnson County, KS",
    counties: ["Johnson"],
    meetingDate: new Date(Date.now() - 86400000 * 3).toISOString(),
    docTypes: ["Agenda", "Staff Memo"],
    impact: "High",
    stage: "Hearing",
    topics: ["solar zoning", "renewable energy", "land use"],
    hits: { "solar": 5, "zoning": 3 },
    extractedText: [
      "JOHNSON COUNTY PLANNING COMMISSION - AGENDA ITEM 4.2",
      "Proposed Amendments to Solar Energy Facility Regulations",
      "Staff recommends approval of the proposed setback requirements for utility-scale solar installations. The current draft requires a minimum 500-foot setback from residential properties and a 200-foot buffer from property lines.",
      "Public comments received to date express concerns about visual impact and property values. The Planning Commission is requested to review the proposed language and provide direction to staff.",
      "Key considerations include: (1) balancing renewable energy goals with community concerns, (2) ensuring adequate screening and buffering, (3) addressing decommissioning requirements.",
    ],
    pdfPreview: [
      "Page 1: Cover page - Johnson County Planning Commission Regular Meeting Agenda, October 15, 2024",
      "Page 2: Call to order, roll call, approval of minutes from previous meeting",
      "Page 3: Public comment period - Three speakers registered regarding solar facility regulations",
      "Page 4: Item 4.2 - Solar Energy Facility Regulations. Staff presentation by Director of Planning.",
      "Page 5: Proposed ordinance text with tracked changes showing setback distance modifications",
    ],
    attachments: [],
    updatedAt: new Date().toISOString(),
  },
  {
    id: "mock-doc-2",
    sourceId: "sedgwick_county_council",
    fileUrl: "https://example.com/mock-minutes.pdf",
    contentHash: "mock-hash-2",
    bytesSize: 245760,
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    title: "[MOCK] City Council Meeting Minutes - Budget Discussion",
    entity: "Sedgwick County City Council",
    jurisdiction: "Sedgwick County, KS",
    counties: ["Sedgwick"],
    meetingDate: new Date(Date.now() - 86400000 * 8).toISOString(),
    docTypes: ["Minutes"],
    impact: "Medium",
    stage: "Adopted",
    topics: ["budget", "infrastructure", "public works"],
    hits: { "budget": 12, "infrastructure": 4 },
    extractedText: [
      "SEDGWICK COUNTY CITY COUNCIL - MEETING MINUTES",
      "The meeting was called to order at 6:00 PM by Mayor Johnson.",
      "Council members present: Smith, Williams, Brown, Davis, Martinez",
      "Item 3: FY2025 Budget Discussion - Infrastructure Allocation",
      "Finance Director presented the proposed infrastructure budget of $45M, representing a 15% increase over FY2024. The allocation prioritizes road maintenance, water system upgrades, and public transit expansion.",
      "Council Member Smith moved to approve the infrastructure budget as presented. Council Member Williams seconded. Motion carried 5-0.",
    ],
    pdfPreview: [
      "Page 1: Official minutes header with city seal and meeting date",
      "Page 2: Attendance and call to order at 6:00 PM",
      "Page 3: Budget discussion begins - Finance Director presentation",
      "Page 4: Detailed breakdown of infrastructure spending by category",
      "Page 5: Council discussion and vote results - unanimous approval",
    ],
    attachments: [],
    updatedAt: new Date().toISOString(),
  },
];

export default function ItemDetailPage() {
  const params = useParams<{ id: string }>();
  const { state, addToBrief, removeFromBrief } = useAppState();
  const [item, setItem] = useState<FeedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [transcriptContent, setTranscriptContent] = useState<string[] | null>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{question: string; answer: string}>>([]);

  const userTopics = state.preferences?.topics || [];

  useEffect(() => {
    async function fetchDocument() {
      setLoading(true);
      setError(null);

      // First check mock documents
      const mockDoc = MOCK_DOCUMENTS.find((x) => x.id === params.id);
      if (mockDoc) {
        setItem(mockDoc);
        setLoading(false);
        return;
      }

      // Try to fetch from API
      try {
        const response = await fetch(`/api/documents/${params.id}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError("Document not found");
          } else {
            setError("Failed to load document");
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        setItem(data.document);
      } catch (err) {
        console.error("Error fetching document:", err);
        setError("Failed to load document");
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      fetchDocument();
    }
  }, [params.id]);

  if (loading) {
    return (
      <main className="w-full py-8">
        <div className="text-sm muted">Loading document...</div>
      </main>
    );
  }

  if (error || !item) {
    return (
      <main className="w-full py-8">
        <div className="text-sm">
          {error || "Document not found."}{" "}
          <Link className="text-[--color-brand-100] hover:underline" href="/search">
            Back to search
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full py-8">
      <div className="px-6 sm:px-8 lg:px-12">
      {/* Header with enhanced visual hierarchy */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="page-title mb-2">{item.title}</h1>
            <div className="subtitle flex items-center gap-2">
              <span className="text-[--color-brand-300] font-semibold">{item.entity}</span>
              <span className="text-[--color-muted]/50">•</span>
              <span>{item.jurisdiction}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Button variant="secondary">Follow</Button>
            {item && state.briefItemIds.includes(item.id) ? (
              <Button variant="primary" onClick={() => removeFromBrief(item.id)}>Remove from Brief</Button>
            ) : (
              item ? <Button variant="primary" onClick={() => addToBrief(item.id)}>Add to Brief</Button> : null
            )}
          </div>
        </div>
      </div>

      {/* Context and Signals Cards */}
      <div className="mb-8 grid md:grid-cols-2 gap-4">
        {/* Context Card */}
        <Card className="p-5">
          <div className="font-medium mb-3">Context</div>
          <div className="grid gap-2 text-sm">
            <div className="rounded-md border border-white/10 p-3 bg-white/5">
              <div className="text-xs uppercase tracking-wide text-[--color-muted]">
                Prior Actions — Sedgwick County
              </div>
              <div className="mt-1">
                Ordinance passed in 2022 related to utility-scale solar siting.
              </div>
            </div>
            <div className="rounded-md border border-white/10 p-3 bg-white/5">
              <div className="text-xs uppercase tracking-wide text-[--color-muted]">
                Related Jurisdictions — Douglas County
              </div>
              <div className="mt-1">Draft ordinance under review.</div>
            </div>
            <div className="rounded-md border border-white/10 p-3 bg-white/5">
              <div className="text-xs uppercase tracking-wide text-[--color-muted]">
                Related Jurisdictions — Wyandotte County
              </div>
              <div className="mt-1">Work session scheduled for next month.</div>
            </div>
            <div className="rounded-md border border-white/10 p-3 bg-white/5">
              <div className="text-xs uppercase tracking-wide text-[--color-muted]">
                Change Log
              </div>
              <div className="mt-1">
                Draft → Current: setback distance updated; added buffer definitions.
              </div>
            </div>
          </div>
        </Card>

        {/* Signals Card */}
        <Card className="p-5">
          <div className="font-medium mb-3">Signals</div>
          <div className="grid gap-2 text-sm">
            <div className="rounded-md border border-white/10 p-3 bg-white/5">
              <div className="text-xs uppercase tracking-wide text-[--color-muted]">
                Sentiment
              </div>
              <div className="mt-1">Public comments: neutral to mixed</div>
            </div>
            <div className="rounded-md border border-white/10 p-3 bg-white/5">
              <div className="text-xs uppercase tracking-wide text-[--color-muted]">
                Stage
              </div>
              <div className="mt-1">{item.stage || "Draft"}</div>
            </div>
            <div className="rounded-md border border-white/10 p-3 bg-white/5">
              <div className="text-xs uppercase tracking-wide text-[--color-muted]">
                Impact Level
              </div>
              <div className="mt-1">
                <ImpactBadge level={item.impact} />
              </div>
            </div>
            <div className="rounded-md border border-white/10 p-3 bg-white/5">
              <div className="text-xs uppercase tracking-wide text-[--color-muted]">
                Topics
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.topics.map((topic) => (
                  <span
                    key={topic}
                    className="inline-block px-2 py-1 rounded-full text-xs bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
                  >
                    {formatTopicLabel(topic)}
                  </span>
                ))}
                {item.topics.length === 0 && (
                  <span className="text-xs text-[--color-muted]">No topics tagged yet</span>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Document Viewer Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4 pb-3 accent-border-top pt-4">
          <div>
            <div className="section-title">Document Viewer</div>
            <div className="text-xs text-[--color-muted] mt-1">AI-powered analysis and transcript loading</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded-md bg-[--color-brand-500]/10 text-[--color-brand-200] border border-[--color-brand-500]/20">AI Summary</span>
            <span className="text-xs px-2 py-1 rounded-md bg-[--color-accent-cyan]/10 text-cyan-300 border border-[--color-accent-cyan]/20">Live Transcript</span>
          </div>
        </div>
        <SplitViewer
          left={
            <div className="p-6 text-sm space-y-4">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
                <div className="w-1.5 h-1.5 rounded-full bg-[--color-brand-400] animate-pulse"></div>
                <div className="text-xs uppercase tracking-wider font-bold text-[--color-brand-200]">AI-Generated Summary</div>
              </div>
              {aiSummary ? (
                <div className="prose prose-sm prose-invert max-w-none markdown-content">
                  <ReactMarkdown
                    components={{
                      h1: ({...props}) => <h1 className="text-lg font-bold mt-4 mb-2 text-[--color-brand-100]" {...props} />,
                      h2: ({...props}) => <h2 className="text-base font-semibold mt-3 mb-2 text-[--color-brand-200]" {...props} />,
                      h3: ({...props}) => <h3 className="text-sm font-semibold mt-2 mb-1 text-[--color-brand-300]" {...props} />,
                      p: ({...props}) => <p className="mb-3 leading-relaxed" {...props} />,
                      ul: ({...props}) => <ul className="list-disc list-inside mb-3 space-y-1" {...props} />,
                      ol: ({...props}) => <ol className="list-decimal list-inside mb-3 space-y-1" {...props} />,
                      li: ({...props}) => <li className="ml-2" {...props} />,
                      strong: ({...props}) => <strong className="font-semibold text-[--color-brand-100]" {...props} />,
                      em: ({...props}) => <em className="italic text-[--color-muted]" {...props} />,
                      code: ({...props}) => <code className="bg-white/10 px-1 py-0.5 rounded text-xs" {...props} />,
                    }}
                  >
                    {aiSummary}
                  </ReactMarkdown>
                </div>
              ) : null}

              {/* Follow-up Q&A Section */}
              {aiSummary && transcriptContent && (
                <div className="mt-6 pt-6 border-t-2 border-[--color-brand-500]/20">
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-4 h-4 text-[--color-brand-300]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-xs uppercase tracking-wider font-bold text-[--color-brand-200]">
                      Ask Follow-Up Questions
                    </div>
                  </div>

                  {/* Conversation History */}
                  {conversationHistory.length > 0 && (
                    <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                      {conversationHistory.map((item, idx) => (
                        <div key={idx} className="space-y-2">
                          <div className="rounded-lg bg-[--color-brand-500]/10 border border-[--color-brand-500]/30 p-3">
                            <div className="text-xs font-bold text-[--color-brand-200] mb-1 flex items-center gap-1.5">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              You asked:
                            </div>
                            <p className="text-sm text-[--color-foreground]">{item.question}</p>
                          </div>
                          <div className="rounded-lg bg-[--color-accent-emerald]/10 border border-[--color-accent-emerald]/30 p-3">
                            <div className="text-xs font-bold text-emerald-300 mb-1 flex items-center gap-1.5">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                              AI Response:
                            </div>
                            <div className="prose prose-sm prose-invert max-w-none">
                              <ReactMarkdown
                                components={{
                                  p: ({...props}) => <p className="mb-2 leading-relaxed text-sm" {...props} />,
                                  ul: ({...props}) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
                                  li: ({...props}) => <li className="ml-2 text-sm" {...props} />,
                                  strong: ({...props}) => <strong className="font-semibold text-emerald-200" {...props} />,
                                }}
                              >
                                {item.answer}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Input Form */}
                  <div className="rounded-xl border-2 border-[--color-brand-400]/30 bg-gradient-to-br from-[--color-surface-elevated] to-[--color-surface] p-4 shadow-lg">
                    <textarea
                      value={followUpQuestion}
                      onChange={(e) => setFollowUpQuestion(e.target.value)}
                      placeholder="Ask a question about this transcript..."
                      className="w-full px-4 py-3 bg-[--color-surface-2] border-2 border-[--color-brand-400]/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[--color-brand-400] focus:border-[--color-brand-400] transition-all resize-none"
                      rows={3}
                      disabled={isAskingQuestion}
                    />
                    <div className="flex items-center justify-between mt-3">
                      <div className="text-xs text-[--color-muted]">
                        {isAskingQuestion ? (
                          <span className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[--color-brand-400] animate-pulse"></div>
                            Processing your question...
                          </span>
                        ) : (
                          "Ask anything about the meeting content"
                        )}
                      </div>
                      <Button
                        onClick={async () => {
                          if (!followUpQuestion.trim() || isAskingQuestion) return;

                          setIsAskingQuestion(true);
                          try {
                            const response = await fetch("/api/ask-followup", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                question: followUpQuestion,
                                transcriptContent: transcriptContent,
                                conversationHistory: conversationHistory
                              })
                            });

                            if (!response.ok) throw new Error("Failed to get answer");

                            const data = await response.json();
                            setConversationHistory([...conversationHistory, {
                              question: followUpQuestion,
                              answer: data.answer
                            }]);
                            setFollowUpQuestion("");
                          } catch (err) {
                            console.error("Follow-up question error:", err);
                            setConversationHistory([...conversationHistory, {
                              question: followUpQuestion,
                              answer: "Sorry, I couldn't process your question. Please try again."
                            }]);
                          } finally {
                            setIsAskingQuestion(false);
                          }
                        }}
                        disabled={!followUpQuestion.trim() || isAskingQuestion}
                        variant="primary"
                        className="ml-auto"
                      >
                        {isAskingQuestion ? "Asking..." : "Ask"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {!aiSummary && (
                <div className="rounded-lg border-2 border-dashed border-[--color-brand-500]/20 bg-[--color-brand-500]/5 p-6 text-center">
                  <div className="text-[--color-muted] mb-3">
                    <svg className="w-12 h-12 mx-auto mb-3 text-[--color-brand-400]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm">Load a transcript to generate an AI summary with key takeaways, talking points, and relevance to your topics.</p>
                  </div>
                  {userTopics.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="text-xs uppercase tracking-wide text-[--color-brand-300] mb-2 font-semibold">Your Topics</div>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {userTopics.map((topic, idx) => (
                          <span key={idx} className="px-2 py-1 text-xs rounded-full bg-[--color-brand-500]/20 text-[--color-brand-100] border border-[--color-brand-500]/30">
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          }
          right={
            <div className="h-full overflow-auto p-6 bg-gradient-to-br from-[--color-surface] to-[--color-surface-2]">
              <TranscriptViewer 
                onSummaryGenerated={setAiSummary}
                onTranscriptLoaded={setTranscriptContent}
                userTopics={userTopics}
              />
            </div>
          }
        />
      </div>
    </div>
    </main>
  );
}

function ImpactBadge({ level }: { level: "Low" | "Medium" | "High" }) {
  if (level === "High") return <Badge color="danger">High</Badge>;
  if (level === "Medium") return <Badge color="warning">Medium</Badge>;
  return <Badge color="success">Low</Badge>;
}
