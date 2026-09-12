import type { ComponentType, SVGProps } from "react";
import type { PillarKey } from "@climate/contract";
import { AlertTriangleIcon, BarChartIcon, CompassIcon, ShieldIcon } from "@/components/icons";

/**
 * A distinct identity colour and icon per pillar, used consistently across
 * the About page, the report itself, and the landing preview — so "this is
 * Governance" reads the same way everywhere without relying on the label
 * text alone. Deliberately a different palette from the strong/partial/
 * missing rating colours: pillar identity and completeness rating are two
 * different axes and must not be visually confused with each other.
 */
export const PILLAR_META: Record<
  PillarKey,
  { colorVar: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }
> = {
  governance: { colorVar: "var(--pillar-governance)", Icon: ShieldIcon },
  strategy: { colorVar: "var(--pillar-strategy)", Icon: CompassIcon },
  risk_management: { colorVar: "var(--pillar-risk)", Icon: AlertTriangleIcon },
  metrics_targets: { colorVar: "var(--pillar-metrics)", Icon: BarChartIcon },
};
