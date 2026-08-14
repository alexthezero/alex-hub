import { and, desc, eq, sql } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { notes } from "@/db/schema";

async function currentOwner() {
  const user = await getChatGPTUser();
  return user?.email ?? null;
}

export async function GET() {
  const ownerEmail = await currentOwner();
  if (!ownerEmail) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await getDb().select().from(notes)
    .where(eq(notes.ownerEmail, ownerEmail))
    .orderBy(desc(notes.updatedAt), desc(notes.id));
  return Response.json({ notes: rows });
}

export async function POST(request: Request) {
  const ownerEmail = await currentOwner();
  if (!ownerEmail) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const payload = (await request.json()) as { title?: string; content?: string; color?: string };
  const title = payload.title?.trim();
  if (!title) return Response.json({ error: "A note title is required." }, { status: 400 });

  const [note] = await getDb().insert(notes).values({
    ownerEmail,
    title: title.slice(0, 120),
    content: payload.content?.trim().slice(0, 10000) || "",
    color: ["sage", "sand", "blue"].includes(payload.color || "") ? payload.color! : "sage",
  }).returning();
  return Response.json({ note }, { status: 201 });
}

export async function PATCH(request: Request) {
  const ownerEmail = await currentOwner();
  if (!ownerEmail) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const payload = (await request.json()) as { id?: number; title?: string; content?: string; color?: string };
  if (!Number.isInteger(payload.id)) return Response.json({ error: "A valid note ID is required." }, { status: 400 });

  const changes: { title?: string; content?: string; color?: string; updatedAt: ReturnType<typeof sql> } = { updatedAt: sql`CURRENT_TIMESTAMP` };
  if (typeof payload.title === "string" && payload.title.trim()) changes.title = payload.title.trim().slice(0, 120);
  if (typeof payload.content === "string") changes.content = payload.content.trim().slice(0, 10000);
  if (["sage", "sand", "blue"].includes(payload.color || "")) changes.color = payload.color;

  const [note] = await getDb().update(notes).set(changes)
    .where(and(eq(notes.id, payload.id as number), eq(notes.ownerEmail, ownerEmail)))
    .returning();
  if (!note) return Response.json({ error: "Note not found." }, { status: 404 });
  return Response.json({ note });
}

export async function DELETE(request: Request) {
  const ownerEmail = await currentOwner();
  if (!ownerEmail) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return Response.json({ error: "A valid note ID is required." }, { status: 400 });
  await getDb().delete(notes).where(and(eq(notes.id, id), eq(notes.ownerEmail, ownerEmail)));
  return new Response(null, { status: 204 });
}
