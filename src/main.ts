import "@logseq/libs";
import { buildGraph } from "./graph";
import { renderGraph } from "./render";
import { applyQuery } from "./query";
import CSS from "./styles";
import type { GraphData } from "./types";

interface State {
  active: boolean;
  currentPage: string | null;
  query: Record<string, any>;
  graphData: GraphData | null;
  history: string[];
  activeFilters: Map<string, string>; // property key:value toggles
  dark: boolean;
  splitPct: number;
}

const state: State = {
  active: false,
  currentPage: null,
  query: {},
  graphData: null,
  history: [],
  activeFilters: new Map(),
  dark: false,
  splitPct: 50,
};

function createModel() {
  return {
    toggleConstel() {
      console.log("[constel] toggle");
      state.active ? deactivate() : activate();
    },
  };
}

function main() {
  logseq.useSettingsSchema([
    {
      key: "graphDepth",
      type: "number",
      default: 2,
      title: "Graph depth (degrees of separation)",
      description:
        "1 = direct connections only, 2 = connections of connections, etc.",
    },
    {
      key: "chargeStrength",
      type: "number",
      default: -200,
      title: "Repulsion force",
      description: "More negative = more spread out.",
    },
    {
      key: "linkDistance",
      type: "number",
      default: 80,
      title: "Link distance (px)",
      description: "Ideal distance between connected nodes.",
    },
    {
      key: "nodeStyle",
      type: "enum",
      default: "circular",
      title: "Node style",
      description: "circular: classic dots with labels. title: text rectangles sized by page length.",
      enumChoices: ["circular", "title"],
      enumPicker: "radio",
    },
  ]);

  // Inject styles into the plugin iframe
  const styleEl = document.createElement("style");
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  // Transparent background; position/size managed in activate()/deactivate()
  logseq.setMainUIInlineStyle({
    background: "transparent",
  });

  // Toolbar button
  logseq.App.registerUIItem("toolbar", {
    key: "constel-toggle",
    template: `
      <a data-on-click="toggleConstel" class="button" title="Con§tel">
        <svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M350.2,329.3c9.8-7.3,18-16.1,24.6-26.4,9.2-14.3,13.8-30.3,13.8-47.4s-4.6-32.1-13.8-46.4c-8.9-13.9-20.8-25.2-35.5-33.5-14.8-8.4-31-12.6-48.1-12.6h-61c-9,0-17.1-2.1-24.5-6.3-7.5-4.2-13.4-9.8-17.8-17.1-4.3-7-6.4-14.4-6.4-22.5s2-15.5,6.2-22.4c4.3-7,10.1-12.5,17.7-16.7,7.7-4.3,15.8-6.3,24.9-6.3h116.7V24.7h-116.7c-17.4,0-33.6,4.1-48.4,12.3-14.8,8.1-26.7,19.4-35.5,33.4-8.9,14.3-13.5,30-13.5,46.7s4.5,32.4,13.5,46.7c4.3,6.9,9.3,13.1,15.1,18.6-9.9,7.3-18.2,16.1-24.7,26.4-9,14.2-13.5,30-13.5,47.1s4.5,32.4,13.5,46.7c8.7,14,20.6,25.3,35.3,33.6,14.8,8.4,31.1,12.6,48.5,12.6h61c9,0,17.1,2.1,24.6,6.3,7.5,4.2,13.4,9.8,17.8,17.1,4.3,7,6.4,14.4,6.4,22.5s-2.1,15.4-6.4,22.2c-4.5,7.1-10.3,12.7-17.9,17-7.5,4.2-15.5,6.3-24.5,6.3h-121.5v47.1h121.5c17.1,0,33.2-4.2,48-12.6,14.6-8.3,26.6-19.5,35.5-33.5,9.2-14.3,13.8-30,13.8-46.4s-4.6-33-13.8-47.4c-4.3-6.7-9.3-12.8-14.9-18.2ZM178.2,233.3c4.5-7.1,10.3-12.7,17.9-17,7.5-4.2,15.5-6.3,24.5-6.3h70.6c9,0,17.1,2.1,24.5,6.3,7.6,4.3,13.4,9.8,17.9,17,4.3,6.8,6.3,14.1,6.3,22.2s-2.1,15.5-6.4,22.5c-4.5,7.3-10.3,12.9-17.8,17.1-7.5,4.2-15.5,6.3-24.5,6.3h-70.6c-9,0-17.1-2.1-24.5-6.3-7.5-4.2-13.4-9.8-17.8-17.1-4.3-7-6.4-14.4-6.4-22.5s2.1-15.4,6.4-22.2Z"/></svg>
      </a>
    `,
  });

  logseq.App.registerCommandPalette(
    {
      key: "constel-toggle-cmd",
      label: "Con§tel: Toggle graph view",
      keybinding: { binding: "mod+shift+." },
    },
    () => {
      state.active ? deactivate() : activate();
    }
  );

  logseq.App.onRouteChanged(async ({ path }) => {
    if (!state.active) return;
    const match = path.match(/\/page\/(.+)/);
    if (!match) return;
    const page = decodeURIComponent(match[1]);
    // Guard: don't re-navigate if already on this page
    if (page.toLowerCase() === state.currentPage?.toLowerCase()) return;
    await navigateTo(page);
  });

  // Listen for theme changes via official API
  logseq.App.onThemeModeChanged(({ mode }) => {
    const wasDark = state.dark;
    state.dark = mode === "dark";
    if (state.dark !== wasDark && state.active) {
      const root = document.getElementById("constel-root");
      if (root) root.className = state.dark ? "dark" : "";
      refreshGraph();
    }
  });

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.active) {
      deactivate();
    }
  });

  console.log("[constel] ready");
}

