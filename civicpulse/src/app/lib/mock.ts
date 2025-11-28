import type { FeedItem } from "@app/lib/types";

export const MOCK_FEED: FeedItem[] = [
  {
    id: "item-ks-johnson-utility-solar-1",
    sourceId: "johnson_county_planning",
    fileUrl: "https://jocogov.org/dept/planning/docs/2025-10-27-solar-agenda.pdf",
    contentHash: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
    bytesSize: 524288,
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    title: "Proposed permitting requirements for utility-scale solar",
    entity: "Johnson County Planning Board",
    jurisdiction: "Johnson County, KS",
    counties: ["Johnson"],
    meetingDate: new Date().toISOString(),
    docTypes: ["Agenda", "Staff Memo"],
    impact: "High",
    stage: "Hearing",
    topics: ["solar zoning", "renewable incentive", "land use"],
    hits: { "solar zoning": 3, setback: 2 },
    attachments: [
      { id: "a1", title: "Agenda", type: "Agenda", pageCount: 15 },
      { id: "a2", title: "Staff Memo", type: "Staff Memo", pageCount: 6 },
    ],
    extractedText: [
      "Staff recommends establishing a conditional use permit for utility-scale solar facilities, subject to performance standards including setbacks, buffering, and decommissioning.",
      "Setbacks: A minimum of 300 feet from residential structures, with increased distances adjacent to designated scenic corridors.",
      "Environmental review: Projects exceeding 50 acres require a third-party study on stormwater and wildlife impacts.",
      "Public comment summary: 37 submissions, with mixed sentiment on visual impacts and agricultural land conversion.",
    ],
    pdfPreview: [
      "Agenda p.1 — Call to Order, Approval of Minutes, New Business",
      "Staff Memo p.2 — Background: growth in regional solar proposals",
      "Staff Memo p.4 — Proposed standards: setbacks, screening, glare",
      "Appendix A — Draft ordinance excerpts",
    ],
    updatedAt: new Date().toISOString(),
  },
];
