"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppState } from "@app/lib/state";
import { SavedBrief } from "@app/lib/types";
import type { FeedItem } from "@app/lib/types";
import { Button, Card, Badge } from "@app/components/ui";
import Link from "next/link";
import { useAuth } from "@app/auth/AuthContext";
import { formatTopicLabel } from "@app/lib/format";

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

  // Topic aggregations
  const topicCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const doc of documents) {
      for (const topic of doc.topics || []) {
        if (!topic) continue;
        counts[topic] = (counts[topic] || 0) + 1;
      }
    }
    return counts;
  }, [documents]);

  const allTopics = useMemo(
    () => Object.keys(topicCounts).sort((a, b) => formatTopicLabel(a).localeCompare(formatTopicLabel(b))),
    [topicCounts]
  );

  // Export brief as rich HTML (for printing/saving as PDF)
  const exportToPDF = () => {
    // Topic distribution data
    const topicEntries = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]);
    const maxTopicCount =
      topicEntries.length > 0 ? Math.max(...topicEntries.map(([, count]) => count)) : 0;

    const topicDistributionHtml =
      topicEntries.length > 0 && maxTopicCount > 0
        ? `
      <div class="chart">
        ${topicEntries
          .map(([topic, count]) => {
            const width = (count / maxTopicCount) * 100;
            const label = formatTopicLabel(topic);
            return `
          <div class="chart-row">
            <div class="chart-label">${label}</div>
            <div class="chart-bar-track">
              <div class="chart-bar" style="width: ${Math.max(width, 8).toFixed(1)}%;"></div>
            </div>
            <div class="chart-value">${count}</div>
          </div>`;
          })
          .join("")}
      </div>`
        : "<p>No topics assigned in this brief.</p>";

    // Document type distribution
    const docTypeCounts: Record<string, number> = {};
    for (const doc of documents) {
      for (const dt of doc.docTypes || []) {
        if (!dt) continue;
        docTypeCounts[dt] = (docTypeCounts[dt] || 0) + 1;
      }
    }
    const docTypeEntries = Object.entries(docTypeCounts).sort((a, b) => b[1] - a[1]);
    const maxDocTypeCount =
      docTypeEntries.length > 0 ? Math.max(...docTypeEntries.map(([, count]) => count)) : 0;

    const docTypeDistributionHtml =
      docTypeEntries.length > 0 && maxDocTypeCount > 0
        ? `
      <div class="chart">
        ${docTypeEntries
          .map(([type, count]) => {
            const width = (count / maxDocTypeCount) * 100;
            return `
          <div class="chart-row">
            <div class="chart-label">${type}</div>
            <div class="chart-bar-track">
              <div class="chart-bar" style="width: ${Math.max(width, 10).toFixed(1)}%;"></div>
            </div>
            <div class="chart-value">${count}</div>
          </div>`;
          })
          .join("")}
      </div>`
        : "<p>No document types available.</p>";

    // Simple word cloud from document summaries only
    const stopwords = new Set([
      "the",
      "and",
      "of",
      "to",
      "in",
      "for",
      "on",
      "at",
      "by",
      "with",
      "a",
      "an",
      "or",
      "from",
      "is",
      "are",
      "was",
      "were",
      "be",
      "this",
      "that",
      "it",
      "as",
      "we",
      "you",
      "they",
      "their",
      "our",
      "city",
      "county",
      "council",
      "board",
      "agenda",
      "meeting",
      "document",
      "final",
      "summary",
      "brief",
      "report",
      // User-requested low-information words
      "key",
      "items",
      "include",
      "includes",
      "including",
      "also",
      "various",
      "related",
      "several",
    ]);

    const monthWords = new Set([
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
      "jan",
      "feb",
      "mar",
      "apr",
      "jun",
      "jul",
      "aug",
      "sep",
      "sept",
      "oct",
      "nov",
      "dec",
    ]);

    const isDateLikeWord = (word: string) => {
      if (!word) return false;
      const w = word.toLowerCase();
      if (monthWords.has(w)) return true;
      // Pure numbers (days, years)
      if (/^\d+$/.test(w)) return true;
      // Ordinals like 1st, 2nd, 3rd, 4th
      if (/^\d+(st|nd|rd|th)$/.test(w)) return true;
      return false;
    };

    const wordCounts: Record<string, number> = {};
    const bigramCounts: Record<string, number> = {};
    const trigramCounts: Record<string, number> = {};
    for (const doc of documents) {
      if (!doc.summary) continue;

      // Use only summary text and strip boilerplate openers like
      // "This document is the final agenda for the Wichita City Council meeting on ..."
      let summaryLower = doc.summary.toLowerCase();
      summaryLower = summaryLower.replace(
        /this document is the (final|draft)?\s*agenda for [^.]*\./g,
        " "
      );

      const cleaned = summaryLower.replace(/[^a-z0-9\s]/g, " ");
      const words = cleaned.split(/\s+/).filter(Boolean);

      for (let i = 0; i < words.length; i++) {
        const w1 = words[i];
        if (w1.length > 3 && !stopwords.has(w1) && !isDateLikeWord(w1)) {
          wordCounts[w1] = (wordCounts[w1] || 0) + 1;
        }

        if (i + 1 < words.length) {
          const w2 = words[i + 1];
          const bigram = `${w1} ${w2}`;
          if (
            !stopwords.has(w1) &&
            !stopwords.has(w2) &&
            !isDateLikeWord(w1) &&
            !isDateLikeWord(w2)
          ) {
            bigramCounts[bigram] = (bigramCounts[bigram] || 0) + 1;
          }
        }

        if (i + 2 < words.length) {
          const w2 = words[i + 1];
          const w3 = words[i + 2];
          const trigram = `${w1} ${w2} ${w3}`;
          if (
            !stopwords.has(w1) &&
            !stopwords.has(w2) &&
            !stopwords.has(w3) &&
            !isDateLikeWord(w1) &&
            !isDateLikeWord(w2) &&
            !isDateLikeWord(w3)
          ) {
            trigramCounts[trigram] = (trigramCounts[trigram] || 0) + 1;
          }
        }
      }
    }

    const wordEntries = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 60);
    const maxWordCount = wordEntries.length > 0 ? Math.max(...wordEntries.map(([, c]) => c)) : 0;

    const wordCloudHtml =
      wordEntries.length > 0 && maxWordCount > 0
        ? `
      <div class="word-cloud">
        ${wordEntries
          .map(([word, count]) => {
            const ratio = count / maxWordCount;
            const size = 12 + ratio * 24; // 12px to 36px
            return `<span style="font-size:${size.toFixed(1)}px;">${word}</span>`;
          })
          .join(" ")}
      </div>`
        : "<p>Not enough text content to generate a word cloud.</p>";

    const bigramEntries = Object.entries(bigramCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40);
    const maxBigramCount =
      bigramEntries.length > 0 ? Math.max(...bigramEntries.map(([, c]) => c)) : 0;

    const bigramCloudHtml =
      bigramEntries.length > 0 && maxBigramCount > 0
        ? `
      <div class="word-cloud">
        ${bigramEntries
          .map(([phrase, count]) => {
            const ratio = count / maxBigramCount;
            const size = 11 + ratio * 18; // 11px to 29px
            return `<span style="font-size:${size.toFixed(1)}px;">${phrase}</span>`;
          })
          .join(" ")}
      </div>`
        : "<p>Not enough phrase diversity to generate a bigram cloud.</p>";

    const trigramEntries = Object.entries(trigramCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30);
    const maxTrigramCount =
      trigramEntries.length > 0 ? Math.max(...trigramEntries.map(([, c]) => c)) : 0;

    const trigramCloudHtml =
      trigramEntries.length > 0 && maxTrigramCount > 0
        ? `
      <div class="word-cloud">
        ${trigramEntries
          .map(([phrase, count]) => {
            const ratio = count / maxTrigramCount;
            const size = 10 + ratio * 16; // 10px to 26px
            return `<span style="font-size:${size.toFixed(1)}px;">${phrase}</span>`;
          })
          .join(" ")}
      </div>`
        : "<p>Not enough phrase diversity to generate a trigram cloud.</p>";

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
              width: 160px;
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
            .chart {
              margin-top: 12px;
              display: flex;
              flex-direction: column;
              gap: 6px;
            }
            .chart-row {
              display: grid;
              grid-template-columns: minmax(0, 180px) 1fr auto;
              align-items: center;
              gap: 8px;
              font-size: 12px;
            }
            .chart-label {
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .chart-bar-track {
              background: #f1f1f1;
              border-radius: 999px;
              overflow: hidden;
              height: 10px;
            }
            .chart-bar {
              height: 100%;
              background: linear-gradient(90deg, #4f46e5, #22c55e);
            }
            .chart-value {
              font-weight: 600;
              min-width: 24px;
              text-align: right;
            }
            .word-cloud {
              margin-top: 16px;
              padding: 12px;
              border-radius: 8px;
              background: #fafafa;
              line-height: 1.4;
            }
            .word-cloud span {
              margin: 4px 6px;
              display: inline-block;
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
            ` : ""}
            <div class="metadata-row">
              <div class="metadata-label">Meeting Date Range:</div>
              <div class="metadata-value">${dateRange}</div>
            </div>
            <!-- Document types omitted here; see chart below -->
          </div>
          
          <h2>Impact Summary</h2>
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

          <h2>Topic Distribution</h2>
          ${topicDistributionHtml}

          <h2>Document Types</h2>
          ${docTypeDistributionHtml}

          <h2>Word Cloud (Top Terms)</h2>
          ${wordCloudHtml}

          <h2>Word Cloud (Top Bigrams)</h2>
          ${bigramCloudHtml}

          <h2>Word Cloud (Top Trigrams)</h2>
          ${trigramCloudHtml}
        </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `CivicPulse-Brief-${new Date().toISOString().split("T")[0]}.html`;
    document.body.appendChild(link);
    link.click();

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
                            <ImpactBadge level={item.impact} />
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
                                {formatTopicLabel(topic)}
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
                        {formatTopicLabel(topic)}{" "}
                        <span className="opacity-70">({topicCounts[topic] ?? 0})</span>
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
                  <div className="rounded-md border border-red-200 bg-red-100 p-2 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-red-800 font-medium">
                      High
                    </div>
                    <div className="text-sm font-bold mt-1 text-red-800">{impacts.High}</div>
                  </div>
                  <div className="rounded-md border border-amber-200 bg-amber-100 p-2 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-amber-800 font-medium">
                      Medium
                    </div>
                    <div className="text-sm font-bold mt-1 text-amber-800">{impacts.Medium}</div>
                  </div>
                  <div className="rounded-md border border-green-200 bg-green-100 p-2 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-green-800 font-medium">
                      Low
                    </div>
                    <div className="text-sm font-bold mt-1 text-green-800">{impacts.Low}</div>
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

function ImpactBadge({ level }: { level: "Low" | "Medium" | "High" | null }) {
  if (!level) return null;
  if (level === "High") return <Badge color="danger">High</Badge>;
  if (level === "Medium") return <Badge color="warning">Medium</Badge>;
  return <Badge color="success">Low</Badge>;
}
