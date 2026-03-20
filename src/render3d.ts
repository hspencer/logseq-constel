import ForceGraph3D from "3d-force-graph";
import * as THREE from "three";
import type { GraphData, GraphNode } from "./types";
import type { RenderSettings } from "./render";

const RING_COLOR = "#ef7a1c";

// Store active graph instance and event listeners for cleanup
let activeGraph: any = null;
let activeListeners: { event: string; fn: EventListener }[] = [];

export function cleanupGraph3D() {
  // Remove event listeners from previous render
  for (const { event, fn } of activeListeners) {
    document.removeEventListener(event, fn);
  }
  activeListeners = [];

  if (activeGraph) {
    activeGraph._destructor?.();
    activeGraph = null;
  }
}

export function renderGraph3D(
  container: HTMLElement,
  data: GraphData,
  onClickPage: (pageName: string) => void,
  settings: RenderSettings = {}
) {
  // Cleanup previous instance
  cleanupGraph3D();
  container.innerHTML = "";

  const width = container.clientWidth;
  const height = container.clientHeight;
  const dark = settings.dark ?? false;

  // Read CSS vars from #constel-root
  const rootEl = document.getElementById("constel-root");
  const cs = rootEl ? getComputedStyle(rootEl) : null;
  const cssVar = (name: string, fallback: string) =>
    cs?.getPropertyValue(name).trim() || fallback;

  const colors = {
    nodeCentral: cssVar("--node-central", dark ? "#4a9ade" : "#045591"),
    nodeFill: cssVar("--node-fill", dark ? "#777" : "#999"),
    linkStroke: cssVar("--link-stroke", dark ? "#555" : "#ccc"),
    text: cssVar("--text", dark ? "#d4d4d4" : "#333"),
    accent: cssVar("--accent", dark ? "#4a9ade" : "#045591"),
  };

  // History lookup for coloring
  const historyTail = (settings.history ?? []).slice(-5).reverse();
  const historyMap = new Map<string, number>();
  historyTail.forEach((name, i) => {
    const key = name.toLowerCase();
    if (!historyMap.has(key)) historyMap.set(key, i);
  });

  // Prepare data — 3d-force-graph mutates the data, so deep clone
  const nodes3d = data.nodes.map((n) => ({
    id: n.id,
    name: n.name,
    central: n.central,
    degree: n.degree,
    blockCount: n.blockCount ?? 1,
    properties: n.properties,
    matched: n.matched,
  }));

  const links3d = data.links.map((l) => ({
    source: typeof l.source === "string" ? l.source : (l.source as any).id,
    target: typeof l.target === "string" ? l.target : (l.target as any).id,
  }));

  // Node size based on blockCount
  const minBlocks = 1;
  const maxBlocks = 100;
  const minSize = 2;
  const maxSize = 8;

  function nodeSize(node: any): number {
    if (node.central) return maxSize + 2;
    const count = node.blockCount ?? minBlocks;
    const t = Math.min(1, Math.max(0, (count - minBlocks) / (maxBlocks - minBlocks)));
    return minSize + (maxSize - minSize) * Math.sqrt(t);
  }

  function nodeColor(node: any): string {
    if (node.central) return colors.nodeCentral;
    const histIdx = historyMap.get(node.id.toLowerCase());
    if (histIdx !== undefined) {
      const opacities = [1.0, 0.8, 0.6, 0.4, 0.2];
      return `rgba(239, 122, 28, ${opacities[histIdx]})`;
    }
    return colors.nodeFill;
  }

  // Create billboard sprite for each node: centered circle behind text, always facing camera
  function createNodeSprite(node: any): THREE.Group {
    const size = nodeSize(node);
    const color = nodeColor(node);
    const baseFontSize = settings.fontSize ?? 12;
    const spriteFontSize = node.central ? baseFontSize * 4.5 : baseFontSize * 3.3;
    const textColor = node.central ? colors.nodeCentral : colors.text;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const dpr = 2;
    const text = showTitles ? node.name : "";
    ctx.font = `${node.central ? "bold " : ""}${spriteFontSize * dpr}px system-ui, -apple-system, sans-serif`;
    const textMetrics = ctx.measureText(text);
    const textWidth = showTitles ? textMetrics.width : 0;
    const textHeight = spriteFontSize * dpr * 1.4;
    const circleRadius = size * dpr * 12;
    const padding = 8 * dpr;

    // Canvas sized to fit whichever is larger: circle or text
    const totalWidth = Math.max(circleRadius * 2, textWidth) + padding * 2;
    const totalHeight = Math.max(circleRadius * 2, textHeight) + padding * 2;
    canvas.width = totalWidth;
    canvas.height = totalHeight;

    const cx = totalWidth / 2;
    const cy = totalHeight / 2;

    // Re-set font after resize
    ctx.font = `${node.central ? "bold " : ""}${spriteFontSize * dpr}px system-ui, -apple-system, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    // Draw circle behind text if nodes visible
    if (showNodes) {
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(cx, cy, circleRadius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    // Draw text with opaque background pill for legibility
    if (showTitles) {
      const tm = ctx.measureText(text);
      const pillH = spriteFontSize * dpr * 1.2;
      const pillW = tm.width + 12 * dpr;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = dark ? "rgba(30,30,30,0.9)" : "rgba(255,255,255,0.9)";
      const rx = cx - pillW / 2, ry = cy - pillH / 2, rr = pillH / 2;
      ctx.beginPath();
      ctx.moveTo(rx + rr, ry);
      ctx.lineTo(rx + pillW - rr, ry);
      ctx.quadraticCurveTo(rx + pillW, ry, rx + pillW, ry + rr);
      ctx.lineTo(rx + pillW, ry + pillH - rr);
      ctx.quadraticCurveTo(rx + pillW, ry + pillH, rx + pillW - rr, ry + pillH);
      ctx.lineTo(rx + rr, ry + pillH);
      ctx.quadraticCurveTo(rx, ry + pillH, rx, ry + pillH - rr);
      ctx.lineTo(rx, ry + rr);
      ctx.quadraticCurveTo(rx, ry, rx + rr, ry);
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = 1.0;
      ctx.fillStyle = textColor;
      ctx.fillText(text, cx, cy);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      opacity: 1.0,
    });
    const sprite = new THREE.Sprite(spriteMaterial);

    const worldScale = totalWidth / (dpr * 8);
    const aspect = totalWidth / totalHeight;
    sprite.scale.set(worldScale, worldScale / aspect, 1);

    const group = new THREE.Group();
    group.add(sprite);
    return group;
  }

  const showEdges = settings.showEdges ?? true;
  const showNodes = settings.showNodes ?? true;
  const showTitles = settings.showTitles ?? true;

  const graph = ForceGraph3D()(container)
    .width(width)
    .height(height)
    .backgroundColor("rgba(0,0,0,0)")
    .graphData({ nodes: nodes3d, links: links3d })
    .nodeThreeObject((node: any) => createNodeSprite(node))
    .nodeThreeObjectExtend(false)
    .linkColor(() => showEdges ? colors.linkStroke : "rgba(0,0,0,0)")
    .linkOpacity(showEdges ? 0.4 : 0)
    .linkWidth(showEdges ? 0.5 : 0)
    .onNodeClick((node: any) => {
      if (node?.name) onClickPage(node.name);
    })
    .onNodeHover((node: any) => {
      container.style.cursor = node ? "pointer" : "default";
    })
    .controlType("orbit" as any)
    .enableNavigationControls(true);

  // Auto-fit after simulation settles
  setTimeout(() => {
    graph.zoomToFit(400, 60);
  }, 500);

  activeGraph = graph;

  // Listen for external zoom/center events from controls toolbar
  const onZoom = ((e: CustomEvent) => {
    const camera = graph.camera();
    const dist = camera.position.length();
    camera.position.setLength(e.detail === "in" ? dist * 0.67 : dist * 1.5);
  }) as EventListener;
  const onCenter = (() => {
    // Reset camera to look at origin, then fit all nodes
    graph.cameraPosition(
      { x: 0, y: 0, z: 200 },  // camera position
      { x: 0, y: 0, z: 0 },    // look-at
      600                        // transition ms
    );
    setTimeout(() => graph.zoomToFit(400, 40), 650);
  }) as EventListener;
  document.addEventListener("constel:zoom", onZoom);
  document.addEventListener("constel:center", onCenter);
  activeListeners = [
    { event: "constel:zoom", fn: onZoom },
    { event: "constel:center", fn: onCenter },
  ];
}
