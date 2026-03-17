import * as d3 from "d3";
import type { GraphData, GraphNode } from "./types";

export type NodeStyle = "circular" | "title";

export interface RenderSettings {
  chargeStrength?: number;
  linkDistance?: number;
  history?: string[]; // recent pages, last = current
  dark?: boolean;
  fontFamily?: string;
  nodeStyle?: NodeStyle;
}

// ── Title-mode constants ──
const PAD_X = 0;
const PAD_Y = 0;
const FONT_MIN = 10;
const FONT_MAX = 18;
const BLOCKS_MIN = 1;
const BLOCKS_MAX = 100;

function titleFontSize(d: GraphNode): number {
  if (d.central) return FONT_MAX;
  const count = d.blockCount ?? BLOCKS_MIN;
  const t = Math.min(1, Math.max(0, (count - BLOCKS_MIN) / (BLOCKS_MAX - BLOCKS_MIN)));
  return FONT_MIN + (FONT_MAX - FONT_MIN) * Math.sqrt(t);
}

// ── History ring config ──
const RING_COLOR = "#ef7a1c";

export function renderGraph(
  container: HTMLElement,
  data: GraphData,
  onClickPage: (pageName: string) => void,
  settings: RenderSettings = {}
) {
  container.innerHTML = "";

  const width = container.clientWidth;
  const height = container.clientHeight;
  const style = settings.nodeStyle ?? "circular";

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height]);

  const g = svg.append("g");
  svg.call(
    d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on("zoom", (event) => g.attr("transform", event.transform)) as any
  );

  // Theme colors
  const dark = settings.dark ?? false;
  const colors = {
    nodeCentral: dark ? "#4a9ade" : "#045591",
    nodeFill: dark ? "#777" : "#999",
    nodeBorder: dark ? "#555" : "#ddd",
    textCentral: dark ? "#d4d4d4" : "#333",
    textNormal: dark ? "#d4d4d4" : "#333",
    linkStroke: dark ? "#555" : "#ccc",
    hoverAccent: dark ? "#4a9ade" : "#045591",
  };

  // History lookup
  const historyTail = (settings.history ?? []).slice(-5).reverse();
  const historyMap = new Map<string, number>();
  historyTail.forEach((name, i) => {
    const key = name.toLowerCase();
    if (!historyMap.has(key)) historyMap.set(key, i);
  });

  // Links
  const link = g
    .append("g")
    .attr("stroke", colors.linkStroke)
    .attr("stroke-opacity", 0.6)
    .selectAll("line")
    .data(data.links)
    .join("line")
    .attr("stroke-width", 1)
    .style("transition", "stroke-opacity 0.2s, stroke 0.2s");

  // Nodes
  const node = g
    .append("g")
    .selectAll<SVGGElement, GraphNode>("g")
    .data(data.nodes)
    .join("g")
    .attr("cursor", "pointer")
    .style("transition", "opacity 0.2s");

  // ── Dimensions map (used for title-mode collision and both modes for history rings) ──
  const dims = new Map<string, { w: number; h: number }>();

  const fontFamily = settings.fontFamily ?? "system-ui, -apple-system, sans-serif";

  if (style === "title") {
    renderTitleNodes(node, data, dims, historyMap, colors, fontFamily);
  } else {
    renderCircularNodes(node, data, dims, historyMap, colors);
  }

  // Click
  node.on("click", (_event, d) => onClickPage(d.name));

  // Hover highlight
  node
    .on("mouseenter", function (_event, d) {
      link.attr("stroke-opacity", 0.1);
      node.attr("opacity", 0.2);
      const connected = new Set<string>([d.id]);
      data.links.forEach((l) => {
        const src = typeof l.source === "string" ? l.source : (l.source as any).id;
        const tgt = typeof l.target === "string" ? l.target : (l.target as any).id;
        if (src === d.id) connected.add(tgt);
        if (tgt === d.id) connected.add(src);
      });
      node.filter((n) => connected.has(n.id)).attr("opacity", 1);
      link
        .filter((l) => {
          const src = typeof l.source === "string" ? l.source : (l.source as any).id;
          const tgt = typeof l.target === "string" ? l.target : (l.target as any).id;
          return src === d.id || tgt === d.id;
        })
        .attr("stroke-opacity", 0.8)
        .attr("stroke", colors.hoverAccent);
    })
    .on("mouseleave", function () {
      link.attr("stroke-opacity", 0.6).attr("stroke", colors.linkStroke);
      node.attr("opacity", 1);
    });

  // Simulation — title mode needs more space and stronger repulsion
  const isTitle = style === "title";
  const collisionForce = isTitle
    ? rectCollide(dims, 4)
    : d3.forceCollide<GraphNode>().radius(20);

  const linkDist = settings.linkDistance ?? (isTitle ? 120 : 80);
  const charge = settings.chargeStrength ?? (isTitle ? -400 : -200);

  const sim = d3
    .forceSimulation<GraphNode>(data.nodes)
    .force(
      "link",
      d3.forceLink<GraphNode, any>(data.links)
        .id((d) => d.id)
        .distance(linkDist)
    )
    .force("charge", d3.forceManyBody().strength(charge))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", collisionForce as any);

  sim.on("tick", () => {
    link
      .attr("x1", (d: any) => d.source.x)
      .attr("y1", (d: any) => d.source.y)
      .attr("x2", (d: any) => d.target.x)
      .attr("y2", (d: any) => d.target.y);
    node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
  });

  node.call(drag(sim) as any);
}

