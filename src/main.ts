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
  allPageNames: string[]; // cached for search
  dark: boolean;
  fontFamily: string;
  themeObserver: MutationObserver | null;
}

const state: State = {
  active: false,
  currentPage: null,
  query: {},
  graphData: null,
  history: [],
  activeFilters: new Map(),
  allPageNames: [],
  dark: false,
  fontFamily: "system-ui, -apple-system, sans-serif",
  themeObserver: null,
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

  // Plugin iframe covers only the left side
  // z-index 9: above content but below LogSeq dropdowns/menus (z ≥ 999)
  logseq.setMainUIInlineStyle({
    position: "fixed",
    top: "0",
    left: "0",
    width: "50vw",
    height: "100vh",
    zIndex: "9",
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
      keybinding: { binding: "mod+ctrl+c" },
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

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.active) {
      deactivate();
    }
  });

  console.log("[constel] ready");
}

function detectFontFamily(): string {
  const fallback = "system-ui, -apple-system, sans-serif";
  try {
    // LogSeq sets --ls-font-family or font-family on the root
    const html = parent.document.documentElement;
    const styles = getComputedStyle(html);
    const lsFont = styles.getPropertyValue("--ls-font-family").trim();
    if (lsFont) return lsFont;
    const bodyFont = getComputedStyle(parent.document.body).fontFamily;
    if (bodyFont) return bodyFont;
  } catch (_) { /* cross-origin guard */ }
  return fallback;
}

function detectDarkMode(): boolean {
  try {
    const html = parent.document.documentElement;
    const body = parent.document.body;

    // LogSeq uses html[data-theme] or class on html/body
    if (html.getAttribute("data-theme") === "dark") return true;
    if (html.getAttribute("data-theme") === "light") return false;
    if (html.classList.contains("dark")) return true;
    if (html.classList.contains("white") || html.classList.contains("light")) return false;
    if (body.classList.contains("dark")) return true;
    if (body.classList.contains("white") || body.classList.contains("light")) return false;

    // Check LogSeq's CSS variable
    const lsBg = getComputedStyle(html).getPropertyValue("--ls-primary-background-color").trim();
    if (lsBg) {
      const tmp = parent.document.createElement("div");
      tmp.style.color = lsBg;
      parent.document.body.appendChild(tmp);
      const computed = getComputedStyle(tmp).color;
      tmp.remove();
      const m = computed.match(/\d+/g);
      if (m) {
        const [r, g, b] = m.map(Number);
        return (r * 299 + g * 587 + b * 114) / 1000 < 128;
      }
    }

    // Fallback: check computed background luminance
    const bg = getComputedStyle(body).backgroundColor;
    const match = bg.match(/\d+/g);
    if (match) {
      const [r, g, b] = match.map(Number);
      return (r * 299 + g * 587 + b * 114) / 1000 < 128;
    }
  } catch (_) { /* cross-origin guard */ }
  return false;
}

async function activate() {
  state.active = true;
  state.dark = detectDarkMode();
  state.fontFamily = detectFontFamily();
  console.log("[constel] activating, dark:", state.dark, "font:", state.fontFamily);

  // Watch for theme changes (class/attribute mutations on <html>)
  try {
    state.themeObserver = new MutationObserver(() => {
      const wasDark = state.dark;
      const oldFont = state.fontFamily;
      state.dark = detectDarkMode();
      state.fontFamily = detectFontFamily();
      if (state.dark !== wasDark || state.fontFamily !== oldFont) {
        console.log("[constel] theme changed, dark:", state.dark);
        const root = document.getElementById("constel-root");
        if (root) root.className = state.dark ? "dark" : "";
        refreshGraph();
      }
    });
    state.themeObserver.observe(parent.document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });
    state.themeObserver.observe(parent.document.body, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
  } catch (_) { /* cross-origin guard */ }

  // Try to close LogSeq's left sidebar if open (via API, not force)
  try {
    const sidebar = parent.document.querySelector(".cp__sidebar-left-layout.is-open") as HTMLElement | null;
    if (sidebar) {
      // Click the overlay to close it naturally
      const overlay = parent.document.querySelector(".cp__sidebar-left-layout-overlay") as HTMLElement | null;
      if (overlay) overlay.click();
    }
  } catch (_) { /* cross-origin guard */ }

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

  // Cache all page names for search
  const allPages = await logseq.Editor.getAllPages();
  state.allPageNames = (allPages || [])
    .map((p) => p.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  // Build the UI — graph panel only (right side shows native LogSeq)
  const app = document.getElementById("app")!;
  app.innerHTML = `
    <div id="constel-root" class="${state.dark ? "dark" : ""}">
      <div id="constel-panel">
        <div id="constel-search-bar">
          <div id="constel-search-wrap">
            <input id="constel-search-input" type="text"
              placeholder="Search pages..." autocomplete="off" />
            <div id="constel-search-results"></div>
          </div>
          <button id="constel-close" title="Close (Esc)">&times;</button>
        </div>
        <div id="constel-props"></div>
        <div id="constel-history"></div>
        <div id="constel-graph"></div>
      </div>
      <div id="constel-resize-handle"></div>
    </div>
  `;

  // Wire up events
  document.getElementById("constel-close")!.addEventListener("click", deactivate);
  initSearch();

  // Resize handle drag
  initResize();

  // Show the plugin iframe and focus the search input
  logseq.showMainUI({ autoFocus: true });

  // Push LogSeq main content to the right
  pushLogseqContent(50);

  // Ensure the input is focusable
  setTimeout(() => {
    const input = document.getElementById("constel-search-input") as HTMLInputElement;
    if (input) input.focus();
  }, 100);

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
  state.allPageNames = [];
  state.dark = false;
  state.fontFamily = "system-ui, -apple-system, sans-serif";
  if (state.themeObserver) {
    state.themeObserver.disconnect();
    state.themeObserver = null;
  }
  restoreLogseqContent();
  logseq.hideMainUI();
  const app = document.getElementById("app");
  if (app) app.innerHTML = "";
}

function initSearch() {
  const input = document.getElementById("constel-search-input") as HTMLInputElement;
  const results = document.getElementById("constel-search-results")!;
  let selectedIdx = -1;

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    results.innerHTML = "";
    selectedIdx = -1;

    if (q.length < 1) {
      results.style.display = "none";
      return;
    }

    // Match pages: starts-with first, then includes
    const startsWith: string[] = [];
    const includes: string[] = [];
    for (const name of state.allPageNames) {
      const lower = name.toLowerCase();
      if (lower.startsWith(q)) startsWith.push(name);
      else if (lower.includes(q)) includes.push(name);
    }
    const matches = [...startsWith, ...includes].slice(0, 12);

    if (matches.length === 0) {
      results.style.display = "none";
      return;
    }

    results.style.display = "block";
    for (let i = 0; i < matches.length; i++) {
      const item = document.createElement("div");
      item.className = "constel-search-item";
      item.textContent = matches[i];
      item.addEventListener("mousedown", (e) => {
        e.preventDefault(); // keep focus on input
        selectPage(matches[i], input, results);
      });
      results.appendChild(item);
    }
  });

  input.addEventListener("keydown", (e) => {
    const items = results.querySelectorAll(".constel-search-item");
    if (items.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIdx = Math.min(selectedIdx + 1, items.length - 1);
      updateSelection(items, selectedIdx);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIdx = Math.max(selectedIdx - 1, 0);
      updateSelection(items, selectedIdx);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIdx >= 0 && selectedIdx < items.length) {
        selectPage(items[selectedIdx].textContent!, input, results);
      } else if (items.length > 0) {
        selectPage(items[0].textContent!, input, results);
      }
    }
  });

  input.addEventListener("blur", () => {
    // Delay to allow mousedown on results
    setTimeout(() => {
      results.style.display = "none";
    }, 150);
  });

  input.addEventListener("focus", () => {
    if (input.value.trim().length > 0) {
      input.dispatchEvent(new Event("input"));
    }
  });
}

