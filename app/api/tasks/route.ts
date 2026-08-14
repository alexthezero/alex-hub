import { and, desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { tasks } from "@/db/schema";

async function currentOwner() {
  const user = await getChatGPTUser();
  return user?.email ?? null;
}

export async function GET() {
  const ownerEmail = await currentOwner();
  if (!ownerEmail) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await getDb()
    .select()
    .from(tasks)
    .where(eq(tasks.ownerEmail, ownerEmail))
    .orderBy(tasks.completed, desc(tasks.createdAt), desc(tasks.id));
  return Response.json({ tasks: rows });
}

export async function POST(request: Request) {
  const ownerEmail = await currentOwner();
  if (!ownerEmail) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const payload = (await request.json()) as { title?: string; category?: string };
  const title = payload.title?.trim();
  if (!title) return Response.json({ error: "A task title is required." }, { status: 400 });

  const [task] = await getDb().insert(tasks).values({
    ownerEmail,
    title: title.slice(0, 240),
    category: payload.category?.trim().slice(0, 40) || "Inbox",
  }).returning();
  return Response.json({ task }, { status: 201 });
}

export async function PATCH(request: Request) {
  const ownerEmail = await currentOwner();
  if (!ownerEmail) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const payload = (await request.json()) as { id?: number; completed?: boolean; title?: string };
  if (!Number.isInteger(payload.id)) return Response.json({ error: "A valid task ID is required." }, { status: 400 });

  const changes: { completed?: boolean; title?: string } = {};
  if (typeof payload.completed === "boolean") changes.completed = payload.completed;
  if (typeof payload.title === "string" && payload.title.trim()) changes.title = payload.title.trim().slice(0, 240);
  if (!Object.keys(changes).length) return Response.json({ error: "No changes supplied." }, { status: 400 });

  const [task] = await getDb().update(tasks).set(changes)
    .where(and(eq(tasks.id, payload.id as number), eq(tasks.ownerEmail, ownerEmail)))
    .returning();
  if (!task) return Response.json({ error: "Task not found." }, { status: 404 });
  return Response.json({ task });
}

export async function DELETE(request: Request) {
  const ownerEmail = await currentOwner();
  if (!ownerEmail) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return Response.json({ error: "A valid task ID is required." }, { status: 400 });

  await getDb().delete(tasks).where(and(eq(tasks.id, id), eq(tasks.ownerEmail, ownerEmail)));
  return new Response(null, { status: 204 });
}
