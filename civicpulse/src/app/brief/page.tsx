"use client";

import { useEffect, useState } from "react";
import { useAppState } from "@/lib/state";
import type { FeedItem } from "@/lib/types";
import { Button, Card } from "@/components/ui";
import Link from "next/link";

// Mock documents for testing (same as in search page)
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
    extractedText: [],
    pdfPreview: [],
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
    extractedText: [],
    pdfPreview: [],
    attachments: [],
    updatedAt: new Date().toISOString(),
  },
];

export default function BriefPage() {
  const { state, removeFromBrief } = useAppState();
  const [documents, setDocuments] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch documents that are in the brief
  useEffect(() => {
    async function fetchBriefDocuments() {
      if (state.briefItemIds.length === 0) {
        setDocuments([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // First, check if any briefItemIds are mock documents
        const mockBriefDocs = MOCK_DOCUMENTS.filter(doc => 
          state.briefItemIds.includes(doc.id)
        );

        // Try to fetch real documents from API
        const response = await fetch(`/api/documents?limit=100`);
        
        if (!response.ok) {
          // If API fails, use only mock documents
          console.warn("API failed, using only mock documents in brief");
          setDocuments(mockBriefDocs);
          setLoading(false);
          return;
        }
        
        const data = await response.json();
        const apiBriefDocs = (data.documents || []).filter((doc: FeedItem) => 
          state.briefItemIds.includes(doc.id)
        );
        
        // Combine mock and API documents
        setDocuments([...mockBriefDocs, ...apiBriefDocs]);
      } catch (err) {
        console.error("Error fetching brief documents:", err);
        // On error, fall back to mock documents only
        const mockBriefDocs = MOCK_DOCUMENTS.filter(doc => 
          state.briefItemIds.includes(doc.id)
        );
        setDocuments(mockBriefDocs);
      } finally {
        setLoading(false);
      }
    }

    fetchBriefDocuments();
  }, [state.briefItemIds]);

  // Calculate metadata
  const itemCount = documents.length;
  const allCounties = Array.from(new Set(documents.flatMap((doc) => doc.counties))).sort();
  const dates = documents
    .map((doc) => doc.meetingDate ? new Date(doc.meetingDate).getTime() : null)
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b);
  
  const dateRange = dates.length
    ? `${new Date(dates[0]).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} → ${new Date(
        dates[dates.length - 1]
      ).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
    : "—";
  
  const docTypes = Array.from(new Set(documents.flatMap((doc) => doc.docTypes))).sort();
  
  const impacts = documents.reduce(
    (acc, doc) => ({ ...acc, [doc.impact]: (acc[doc.impact as keyof typeof acc] || 0) + 1 }),
    { High: 0, Medium: 0, Low: 0 } as Record<"High" | "Medium" | "Low", number>
  );

  const allTopics = Array.from(new Set(documents.flatMap((doc) => doc.topics))).sort();

  // PDF Export Function - instant download
  const exportToPDF = () => {
    // Create HTML content for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>CivicPulse Brief - ${new Date().toLocaleDateString()}</title>
          <style>
            @media print {
              @page { margin: 0.75in; }
              body { margin: 0; }
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
              line-height: 1.6;
              color: #1a1a1a;
              max-width: 8.5in;
              margin: 0 auto;
              padding: 20px;
            }
            h1 {
              font-size: 28px;
              font-weight: 700;
              margin-bottom: 8px;
              color: #000;
            }
            .date {
              color: #666;
              font-size: 14px;
              margin-bottom: 24px;
            }
            h2 {
              font-size: 20px;
              font-weight: 600;
              margin-top: 32px;
              margin-bottom: 16px;
              color: #000;
              border-bottom: 2px solid #e5e5e5;
              padding-bottom: 8px;
            }
            .metadata {
              background: #f8f8f8;
              padding: 16px;
              border-radius: 8px;
              margin-bottom: 24px;
            }
            .metadata-row {
              display: flex;
              margin-bottom: 8px;
            }
            .metadata-label {
              font-weight: 600;
              width: 140px;
              color: #555;
            }
            .metadata-value {
              color: #1a1a1a;
            }
            .impact-grid {
              display: flex;
              gap: 16px;
              margin-top: 12px;
            }
            .impact-box {
              flex: 1;
              padding: 12px;
              border-radius: 6px;
              text-align: center;
            }
            .impact-high { background: #fee; border: 1px solid #fcc; }
            .impact-medium { background: #fef3e0; border: 1px solid #fdd; }
            .impact-low { background: #efe; border: 1px solid #cfc; }
            .impact-label {
              font-size: 11px;
              text-transform: uppercase;
              font-weight: 600;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
            }
            .impact-count {
              font-size: 20px;
              font-weight: 700;
            }
            .document {
              margin-bottom: 24px;
              padding: 16px;
              border: 1px solid #e5e5e5;
              border-radius: 8px;
              page-break-inside: avoid;
            }
            .doc-title {
              font-size: 16px;
              font-weight: 600;
              margin-bottom: 8px;
              color: #000;
            }
            .doc-meta {
              font-size: 13px;
              color: #666;
              margin-bottom: 8px;
            }
            .doc-detail {
              font-size: 13px;
              margin: 4px 0;
            }
            .doc-detail strong {
              font-weight: 600;
              color: #555;
            }
            .topics {
              display: flex;
              flex-wrap: wrap;
              gap: 6px;
              margin-top: 8px;
            }
            .topic-tag {
              display: inline-block;
              padding: 4px 10px;
              background: #e8eaf6;
              border-radius: 12px;
              font-size: 11px;
              color: #3f51b5;
            }
          </style>
        </head>
        <body>
          <h1>CivicPulse Brief</h1>
          <div class="date">Generated: ${new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</div>
          
          <h2>Brief Overview</h2>
          <div class="metadata">
            <div class="metadata-row">
              <div class="metadata-label">Total Documents:</div>
              <div class="metadata-value">${itemCount}</div>
            </div>
            ${allCounties.length > 0 ? `
            <div class="metadata-row">
              <div class="metadata-label">Counties:</div>
              <div class="metadata-value">${allCounties.join(", ")}</div>
            </div>
            ` : ''}
            <div class="metadata-row">
              <div class="metadata-label">Date Range:</div>
              <div class="metadata-value">${dateRange}</div>
            </div>
            ${docTypes.length > 0 ? `
            <div class="metadata-row">
              <div class="metadata-label">Document Types:</div>
              <div class="metadata-value">${docTypes.join(", ")}</div>
            </div>
            ` : ''}
            ${allTopics.length > 0 ? `
            <div class="metadata-row">
              <div class="metadata-label">Topics:</div>
              <div class="metadata-value">${allTopics.join(", ")}</div>
            </div>
            ` : ''}
            
            <div style="margin-top: 16px;">
              <div class="metadata-label" style="margin-bottom: 8px;">Impact Distribution:</div>
              <div class="impact-grid">
                <div class="impact-box impact-high">
                  <div class="impact-label">High</div>
                  <div class="impact-count">${impacts.High}</div>
                </div>
                <div class="impact-box impact-medium">
                  <div class="impact-label">Medium</div>
                  <div class="impact-count">${impacts.Medium}</div>
                </div>
                <div class="impact-box impact-low">
                  <div class="impact-label">Low</div>
                  <div class="impact-count">${impacts.Low}</div>
                </div>
              </div>
            </div>
          </div>
          
          <h2>Documents</h2>
          ${documents.map((item, index) => `
            <div class="document">
              <div class="doc-title">${index + 1}. ${item.title}</div>
              <div class="doc-meta">${item.entity} — ${item.jurisdiction}</div>
              ${item.meetingDate ? `
              <div class="doc-detail"><strong>Meeting Date:</strong> ${new Date(item.meetingDate).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</div>
              ` : ''}
              <div class="doc-detail"><strong>Document Types:</strong> ${item.docTypes.join(", ")}</div>
              <div class="doc-detail"><strong>Impact:</strong> ${item.impact}</div>
              ${item.topics.length > 0 ? `
              <div class="doc-detail"><strong>Topics:</strong></div>
              <div class="topics">
                ${item.topics.map(topic => `<span class="topic-tag">${topic}</span>`).join('')}
              </div>
              ` : ''}
            </div>
          `).join('')}
        </body>
      </html>
    `;

    // Create a blob from the HTML content
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = `CivicPulse-Brief-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Brief Builder</h1>

      <section className="mt-6 grid lg:grid-cols-3 gap-6">
        {/* Main content area */}
        <div className="lg:col-span-2">
          <Card className="p-5">
            {loading && (
              <div className="text-sm muted">Loading documents...</div>
            )}
            
            {error && (
              <div className="text-sm text-red-400">Error: {error}</div>
            )}
            
            {!loading && !error && documents.length === 0 && (
              <div className="text-sm muted">
                No items in your brief yet. Add documents from the{" "}
                <Link href="/search" className="text-[--color-brand-100] hover:underline">
                  Search page
                </Link>
                .
              </div>
            )}
            
            {!loading && !error && documents.length > 0 && (
              <div className="space-y-4">
                {documents.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-lg border border-white/10 bg-surface/60 hover:bg-white/5 transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/item/${item.id}`}
                          className="font-medium hover:underline text-[--color-brand-100] block"
                        >
                          {item.title}
                        </Link>
                        <div className="text-xs muted mt-1">
                          {item.entity} — {item.jurisdiction}
                        </div>
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          {/* Impact Badge */}
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                              item.impact === "High"
                                ? "bg-red-500/20 text-red-300 border border-red-500/30"
                                : item.impact === "Medium"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : "bg-green-500/20 text-green-300 border border-green-500/30"
                            }`}
                          >
                            {item.impact} Impact
                          </span>
                          
                          {/* Doc Types */}
                          {item.docTypes.map((type) => (
                            <span
                              key={type}
                              className="px-2 py-0.5 rounded text-[10px] border border-white/10 bg-white/5"
                            >
                              {type}
                            </span>
                          ))}
                          
                          {/* Meeting Date */}
                          {item.meetingDate && (
                            <span className="text-xs muted">
                              {new Date(item.meetingDate).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          )}
                        </div>
                        
                        {/* Topics */}
                        {item.topics.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {item.topics.map((topic) => (
                              <span
                                key={topic}
                                className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-500/15 text-indigo-200 border border-indigo-500/25"
                              >
                                {topic}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        <Button
                          variant="secondary"
                          onClick={() => removeFromBrief(item.id)}
                          className="text-xs"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Metadata Card */}
          <Card className="p-5">
            <div className="font-medium mb-4">Brief Metadata</div>
            <div className="grid gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[--color-muted]">Items</span>
                <span className="font-medium">{itemCount}</span>
              </div>
              
              <div>
                <div className="text-[--color-muted] mb-1">Counties</div>
                <div className="text-xs">
                  {allCounties.length ? allCounties.join(", ") : "—"}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-[--color-muted]">Date range</span>
                <span className="text-xs">{dateRange}</span>
              </div>
              
              <div>
                <div className="text-[--color-muted] mb-1">Doc types</div>
                <div className="text-xs">
                  {docTypes.length ? docTypes.join(", ") : "—"}
                </div>
              </div>
              
              <div>
                <div className="text-[--color-muted] mb-2">Topics</div>
                <div className="flex flex-wrap gap-1">
                  {allTopics.length > 0 ? (
                    allTopics.map((topic) => (
                      <span
                        key={topic}
                        className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-500/15 text-indigo-200 border border-indigo-500/25"
                      >
                        {topic}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs">—</span>
                  )}
                </div>
              </div>
              
              <div className="mt-2">
                <div className="text-[--color-muted] mb-2">Impact Distribution</div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-red-300 font-medium">
                      High
                    </div>
                    <div className="text-sm font-bold mt-1 text-red-200">{impacts.High}</div>
                  </div>
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-amber-300 font-medium">
                      Med
                    </div>
                    <div className="text-sm font-bold mt-1 text-amber-200">{impacts.Medium}</div>
                  </div>
                  <div className="rounded-md border border-green-500/30 bg-green-500/10 p-2 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-green-300 font-medium">
                      Low
                    </div>
                    <div className="text-sm font-bold mt-1 text-green-200">{impacts.Low}</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Export Button */}
          <Button 
            variant="secondary" 
            className="w-full justify-center py-3"
            onClick={exportToPDF}
            disabled={documents.length === 0}
          >
            Export as PDF
          </Button>
        </aside>
      </section>
    </main>
  );
}
