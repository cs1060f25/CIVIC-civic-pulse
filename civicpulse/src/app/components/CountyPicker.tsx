"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface CountyPickerProps {
  /** Currently selected counties */
  selected: string[];
  /** Callback when selection changes */
  onChange: (counties: string[]) => void;
  /** Placeholder text for the input */
  placeholder?: string;
}

/**
 * CountyPicker - A searchable multi-select dropdown for counties
 * 
 * Features:
 * - Type to search/filter available counties
 * - Click to add from dropdown
 * - Selected counties appear as removable tags
 * - Fetches available counties from /api/counties
 */
export function CountyPicker({ selected, onChange, placeholder = "Search counties..." }: CountyPickerProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [allCounties, setAllCounties] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch available counties on mount
  useEffect(() => {
    async function fetchCounties() {
      try {
        const response = await fetch("/api/counties");
        if (response.ok) {
          const data = await response.json();
          setAllCounties(data.counties || []);
        }
      } catch (err) {
        console.error("Failed to fetch counties:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCounties();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter counties based on query, excluding already selected
  const filteredCounties = allCounties.filter(
    (county) =>
      !selected.includes(county) &&
      county.toLowerCase().includes(query.toLowerCase())
  );

  // Add a county to selection
  const addCounty = useCallback((county: string) => {
    if (!selected.includes(county)) {
      onChange([...selected, county]);
    }
    setQuery("");
    setIsOpen(false);
    inputRef.current?.focus();
  }, [selected, onChange]);

  // Remove a county from selection
  const removeCounty = useCallback((county: string) => {
    onChange(selected.filter((c) => c !== county));
  }, [selected, onChange]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "Backspace" && query === "" && selected.length > 0) {
      // Remove last tag on backspace when input is empty
      removeCounty(selected[selected.length - 1]);
    } else if (e.key === "Enter" && filteredCounties.length > 0) {
      e.preventDefault();
      addCounty(filteredCounties[0]);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Selected tags and input container */}
      <div
        className="input flex flex-wrap gap-1.5 min-h-[38px] p-1.5 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {/* Selected county tags - styled to match document type chips */}
        {selected.map((county) => (
          <span
            key={county}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs
                       ring-2 ring-[--ring-color]
                       bg-[color-mix(in_oklab,var(--brand-500)_20%,transparent)]
                       border border-[color-mix(in_oklab,var(--brand-500)_40%,transparent)]
                       text-[--color-brand-100]"
          >
            {county}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeCounty(county);
              }}
              className="hover:text-white focus:outline-none"
              aria-label={`Remove ${county}`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        
        {/* Search input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selected.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm
                     placeholder:text-gray-500"
          aria-label="Search counties"
          aria-expanded={isOpen}
          aria-autocomplete="list"
        />
      </div>

      {/* Dropdown - z-[9999] to appear above date picker popper */}
      {isOpen && (
        <div
          className="absolute z-[9999] mt-1 w-full max-h-48 overflow-auto rounded-lg
                     border border-white/10 bg-[--color-surface] backdrop-blur-xl
                     shadow-lg shadow-black/20"
        >
          {loading ? (
            <div className="px-3 py-2 text-sm text-gray-400">Loading...</div>
          ) : filteredCounties.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400">
              {query ? "No matching counties" : "All counties selected"}
            </div>
          ) : (
            <ul role="listbox">
              {filteredCounties.map((county, index) => (
                <li
                  key={county}
                  role="option"
                  aria-selected={false}
                  onClick={() => addCounty(county)}
                  className={`px-3 py-2 text-sm cursor-pointer transition-colors
                             hover:bg-white/10 ${index === 0 && query ? "bg-white/5" : ""}`}
                >
                  {/* Highlight matching text */}
                  {query ? (
                    <HighlightMatch text={county} query={query} />
                  ) : (
                    county
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Helper to highlight matching text in dropdown */
function HighlightMatch({ text, query }: { text: string; query: string }) {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerText.indexOf(lowerQuery);

  if (matchIndex === -1) return <>{text}</>;

  const before = text.slice(0, matchIndex);
  const match = text.slice(matchIndex, matchIndex + query.length);
  const after = text.slice(matchIndex + query.length);

  return (
    <>
      {before}
      <span className="text-[--color-brand-300] font-medium">{match}</span>
      {after}
    </>
  );
}

