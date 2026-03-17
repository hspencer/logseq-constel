import type { GraphData, GraphNode, QueryFilter } from "./types";

/**
 * Apply a query filter to graph data.
 * Marks matching nodes and returns filtered graph data
 * (only matched nodes + edges between them).
 */
export function applyQuery(data: GraphData, query: QueryFilter): GraphData {
  if (isEmptyQuery(query)) {
    // No filter: mark all as matched
    data.nodes.forEach((n) => (n.matched = true));
    return data;
  }

  // Mark each node
  for (const node of data.nodes) {
    node.matched = matchesNode(node, query);
  }

  // Always keep the central node visible
  const central = data.nodes.find((n) => n.central);
  if (central) central.matched = true;

  const matchedIds = new Set(data.nodes.filter((n) => n.matched).map((n) => n.id));

  // Keep links where both endpoints are matched
  const filteredLinks = data.links.filter((l) => {
    const src = typeof l.source === "string" ? l.source : l.source.id;
    const tgt = typeof l.target === "string" ? l.target : l.target.id;
    return matchedIds.has(src) && matchedIds.has(tgt);
  });

  return {
    nodes: data.nodes.filter((n) => n.matched),
    links: filteredLinks,
  };
}

function matchesNode(node: GraphNode, query: QueryFilter): boolean {
  // Text filter: match against node name
  if (query.text) {
    const q = query.text.toLowerCase();
    if (!node.name.toLowerCase().includes(q)) {
      return false;
    }
  }

  // Tag filter
  if (query.tags && query.tags.length > 0) {
    const nodeTags: string[] = node.properties?.tags ?? [];
    const normalizedNodeTags = nodeTags.map((t) => t.toLowerCase());
    const allTagsMatch = query.tags.every((t) =>
      normalizedNodeTags.includes(t.toLowerCase())
    );
    if (!allTagsMatch) return false;
  }

  // Property filter
  if (query.properties) {
    for (const [key, val] of Object.entries(query.properties)) {
      const nodeVal = node.properties?.[key];
      if (nodeVal === undefined) return false;
      if (String(nodeVal).toLowerCase() !== val.toLowerCase()) return false;
    }
  }

  // Minimum degree filter
  if (query.minDegree !== undefined && node.degree < query.minDegree) {
    return false;
  }

  return true;
}

function isEmptyQuery(q: QueryFilter): boolean {
  return (
    !q.text &&
    (!q.tags || q.tags.length === 0) &&
    (!q.properties || Object.keys(q.properties).length === 0) &&
    q.minDegree === undefined
  );
}

/**
 * Parse a query string into a QueryFilter.
 * Syntax:
 *   free text        → text filter
 *   #tag             → tag filter
 *   key:value        → property filter
 *   degree>N         → minimum degree filter
 *
 * Example: "#project status:active degree>2 neural"
 */
export function parseQuery(input: string): QueryFilter {
  const query: QueryFilter = {};
  const tags: string[] = [];
  const properties: Record<string, string> = {};
  const textParts: string[] = [];

  const tokens = input.trim().split(/\s+/);

  for (const token of tokens) {
    if (token.startsWith("#")) {
      tags.push(token.slice(1));
    } else if (/^degree>(\d+)$/i.test(token)) {
      const match = token.match(/^degree>(\d+)$/i);
      if (match) query.minDegree = parseInt(match[1], 10);
    } else if (token.includes(":") && !token.startsWith("http")) {
      const [key, ...rest] = token.split(":");
      properties[key] = rest.join(":");
    } else {
      textParts.push(token);
    }
  }

  if (textParts.length > 0) query.text = textParts.join(" ");
  if (tags.length > 0) query.tags = tags;
  if (Object.keys(properties).length > 0) query.properties = properties;

  return query;
}
