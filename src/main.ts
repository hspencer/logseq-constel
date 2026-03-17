import "@logseq/libs";
import { buildGraph } from "./graph";
import { renderGraph } from "./render";
import { renderPage } from "./page-renderer";
import { applyQuery, parseQuery } from "./query";
import type { ConstelState, GraphData } from "./types";

const state: ConstelState = {
  active: false,
  currentPage: null,
  query: {},
  graphData: null,
};

async function main() {
  // Inject styles into parent document
  logseq.provideStyle(CSS);

  // Toolbar toggle button
  logseq.App.registerUIItem("toolbar", {
    key: "constel-toggle",
    template: `
      <a class="button" data-on-click="toggleConstel" title="Toggle Constel view">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="2"/>
          <circle cx="4" cy="6" r="1.5"/>
          <circle cx="20" cy="6" r="1.5"/>
          <circle cx="4" cy="18" r="1.5"/>
          <circle cx="20" cy="18" r="1.5"/>
          <line x1="12" y1="12" x2="4" y2="6"/>
          <line x1="12" y1="12" x2="20" y2="6"/>
          <line x1="12" y1="12" x2="4" y2="18"/>
          <line x1="12" y1="12" x2="20" y2="18"/>
        </svg>
      </a>
    `,
  });

  logseq.provideModel({
    toggleConstel() {
      if (state.active) {
        deactivate();
      } else {
        activate();
      }
    },
    closeConstel() {
      deactivate();
    },
    async handleQueryInput(e: any) {
      const input = e.target?.value ?? "";
      state.query = parseQuery(input);
      await refreshGraph();
    },
    async clearQuery() {
      state.query = {};
      const input = parent.document.getElementById("constel-query-input") as HTMLInputElement;
      if (input) input.value = "";
      await refreshGraph();
    },
  });

  // Listen for page navigation in LogSeq
  logseq.App.onRouteChanged(async ({ path }) => {
    if (!state.active) return;
    const match = path.match(/\/page\/(.+)/);
    if (match) {
      const pageName = decodeURIComponent(match[1]);
      await navigateTo(pageName);
    }
  });

  // Keyboard shortcut: Escape to close
  logseq.App.registerCommandShortcut(
    { binding: "mod+shift+g" },
    () => {
      if (state.active) {
        deactivate();
      } else {
        activate();
      }
    }
  );

  console.log("logseq-constel loaded");
}

async function activate() {
  state.active = true;

  // Get current page
  const page = await logseq.Editor.getCurrentPage();
  const pageName = page && "name" in page ? (page.name as string) : null;

  if (!pageName) {
    console.warn("constel: no current page");
    return;
  }

  // Inject the split layout
  logseq.provideUI({
    key: "constel-layout",
    path: "#app",
    template: `
      <div id="constel-root">
        <div id="constel-left">
          <div id="constel-query-bar">
            <input
              id="constel-query-input"
              type="text"
              placeholder="Filter: text #tag key:value degree>N"
              data-on-change="handleQueryInput"
            />
            <button data-on-click="clearQuery" title="Clear filter">&times;</button>
          </div>
          <div id="constel-graph"></div>
        </div>
        <div id="constel-divider"></div>
        <div id="constel-right">
          <div id="constel-page"></div>
        </div>
        <button id="constel-close" data-on-click="closeConstel" title="Close (Cmd+Shift+G)">&times;</button>
      </div>
    `,
  });

  await navigateTo(pageName);
}

function deactivate() {
  state.active = false;
  state.currentPage = null;
  state.graphData = null;
  state.query = {};

  logseq.provideUI({
    key: "constel-layout",
    path: "#app",
    template: "",
  });
}

async function navigateTo(pageName: string) {
  state.currentPage = pageName;
  state.graphData = await buildGraph(pageName);

  await refreshGraph();
  await refreshPage();
}

async function refreshGraph() {
  if (!state.graphData || !state.currentPage) return;

  // Deep clone to avoid mutating original data with d3 simulation
  const cloned: GraphData = JSON.parse(JSON.stringify(state.graphData));
  const filtered = applyQuery(cloned, state.query);

  setTimeout(() => {
    const container = parent.document.getElementById("constel-graph");
    if (!container) return;

    renderGraph(container, filtered, async (clickedPage: string) => {
      // Navigate in LogSeq + update our view
      await logseq.App.pushState("page", { name: clickedPage });
      await navigateTo(clickedPage);
    });
  }, 50);
}

async function refreshPage() {
  if (!state.currentPage) return;

  setTimeout(async () => {
    const container = parent.document.getElementById("constel-page");
    if (!container) return;

    await renderPage(container, state.currentPage!, async (clickedPage: string) => {
      await logseq.App.pushState("page", { name: clickedPage });
      await navigateTo(clickedPage);
    });
  }, 50);
}

