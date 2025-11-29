"use client";

import { useEffect, useState } from "react";
import type { DocumentType, FeedItem } from "@app/lib/types";
import Link from "next/link";
import { Badge, Button, Card } from "@app/components/ui";
import { CountyPicker } from "@app/components/CountyPicker";
import { useAppState } from "@app/lib/state";
import { formatHitLabel } from "@app/lib/format";
import { useAuth } from "@app/auth/AuthContext";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const allDocTypes: DocumentType[] = ["Agenda", "Minutes", "Staff Memo", "Ordinance", "Other"];

export default function SearchPage() {
  const { state, addToBrief, setSearchUi } = useAppState();
  const { isAuthenticated } = useAuth();
  const [documents, setDocuments] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const {
    query,
    selectedDocTypes,
    counties,
    meetingDateFrom,
    meetingDateTo,
    selectedIds,
  } = state.searchUi;

  const startDate = meetingDateFrom ? new Date(meetingDateFrom) : null;
  const endDate = meetingDateTo ? new Date(meetingDateTo) : null;

  function toggleSelected(id: string) {
    setSearchUi((prev) => ({
      ...prev,
      selectedIds: prev.selectedIds.includes(id)
        ? prev.selectedIds.filter((x) => x !== id)
        : [...prev.selectedIds, id],
    }));
  }

  function toggle<T>(arr: T[], value: T): T[] {
    return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
  }

  // Fetch documents from API (with query, document type, and date range filters)
  useEffect(() => {
    async function fetchDocuments() {
      if (!isAuthenticated) {
        setDocuments([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      
      try {
        const params = new URLSearchParams();
        if (query) params.append("query", query);
        if (selectedDocTypes.length > 0) params.append("docTypes", selectedDocTypes.join(","));
        if (counties.length > 0) params.append("counties", counties.join(","));
        if (meetingDateFrom) params.append("meetingDateFrom", meetingDateFrom);
        if (meetingDateTo) params.append("meetingDateTo", meetingDateTo);
        params.append("limit", "100");
        
        const response = await fetch(`/api/documents?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }
        
        const data = await response.json();
        setDocuments(data.documents || []);
      } catch (err) {
        console.error("Error fetching documents:", err);
        setError("Failed to load documents from database");
      } finally {
        setLoading(false);
      }
    }
    
    fetchDocuments();
  }, [query, selectedDocTypes, counties, meetingDateFrom, meetingDateTo, isAuthenticated]);

  const results = documents;

  if (!isAuthenticated) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-semibold">Sign in to search CivicPulse</h1>
          <p className="text-[--color-muted]">
            Use the Sign in button in the header to authenticate with Google. Search and brief tools unlock after authentication.
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
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <div className="mt-6 grid lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-1 space-y-4 lg:sticky lg:top-8 lg:h-fit">
          {/* Button shown in sidebar on desktop only */}
          <div className="hidden lg:block">
            <Button
              variant="secondary"
              className="w-full"
              disabled={selectedIds.length === 0}
              onClick={() => {
                selectedIds.forEach((id) => addToBrief(id));
                setSearchUi((prev) => ({
                  ...prev,
                  selectedIds: [],
                }));
              }}
            >
              Add {selectedIds.length || "0"} selected to brief
            </Button>
          </div>
          <Card>
            <label className="block text-sm font-medium">Query</label>
            <input
              value={query}
              onChange={(e) =>
                setSearchUi((prev) => ({
                  ...prev,
                  query: e.target.value,
                }))
              }
              placeholder='e.g. ("utility-scale" AND zoning) AND (setback OR buffer)'
              className="input mt-2"
            />
          </Card>
          <Card>
            <div className="text-sm font-medium">Document Type</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {allDocTypes.map((d) => {
                const active = selectedDocTypes.includes(d);
                return (
                  <button
                    type="button"
                    key={d}
                    aria-pressed={active}
                    onClick={() =>
                      setSearchUi((prev) => ({
                        ...prev,
                        selectedDocTypes: toggle(prev.selectedDocTypes, d),
                      }))
                    }
                    className={`chip ${active ? "ring-2 ring-[--ring-color] bg-[color-mix(in_oklab,var(--brand-500)_20%,transparent)] border-[color-mix(in_oklab,var(--brand-500)_40%,transparent)] text-[--color-brand-100]" : ""}`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </Card>
          <Card>
            <div className="text-sm font-medium">Counties</div>
            <div className="mt-2">
              <CountyPicker
                selected={counties}
                onChange={(newCounties) =>
                  setSearchUi((prev) => ({
                    ...prev,
                    counties: newCounties,
                  }))
                }
                placeholder="Type to search counties..."
              />
            </div>
          </Card>
          <Card>
            <label className="block text-sm font-medium">Date range</label>
            <div className="mt-2 space-y-2">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Start date</label>
                <DatePicker
                  selected={startDate}
                  onChange={(date: Date | null) =>
                    setSearchUi((prev) => ({
                      ...prev,
                      meetingDateFrom: date ? date.toISOString().split("T")[0] : null,
                    }))
                  }
                  placeholderText="Select start date"
                  className="input w-full"
                  dateFormat="yyyy-MM-dd"
                  isClearable
                  popperPlacement="top"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">End date</label>
                <DatePicker
                  selected={endDate}
                  onChange={(date: Date | null) =>
                    setSearchUi((prev) => ({
                      ...prev,
                      meetingDateTo: date ? date.toISOString().split("T")[0] : null,
                    }))
                  }
                  placeholderText="Select end date"
                  className="input w-full"
                  dateFormat="yyyy-MM-dd"
                  isClearable
                  popperPlacement="top"
                />
              </div>
            </div>
          </Card>
        </aside>
        <section className="lg:col-span-3">
          {/* Button shown above results on mobile only */}
          <Button
            variant="secondary"
            className="lg:hidden w-full mb-4"
            disabled={selectedIds.length === 0}
            onClick={() => {
              selectedIds.forEach((id) => addToBrief(id));
              setSearchUi((prev) => ({
                ...prev,
                selectedIds: [],
              }));
            }}
          >
            Add {selectedIds.length || "0"} selected to brief
          </Button>
          
          {loading && (
            <Card className="p-6 text-sm muted text-center">Loading documents...</Card>
          )}
          {error && (
            <Card className="p-6 text-sm text-red-400">Error: {error}</Card>
          )}
          {!loading && !error && results.length === 0 && (
            <Card className="p-6 text-sm muted">No results match your filters.</Card>
          )}
          
          {/* Desktop Table View - hidden on mobile */}
          {!loading && !error && results.length > 0 && (
            <div className="hidden lg:block rounded-[--radius-lg] border border-white/10 bg-surface/60 backdrop-blur overflow-hidden">
              <div className="grid grid-cols-12 bg-white/10 text-[13px] font-medium border-b border-white/10">
                <div className="col-span-1 px-4 py-3">Select</div>
                <div className="col-span-4 px-4 py-3">Title</div>
                <div className="col-span-3 px-4 py-3">Entity / County</div>
                <div className="col-span-2 px-4 py-3">Docs</div>
                <div className="col-span-1 px-4 py-3">Date</div>
                <div className="col-span-1 px-4 py-3">Impact</div>
              </div>
              {results.map((item, idx) => (
                <div key={item.id} className={`grid grid-cols-12 border-t border-white/10 text-sm leading-7 ${idx % 2 ? "bg-white/[0.03]" : ""}`}>
                  <div className="col-span-1 px-4 py-4">
                    <input
                      type="checkbox"
                      className="h-4 w-4 align-middle accent-[--color-brand-600] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelected(item.id)}
                      disabled={state.briefItemIds.includes(item.id)}
                      title={state.briefItemIds.includes(item.id) ? "Already in Brief" : "Select item"}
                    />
                  </div>
                  <div className="col-span-4 px-4 py-4 overflow-hidden break-words">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/item/${item.id}`} className="font-medium hover:underline text-[--color-brand-100]">{item.title}</Link>
                      {state.briefItemIds.includes(item.id) && (
                        <span className="shrink-0"><Badge color="brand">In Brief</Badge></span>
                      )}
                    </div>
                      <div className="text-xs muted mt-1">
                        Hits:{" "}
                        {Object.entries(item.hits || {})
                          .map(([k, v]) => formatHitLabel(k, v))
                          .join(", ")}
                      </div>
                  </div>
                  <div className="col-span-3 px-4 py-4 overflow-hidden break-words">
                    <div className="font-medium text-xs">{item.entity}</div>
                    <div className="text-xs muted">{item.jurisdiction}</div>
                  </div>
                  <div className="col-span-2 px-4 py-4 text-xs overflow-hidden text-ellipsis">{item.docTypes.join(", ")}</div>
                  <div className="col-span-1 px-4 py-4 text-xs whitespace-nowrap">
                    {item.meetingDate ? new Date(item.meetingDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "N/A"}
                  </div>
                  <div className="col-span-1 px-4 py-4">
                    <ImpactBadge level={item.impact} />
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Mobile Card View - shown only on mobile */}
          {!loading && !error && results.length > 0 && (
            <div className="lg:hidden space-y-4">
              {results.map((item) => (
                <Card key={item.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-[--color-brand-600] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelected(item.id)}
                      disabled={state.briefItemIds.includes(item.id)}
                      title={state.briefItemIds.includes(item.id) ? "Already in Brief" : "Select item"}
                    />
                    <div className="flex-1 min-w-0">
                      <Link href={`/item/${item.id}`} className="font-medium hover:underline text-[--color-brand-100] block">
                        {item.title}
                      </Link>
                      <div className="text-xs muted mt-1">
                        {item.entity} — {item.jurisdiction}
                      </div>
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <ImpactBadge level={item.impact} />
                        {state.briefItemIds.includes(item.id) && (
                          <Badge color="brand">In Brief</Badge>
                        )}
                      </div>
                      <div className="text-xs muted mt-2">
                        {item.docTypes.join(", ")} • {item.meetingDate ? new Date(item.meetingDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "N/A"}
                      </div>
                      <div className="text-xs muted mt-1">
                        Hits:{" "}
                        {Object.entries(item.hits || {})
                          .map(([k, v]) => formatHitLabel(k, v))
                          .join(", ")}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
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