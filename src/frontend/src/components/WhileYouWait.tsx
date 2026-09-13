"use client";

import { useEffect, useState } from "react";
import { LEARN_CARDS } from "@/lib/learn";

const ROTATE_MS = 14000;

/**
 * Turns the analysis wait into something useful: short explainers on the same
 * AASB S2 criteria the report is being assessed against. Auto-advances, and
 * stops auto-advancing once the reader takes manual control.
 */
export function WhileYouWait() {
  const [i, setI] = useState(0);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    if (manual) return;
    const id = setInterval(() => setI((n) => (n + 1) % LEARN_CARDS.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [manual]);

  const card = LEARN_CARDS[i]!;

  return (
    <section className="wyw">
      <div className="wyw-head">
        <h2 className="eyebrow" style={{ margin: 0 }}>
          While you wait
        </h2>
        <div className="wyw-dots">
          {LEARN_CARDS.map((c, n) => (
            <button
              key={c.title}
              className="wyw-dot"
              aria-current={n === i}
              aria-label={`Show: ${c.title}`}
              onClick={() => {
                setI(n);
                setManual(true);
              }}
            />
          ))}
        </div>
      </div>

      {/* keyed so each card re-runs its entrance animation */}
      <article className="wyw-card" key={card.title}>
        <p className="wyw-tag">{card.tag}</p>
        <h3 className="wyw-title">{card.title}</h3>
        <p className="wyw-body">{card.body}</p>
        <div className="wyw-foot">
          <span className="wyw-src">
            {card.source} ·{" "}
            <a href={card.href} target="_blank" rel="noopener noreferrer">
              Read the source ↗
            </a>
          </span>
          <button
            className="btn btn-ghost"
            style={{ padding: "6px 12px", fontSize: 13 }}
            onClick={() => {
              setI((n) => (n + 1) % LEARN_CARDS.length);
              setManual(true);
            }}
          >
            Next
          </button>
        </div>
      </article>
    </section>
  );
}
