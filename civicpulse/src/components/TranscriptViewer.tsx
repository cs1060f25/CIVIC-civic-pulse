"use client";

import { useState } from "react";
import { Button } from "./ui";

interface TranscriptData {
  title: string;
  date: string;
  speakers: string[];
  content: string[];
}

interface TranscriptViewerProps {
  onSummaryGenerated?: (summary: string) => void;
  onTranscriptLoaded?: (content: string[]) => void;
  userTopics?: string[];
}

export function TranscriptViewer({ onSummaryGenerated, onTranscriptLoaded, userTopics }: TranscriptViewerProps) {
  const [url, setUrl] = useState("");
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  const handleFetchTranscript = async () => {
    if (!url.trim()) {
      setError("Please enter a valid URL");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/fetch-transcript", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch transcript");
      }

      const data = await response.json();
      setTranscript(data.transcript);
      setError(null);

      // Notify parent of transcript content
      if (data.transcript && onTranscriptLoaded) {
        onTranscriptLoaded(data.transcript.content);
      }

      // Generate summary after successful transcript fetch
      if (data.transcript && onSummaryGenerated) {
        await generateSummary(data.transcript.content);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const generateSummary = async (transcriptContent: string[]) => {
    if (!onSummaryGenerated) return;

    setGeneratingSummary(true);
    try {
      const response = await fetch("/api/summarize-transcript", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          transcriptContent,
          userTopics: userTopics || []
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate summary");
      }

      const data = await response.json();

      // Add a note if this is a fallback summary
      let summaryText = data.summary;
      if (data.fallback) {
        const errorMsg = data.error ? ` (${data.error})` : '';
        summaryText = "🔄 **AI Service Unavailable**" + errorMsg + " - Showing generated summary:\n\n" + data.summary;
      }

      onSummaryGenerated(summaryText);
    } catch (err) {
      console.error("Summary generation error:", err);
      onSummaryGenerated("Failed to generate summary. Please try again.");
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleClear = () => {
    setUrl("");
    setTranscript(null);
    setError(null);
  };

  return (
    <div className="space-y-5">
      {/* URL Input Section */}
      <div className="rounded-xl border-2 border-[--color-accent-cyan]/20 bg-gradient-to-br from-[--color-surface-elevated] to-[--color-surface] p-5 shadow-lg">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 text-[--color-accent-cyan]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <label className="block text-sm font-bold text-[--color-accent-cyan]">
            Load Municipal Transcript
          </label>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">Beta</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://watertown.munitrac.ai/transcript?id=..."
            className="flex-1 px-4 py-2.5 bg-[--color-surface-2] border-2 border-[--color-accent-cyan]/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[--color-accent-cyan] focus:border-[--color-accent-cyan] transition-all"
            disabled={loading || generatingSummary}
          />
          <Button 
            onClick={handleFetchTranscript} 
            disabled={loading || generatingSummary || !url.trim()}
            variant="primary"
          >
            {loading ? "Loading..." : generatingSummary ? "Generating Summary..." : "Load"}
          </Button>
          {transcript && (
            <Button onClick={handleClear} variant="ghost">
              Clear
            </Button>
          )}
        </div>
        {error && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}
      </div>

      {/* Transcript Display */}
      {transcript && (
        <div className="space-y-5">
          {/* Header Info */}
          <div className="rounded-xl border-2 border-[--color-accent-emerald]/20 bg-gradient-to-br from-[--color-surface-elevated] to-[--color-surface] p-5 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[--color-accent-emerald]/10 border border-[--color-accent-emerald]/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[--color-accent-emerald]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-[--color-brand-100] mb-1">
                  {transcript.title}
                </h3>
                {transcript.date && (
                  <p className="text-sm text-[--color-muted] flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {transcript.date}
                  </p>
                )}
              </div>
            </div>
            {transcript.speakers.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-xs uppercase tracking-wider font-bold text-[--color-accent-emerald] mb-2">
                  Speakers ({transcript.speakers.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {transcript.speakers.map((speaker, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 text-xs font-medium rounded-full bg-[--color-accent-emerald]/10 text-emerald-200 border border-[--color-accent-emerald]/30"
                    >
                      {speaker}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Transcript Content */}
          <div className="rounded-xl border border-white/10 bg-[--color-surface-elevated]/50 p-5 shadow-md">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
              <svg className="w-4 h-4 text-[--color-brand-300]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h4 className="text-sm font-bold text-[--color-brand-200]">Full Transcript</h4>
              <span className="ml-auto text-xs text-[--color-muted]">{transcript.content.length} lines</span>
            </div>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {transcript.content.map((line, idx) => (
                <p key={idx} className="text-sm leading-relaxed text-[--color-foreground]/90 hover:text-[--color-foreground] transition-colors">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!transcript && !loading && !error && (
        <div className="rounded-xl border-2 border-dashed border-white/10 bg-white/5 p-10 text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-[--color-muted]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <p className="text-sm text-[--color-muted] mb-2">
            Enter a municipal transcript URL above to load and view the content
          </p>
          <p className="text-xs text-[--color-muted]/70">
            Example: https://watertown.munitrac.ai/transcript?id=...
          </p>
        </div>
      )}
    </div>
  );
}
