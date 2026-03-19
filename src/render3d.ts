import ForceGraph3D from "3d-force-graph";
import * as THREE from "three";
import type { GraphData, GraphNode } from "./types";
import type { RenderSettings } from "./render";

const RING_COLOR = "#ef7a1c";

// Store active graph instance for cleanup
let activeGraph: any = null;

export function cleanupGraph3D() {
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
    const fontSize = node.central ? 56 : 40;
    const textColor = node.central ? colors.nodeCentral : colors.text;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const dpr = 2;
    const text = node.name;
    ctx.font = `${node.central ? "bold " : ""}${fontSize * dpr}px system-ui, -apple-system, sans-serif`;
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;
    const textHeight = fontSize * dpr * 1.4;
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
    ctx.font = `${node.central ? "bold " : ""}${fontSize * dpr}px system-ui, -apple-system, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    // Draw circle centered behind text (30% opacity)
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(cx, cy, circleRadius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Draw text centered on top (100% opacity)
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = textColor;
    ctx.fillText(text, cx, cy);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(spriteMaterial);

    const worldScale = totalWidth / (dpr * 8);
    const aspect = totalWidth / totalHeight;
    sprite.scale.set(worldScale, worldScale / aspect, 1);

    const group = new THREE.Group();
    group.add(sprite);
    return group;
  }

  const graph = ForceGraph3D()(container)
    .width(width)
    .height(height)
    .backgroundColor("rgba(0,0,0,0)")
    .graphData({ nodes: nodes3d, links: links3d })
    .nodeThreeObject((node: any) => createNodeSprite(node))
    .nodeThreeObjectExtend(false)
    .linkColor(() => colors.linkStroke)
    .linkOpacity(0.4)
    .linkWidth(0.5)
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

  // Zoom controls
  const controls = document.createElement("div");
  controls.className = "constel-zoom-controls";

  const btnPlus = document.createElement("button");
  btnPlus.textContent = "+";
  btnPlus.title = "Zoom in";
  btnPlus.setAttribute("aria-label", "Zoom in");

  const btnMinus = document.createElement("button");
  btnMinus.textContent = "\u2212";
  btnMinus.title = "Zoom out";
  btnMinus.setAttribute("aria-label", "Zoom out");

  const btnFit = document.createElement("button");
  btnFit.textContent = "\u2300";
  btnFit.title = "Fit to view";
  btnFit.setAttribute("aria-label", "Fit to view");

  controls.append(btnPlus, btnMinus, btnFit);
  container.appendChild(controls);

  btnPlus.addEventListener("click", () => {
    const camera = graph.camera();
    const dist = camera.position.length();
    camera.position.setLength(dist * 0.67);
  });

  btnMinus.addEventListener("click", () => {
    const camera = graph.camera();
    const dist = camera.position.length();
    camera.position.setLength(dist * 1.5);
  });

  btnFit.addEventListener("click", () => {
    graph.zoomToFit(400, 60);
  });
}
