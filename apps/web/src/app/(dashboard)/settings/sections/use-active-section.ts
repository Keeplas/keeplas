"use client";

import { useEffect, useState } from "react";
import { SECTIONS, type SectionId } from "./constants";

export function useActiveSection(): [SectionId, (id: SectionId) => void] {
  const [activeSection, setActiveSection] = useState<SectionId>(SECTIONS[0].id);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id as SectionId);
      },
      {
        rootMargin: "-30% 0px -55% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    SECTIONS.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  return [activeSection, setActiveSection];
}
