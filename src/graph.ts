import type { GraphData, GraphNode, GraphLink } from "./types";

/**
 * Build a local graph centered on `pageName`:
 * - The page itself (central node)
 * - All pages that link TO it (backlinks)
 * - All pages it links TO (forward links)
 * - Connections among those neighbor pages (2nd-degree edges)
 */
export async function buildGraph(pageName: string): Promise<GraphData | null> {
  const page = await logseq.Editor.getPage(pageName);
  if (!page) return null;

  const nodeMap = new Map<string, GraphNode>();
  const linkSet = new Set<string>();
  const links: GraphLink[] = [];

  function addNode(name: string, central = false): GraphNode {
    const key = name.toLowerCase();
    if (!nodeMap.has(key)) {
      nodeMap.set(key, { id: name, name, central, degree: 0 });
    }
    const node = nodeMap.get(key)!;
    if (central) node.central = true;
    return node;
  }

  function addLink(a: string, b: string) {
    const key = [a.toLowerCase(), b.toLowerCase()].sort().join("||");
    if (linkSet.has(key)) return;
    if (a.toLowerCase() === b.toLowerCase()) return;
    linkSet.add(key);
    links.push({ source: a, target: b });
  }

  // Central node
  addNode(pageName, true);

  // Linked references (backlinks)
  const backlinks = await logseq.Editor.getPageLinkedReferences(pageName);
  if (backlinks) {
    for (const [refPage] of backlinks) {
      if (refPage?.name) {
        addNode(refPage.name);
        addLink(pageName, refPage.name);
      }
    }
  }

  // Forward links: scan the page's block tree for [[...]] references
  const blocks = await logseq.Editor.getPageBlocksTree(pageName);
  if (blocks) {
    const refPattern = /\[\[([^\]]+)\]\]/g;
    for (const block of flattenBlocks(blocks)) {
      let match: RegExpExecArray | null;
      while ((match = refPattern.exec(block.content)) !== null) {
        const refName = match[1];
        addNode(refName);
        addLink(pageName, refName);
      }
    }
  }

  // 2nd-degree: check connections among neighbor pages
  const neighbors = [...nodeMap.values()].filter((n) => !n.central);
  for (const neighbor of neighbors) {
    const nBacklinks = await logseq.Editor.getPageLinkedReferences(neighbor.name);
    if (nBacklinks) {
      for (const [refPage] of nBacklinks) {
        if (refPage?.name && nodeMap.has(refPage.name.toLowerCase())) {
          addLink(neighbor.name, refPage.name);
        }
      }
    }
  }

  // Calculate degrees
  for (const link of links) {
    const src = typeof link.source === "string" ? link.source : link.source.id;
    const tgt = typeof link.target === "string" ? link.target : link.target.id;
    const srcNode = nodeMap.get(src.toLowerCase());
    const tgtNode = nodeMap.get(tgt.toLowerCase());
    if (srcNode) srcNode.degree++;
    if (tgtNode) tgtNode.degree++;
  }

  return {
    nodes: [...nodeMap.values()],
    links,
  };
}

function flattenBlocks(blocks: any[]): any[] {
  const result: any[] = [];
  for (const block of blocks) {
    result.push(block);
    if (block.children?.length) {
      result.push(...flattenBlocks(block.children));
    }
  }
  return result;
}