const CSS = `
  #constel-root {
    position: fixed;
    inset: 0;
    z-index: 999;
    display: flex;
    background: var(--ls-primary-background-color, #fff);
    font-family: var(--ls-font-family, system-ui, sans-serif);
    color: var(--ls-primary-text-color, #333);
  }

  #constel-left {
    width: 50%;
    display: flex;
    flex-direction: column;
    border-right: none;
    position: relative;
  }

  #constel-divider {
    width: 3px;
    background: var(--ls-border-color, #e0e0e0);
    cursor: col-resize;
    flex-shrink: 0;
    transition: background 0.15s;
  }

  #constel-divider:hover {
    background: var(--ls-link-text-color, #045591);
  }

  #constel-right {
    width: 50%;
    overflow-y: auto;
    position: relative;
  }

  #constel-close {
    position: absolute;
    top: 8px;
    right: 12px;
    z-index: 10;
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: var(--ls-secondary-text-color, #999);
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }

  #constel-close:hover {
    background: var(--ls-tertiary-background-color, #f0f0f0);
    color: var(--ls-primary-text-color, #333);
  }

  /* Query bar */
  #constel-query-bar {
    display: flex;
    padding: 8px 12px;
    gap: 6px;
    border-bottom: 1px solid var(--ls-border-color, #e0e0e0);
    background: var(--ls-secondary-background-color, #f8f8f8);
  }

  #constel-query-input {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid var(--ls-border-color, #ddd);
    border-radius: 6px;
    background: var(--ls-primary-background-color, #fff);
    color: var(--ls-primary-text-color, #333);
    font-size: 13px;
    outline: none;
  }

  #constel-query-input:focus {
    border-color: var(--ls-link-text-color, #045591);
    box-shadow: 0 0 0 2px rgba(4, 85, 145, 0.15);
  }

  #constel-query-input::placeholder {
    color: var(--ls-secondary-text-color, #aaa);
  }

  #constel-query-bar button {
    background: none;
    border: 1px solid var(--ls-border-color, #ddd);
    border-radius: 6px;
    padding: 4px 10px;
    cursor: pointer;
    color: var(--ls-secondary-text-color, #999);
    font-size: 16px;
  }

  #constel-query-bar button:hover {
    background: var(--ls-tertiary-background-color, #f0f0f0);
  }

  /* Graph area */
  #constel-graph {
    flex: 1;
    min-height: 0;
  }

  /* Page panel */
  #constel-page {
    padding: 24px 32px;
    max-width: 720px;
  }

  .constel-page-header h1 {
    font-size: 1.6em;
    font-weight: 700;
    margin: 0 0 12px 0;
    color: var(--ls-title-text-color, var(--ls-primary-text-color, #333));
  }

  .constel-page-props {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 16px;
  }

  .constel-prop {
    display: inline-flex;
    font-size: 12px;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid var(--ls-border-color, #ddd);
  }

  .constel-prop-key {
    padding: 2px 6px;
    background: var(--ls-secondary-background-color, #f0f0f0);
    color: var(--ls-secondary-text-color, #666);
  }

  .constel-prop-val {
    padding: 2px 6px;
    color: var(--ls-primary-text-color, #333);
  }

  /* Block tree */
  .constel-blocks {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .constel-blocks-nested {
    padding-left: 20px;
    border-left: 1px solid var(--ls-border-color, #e8e8e8);
    margin-left: 4px;
  }

  .constel-block {
    margin: 2px 0;
  }

  .constel-block-content {
    padding: 4px 6px;
    border-radius: 4px;
    line-height: 1.6;
    font-size: 14px;
  }

  .constel-block-content:hover {
    background: var(--ls-secondary-background-color, #f8f8f8);
  }

  .constel-page-link {
    color: var(--ls-link-text-color, #045591);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    cursor: pointer;
  }

  .constel-page-link:hover {
    border-bottom-color: var(--ls-link-text-color, #045591);
  }

  .constel-marker {
    font-size: 12px;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 3px;
    margin-right: 4px;
  }

  .constel-todo {
    background: #fef3c7;
    color: #92400e;
  }

  .constel-done {
    background: #d1fae5;
    color: #065f46;
  }

  .constel-empty {
    color: var(--ls-secondary-text-color, #999);
    font-style: italic;
    padding: 20px 0;
  }

  .constel-block-content code {
    background: var(--ls-secondary-background-color, #f0f0f0);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 0.9em;
  }

  .constel-block-content strong {
    font-weight: 600;
  }
`;

logseq.ready(main).catch(console.error);
