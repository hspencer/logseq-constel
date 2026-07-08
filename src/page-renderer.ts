import mermaid from "mermaid";

/**
 * Renders a LogSeq page's block tree into HTML for the right panel.
 */
export async function renderPage(
  container: HTMLElement,
  pageName: string,
  onNavigate: (pageName: string) => void
) {
  container.innerHTML = "";

  const page = await logseq.Editor.getPage(pageName);
  if (!page) {
    container.innerHTML = `<p class="constel-empty">Page not found</p>`;
    return;
  }

  // Page header
  const header = document.createElement("div");
  header.className = "constel-page-header";
  header.innerHTML = `<h1>${escapeHtml(pageName)}</h1>`;

  // Page properties
  if (page.properties && Object.keys(page.properties).length > 0) {
    const propsEl = document.createElement("div");
    propsEl.className = "constel-page-props";
    for (const [key, val] of Object.entries(page.properties)) {
      if (key === "id") continue;
      const prop = document.createElement("span");
      prop.className = "constel-prop";
      prop.innerHTML = `<span class="constel-prop-key">${escapeHtml(key)}</span><span class="constel-prop-val">${escapeHtml(String(val))}</span>`;
      propsEl.appendChild(prop);
    }
    header.appendChild(propsEl);
  }

  container.appendChild(header);

  // Block tree
  const blocks = await logseq.Editor.getPageBlocksTree(pageName);
  if (blocks && blocks.length > 0) {
    const tree = renderBlockTree(blocks, onNavigate);
    container.appendChild(tree);
  } else {
    const empty = document.createElement("p");
    empty.className = "constel-empty";
    empty.textContent = "Empty page";
    container.appendChild(empty);
  }

  // Render Mermaid diagrams asynchronously
  await renderMermaidDiagrams(container);
}

function renderBlockTree(
  blocks: any[],
  onNavigate: (pageName: string) => void,
  depth = 0
): HTMLElement {
  const ul = document.createElement("ul");
  ul.className = "constel-blocks";
  if (depth > 0) ul.classList.add("constel-blocks-nested");

  for (const block of blocks) {
    const formatted = formatBlockContent(block.content || "");
    // Skip empty blocks (e.g. property-only lines)
    if (!formatted && (!block.children?.length)) continue;

    const li = document.createElement("li");
    li.className = "constel-block";

    const content = document.createElement("div");
    content.className = "constel-block-content";
    content.innerHTML = formatted;

    // Add data attributes for linked pages (for edge-click scrolling)
    const linkedPages = [...(block.content || "").matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1]);
    if (linkedPages.length > 0) {
      content.dataset.linkedPages = linkedPages.map(p => p.toLowerCase()).join(",");
    }

    li.appendChild(content);

    // Wire up page links
    content.querySelectorAll("a.constel-page-link").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const target = (a as HTMLElement).dataset.page;
        if (target) onNavigate(target);
      });
    });

    // Recurse children
    if (block.children?.length > 0) {
      li.appendChild(renderBlockTree(block.children, onNavigate, depth + 1));
    }

    ul.appendChild(li);
  }

  return ul;
}

/**
 * Convert LogSeq block content to HTML:
 * - ## headings
 * - [[page links]] → clickable links
 * - **bold**, *italic*, ~~strikethrough~~, `code`
 * - TODO/DONE markers
 */
function formatBlockContent(content: string): string {
  // Skip property lines (key:: value)
  if (/^[a-zA-Z_-]+::/.test(content.trim())) {
    return "";
  }

  // Pre-process: Extract Mermaid blocks before markdown formatting
  const mermaidBlocks: string[] = [];
  const processedContent = content.replace(/```mermaid\s*([\s\S]*?)\s*```/g, (match, code) => {
    const index = mermaidBlocks.length;
    mermaidBlocks.push(code);
    return `__MERMAID_BLOCK_${index}__`;
  });

  let html = escapeHtml(processedContent);

  // Headings (## ... → <h2>, ### ... → <h3>, etc.)
  const headingMatch = html.match(/^(#{1,6})\s+(.+)$/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    return `<h${level} class="constel-heading">${headingMatch[2]}</h${level}>`;
  }

  // Page references [[...]]
  html = html.replace(
    /\[\[([^\]]+)\]\]/g,
    '<a href="#" class="constel-page-link" data-page="$1">$1</a>'
  );

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");
  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");
  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // TODO / DONE markers
  html = html.replace(
    /^(TODO)\s/,
    '<span class="constel-marker constel-todo">TODO</span> '
  );
  html = html.replace(
    /^(DONE)\s/,
    '<span class="constel-marker constel-done">DONE</span> '
  );

  // Post-process: Replace placeholders with Mermaid container elements
  html = html.replace(/__MERMAID_BLOCK_(\d+)__/g, (match, indexStr) => {
    const index = parseInt(indexStr, 10);
    const code = mermaidBlocks[index];
    return `<div class="constel-mermaid" data-code="${encodeURIComponent(code)}"></div>`;
  });

  return html;
}

async function renderMermaidDiagrams(container: HTMLElement) {
  const els = container.querySelectorAll(".constel-mermaid");
  if (els.length === 0) return;

  const isDark = document.getElementById("constel-root")?.classList.contains("dark") || false;
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark ? "dark" : "default",
  });

  for (let i = 0; i < els.length; i++) {
    const el = els[i] as HTMLElement;
    const code = decodeURIComponent(el.dataset.code || "");
    if (!code) continue;

    const id = `mermaid-${Math.random().toString(36).substring(2, 9)}-${i}`;
    try {
      const { svg } = await mermaid.render(id, code);
      el.innerHTML = svg;
    } catch (err) {
      console.error("Failed to render Mermaid diagram:", err);
      el.innerHTML = `<pre class="constel-mermaid-error">${escapeHtml(code)}</pre>`;
      const badSvg = document.getElementById(id);
      if (badSvg) badSvg.remove();
    }
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