// ── Circular mode ──
function renderCircularNodes(
  node: d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown>,
  _data: GraphData,
  dims: Map<string, { w: number; h: number }>,
  historyMap: Map<string, number>,
  colors: Record<string, string>
) {
  const RING_LEVELS = [
    { strokeWidth: 6, opacity: 1.0 },
    { strokeWidth: 5, opacity: 0.8 },
    { strokeWidth: 4, opacity: 0.6 },
    { strokeWidth: 4, opacity: 0.4 },
    { strokeWidth: 4, opacity: 0.2 },
  ];

  node
    .append("circle")
    .attr("r", (d) => (d.central ? 12 : 4 + Math.min(d.degree * 1.5, 10)))
    .attr("fill", (d) => (d.central ? colors.nodeCentral : colors.nodeFill))
    .attr("stroke", "none")
    .attr("stroke-width", 0);

  // History rings
  node
    .filter((d) => historyMap.has(d.id.toLowerCase()))
    .append("circle")
    .attr("r", (d) => {
      const baseR = d.central ? 12 : 4 + Math.min(d.degree * 1.5, 10);
      const idx = historyMap.get(d.id.toLowerCase())!;
      return baseR + RING_LEVELS[idx].strokeWidth / 2 + 2;
    })
    .attr("fill", "none")
    .attr("stroke", RING_COLOR)
    .attr("stroke-width", (d) => RING_LEVELS[historyMap.get(d.id.toLowerCase())!].strokeWidth)
    .attr("stroke-opacity", (d) => RING_LEVELS[historyMap.get(d.id.toLowerCase())!].opacity);

  // Labels offset to the right
  node
    .append("text")
    .text((d) => d.name)
    .attr("x", (d) => (d.central ? 16 : 10))
    .attr("y", 4)
    .attr("font-size", (d) => (d.central ? "14px" : "11px"))
    .attr("font-weight", (d) => (d.central ? "bold" : "normal"))
    .attr("fill", colors.textNormal);

  // Store dims for collision (approximate)
  node.each((d) => {
    const r = d.central ? 12 : 4 + Math.min(d.degree * 1.5, 10);
    dims.set(d.id, { w: r * 2, h: r * 2 });
  });
}

// ── Title mode ──
function renderTitleNodes(
  node: d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown>,
  _data: GraphData,
  dims: Map<string, { w: number; h: number }>,
  historyMap: Map<string, number>,
  colors: Record<string, string>,
  fontFamily: string
) {
  // History color: nodes in history get orange tint, fading with recency
  const historyColor = (d: GraphNode): string | null => {
    const idx = historyMap.get(d.id.toLowerCase());
    if (idx === undefined) return null;
    const opacities = [1.0, 0.7, 0.5, 0.3, 0.15];
    return `rgba(239, 122, 28, ${opacities[idx]})`;
  };

  // Text labels — the only visible element per node
  const textEls = node
    .append("text")
    .text((d) => d.name)
    .attr("font-size", (d) => `${titleFontSize(d)}px`)
    .attr("font-weight", (d) => (d.central ? "bold" : "normal"))
    .attr("font-family", fontFamily)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "central")
    .attr("fill", (d) => {
      const hc = historyColor(d);
      if (hc) return hc;
      return d.central ? colors.nodeCentral : colors.textNormal;
    });

  // Measure bounding boxes for collision (rects are invisible)
  textEls.each(function (d) {
    const bbox = (this as SVGTextElement).getBBox();
    dims.set(d.id, {
      w: bbox.width + PAD_X * 2,
      h: bbox.height + PAD_Y * 2,
    });
  });
}

// ── Rectangular collision force ──
// Hard constraint: text boxes must never overlap.
// Runs multiple passes per tick to fully resolve collisions.
function rectCollide(
  dims: Map<string, { w: number; h: number }>,
  padding: number
) {
  let nodes: GraphNode[] = [];
  const ITERATIONS = 4; // passes per tick for convergence

  function force(_alpha: number) {
    for (let iter = 0; iter < ITERATIONS; iter++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i] as any;
          const b = nodes[j] as any;

          const da = dims.get(a.id) ?? { w: 40, h: 16 };
          const db = dims.get(b.id) ?? { w: 40, h: 16 };

          const halfW = (da.w + db.w) / 2 + padding;
          const halfH = (da.h + db.h) / 2 + padding;

          let dx = b.x - a.x;
          let dy = b.y - a.y;

          // Prevent exact overlap (jitter escape)
          if (dx === 0 && dy === 0) {
            dx = (Math.random() - 0.5) * 2;
            dy = (Math.random() - 0.5) * 2;
          }

          const overlapX = halfW - Math.abs(dx);
          const overlapY = halfH - Math.abs(dy);

          if (overlapX > 0 && overlapY > 0) {
            // Push along the axis with less overlap (full resolution)
            if (overlapX < overlapY) {
              const shift = overlapX * 0.5;
              const sx = dx > 0 ? shift : -shift;
              if (!a.fx) a.x -= sx;
              if (!b.fx) b.x += sx;
            } else {
              const shift = overlapY * 0.5;
              const sy = dy > 0 ? shift : -shift;
              if (!a.fy) a.y -= sy;
              if (!b.fy) b.y += sy;
            }
          }
        }
      }
    }
  }

  force.initialize = (n: GraphNode[]) => {
    nodes = n;
  };

  return force;
}

// ── Drag behavior ──
function drag(simulation: d3.Simulation<GraphNode, undefined>) {
  return d3
    .drag<SVGGElement, GraphNode>()
    .on("start", (event, d: any) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    })
    .on("drag", (event, d: any) => {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on("end", (event, d: any) => {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    });
}
