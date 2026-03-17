import * as d3 from "d3";
import type { GraphData, GraphNode } from "./types";

export function renderGraph(
  container: HTMLElement,
  data: GraphData,
  onClickPage: (pageName: string) => void
) {
  // Clear previous render
  container.innerHTML = "";

  const width = container.clientWidth;
  const height = container.clientHeight;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height]);

  // Zoom
  const g = svg.append("g");
  svg.call(
    d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      }) as any
  );

  const simulation = d3
    .forceSimulation<GraphNode>(data.nodes)
    .force(
      "link",
      d3
        .forceLink<GraphNode, any>(data.links)
        .id((d) => d.id)
        .distance(80)
    )
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(20));

  // Links
  const link = g
    .append("g")
    .attr("stroke", "var(--ls-border-color, #ccc)")
    .attr("stroke-opacity", 0.6)
    .selectAll("line")
    .data(data.links)
    .join("line")
    .attr("stroke-width", 1);

  // Nodes
  const node = g
    .append("g")
    .selectAll<SVGGElement, GraphNode>("g")
    .data(data.nodes)
    .join("g")
    .attr("cursor", "pointer")
    .call(drag(simulation) as any);

  // Node circles
  node
    .append("circle")
    .attr("r", (d) => (d.central ? 12 : 4 + Math.min(d.degree * 1.5, 10)))
    .attr("fill", (d) =>
      d.central
        ? "var(--ls-link-text-color, #045591)"
        : "var(--ls-secondary-text-color, #999)"
    )
    .attr("stroke", (d) =>
      d.central ? "var(--ls-link-text-color, #045591)" : "none"
    )
    .attr("stroke-width", (d) => (d.central ? 3 : 0))
    .attr("stroke-opacity", 0.3);

  // Labels
  node
    .append("text")
    .text((d) => d.name)
    .attr("x", (d) => (d.central ? 16 : 10))
    .attr("y", 4)
    .attr("font-size", (d) => (d.central ? "14px" : "11px"))
    .attr("font-weight", (d) => (d.central ? "bold" : "normal"))
    .attr("fill", "var(--ls-primary-text-color, #333)");

  // Click to navigate
  node.on("click", (_event, d) => {
    onClickPage(d.name);
  });

  // Hover highlight
  node
    .on("mouseenter", function (_event, d) {
      // Dim everything
      link.attr("stroke-opacity", 0.1);
      node.attr("opacity", 0.2);

      // Highlight connected
      const connected = new Set<string>();
      connected.add(d.id);
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
        .attr("stroke", "var(--ls-link-text-color, #045591)");
    })
    .on("mouseleave", function () {
      link
        .attr("stroke-opacity", 0.6)
        .attr("stroke", "var(--ls-border-color, #ccc)");
      node.attr("opacity", 1);
    });

  // Tick
  simulation.on("tick", () => {
    link
      .attr("x1", (d: any) => d.source.x)
      .attr("y1", (d: any) => d.source.y)
      .attr("x2", (d: any) => d.target.x)
      .attr("y2", (d: any) => d.target.y);

    node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
  });
}

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
