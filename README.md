# ThreadGraph

AI conversations are where thinking happens. ThreadGraph turns them into something you can actually navigate.

---

## The problem

A long AI chat thread is a terrible archive. Decisions, insights, open questions, dead ends, and drafted artifacts all look identical — one message after another, in order, forever. Finding something you figured out three weeks ago means scrolling. Understanding the shape of what you built means re-reading everything.

ThreadGraph parses your Claude and ChatGPT threads and surfaces the structure that was always there.

---

## What it does

Import a thread and ThreadGraph runs it through a three-pass AI pipeline that extracts concepts, classifies relationships, and maps the conversation into a navigable knowledge graph. Every node is typed — decisions, insights, questions, actions, drafts, problems — and every connection between them is labelled.

The result is five ways to read the same thread:

**What was built / decided**
The key decisions, insights, and actions from the thread, grouped by theme. The answer to "what did we actually figure out in here?"

**Re-entry brief**
Structured for coming back after days away. What the thread was about, where it ended, what's confirmed, what's still unresolved.

**Share with someone**
A clean handoff for people who weren't there. What happened, what was decided, what was produced — no context required.

**Risks and open questions**
Tensions between decisions and concerns, surfaced explicitly. Open threads that never got resolved, listed in one place.

**Timeline**
The arc of the conversation rendered as a sequence of labelled segments — where you were exploring, where you were deciding, where you were building. The shape of your thinking, at a glance.

---

## Who it's for

**Anyone** who has ever scrolled back through a hundred-turn thread looking for the thing they said three weeks ago.

**Researchers and analysts** who use long threads to work through complex problems and need to retrieve specific moments later.

**Builders and designers** who use AI as a thinking partner during architecture and planning sessions and want a record of what was decided and why.

**Writers and strategists** who iterate on ideas across multiple sessions and need to see how their thinking evolved.

---

## How it works

ThreadGraph uses a three-pass LLM pipeline:

- **Pass 1** segments the transcript into meaningful conceptual spans
- **Pass 2** classifies each span as a typed node — decision, insight, question, problem, action, reference, or draft
- **Pass 3** builds the graph structure — edges between related nodes, thematic clusters, and a segment map of the conversational arc

---

## Supported sources

- Claude.ai conversation exports
- ChatGPT conversation exports

---

## Stack

Node.js · TypeScript · Hono · Prisma · PostgreSQL · Redis · BullMQ · Better Auth · Railway

---

## Status

ThreadGraph is in active development. The core pipeline, graph canvas, and lens views are built and working. Feedback and contributions are welcome.

---

## License

MIT

