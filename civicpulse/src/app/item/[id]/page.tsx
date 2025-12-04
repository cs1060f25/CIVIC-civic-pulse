"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { FeedItem, ImpactLevel } from "@app/lib/types";
import Link from "next/link";
import { Button, Card, Badge } from "@app/components/ui";
import { useAppState } from "@app/lib/state";
import { formatTopicLabel } from "@app/lib/format";

// Standard topics from the system
const STANDARD_TOPICS = [
  "taxes_and_budget",
  "housing_and_zoning",
  "public_welfare",
  "transportation",
  "utilities",
  "public_safety",
  "emergency_services",
  "economic_development",
  "parks_and_green_spaces",
  "education",
  "sustainability",
  "equity_and_civil_rights",
  "digital_access",
  "oversight_and_transparency",
  "other",
];

const IMPACT_LEVELS: (ImpactLevel)[] = [null, "Low", "Medium", "High"];
const STAGE_OPTIONS = ["Work Session", "Hearing", "Vote", "Adopted", "Draft"];

export default function ItemDetailPage() {
  const params = useParams<{ id: string }>();
  const { state, addToBrief, removeFromBrief } = useAppState();
  const [item, setItem] = useState<FeedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingImpact, setEditingImpact] = useState<ImpactLevel>(null);
  const [editingStage, setEditingStage] = useState<string | undefined>(undefined);
  const [editingTopics, setEditingTopics] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchDocument() {
      setLoading(true);
      setError(null);

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
        const doc = data.document;
        setItem(doc);
        setEditingImpact(doc.impact || null);
        setEditingStage(doc.stage);
        setEditingTopics(doc.topics || []);
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

  const handleSave = async () => {
    if (!item) return;
    
    setSaving(true);
    try {
      const response = await fetch(`/api/documents/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          impact: editingImpact,
          stage: editingStage || null,
          topics: editingTopics,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      const data = await response.json();
      setItem(data.document);
      setIsEditing(false);
    } catch (err) {
      console.error("Error saving document:", err);
      alert("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddTopic = (topic: string) => {
    if (!editingTopics.includes(topic)) {
      setEditingTopics([...editingTopics, topic]);
    }
  };

  const handleRemoveTopic = (topic: string) => {
    setEditingTopics(editingTopics.filter((t) => t !== topic));
  };

  const handleAddCustomTopic = () => {
    const trimmed = customTopic.trim();
    if (trimmed && !editingTopics.includes(trimmed)) {
      setEditingTopics([...editingTopics, trimmed]);
      setCustomTopic("");
    }
  };

  if (loading) {
    return (
      <main className="w-full py-8">
        <div className="text-sm text-[--color-muted]">Loading document...</div>
      </main>
    );
  }

  if (error || !item) {
    return (
      <main className="w-full py-8">
        <div className="text-sm text-[--color-foreground]">
          {error || "Document not found."}{" "}
          <Link className="text-[--color-brand-400] hover:underline" href="/search">
            Back to search
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full py-8">
      <div className="px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-[--color-foreground] mb-2">{item.title}</h1>
              <div className="text-[--color-muted] flex items-center gap-2">
                <span className="font-semibold">{item.entity}</span>
                <span>•</span>
                <span>{item.jurisdiction}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {item && state.briefItemIds.includes(item.id) ? (
                <Button variant="secondary" onClick={() => removeFromBrief(item.id)}>
                  Remove from Brief
                </Button>
              ) : (
                <Button variant="primary" onClick={() => addToBrief(item.id)}>
                  Add to Brief
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Document Info Grid */}
        <div className="mb-8 grid md:grid-cols-2 gap-6">
          {/* Basic Info Card */}
          <Card className="p-6">
            <div className="font-semibold text-[--color-foreground] mb-4">Document Information</div>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-[--color-muted] font-medium mb-1">Document Types</div>
                <div className="text-[--color-foreground]">{item.docTypes.join(", ") || "N/A"}</div>
              </div>
              <div>
                <div className="text-[--color-muted] font-medium mb-1">Meeting Date</div>
                <div className="text-[--color-foreground]">
                  {item.meetingDate
                    ? new Date(item.meetingDate).toLocaleDateString(undefined, {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Not specified"}
                </div>
              </div>
              <div>
                <div className="text-[--color-muted] font-medium mb-1">Counties</div>
                <div className="text-[--color-foreground]">{item.counties.join(", ") || "N/A"}</div>
              </div>
            </div>
          </Card>

          {/* Editable Signals Card */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold text-[--color-foreground]">Metadata</div>
              {!isEditing ? (
                <Button
                  variant="secondary"
                  onClick={() => setIsEditing(true)}
                >
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setIsEditing(false);
                      setEditingImpact(item.impact || null);
                      setEditingStage(item.stage);
                      setEditingTopics(item.topics || []);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-4 text-sm">
              {/* Impact Level */}
              <div>
                <div className="text-[--color-muted] font-medium mb-2">Impact Level</div>
                {isEditing ? (
                  <select
                    value={editingImpact || ""}
                    onChange={(e) =>
                      setEditingImpact(
                        e.target.value === "" ? null : (e.target.value as ImpactLevel)
                      )
                    }
                    className="w-full px-3 py-2 border border-white/10 rounded-md text-[--color-foreground] bg-white/5"
                  >
                    <option value="">None</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                ) : (
                  <div className="text-[--color-foreground]">
                    {item.impact ? <ImpactBadge level={item.impact} /> : <span>Not set</span>}
                  </div>
                )}
              </div>

              {/* Stage */}
              <div>
                <div className="text-[--color-muted] font-medium mb-2">Stage</div>
                {isEditing ? (
                  <select
                    value={editingStage || ""}
                    onChange={(e) =>
                      setEditingStage(e.target.value === "" ? undefined : e.target.value)
                    }
                    className="w-full px-3 py-2 border border-white/10 rounded-md text-[--color-foreground] bg-white/5"
                  >
                    <option value="">Not set</option>
                    {STAGE_OPTIONS.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-[--color-foreground]">{item.stage || "Not set"}</div>
                )}
              </div>

              {/* Topics */}
              <div>
                <div className="text-[--color-muted] font-medium mb-2">Topics</div>
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {editingTopics.map((topic) => (
                        <span
                          key={topic}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-[--color-brand-500]/20 text-[--color-brand-300] border border-[--color-brand-500]/30"
                        >
                          {formatTopicLabel(topic)}
                          <button
                            onClick={() => handleRemoveTopic(topic)}
                            className="text-[--color-brand-400] hover:text-[--color-brand-200]"
                            type="button"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs text-[--color-muted] font-medium">Add Standard Topic:</div>
                      <div className="flex flex-wrap gap-2">
                        {STANDARD_TOPICS.filter((t) => !editingTopics.includes(t)).map((topic) => (
                          <button
                            key={topic}
                            onClick={() => handleAddTopic(topic)}
                            className="px-2 py-1 text-xs border border-white/20 rounded hover:bg-white/10 text-[--color-muted]"
                            type="button"
                          >
                            + {formatTopicLabel(topic)}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customTopic}
                          onChange={(e) => setCustomTopic(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddCustomTopic();
                            }
                          }}
                          placeholder="Add custom topic..."
                          className="flex-1 px-3 py-2 border border-white/10 rounded-md text-[--color-foreground] bg-white/5 text-sm"
                        />
                        <Button
                          variant="secondary"
                          onClick={handleAddCustomTopic}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {item.topics.length > 0 ? (
                      item.topics.map((topic) => (
                        <span
                          key={topic}
                          className="inline-block px-3 py-1 rounded-full text-xs bg-[--color-brand-500]/20 text-[--color-brand-300] border border-[--color-brand-500]/30"
                        >
                          {formatTopicLabel(topic)}
                        </span>
                      ))
                    ) : (
                      <span className="text-[--color-muted] text-sm">No topics assigned</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Summary Section */}
        {item.summary && (
          <Card className="p-6 mb-8">
            <div className="font-semibold text-[--color-foreground] mb-3">Summary</div>
            <div className="text-[--color-muted] leading-relaxed">{item.summary}</div>
          </Card>
        )}

        {/* PDF Viewer Section */}
        {item.fileUrl && (
          <Card className="p-6 mb-8">
            <div className="font-semibold text-[--color-foreground] mb-3">Original Document</div>
            <div className="border border-white/10 rounded-lg overflow-hidden bg-white">
              <iframe
                src={`/api/documents/${item.id}/pdf`}
                className="w-full h-[800px]"
                title="Document PDF Viewer"
              />
            </div>
            <div className="mt-3 flex items-center gap-4 text-sm">
              <a
                href={`/api/documents/${item.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[--color-brand-400] hover:underline"
              >
                Open in new tab →
              </a>
              {item.fullText && (
                <button
                  onClick={() => {
                    const textSection = document.getElementById("full-text-section");
                    if (textSection) {
                      textSection.scrollIntoView({ behavior: "smooth" });
                    }
                  }}
                  className="text-[--color-brand-400] hover:underline"
                >
                  View plain text version ↓
                </button>
              )}
            </div>
          </Card>
        )}

        {/* Full Text Section (collapsible alternative) */}
        {item.fullText && (
          <div id="full-text-section">
            <Card className="p-6 mb-8">
              <div className="font-semibold text-[--color-foreground] mb-3">Full Document Text</div>
              <div className="text-[--color-muted] leading-relaxed whitespace-pre-wrap max-h-[600px] overflow-y-auto">
                {item.fullText}
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
  if (level === "High")
    return <Badge color="danger">High</Badge>;
  if (level === "Medium")
    return <Badge color="warning">Medium</Badge>;
  return <Badge color="success">Low</Badge>;
}
