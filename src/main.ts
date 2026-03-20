import "@logseq/libs";
import { buildGraph } from "./graph";
import { renderGraph } from "./render";
import { renderGraph3D, cleanupGraph3D } from "./render3d";
import { applyQuery } from "./query";
import CSS from "./styles";
import type { GraphData, ViewMode } from "./types";

interface State {
  active: boolean;
  currentPage: string | null;
  query: Record<string, any>;
  graphData: GraphData | null;
  history: string[];
  dark: boolean;
  splitPct: number;
  // Visualization controls
  viewMode: ViewMode;
  showEdges: boolean;
  showNodes: boolean;
  showTitles: boolean;
  fontSize: number;
  graphDepth: number;
  repulsionForce: number;
  controlsExpanded: boolean;
}

const state: State = {
  active: false,
  currentPage: null,
  query: {},
  graphData: null,
  history: [],
  dark: false,
  splitPct: 50,
  viewMode: "titles",
  showEdges: true,
  showNodes: true,
  showTitles: true,
  fontSize: 12,
  graphDepth: 2,
  repulsionForce: -100,
  controlsExpanded: false,
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
  currentLang = detectLang();

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

  // When right sidebar opens while Constel is active, deactivate Constel
  logseq.App.onSidebarVisibleChanged(({ visible }) => {
    if (visible && state.active) {
      deactivate();
    }
  });

  // Detect left sidebar opening via DOM observation on parent document.
  // Logseq adds "ls-left-sidebar-open" on <html> or a wrapper element.
  try {
    const parentDoc = parent.document;
    const targets = [
      parentDoc.documentElement,
      parentDoc.body,
      parentDoc.querySelector("#root"),
      parentDoc.querySelector("#app-container"),
      parentDoc.querySelector(".cp__sidebar-main-layout"),
    ].filter(Boolean) as Element[];

    const sidebarObserver = new MutationObserver(() => {
      if (!state.active) return;
      // Check multiple selectors for left sidebar open state
      const isOpen =
        parentDoc.documentElement.classList.contains("ls-left-sidebar-open") ||
        parentDoc.body.classList.contains("ls-left-sidebar-open") ||
        !!parentDoc.querySelector(".ls-left-sidebar-open") ||
        !!parentDoc.querySelector("#left-sidebar.is-open");
      if (isOpen) {
        deactivate();
      }
    });

    for (const target of targets) {
      sidebarObserver.observe(target, {
        attributes: true,
        attributeFilter: ["class"],
        subtree: false,
      });
    }
  } catch (e) {
    console.warn("[constel] cannot observe parent DOM for sidebar:", e);
  }

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.active) {
      deactivate();
    }
  });

  console.log("[constel] ready");
}

/** Register the base layout CSS once via logseq.provideStyle().
 *  Uses :has(.visible) so it auto-activates/deactivates with showMainUI/hideMainUI.
 *  Uses CSS custom property --constel-split for dynamic resize. */
let layoutStyleRegistered = false;
function registerLayoutStyle() {
  if (layoutStyleRegistered) return;
  layoutStyleRegistered = true;
  const sel = "#logseq-constel_lsp_main.visible";
  logseq.provideStyle(`
    body:has(${sel}) #main-content-container {
      margin-left: var(--constel-split, 50vw) !important;
      width: calc(100vw - var(--constel-split, 50vw)) !important;
    }
    body:has(${sel}) #main-content-container .cp__sidebar-main-content {
      max-width: 100% !important;
      padding-left: 24px !important;
      padding-right: 24px !important;
    }
    body:has(${sel}) #main-content-container .page,
    body:has(${sel}) #main-content-container .ls-page-title,
    body:has(${sel}) #main-content-container .editor-inner {
      max-width: 100% !important;
    }
  `);
}

/** Update the split percentage. Sets CSS variable on parent (local) or
 *  falls back to the 50vw default baked into the provideStyle CSS (marketplace). */
function provideLayoutStyle(pct: number) {
  registerLayoutStyle();
  try {
    parent.document.documentElement.style.setProperty("--constel-split", `${pct}vw`);
  } catch (_) {
    // Marketplace: variable can't be set, but 50vw default still works
  }
}

