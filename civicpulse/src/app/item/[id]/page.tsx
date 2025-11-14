"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { FeedItem } from "@/lib/types";
import { SplitViewer } from "@/components/SplitViewer";
import Link from "next/link";
import { Button, Card, Badge } from "@/components/ui";
import { useAppState } from "@/lib/state";

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
      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-sm muted">Loading document...</div>
      </main>
    );
  }

  if (error || !item) {
    return (
      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-sm">
          {error || "Document not found."}{" "}
          <Link className="text-[--color-brand-100] hover:underline" href="/search">
            Back to search
          </Link>
        </div>
      </main>
    );
  }

  const isInBrief = state.briefItemIds.includes(item.id);

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-[--color-brand-100] break-words">
            {item.title}
          </h1>
          <div className="text-sm muted mt-1">
            {item.entity} — {item.jurisdiction}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="secondary">Follow</Button>
          {isInBrief ? (
            <Button variant="ghost" onClick={() => removeFromBrief(item.id)}>
              Remove from Brief
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => addToBrief(item.id)}>
              Add to Brief
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 grid md:grid-cols-2 gap-4">
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
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
          <div className="text-lg font-semibold">Document Viewer</div>
          <div className="text-xs muted">Left: extracted text · Right: original PDF</div>
        </div>
        <SplitViewer
          left={
            <div className="p-4 text-sm space-y-4">
              <div className="text-xs muted mb-4">
                Extracted text with keyword highlights
              </div>
              {(item.extractedText && item.extractedText.length > 0
                ? item.extractedText
                : ["No extracted text available for this item."]
              ).map((para, idx) => (
                <p key={idx} className="leading-relaxed">
                  {para}
                </p>
              ))}
            </div>
          }
          right={
            <div className="h-full overflow-auto p-4">
              <div className="text-xs muted mb-4">Original PDF preview</div>
              <div className="grid gap-3">
                {(item.pdfPreview && item.pdfPreview.length > 0
                  ? item.pdfPreview
                  : ["No preview available."]
                ).map((page, idx) => (
                  <div
                    key={idx}
                    className="rounded-md border border-white/10 bg-white/5 p-3 text-xs"
                  >
                    <div className="text-[10px] uppercase tracking-wide text-[--color-muted] mb-1">
                      Page {idx + 1}
                    </div>
                    <div className="leading-relaxed">{page}</div>
                  </div>
                ))}
              </div>
            </div>
          }
        />
      </div>
    </main>
  );
}

function ImpactBadge({ level }: { level: "Low" | "Medium" | "High" }) {
  if (level === "High") return <Badge color="danger">High</Badge>;
  if (level === "Medium") return <Badge color="warning">Medium</Badge>;
  return <Badge color="success">Low</Badge>;
}