function updateSelection(items: NodeListOf<Element>, idx: number) {
  items.forEach((el, i) => {
    el.classList.toggle("selected", i === idx);
  });
  items[idx]?.scrollIntoView({ block: "nearest" });
}

function selectPage(
  pageName: string,
  input: HTMLInputElement,
  results: HTMLElement
) {
  input.value = "";
  results.style.display = "none";
  results.innerHTML = "";
  navigateTo(pageName);
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
    fontFamily: state.fontFamily,
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

const CONSTEL_STYLE_ID = "constel-logseq-layout";

function pushLogseqContent(pct: number) {
  try {
    const doc = parent.document;
    // Remove existing style if any
    doc.getElementById(CONSTEL_STYLE_ID)?.remove();
    const style = doc.createElement("style");
    style.id = CONSTEL_STYLE_ID;
    style.textContent = `
      #main-content-container {
        margin-left: ${pct}vw !important;
        width: ${100 - pct}vw !important;
      }
      /* Remove LogSeq's wide-screen padding so text fills the available space */
      #main-content-container .cp__sidebar-main-content {
        max-width: 100% !important;
        padding-left: 24px !important;
        padding-right: 24px !important;
      }
      #main-content-container #main-content-container {
        max-width: 100% !important;
      }
      #main-content-container .page {
        max-width: 100% !important;
      }
      #main-content-container .ls-page-title {
        max-width: 100% !important;
      }
      #main-content-container .editor-inner {
        max-width: 100% !important;
      }
    `;
    doc.head.appendChild(style);
  } catch (e) {
    console.warn("[constel] could not adjust LogSeq layout:", e);
  }
}

function restoreLogseqContent() {
  try {
    parent.document.getElementById(CONSTEL_STYLE_ID)?.remove();
  } catch (_) {
    // ignore
  }
}

function initResize() {
  const handle = document.getElementById("constel-resize-handle");
  if (!handle) return;

  let dragging = false;
  let rafId: number | null = null;
  let lastPct = 50;

  const applyResize = () => {
    rafId = null;
    const iframe = parent.document.getElementById(
      `logseq-constel_iframe`
    ) as HTMLIFrameElement | null;
    if (iframe) {
      iframe.style.width = `${lastPct}vw`;
    }
    pushLogseqContent(lastPct);
  };

  const onMove = (e: MouseEvent) => {
    if (!dragging) return;
    e.preventDefault();
    // Use parent viewport width — stable reference that doesn't change during drag
    const parentVW = parent.window.innerWidth;
    lastPct = Math.max(20, Math.min(80, (e.clientX / parentVW) * 100));
    // Throttle DOM updates to animation frames
    if (rafId === null) {
      rafId = requestAnimationFrame(applyResize);
    }
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    try {
      parent.document.body.style.cursor = "";
      parent.document.body.style.userSelect = "";
    } catch (_) { /* cross-origin guard */ }
  };

  handle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    dragging = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    try {
      parent.document.body.style.cursor = "col-resize";
      parent.document.body.style.userSelect = "none";
    } catch (_) { /* cross-origin guard */ }
  });

  // Listen on iframe document
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);

  // Also listen on parent document to capture mouse when it leaves the iframe
  try {
    parent.document.addEventListener("mousemove", onMove);
    parent.document.addEventListener("mouseup", onUp);
  } catch (_) { /* cross-origin guard */ }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

logseq.ready(createModel(), main).catch(console.error);