/** Inject layout CSS into LogSeq's parent document via official API.
 *  Uses :has() so styles auto-activate/deactivate with .visible class. */
function provideLayoutStyle(pct: number) {
  const sel = "#logseq-constel_lsp_main.visible";
  logseq.provideStyle(`
    body:has(${sel}) #main-content-container {
      margin-left: ${pct}vw !important;
      width: ${100 - pct}vw !important;
    }
    body:has(${sel}) #main-content-container .cp__sidebar-main-content {
      max-width: 100% !important;
      padding-left: 24px !important;
      padding-right: 24px !important;
    }
    body:has(${sel}) #main-content-container #main-content-container,
    body:has(${sel}) #main-content-container .page,
    body:has(${sel}) #main-content-container .ls-page-title,
    body:has(${sel}) #main-content-container .editor-inner {
      max-width: 100% !important;
    }
  `);
}

async function activate() {
  state.active = true;

  // Detect theme via official API
  const configs = await logseq.App.getUserConfigs();
  state.dark = configs.preferredThemeMode === "dark";
  console.log("[constel] activating, dark:", state.dark);

  // Close left sidebar via official API
  logseq.App.setLeftSidebarVisible(false);

  let pageName: string | null = null;

  const page = await logseq.Editor.getCurrentPage();
  if (page && "name" in page) {
    pageName = page.name as string;
  }

  if (!pageName) {
    const d = new Date();
    const journals = [
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`,
    ];
    for (const jName of journals) {
      const jPage = await logseq.Editor.getPage(jName);
      if (jPage) {
        pageName = jPage.name;
        break;
      }
    }
  }

  if (!pageName) {
    const allPages = await logseq.Editor.getAllPages();
    if (allPages && allPages.length > 0) {
      const nonJournal = allPages.find((p) => !(p as any)["journal?"]);
      pageName = (nonJournal || allPages[0]).name;
    }
  }

  if (!pageName) {
    console.warn("[constel] no page found");
    state.active = false;
    return;
  }

  console.log("[constel] page:", pageName);

  // Build the UI — graph panel only (right side shows native LogSeq)
  const app = document.getElementById("app")!;
  app.innerHTML = `
    <div id="constel-root" class="${state.dark ? "dark" : ""}">
      <div id="constel-panel">
        <div id="constel-props"></div>
        <div id="constel-history"></div>
        <div id="constel-graph"></div>
      </div>
      <div id="constel-resize-handle"></div>
    </div>
  `;

  // Resize handle drag
  initResize();

  // Show the plugin iframe and position for split-view
  logseq.showMainUI({ autoFocus: true });

  state.splitPct = 50;
  logseq.setMainUIInlineStyle({
    position: "fixed",
    top: "0",
    left: "0",
    right: "auto",
    width: `${state.splitPct}vw`,
    height: "100vh",
    zIndex: "9",
    pointerEvents: "auto",
  });

  // Push LogSeq main content to the right
  provideLayoutStyle(state.splitPct);

  await navigateTo(pageName);
}

function deactivate() {
  console.log("[constel] deactivating");
  state.active = false;
  state.currentPage = null;
  state.graphData = null;
  state.query = {};
  state.history = [];
  state.activeFilters.clear();
  state.dark = false;

  // Reset container styles — layout CSS auto-deactivates via :has(.visible)
  logseq.setMainUIInlineStyle({
    position: "",
    top: "",
    left: "",
    right: "",
    width: "",
    height: "",
    zIndex: "",
    pointerEvents: "",
  });

  logseq.hideMainUI();
  const app = document.getElementById("app");
  if (app) app.innerHTML = "";
}

async function navigateTo(pageName: string) {
  state.currentPage = pageName;

  // Navigate LogSeq's native editor to this page
  await logseq.App.pushState("page", { name: pageName });

  // Track history (no duplicates, move to end if revisited)
  const idx = state.history.indexOf(pageName);
  if (idx !== -1) state.history.splice(idx, 1);
  state.history.push(pageName);
  if (state.history.length > 20) state.history.shift();
  renderHistory();

  const depth = (logseq.settings?.graphDepth as number) ?? 2;
  state.graphData = await buildGraph(pageName, depth);

  // Update property switches for the central node
  renderProps();

  refreshGraph();
}

function renderHistory() {
  const container = document.getElementById("constel-history");
  if (!container) return;
  container.innerHTML = "";
  for (const name of state.history) {
    const pill = document.createElement("button");
    pill.className = "constel-pill";
    if (name === state.currentPage) pill.classList.add("active");
    pill.textContent = name;
    pill.addEventListener("click", () => navigateTo(name));
    container.appendChild(pill);
  }
  // Scroll to end
  container.scrollLeft = container.scrollWidth;
}

function renderProps() {
  const container = document.getElementById("constel-props");
  if (!container) return;
  container.innerHTML = "";

  if (!state.graphData) return;

  const centralNode = state.graphData.nodes.find((n) => n.central);
  if (!centralNode?.properties) return;

  for (const [key, val] of Object.entries(centralNode.properties)) {
    if (key === "id") continue;
    const valStr = String(val);
    const filterKey = `${key}:${valStr}`;
    const isActive = state.activeFilters.has(filterKey);

    const sw = document.createElement("label");
    sw.className = "constel-switch" + (isActive ? " active" : "");
    sw.innerHTML = `
      <span class="constel-switch-key">${escapeHtml(key)}</span>
      <span class="constel-switch-val">${escapeHtml(valStr)}</span>
      <span class="constel-switch-toggle">
        <span class="constel-switch-knob"></span>
      </span>
    `;
    sw.addEventListener("click", () => {
      if (state.activeFilters.has(filterKey)) {
        state.activeFilters.delete(filterKey);
      } else {
        state.activeFilters.set(filterKey, filterKey);
      }
      renderProps();
      refreshGraph();
    });
    container.appendChild(sw);
  }
}

function refreshGraph() {
  if (!state.graphData || !state.currentPage) return;

  const cloned: GraphData = JSON.parse(JSON.stringify(state.graphData));

  // Merge text query with active property filters
  const query = { ...state.query };
  if (state.activeFilters.size > 0) {
    const props: Record<string, string> = { ...(query.properties || {}) };
    for (const filterKey of state.activeFilters.keys()) {
      const [key, ...rest] = filterKey.split(":");
      props[key] = rest.join(":");
    }
    query.properties = props;
  }

  const filtered = applyQuery(cloned, query);
  const nodeStyle = (logseq.settings?.nodeStyle as string) ?? "circular";
  const settings = {
    chargeStrength: (logseq.settings?.chargeStrength as number) ?? -200,
    linkDistance: (logseq.settings?.linkDistance as number) ?? 80,
    history: state.history,
    dark: state.dark,
    nodeStyle: nodeStyle as "circular" | "title",
  };

  const container = document.getElementById("constel-graph");
  if (!container) return;
  renderGraph(
    container,
    filtered,
    async (clickedPage: string) => {
      await navigateTo(clickedPage);
    },
    settings
  );
}

function initResize() {
  const handle = document.getElementById("constel-resize-handle");
  if (!handle) return;

  let dragging = false;
  let rafId: number | null = null;

  // Full-viewport overlay to capture mouse events during drag
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;cursor:col-resize;display:none;";
  document.body.appendChild(overlay);

  // Visual indicator line
  const indicator = document.createElement("div");
  indicator.style.cssText =
    "position:absolute;top:0;bottom:0;width:2px;background:var(--accent, #045591);pointer-events:none;";
  overlay.appendChild(indicator);

  const onMove = (e: MouseEvent) => {
    if (!dragging) return;
    e.preventDefault();
    state.splitPct = Math.max(20, Math.min(80, (e.clientX / window.innerWidth) * 100));
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        rafId = null;
        indicator.style.left = `${state.splitPct}vw`;
      });
    }
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    overlay.style.display = "none";
    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    // Apply final size
    logseq.setMainUIInlineStyle({ width: `${state.splitPct}vw` });
    provideLayoutStyle(state.splitPct);
  };

  handle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    dragging = true;
    // Expand iframe to full viewport to capture all mouse events
    logseq.setMainUIInlineStyle({ width: "100vw" });
    overlay.style.display = "block";
    indicator.style.left = `${state.splitPct}vw`;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  });

  overlay.addEventListener("mousemove", onMove);
  overlay.addEventListener("mouseup", onUp);
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

logseq.ready(createModel(), main).catch(console.error);
