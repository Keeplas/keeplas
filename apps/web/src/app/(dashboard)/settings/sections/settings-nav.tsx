"use client";

import { cn } from "@keeplas/ui";
import { SECTIONS, type SectionId } from "./constants";

interface SettingsNavProps {
  activeSection: SectionId;
  onSelect: (id: SectionId) => void;
}

export function SettingsNav({ activeSection, onSelect }: SettingsNavProps) {
  return (
    <nav className="sticky top-14 md:top-0 z-20 bg-surface/80 backdrop-blur-xl -mx-6 md:mx-0 md:rounded-2xl overflow-x-auto">
      <ul className="flex items-center gap-1 py-3 px-6 md:px-4">
        {SECTIONS.map((section) => {
          const isActive = activeSection === section.id;
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={isActive ? "true" : undefined}
                onClick={() => onSelect(section.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-secondary",
                  isActive
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
                )}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={section.icon}
                  />
                </svg>
                {section.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
