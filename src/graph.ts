import type { GraphData, GraphNode, GraphLink } from "./types";

/**
 * Build a local graph centered on `pageName` up to `maxDepth` degrees.
 * depth=1: only direct connections
 * depth=2: connections of connections
 * depth=3+: further expansion
 */
export async function buildGraph(
  pageName: string,
  maxDepth = 2
): Promise<GraphData | null> {
  const page = await logseq.Editor.getPage(pageName);
  if (!page) return null;

  const nodeMap = new Map<string, GraphNode>();
  const linkSet = new Set<string>();
  const links: GraphLink[] = [];

  function addNode(name: string, central = false, properties?: Record<string, any>, blockCount?: number, originalName?: string): GraphNode {
    const key = name.toLowerCase();
    const displayName = originalName || name;
    if (!nodeMap.has(key)) {
      nodeMap.set(key, { id: name, name: displayName, central, degree: 0, properties, blockCount });
    }
    const node = nodeMap.get(key)!;
    if (central) node.central = true;
    if (properties && !node.properties) node.properties = properties;
    if (blockCount !== undefined && node.blockCount === undefined) node.blockCount = blockCount;
    return node;
  }

  function addLink(a: string, b: string) {
    const aKey = a.toLowerCase();
    const bKey = b.toLowerCase();
    const linkKey = [aKey, bKey].sort().join("||");
    if (linkSet.has(linkKey)) return;
    if (aKey === bKey) return;
    linkSet.add(linkKey);
    // Use the canonical node id (from addNode), not the raw name
    const aId = nodeMap.get(aKey)?.id ?? a;
    const bId = nodeMap.get(bKey)?.id ?? b;
    links.push({ source: aId, target: bId });
  }

  // Central node (with properties and block count)
  const centralBlocks = await logseq.Editor.getPageBlocksTree(pageName);
  const centralBlockCount = centralBlocks ? flattenBlocks(centralBlocks).length : 0;
  addNode(pageName, true, page.properties as Record<string, any> | undefined, centralBlockCount, (page as any).originalName ?? pageName);

  // BFS expansion by depth
  let frontier = new Set<string>([pageName.toLowerCase()]);
  const visited = new Set<string>([pageName.toLowerCase()]);

  for (let depth = 0; depth < maxDepth; depth++) {
    const nextFrontier = new Set<string>();

    for (const nodeKey of frontier) {
      const node = nodeMap.get(nodeKey);
      if (!node) continue;
      const name = node.name;

      // Backlinks
      const backlinks = await logseq.Editor.getPageLinkedReferences(name);
      if (backlinks) {
        for (const [refPage] of backlinks) {
          if (refPage?.name) {
            addNode(refPage.name, false, refPage.properties as Record<string, any> | undefined, undefined, (refPage as any).originalName ?? refPage.name);
            addLink(name, refPage.name);
            const refKey = refPage.name.toLowerCase();
            if (!visited.has(refKey)) {
              visited.add(refKey);
              nextFrontier.add(refKey);
            }
          }
        }
      }

      // Forward links from block content (also count blocks for size)
      const blocks = await logseq.Editor.getPageBlocksTree(name);
      if (blocks) {
        const allBlocks = flattenBlocks(blocks);
        const currentNode = nodeMap.get(nodeKey);
        if (currentNode && currentNode.blockCount === undefined) {
          currentNode.blockCount = allBlocks.length;
        }
        const refPattern = /\[\[([^\]]+)\]\]/g;
        // Collect unique refs first, then batch-check existence
        const refs = new Set<string>();
        for (const block of flattenBlocks(blocks)) {
          let match: RegExpExecArray | null;
          while ((match = refPattern.exec(block.content)) !== null) {
            refs.add(match[1]);
          }
        }
        // Check each ref page exists before adding
        for (const refName of refs) {
          const refKey = refName.toLowerCase();
          // Skip if already in graph (already verified)
          if (nodeMap.has(refKey)) {
            addLink(name, refName);
            if (!visited.has(refKey)) {
              visited.add(refKey);
              nextFrontier.add(refKey);
            }
            continue;
          }
          // Verify page exists
          const refPage = await logseq.Editor.getPage(refName);
          if (!refPage) continue; // skip non-existent pages
          addNode(refPage.name, false, refPage.properties as Record<string, any> | undefined, undefined, (refPage as any).originalName ?? refPage.name);
          addLink(name, refPage.name);
          if (!visited.has(refKey)) {
            visited.add(refKey);
            nextFrontier.add(refKey);
          }
        }
      }
    }

    frontier = nextFrontier;
    if (frontier.size === 0) break;
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
