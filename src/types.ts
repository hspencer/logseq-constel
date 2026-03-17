import type { SimulationNodeDatum } from "d3";

export interface GraphNode extends SimulationNodeDatum {
  id: string;
  name: string;
  central: boolean;
  /** Number of connections (degree) */
  degree: number;
  /** Page properties from LogSeq */
  properties?: Record<string, any>;
  /** Whether this node matches the current query filter */
  matched?: boolean;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface QueryFilter {
  /** Free text search across page names and content */
  text?: string;
  /** Filter by page tags */
  tags?: string[];
  /** Filter by page property key-value */
  properties?: Record<string, string>;
  /** Only show nodes with at least this many connections */
  minDegree?: number;
}

export interface ConstelState {
  active: boolean;
  currentPage: string | null;
  query: QueryFilter;
  graphData: GraphData | null;
}
