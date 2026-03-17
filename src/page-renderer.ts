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
    const li = document.createElement("li");
    li.className = "constel-block";

    const content = document.createElement("div");
    content.className = "constel-block-content";
    content.innerHTML = formatBlockContent(block.content || "");
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
 * - [[page links]] → clickable links
 * - **bold**, *italic*, ~~strikethrough~~, `code`
 * - TODO/DONE markers
 */
function formatBlockContent(content: string): string {
  let html = escapeHtml(content);

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

  return html;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
