import { auth } from "@/auth";
import { searchFamily } from "@/lib/family-search";
import { getTranslations } from "@/lib/preferences";

const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ results: [] }, { status: 401, headers });
  }

  const query = new URL(request.url).searchParams.get("q") ?? "";
  const { language } = await getTranslations();
  const results = await searchFamily(session.user.id, query, language);
  return Response.json({ results }, { headers });
}
