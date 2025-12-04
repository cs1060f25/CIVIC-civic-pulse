"use client";

import { useEffect, useState } from "react";
import { useAppState } from "@app/lib/state";
import { SavedBrief } from "@app/lib/types";
import type { FeedItem } from "@app/lib/types";
import { Button, Card } from "@app/components/ui";
import Link from "next/link";
import { useAuth } from "@app/auth/AuthContext";

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
  const { state, removeFromBrief, saveBrief, loadBrief, deleteBrief, clearBrief } = useAppState();
  const { isAuthenticated, user } = useAuth();
  const [documents, setDocuments] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [briefName, setBriefName] = useState("");
  const [briefDescription, setBriefDescription] = useState("");

  // Fetch documents that are in the brief
  useEffect(() => {
    // Safety check - if user not authenticated or state missing, don't proceed
    if (!state || !isAuthenticated) {
      setDocuments([]);
      setLoading(false);
      return;
    }
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

        // Build API URL with googleId if user is authenticated
        const params = new URLSearchParams();
        params.append("limit", "100");
        if (user?.googleId) {
          params.append("googleId", user.googleId);
        }

        // Try to fetch real documents from API with user-specific metadata
        const response = await fetch(`/api/documents?${params.toString()}`);
        
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
  }, [state, isAuthenticated, user?.googleId]);

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
              <div class="metadata-label">Meeting Date:</div>
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
              <div class="metadata-label" style="margin-bottom: 8px;">Impact Level:</div>
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

  // Handler functions for brief management
  const handleSaveBrief = () => {
    if (!briefName.trim()) return;
    
    saveBrief(briefName.trim(), briefDescription.trim());
    setBriefName("");
    setBriefDescription("");
    setShowSaveDialog(false);
  };

  const handleLoadBrief = (briefId: string) => {
    loadBrief(briefId);
    setShowHistory(false);
  };

  const handleDeleteBrief = (briefId: string) => {
    if (confirm("Are you sure you want to delete this brief?")) {
      deleteBrief(briefId);
    }
  };

  // Safety check - if state is undefined, show loading state
  if (!state) {
    return (
      <main className="w-full py-8">
        <div className="text-center">Loading...</div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-semibold">Sign in to build briefs</h1>
          <p className="text-[--color-muted]">
            Authenticate with Google to save document selections, resume drafts, and export briefs.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-[--color-brand-600] text-white font-semibold"
          >
            Go to login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full py-8">
      <div className="px-6 sm:px-8 lg:px-12">
      <h1 className="text-2xl font-semibold tracking-tight">Brief Builder</h1>

      <section className="mt-6 grid lg:grid-cols-3 gap-6">
        {/* Main content area */}
        <div className="lg:col-span-2">
          <Card className="p-5">
            {loading && (
              <div className="text-sm text-[--color-muted]">Loading documents...</div>
            )}
            
            {error && (
              <div className="text-sm text-[--color-danger]">Error: {error}</div>
            )}
            
            {!loading && !error && documents.length === 0 && (
              <div className="text-sm text-[--color-muted]">
                No items in your brief yet. Add documents from the{" "}
                <Link href="/search" className="text-[--color-brand-400] hover:underline">
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
                          className="font-medium hover:underline text-[--color-foreground] hover:text-[--color-brand-300] block"
                        >
                          {item.title}
                        </Link>
                        <div className="text-xs text-[--color-muted] mt-1">
                          {item.entity} — {item.jurisdiction}
                        </div>
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          {/* Impact Badge */}
                          {item.impact && (
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
                          )}
                          
                          {/* Doc Types */}
                          {item.docTypes.map((type) => (
                            <span
                              key={type}
                              className="px-2 py-0.5 rounded text-[10px] border border-white/20 bg-white/5 text-[--color-foreground]"
                            >
                              {type}
                            </span>
                          ))}
                          
                          {/* Meeting Date */}
                          {item.meetingDate && (
                            <span className="text-xs text-[--color-muted]">
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
                                className="px-2 py-0.5 rounded-full text-[10px] bg-[--color-brand-500]/20 text-[--color-brand-300] border border-[--color-brand-500]/30"
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
            <div className="font-medium mb-4 text-[--color-foreground]">Brief Metadata</div>
            <div className="grid gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white/90">Items</span>
                <span className="font-medium text-[--color-foreground]">{itemCount}</span>
              </div>
              
              <div>
                <div className="font-medium mb-1 text-white/90">Counties</div>
                <div className="text-xs text-[--color-foreground]">
                  {allCounties.length ? allCounties.join(", ") : "—"}
                </div>
              </div>
              
              <div>
                <div className="font-medium mb-1 text-white/90">Meeting Date</div>
                <div className="text-xs text-[--color-foreground]">{dateRange}</div>
              </div>
              
              <div>
                <div className="font-medium mb-1 text-white/90">Document Types</div>
                <div className="text-xs text-[--color-foreground]">
                  {docTypes.length ? docTypes.join(", ") : "—"}
                </div>
              </div>
              
              <div>
                <div className="font-medium mb-2 text-white/90">Topics</div>
                <div className="flex flex-wrap gap-1">
                  {allTopics.length > 0 ? (
                    allTopics.map((topic) => (
                      <span
                        key={topic}
                        className="px-2 py-0.5 rounded-full text-[10px] bg-[--color-brand-500]/20 text-[--color-brand-300] border border-[--color-brand-500]/30"
                      >
                        {topic}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[--color-foreground] opacity-60">—</span>
                  )}
                </div>
              </div>
              
              <div className="mt-2">
                <div className="font-medium mb-2 text-white/90">Impact Level</div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-md border border-red-500/30 bg-red-500/20 p-2 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-red-200 font-medium">
                      High
                    </div>
                    <div className="text-sm font-bold mt-1 text-red-100">{impacts.High}</div>
                  </div>
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/20 p-2 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-amber-200 font-medium">
                      Medium
                    </div>
                    <div className="text-sm font-bold mt-1 text-amber-100">{impacts.Medium}</div>
                  </div>
                  <div className="rounded-md border border-green-500/30 bg-green-500/20 p-2 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-green-200 font-medium">
                      Low
                    </div>
                    <div className="text-sm font-bold mt-1 text-green-100">{impacts.Low}</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Brief Actions */}
          <div className="space-y-3">
            <Button 
              className="w-full justify-center py-3"
              onClick={() => setShowSaveDialog(true)}
              disabled={documents.length === 0}
            >
              Save Brief
            </Button>
            
            <Button 
              variant="secondary" 
              className="w-full justify-center py-3"
              onClick={() => setShowHistory(true)}
              disabled={(state?.savedBriefs || []).length === 0}
            >
              View History ({(state?.savedBriefs || []).length})
            </Button>
            
            <Button 
              variant="ghost" 
              className="w-full justify-center py-3"
              onClick={clearBrief}
              disabled={documents.length === 0}
            >
              Clear Brief
            </Button>
            
            <Button 
              variant="secondary" 
              className="w-full justify-center py-3"
              onClick={exportToPDF}
              disabled={documents.length === 0}
            >
              Export as PDF
            </Button>
          </div>
        </aside>
      </section>

      {/* Save Brief Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4 text-[--color-foreground]">Save Brief</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-[--color-foreground]">Brief Name</label>
                <input
                  type="text"
                  value={briefName}
                  onChange={(e) => setBriefName(e.target.value)}
                  className="w-full px-3 py-2 border border-white/10 rounded-lg bg-white/5 focus:outline-none focus:ring-2 focus:ring-[--ring-color]"
                  placeholder="Enter brief name"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-[--color-foreground]">Description (optional)</label>
                <textarea
                  value={briefDescription}
                  onChange={(e) => setBriefDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-white/10 rounded-lg bg-white/5 focus:outline-none focus:ring-2 focus:ring-[--ring-color] resize-none"
                  rows={3}
                  placeholder="Brief description or notes"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowSaveDialog(false);
                    setBriefName("");
                    setBriefDescription("");
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveBrief}
                  disabled={!briefName.trim()}
                  className="flex-1"
                >
                  Save Brief
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Brief History Sidebar */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[--color-foreground]">Brief History</h2>
              <Button
                variant="ghost"
                onClick={() => setShowHistory(false)}
                className="text-sm"
              >
                Close
              </Button>
            </div>
            
            <div className="overflow-y-auto max-h-[60vh]">
              {(state?.savedBriefs || []).length === 0 ? (
                <div className="text-center text-[--color-muted] py-8">
                  No saved briefs yet
                </div>
              ) : (
                <div className="space-y-3">
                  {Array.isArray(state?.savedBriefs) && state.savedBriefs.length > 0 ? (
                    state.savedBriefs
                      .sort((a: SavedBrief, b: SavedBrief) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                      .map((brief: SavedBrief) => (
                      <div
                        key={brief.id}
                        className="p-4 border border-white/10 rounded-lg bg-white/5 hover:bg-white/10 transition"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-[--color-foreground] mb-1">
                              {brief.name}
                            </h3>
                            {brief.description && (
                              <p className="text-sm text-[--color-muted] mb-2">
                                {brief.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-[--color-muted]">
                              <span>{brief.documentCount} documents</span>
                              <span>
                                Created {new Date(brief.createdAt).toLocaleDateString()}
                              </span>
                              {brief.updatedAt !== brief.createdAt && (
                                <span>
                                  Updated {new Date(brief.updatedAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Button
                              variant="secondary"
                              onClick={() => handleLoadBrief(brief.id)}
                              className="text-xs"
                            >
                              Load
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => handleDeleteBrief(brief.id)}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-[--color-muted] py-8">
                      No saved briefs available
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
    </main>
  );
}
