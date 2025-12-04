"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { formatTopicLabel } from "@app/lib/format";

interface TopicPickerProps {
  /** Currently selected topic keys or freeform topics */
  selected: string[];
  /** Callback when selection changes */
  onChange: (topics: string[]) => void;
  /** Placeholder text for the input */
  placeholder?: string;
}

// Standard topics used across the app (same keys as on the item detail page)
const STANDARD_TOPICS: string[] = [
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

/**
 * TopicPicker - A searchable multi-select dropdown for topics
 *
 * Features:
 * - Type to search/filter standard topics
 * - Press Enter to add a custom topic
 * - Selected topics appear as removable tags
 */
export function TopicPicker({
  selected,
  onChange,
  placeholder = "Search or add topics...",
}: TopicPickerProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Available standard topics that are not already selected
  const availableStandard = STANDARD_TOPICS.filter((topic) => !selected.includes(topic));

  // Filter standard topics based on query
  const filteredStandard = availableStandard.filter((topic) =>
    formatTopicLabel(topic).toLowerCase().includes(query.toLowerCase())
  );

  const addTopic = useCallback(
    (topic: string) => {
      if (!selected.includes(topic)) {
        onChange([...selected, topic]);
      }
      setQuery("");
      setIsOpen(false);
      inputRef.current?.focus();
    },
    [selected, onChange]
  );

  const removeTopic = useCallback(
    (topic: string) => {
      onChange(selected.filter((t) => t !== topic));
    },
    [selected, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "Backspace" && query === "" && selected.length > 0) {
      // Remove last tag on backspace when input is empty
      removeTopic(selected[selected.length - 1]);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredStandard.length > 0) {
        // Prefer selecting the first matching standard topic
        addTopic(filteredStandard[0]);
      } else {
        const trimmed = query.trim();
        if (trimmed) {
          addTopic(trimmed);
        }
      }
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Selected tags and input container */}
      <div
        className="input flex flex-wrap gap-1.5 min-h-[38px] p-1.5 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {/* Selected topic tags */}
        {selected.map((topic) => (
          <span
            key={topic}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs
                       ring-2 ring-[--ring-color]
                       bg-[color-mix(in_oklab,var(--brand-500)_20%,transparent)]
                       border border-[color-mix(in_oklab,var(--brand-500)_40%,transparent)]
                       text-[--color-brand-100]"
          >
            {formatTopicLabel(topic)}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTopic(topic);
              }}
              className="hover:text-white focus:outline-none"
              aria-label={`Remove ${formatTopicLabel(topic)}`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}

        {/* Search / input */}
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
          className="flex-1 min-w-[160px] bg-transparent border-none outline-none text-sm
                     placeholder:text-gray-500"
          aria-label="Search topics"
          aria-expanded={isOpen}
          aria-autocomplete="list"
        />
      </div>

      {/* Dropdown with standard topics */}
      {isOpen && (
        <div
          className="absolute z-[9999] mt-1 w-full max-h-48 overflow-auto rounded-lg
                     border border-white/10 bg-[--color-surface] backdrop-blur-xl
                     shadow-lg shadow-black/20"
        >
          {filteredStandard.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400">
              {query ? "Press Enter to add custom topic" : "All standard topics selected"}
            </div>
          ) : (
            <ul role="listbox">
              {filteredStandard.map((topic) => (
                <li
                  key={topic}
                  role="option"
                  aria-selected={false}
                  onClick={() => addTopic(topic)}
                  className="px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-white/10"
                >
                  {formatTopicLabel(topic)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}


