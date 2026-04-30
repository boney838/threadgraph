import { Hono } from "hono";
import { z } from "zod";
import { db } from "../lib/db.js";
import { getSession } from "../lib/session.js";
import type { Graph, GraphNode, GraphCluster } from "@threadgraph/shared";

const app = new Hono();

app.get("/", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, 401);

  const graphs = await db.graph.findMany({
    where: { user_id: session.user_id },
    select: {
      id: true,
      title: true,
      source_platform: true,
      source_url: true,
      pipeline_version: true,
      usage_json: true,
      created_at: true,
      updated_at: true,
    },
    orderBy: { created_at: "desc" },
  });

  return c.json(graphs);
});

app.get("/:id", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, 401);

  const graph = await db.graph.findFirst({
    where: { id: c.req.param("id"), user_id: session.user_id },
  });

  if (!graph)
    return c.json({ error: { code: "GRAPH_NOT_FOUND", message: "Graph not found" } }, 404);

  return c.json(graph);
});

app.patch("/:id", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, 401);

  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ title: z.string().min(1).max(200) }).safeParse(body);
  if (!parsed.success)
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid body", details: parsed.error.flatten() } }, 400);

  const existing = await db.graph.findFirst({
    where: { id: c.req.param("id"), user_id: session.user_id },
  });
  if (!existing)
    return c.json({ error: { code: "GRAPH_NOT_FOUND", message: "Graph not found" } }, 404);

  const updated = await db.graph.update({
    where: { id: c.req.param("id") },
    data: { title: parsed.data.title },
  });

  return c.json(updated);
});

app.delete("/:id", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, 401);

  const existing = await db.graph.findFirst({
    where: { id: c.req.param("id"), user_id: session.user_id },
  });
  if (!existing)
    return c.json({ error: { code: "GRAPH_NOT_FOUND", message: "Graph not found" } }, 404);

  await db.job.deleteMany({ where: { graph_id: c.req.param("id") } });
  await db.graph.delete({ where: { id: c.req.param("id") } });

  return c.body(null, 204);
});

app.get("/:id/export", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, 401);

  const graph = await db.graph.findFirst({
    where: { id: c.req.param("id"), user_id: session.user_id },
  });
  if (!graph)
    return c.json({ error: { code: "GRAPH_NOT_FOUND", message: "Graph not found" } }, 404);

  const format = c.req.query("format") ?? "json";

  if (format === "json") {
    return new Response(JSON.stringify(graph.graph_json, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="graph-${graph.id}.json"`,
      },
    });
  }

  if (format === "markdown") {
    const md = graphToMarkdown(graph.title, graph.graph_json as Graph);
    return new Response(md, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="graph-${graph.id}.md"`,
      },
    });
  }

  return c.json({ error: { code: "VALIDATION_ERROR", message: "format must be json or markdown" } }, 400);
});

function graphToMarkdown(title: string, graph: Graph): string {
  const TYPE_BADGE: Record<string, string> = {
    insight: "💡",
    decision: "✅",
    question: "❓",
    problem: "⚠️",
    action: "🎯",
    reference: "🔗",
    draft: "📝",
  };

  const lines: string[] = [`# ${title}\n`];

  for (const cluster of graph.clusters) {
    lines.push(`## ${cluster.label}`);
    lines.push(`_${cluster.summary}_\n`);

    const clusterNodes = cluster.node_ids
      .map((id) => graph.nodes.find((n) => n.id === id))
      .filter((n): n is GraphNode => !!n);

    for (const node of clusterNodes) {
      const badge = TYPE_BADGE[node.type] ?? "";
      lines.push(`- ${badge} **[${node.type}]** ${node.label}`);
      lines.push(`  > ${node.summary}`);
      if (node.tags.length > 0) lines.push(`  _tags: ${node.tags.join(", ")}_`);
    }
    lines.push("");
  }

  // Orphan nodes
  const clusteredIds = new Set(graph.clusters.flatMap((c: GraphCluster) => c.node_ids));
  const orphans = graph.nodes.filter((n) => !clusteredIds.has(n.id));
  if (orphans.length > 0) {
    lines.push("## Unclustered nodes");
    for (const node of orphans) {
      const badge = TYPE_BADGE[node.type] ?? "";
      lines.push(`- ${badge} **[${node.type}]** ${node.label}`);
      lines.push(`  > ${node.summary}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export default app;
