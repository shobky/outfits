import { getRepo, unauthorized } from "@/lib/data";

export async function GET() {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  return Response.json({ chats: await repo.listChats() });
}