function clearLayoutVar() {
  try {
    parent.document.documentElement.style.removeProperty("--constel-split");
  } catch (_) {}
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
        <div id="constel-controls"></div>
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
  cleanupGraph3D();
  state.active = false;
  state.currentPage = null;
  state.graphData = null;
  state.query = {};
  state.history = [];
  state.dark = false;

  // Clear CSS variable; layout auto-deactivates via :has(.visible)
  clearLayoutVar();

  // Reset container styles
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

  state.graphData = await buildGraph(pageName, state.graphDepth);

  renderControls();
  refreshGraph();
}

function renderHistory() {
  const container = document.getElementById("constel-history");
  if (!container) return;
  container.innerHTML = "";
  for (const name of state.history) {
    const pill = document.createElement("button");
    pill.className = "constel-pill";
    if (name === state.currentPage) {
      pill.classList.add("active");
      pill.setAttribute("aria-current", "page");
    }
    pill.textContent = name;
    pill.addEventListener("click", () => navigateTo(name));
    container.appendChild(pill);
  }
  // Scroll to end
  container.scrollLeft = container.scrollWidth;
}

// ── i18n ──
type Lang = "es" | "en";
let currentLang: Lang = "es";

const i18n: Record<string, Record<Lang, string>> = {
  view:         { es: "Vista",        en: "View" },
  titles:       { es: "Títulos",      en: "Titles" },
  nodes2d:      { es: "Nodos 2D",     en: "Nodes 2D" },
  nodes3d:      { es: "Nodos 3D",     en: "Nodes 3D" },
  depth:        { es: "Profundidad",  en: "Depth" },
  repulsion:    { es: "Repulsión",    en: "Repulsion" },
  center:       { es: "Centrar",      en: "Center" },
  zoomIn:       { es: "Acercar",      en: "Zoom in" },
  zoomOut:      { es: "Alejar",       en: "Zoom out" },
  edges:        { es: "Aristas",      en: "Edges" },
  nodes:        { es: "Nodos",        en: "Nodes" },
  titleLabels:  { es: "Títulos",      en: "Titles" },
  fontSize:     { es: "Texto",        en: "Text" },
  close:        { es: "Cerrar (Esc)", en: "Close (Esc)" },
  showControls: { es: "Mostrar controles", en: "Show controls" },
  hideControls: { es: "Ocultar controles", en: "Hide controls" },
  decDepth:     { es: "Reducir profundidad",       en: "Decrease depth" },
  incDepth:     { es: "Aumentar profundidad",      en: "Increase depth" },
  decFont:      { es: "Reducir tamaño de fuente",  en: "Decrease font size" },
  incFont:      { es: "Aumentar tamaño de fuente", en: "Increase font size" },
  viewMode:     { es: "Modo de visualización",     en: "View mode" },
  repLabel:     { es: "Fuerza de repulsión",       en: "Repulsion force" },
  degSep:       { es: "Grados de separación",      en: "Degrees of separation" },
  closeLabel:   { es: "Cerrar Con§tel",            en: "Close Con§tel" },
  graphLabel:   { es: "Visualización de grafo",    en: "Knowledge graph visualization" },
};

function t(key: string): string {
  return i18n[key]?.[currentLang] ?? key;
}

function detectLang(): Lang {
  try {
    const lang = navigator.language?.toLowerCase() ?? "";
    if (lang.startsWith("es")) return "es";
  } catch (_) {}
  return "en";
}

