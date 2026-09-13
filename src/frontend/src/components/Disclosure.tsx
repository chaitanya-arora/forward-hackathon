"use client";

import { useState } from "react";
import { ChevronDownIcon } from "@/components/icons";

export interface DisclosureItem {
  title: string;
  teaser: string;
  body: string;
  Icon: React.ComponentType<{ className?: string }>;
}

/**
 * A card that opens to reveal its full explanation, closed by default. Used
 * where a section would otherwise read as a wall of five or six paragraphs
 * at once — the teaser gives the gist, and only a reader who wants the detail
 * has to look at it.
 */
export function Disclosure({ item }: { item: DisclosureItem }) {
  const [open, setOpen] = useState(false);
  const { Icon } = item;

  return (
    <div className={`disclosure${open ? " is-open" : ""}`}>
      <button
        className="disclosure-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="disclosure-icon">
          <Icon />
        </span>
        <span className="disclosure-title-block">
          <span className="disclosure-title">{item.title}</span>
          {!open && <span className="disclosure-teaser">{item.teaser}</span>}
        </span>
        <span className="disclosure-chevron">
          <ChevronDownIcon />
        </span>
      </button>

      <div className="disclosure-body" hidden={!open}>
        <p>{item.body}</p>
      </div>
    </div>
  );
}
