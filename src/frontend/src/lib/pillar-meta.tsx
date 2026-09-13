import type { ComponentType, SVGProps } from "react";
import type { AASB_SECTION_KEYS } from "@/lib/assessment-types";
import { AlertTriangleIcon, BarChartIcon, CompassIcon, InfoIcon, ShieldIcon } from "@/components/icons";

/**
 * A distinct identity colour and icon per AASB S2 section, used consistently
 * across the About page and the report itself — so "this is Governance"
 * reads the same way everywhere without relying on the label text alone.
 * Deliberately a different palette from the present/partial/missing rating
 * colours: section identity and completeness status are two different axes
 * and must not be visually confused with each other.
 */
export const PILLAR_META: Record<
  (typeof AASB_SECTION_KEYS)[number],
  { colorVar: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }
> = {
  governance: { colorVar: "var(--pillar-governance)", Icon: ShieldIcon },
  strategy: { colorVar: "var(--pillar-strategy)", Icon: CompassIcon },
  riskManagement: { colorVar: "var(--pillar-risk)", Icon: AlertTriangleIcon },
  metricsAndTargets: { colorVar: "var(--pillar-metrics)", Icon: BarChartIcon },
  generalRequirements: { colorVar: "var(--pillar-general)", Icon: InfoIcon },
};
