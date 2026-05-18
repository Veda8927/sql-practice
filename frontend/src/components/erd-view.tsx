"use client";

import * as React from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import dagre from "dagre";
import { KeyRound, Link2 } from "lucide-react";

import "@xyflow/react/dist/style.css";

import type { SchemaInfo, TableInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

type TableNodeData = {
  table: TableInfo;
};

type TableNode = Node<TableNodeData, "table">;

function TableNodeView({ data }: NodeProps<TableNode>) {
  const t = data.table;
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-md">
      {/* Single source / target handles per table for FK edges */}
      <Handle
        type="source"
        position={Position.Right}
        id="r"
        className="!h-2 !w-2 !border-0 !bg-blue-500"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="l"
        className="!h-2 !w-2 !border-0 !bg-amber-500"
      />

      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <span className="font-mono text-[13px] font-semibold">{t.name}</span>
        <span className="tabular-nums text-[10px] text-muted-foreground">
          {t.row_count.toLocaleString()}
        </span>
      </div>

      <ul className="font-mono text-[11px]">
        {t.columns.map((c) => (
          <li
            key={c.name}
            className={cn(
              "flex items-center justify-between gap-3 border-b border-border/60 px-3 py-1 last:border-b-0",
              c.primary_key && "bg-amber-500/8",
              c.foreign_key && "bg-blue-500/8",
            )}
          >
            <span className="flex items-center gap-1.5">
              {c.primary_key && (
                <KeyRound className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400" />
              )}
              {c.foreign_key && (
                <Link2 className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400" />
              )}
              <span className="text-foreground">{c.name}</span>
            </span>
            <span className="text-[10px] text-muted-foreground">{c.type}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const nodeTypes = { table: TableNodeView };

const NODE_WIDTH = 240;
// Rough per-row height: 1 header line + 1 per column. Used by dagre only.
function estimateHeight(t: TableInfo) {
  return 36 + t.columns.length * 24;
}

function layoutWithDagre(
  nodes: TableNode[],
  edges: Edge[],
  tables: TableInfo[],
) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 110 });
  g.setDefaultEdgeLabel(() => ({}));

  const heightById = new Map(tables.map((t) => [t.name, estimateHeight(t)]));
  for (const n of nodes) {
    g.setNode(n.id, {
      width: NODE_WIDTH,
      height: heightById.get(n.id) ?? 200,
    });
  }
  for (const e of edges) g.setEdge(e.source, e.target);

  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      ...n,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - pos.height / 2 },
    };
  });
}

function buildGraph(schema: SchemaInfo) {
  const nodes: TableNode[] = schema.tables.map((t) => ({
    id: t.name,
    type: "table" as const,
    position: { x: 0, y: 0 },
    data: { table: t },
  }));

  const edges: Edge[] = [];
  for (const t of schema.tables) {
    for (const c of t.columns) {
      if (c.foreign_key) {
        const [targetTable, targetCol] = c.foreign_key.split(".");
        edges.push({
          id: `${t.name}-${c.name}->${targetTable}-${targetCol}`,
          source: t.name,
          sourceHandle: "r",
          target: targetTable,
          targetHandle: "l",
          type: "smoothstep",
          label: `${c.name} → ${targetCol}`,
          labelStyle: {
            fontSize: 10,
            fontFamily: "ui-monospace, monospace",
          },
          labelBgStyle: { fill: "hsl(var(--card))", opacity: 0.95 },
          labelBgPadding: [4, 2],
          labelBgBorderRadius: 4,
          markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
          style: { stroke: "hsl(var(--muted-foreground))", strokeWidth: 1.5 },
        });
      }
    }
  }

  const laid = layoutWithDagre(nodes, edges, schema.tables);
  return { nodes: laid, edges };
}

function ERDInner({ schema }: { schema: SchemaInfo }) {
  const { nodes, edges } = React.useMemo(() => buildGraph(schema), [schema]);
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.4}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={20} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

export function ERDView({ schema }: { schema: SchemaInfo }) {
  return (
    <div className="h-full w-full">
      <ReactFlowProvider>
        <ERDInner schema={schema} />
      </ReactFlowProvider>
    </div>
  );
}