// ── Feather-style SVG icons (inline, no library) ──
const ICON_CROSSHAIR = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>`;
const ICON_ZOOM_IN = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`;
const ICON_ZOOM_OUT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`;

function createSwitch(label: string, checked: boolean, onChange: (val: boolean) => void): HTMLElement {
  const sw = document.createElement("label");
  sw.className = "constel-switch" + (checked ? " active" : "");
  sw.setAttribute("role", "switch");
  sw.setAttribute("aria-checked", String(checked));
  sw.setAttribute("tabindex", "0");
  sw.innerHTML = `
    <span class="constel-switch-label">${escapeHtml(label)}</span>
    <span class="constel-switch-toggle"><span class="constel-switch-knob"></span></span>
  `;
  const toggle = () => {
    const next = !sw.classList.contains("active");
    sw.classList.toggle("active", next);
    sw.setAttribute("aria-checked", String(next));
    onChange(next);
  };
  sw.addEventListener("click", toggle);
  sw.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
  });
  return sw;
}

function renderControls() {
  const container = document.getElementById("constel-controls");
  if (!container) return;
  container.innerHTML = "";

  // ── Row 1: Mode + chevron + close ──
  const modeRow = document.createElement("div");
  modeRow.className = "constel-ctrl-row";
  const modeLabel = document.createElement("label");
  modeLabel.className = "constel-ctrl-label";
  modeLabel.textContent = t("view");
  const modeSelect = document.createElement("select");
  modeSelect.className = "constel-select";
  modeSelect.setAttribute("aria-label", t("viewMode"));
  for (const [val, key] of [["titles","titles"],["nodes2d","nodes2d"],["nodes3d","nodes3d"]] as const) {
    const o = document.createElement("option");
    o.value = val; o.textContent = t(key);
    if (state.viewMode === val) o.selected = true;
    modeSelect.appendChild(o);
  }
  modeSelect.addEventListener("change", () => { state.viewMode = modeSelect.value as ViewMode; renderControls(); refreshGraph(); });

  const chevDown = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
  const chevUp = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`;
  const chevBtn = document.createElement("button");
  chevBtn.className = "constel-btn-icon constel-btn-close";
  chevBtn.innerHTML = state.controlsExpanded ? chevUp : chevDown;
  chevBtn.title = t(state.controlsExpanded ? "hideControls" : "showControls");
  chevBtn.setAttribute("aria-label", t(state.controlsExpanded ? "hideControls" : "showControls"));
  chevBtn.setAttribute("aria-expanded", String(state.controlsExpanded));
  chevBtn.addEventListener("click", () => { state.controlsExpanded = !state.controlsExpanded; renderControls(); });

  const closeBtn = document.createElement("button");
  closeBtn.className = "constel-btn-icon";
  closeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  closeBtn.title = t("close");
  closeBtn.setAttribute("aria-label", t("closeLabel"));
  closeBtn.addEventListener("click", deactivate);

  modeRow.append(modeLabel, modeSelect, chevBtn, closeBtn);
  container.appendChild(modeRow);

  if (!state.controlsExpanded) return;

  // ── Row 2: Depth + Repulsion ──
  const genRow = document.createElement("div");
  genRow.className = "constel-ctrl-row";

  const depthWrap = document.createElement("div");
  depthWrap.className = "constel-ctrl-field constel-ctrl-field--inline";
  const depthLbl = document.createElement("label");
  depthLbl.className = "constel-ctrl-label";
  depthLbl.textContent = t("depth");
  const dStepper = document.createElement("div");
  dStepper.className = "constel-stepper";
  const dMinus = document.createElement("button");
  dMinus.className = "constel-stepper-btn"; dMinus.textContent = "\u2212"; dMinus.setAttribute("aria-label", t("decDepth"));
  const dVal = document.createElement("span");
  dVal.className = "constel-stepper-value"; dVal.textContent = String(state.graphDepth);
  const dPlus = document.createElement("button");
  dPlus.className = "constel-stepper-btn"; dPlus.textContent = "+"; dPlus.setAttribute("aria-label", t("incDepth"));
  dStepper.append(dMinus, dVal, dPlus);
  const updDepth = async (v: number) => {
    const c = Math.max(1, Math.min(2, v));
    if (c === state.graphDepth) return;
    state.graphDepth = c;
    dVal.textContent = String(c);
    dMinus.disabled = true; dPlus.disabled = true;
    const graphEl = document.getElementById("constel-graph");
    graphEl?.classList.add("constel-loading");
    if (state.currentPage) {
      state.graphData = await buildGraph(state.currentPage, c);
      refreshGraph();
    }
    graphEl?.classList.remove("constel-loading");
    dMinus.disabled = c <= 1; dPlus.disabled = c >= 2;
  };
  dMinus.disabled = state.graphDepth <= 1; dPlus.disabled = state.graphDepth >= 2;
  dMinus.addEventListener("click", () => updDepth(state.graphDepth - 1));
  dPlus.addEventListener("click", () => updDepth(state.graphDepth + 1));
  depthWrap.append(depthLbl, dStepper);

  const repWrap = document.createElement("div");
  repWrap.className = "constel-ctrl-field";
  repWrap.innerHTML = `<label class="constel-ctrl-label">${t("repulsion")} <span class="constel-ctrl-value">${state.repulsionForce}</span></label>`;
  const repSlider = document.createElement("input");
  repSlider.type = "range"; repSlider.className = "constel-range";
  repSlider.min = "-200"; repSlider.max = "0"; repSlider.step = "10"; repSlider.value = String(state.repulsionForce);
  repSlider.setAttribute("aria-label", t("repLabel"));
  repSlider.addEventListener("input", () => { state.repulsionForce = Number(repSlider.value); repWrap.querySelector(".constel-ctrl-value")!.textContent = String(state.repulsionForce); refreshGraph(); });
  repWrap.appendChild(repSlider);
  genRow.append(depthWrap, repWrap);

  // ── Row 3: Zoom + toggles + font (single row) ──
  const mixRow = document.createElement("div");
  mixRow.className = "constel-ctrl-row";

  const btnC = document.createElement("button"); btnC.className = "constel-btn-icon"; btnC.innerHTML = ICON_CROSSHAIR; btnC.title = t("center"); btnC.setAttribute("aria-label", t("center")); btnC.addEventListener("click", () => document.dispatchEvent(new CustomEvent("constel:center")));
  const btnZI = document.createElement("button"); btnZI.className = "constel-btn-icon"; btnZI.innerHTML = ICON_ZOOM_IN; btnZI.title = t("zoomIn"); btnZI.setAttribute("aria-label", t("zoomIn")); btnZI.addEventListener("click", () => document.dispatchEvent(new CustomEvent("constel:zoom", { detail: "in" })));
  const btnZO = document.createElement("button"); btnZO.className = "constel-btn-icon"; btnZO.innerHTML = ICON_ZOOM_OUT; btnZO.title = t("zoomOut"); btnZO.setAttribute("aria-label", t("zoomOut")); btnZO.addEventListener("click", () => document.dispatchEvent(new CustomEvent("constel:zoom", { detail: "out" })));
  mixRow.append(btnC, btnZI, btnZO);

  const sep = document.createElement("span"); sep.className = "constel-ctrl-sep"; mixRow.appendChild(sep);

  mixRow.appendChild(createSwitch(t("edges"), state.showEdges, (v) => { state.showEdges = v; updateVisuals(); }));
  if (state.viewMode === "nodes2d" || state.viewMode === "nodes3d") {
    mixRow.appendChild(createSwitch(t("nodes"), state.showNodes, (v) => { state.showNodes = v; updateVisuals(); }));
    mixRow.appendChild(createSwitch(t("titleLabels"), state.showTitles, (v) => { state.showTitles = v; updateVisuals(); }));
  }

  // Font stepper
  const fWrap = document.createElement("div"); fWrap.className = "constel-ctrl-field constel-ctrl-field--inline";
  const fLbl = document.createElement("label"); fLbl.className = "constel-ctrl-label"; fLbl.textContent = t("fontSize");
  const fStepper = document.createElement("div"); fStepper.className = "constel-stepper";
  const fMinus = document.createElement("button"); fMinus.className = "constel-stepper-btn"; fMinus.textContent = "\u2212"; fMinus.setAttribute("aria-label", t("decFont"));
  const fVal = document.createElement("span"); fVal.className = "constel-stepper-value"; fVal.textContent = String(state.fontSize);
  const fPlus = document.createElement("button"); fPlus.className = "constel-stepper-btn"; fPlus.textContent = "+"; fPlus.setAttribute("aria-label", t("incFont"));
  fStepper.append(fMinus, fVal, fPlus);
  const updFont = (v: number) => { const c = Math.max(8, Math.min(24, v)); if (c === state.fontSize) return; state.fontSize = c; fVal.textContent = String(c); fMinus.disabled = c <= 8; fPlus.disabled = c >= 24; updateVisuals(); };
  fMinus.disabled = state.fontSize <= 8; fPlus.disabled = state.fontSize >= 24;
  fMinus.addEventListener("click", () => updFont(state.fontSize - 1));
  fPlus.addEventListener("click", () => updFont(state.fontSize + 1));
  fWrap.append(fLbl, fStepper); mixRow.appendChild(fWrap);

  container.append(genRow, mixRow);
}

