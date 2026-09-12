import type { PillarKey } from "@climate/contract";

/**
 * Assessment criteria drawn from the AASB S2 / TCFD requirements (spec §4.2).
 * These are interpolated into each pillar's prompt so the completeness rating is
 * an assessment against real disclosure requirements rather than a vibe.
 */
export const PILLAR_RUBRIC: Record<PillarKey, string[]> = {
  governance: [
    "Identifies the specific board or board committee with oversight of climate-related risks and opportunities.",
    "States how often that body considers climate matters.",
    "Describes management's role in assessing and managing climate risks, including named roles or positions.",
    "Describes the reporting line from management to the board on climate matters.",
    "Discloses whether the board has relevant climate skills or expertise, or how it accesses them.",
    "States whether climate-related performance is reflected in remuneration or incentives.",
    "Describes how the board oversees progress against climate targets.",
  ],
  strategy: [
    "Identifies specific climate-related physical risks relevant to the business.",
    "Identifies specific climate-related transition risks (policy, legal, technology, market, reputation).",
    "Identifies climate-related opportunities.",
    "Defines the short, medium and long-term time horizons used, with actual years.",
    "Describes the effect of climate risks and opportunities on the business model and value chain.",
    "Describes the effect on strategy and financial planning, including capital deployment.",
    "Discloses use of climate scenario analysis, naming the scenarios used.",
    "Includes a scenario consistent with limiting warming to 1.5°C or well below 2°C.",
    "Describes the resilience of the strategy under those scenarios.",
    "Discloses a transition plan, including key assumptions and dependencies.",
    "Quantifies current or anticipated financial effects of climate-related risks.",
  ],
  risk_management: [
    "Describes the process for identifying climate-related risks.",
    "Describes the process for assessing the magnitude and likelihood of those risks.",
    "States the materiality thresholds or prioritisation criteria applied.",
    "Describes the process for managing and mitigating identified climate risks.",
    "Explains how climate risk processes are integrated into overall enterprise risk management.",
    "Describes how climate-related opportunities are identified and assessed.",
    "States how often the risk identification and assessment processes are performed.",
  ],
  metrics_targets: [
    "Discloses absolute Scope 1 greenhouse gas emissions with units and reporting period.",
    "Discloses absolute Scope 2 emissions, stating location-based and/or market-based method.",
    "Discloses Scope 3 emissions, including which categories are covered.",
    "States the measurement methodology, standard (e.g. GHG Protocol) and consolidation boundary.",
    "Discloses climate-related targets, with a base year and a target year.",
    "States whether targets are absolute or intensity-based, and their scope coverage.",
    "Discloses progress against targets over time.",
    "Discloses any internal carbon price used.",
    "Discloses cross-industry metrics such as capital deployed toward climate risks and opportunities.",
    "States whether emissions data is externally assured, and to what level.",
  ],
};
