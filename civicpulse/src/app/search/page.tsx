"use client";

import { useMemo, useState } from "react";
import { MOCK_FEED } from "@/lib/mock";
import type { DocumentType } from "@/lib/types";
import Link from "next/link";
import { Badge, Button, Card } from "@/components/ui";
import { useAppState } from "@/lib/state";

const allDocTypes: DocumentType[] = ["Agenda", "Minutes", "Staff Memo", "Ordinance", "Other"];

export default function SearchPage() {
  const { state, addToBrief } = useAppState();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  function toggleSelected(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }
  const [query, setQuery] = useState("");
  const [selectedDocTypes, setSelectedDocTypes] = useState<DocumentType[]>(["Agenda", "Minutes", "Staff Memo"]);
  const [counties, setCounties] = useState<string[]>(["Johnson", "Sedgwick", "Douglas"]);
  const [days, setDays] = useState(60);

  function toggle<T>(arr: T[], value: T): T[] {
    return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
  }

  const results = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    return MOCK_FEED.filter((item) => {
      const matchesDoc = item.docTypes.some((d) => selectedDocTypes.includes(d));
      const matchesCounty = item.counties.some((c) => counties.includes(c));
      const withinDays = item.meetingDate ? Date.now() - new Date(item.meetingDate).getTime() <= days * 86400000 : false;
      const hay = `${item.title} ${item.entity} ${item.jurisdiction} ${item.topics.join(" ")}`.toLowerCase();
      const matchesQuery = tokens.length === 0 || tokens.every((t) => hay.includes(t));
      return matchesDoc && matchesCounty && withinDays && matchesQuery;
    });
  }, [query, selectedDocTypes, counties, days]);

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
      <div className="mt-4 grid lg:grid-cols-4 gap-6">
        <aside className="lg:col-span-1 space-y-6">
          <Button
            variant="secondary"
            className="w-full"
            disabled={selectedIds.length === 0}
            onClick={() => {
              selectedIds.forEach((id) => addToBrief(id));
              setSelectedIds([]);
            }}
          >
            Add {selectedIds.length || "0"} selected to brief
          </Button>
          <Card>
            <label className="block text-sm font-medium">Query</label>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder='e.g. ("utility-scale" AND zoning) AND (setback OR buffer)' className="input mt-2" />
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
                    onClick={() => setSelectedDocTypes((x) => toggle(x, d))}
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
            <div className="mt-2 flex flex-wrap gap-2">
              {["Johnson", "Sedgwick", "Douglas", "Wyandotte"].map((c) => {
                const active = counties.includes(c);
                return (
                  <button
                    type="button"
                    key={c}
                    aria-pressed={active}
                    onClick={() => setCounties((x) => toggle(x, c))}
                    className={`chip ${active ? "ring-2 ring-[--ring-color] bg-[color-mix(in_oklab,var(--brand-500)_20%,transparent)] border-[color-mix(in_oklab,var(--brand-500)_40%,transparent)] text-[--color-brand-100]" : ""}`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </Card>
          <Card>
            <label className="block text-sm font-medium">Date range</label>
            <input type="range" min={7} max={120} value={days} onChange={(e) => setDays(parseInt(e.target.value))} className="mt-2 w-full" />
            <div className="text-xs muted">Last {days} days</div>
          </Card>
        </aside>
        <section className="lg:col-span-3">
          <div className="rounded-[--radius-lg] border border-white/10 bg-surface/60 backdrop-blur overflow-x-auto">
            <div className="min-w-[1200px] grid grid-cols-12 bg-white/10 text-[13px] font-medium border-b border-white/10">
              <div className="col-span-1 px-4 py-3">Select</div>
              <div className="col-span-4 px-4 py-3">Title</div>
              <div className="col-span-3 px-4 py-3">Entity / County</div>
              <div className="col-span-2 px-4 py-3">Docs</div>
              <div className="col-span-1 px-4 py-3">Date</div>
              <div className="col-span-1 px-4 py-3">Impact</div>
            </div>
            {results.map((item, idx) => (
              <div key={item.id} className={`min-w-[1200px] grid grid-cols-12 border-t border-white/10 text-sm leading-7 ${idx % 2 ? "bg-white/[0.03]" : ""}`}>
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
                  <div className="text-xs muted mt-1">Hits: {Object.entries(item.hits).map(([k,v]) => `${k}(${v})`).join(", ")}</div>
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
            {results.length === 0 && (
              <div className="p-6 text-sm muted">No results match your filters.</div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function ImpactBadge({ level }: { level: "Low" | "Medium" | "High" }) {
  if (level === "High") return <Badge color="danger">High</Badge>;
  if (level === "Medium") return <Badge color="warning">Medium</Badge>;
  return <Badge color="success">Low</Badge>;
}