function refreshGraph() {
  if (!state.graphData || !state.currentPage) return;

  const cloned: GraphData = JSON.parse(JSON.stringify(state.graphData));
  const filtered = applyQuery(cloned, state.query);

  const settings = buildSettings();

  const container = document.getElementById("constel-graph");
  if (!container) return;

  const onClickNode = async (clickedPage: string) => {
    await navigateTo(clickedPage);
  };

  if (state.viewMode === "nodes3d") {
    renderGraph3D(container, filtered, onClickNode, settings);
  } else {
    cleanupGraph3D();
    renderGraph(container, filtered, onClickNode, settings);
  }
}

/** Lightweight visual update — no simulation restart.
 *  For toggling edges, nodes, titles, and font size changes. */
function updateVisuals() {
  const container = document.getElementById("constel-graph");
  if (!container) return;

  // 3D: must re-render (sprites are baked textures)
  if (state.viewMode === "nodes3d") {
    refreshGraph();
    return;
  }

  const svg = container.querySelector("svg");
  if (!svg) return;

  // Links visibility
  const linkGroup = svg.querySelector("g > g:first-child") as SVGGElement | null;
  if (linkGroup) linkGroup.style.display = state.showEdges ? "" : "none";

  // Nodes: circles and labels are inside per-node <g> groups
  const nodeGroups = svg.querySelectorAll("g > g:nth-child(2) > g");
  nodeGroups.forEach((g) => {
    // Circles
    g.querySelectorAll("circle").forEach((c) => {
      (c as SVGElement).style.display = state.showNodes ? "" : "none";
    });
    // Text labels
    const textEl = g.querySelector("text") as SVGTextElement | null;
    const titleEl = g.querySelector("title");
    if (state.showTitles) {
      if (!textEl && titleEl) {
        // Switch from tooltip to visible text — need full refresh
        refreshGraph();
        return;
      }
      if (textEl) {
        textEl.style.display = "";
        const d = (textEl as any).__data__;
        const fs = d?.central ? state.fontSize + 2 : state.fontSize;
        textEl.setAttribute("font-size", `${fs}px`);
      }
    } else {
      if (textEl) textEl.style.display = "none";
    }
  });

  // Title mode: update font sizes
  if (state.viewMode === "titles") {
    nodeGroups.forEach((g) => {
      const textEl = g.querySelector("text") as SVGTextElement | null;
      if (textEl) {
        const d = (textEl as any).__data__;
        if (d) {
          const fMin = state.fontSize;
          const fMax = state.fontSize + 8;
          const count = d.blockCount ?? 1;
          const t = Math.min(1, Math.max(0, (count - 1) / 99));
          const fs = d.central ? fMax : fMin + (fMax - fMin) * Math.sqrt(t);
          textEl.setAttribute("font-size", `${fs}px`);
        }
      }
    });
  }
}

function buildSettings() {
  const nodeStyleMap: Record<string, string> = {
    titles: "title",
    nodes2d: "circular",
    nodes3d: "3d",
  };
  const nodeStyle = nodeStyleMap[state.viewMode] ?? "circular";
  return {
    chargeStrength: state.repulsionForce,
    linkDistance: 80,
    history: state.history,
    dark: state.dark,
    nodeStyle: nodeStyle as "circular" | "title",
    showEdges: state.showEdges,
    showNodes: state.showNodes,
    showTitles: state.showTitles,
    fontSize: state.fontSize,
  };
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
