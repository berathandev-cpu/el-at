import { auth } from "@/auth";
import { familyReportCsv, getFamilyReport } from "@/lib/family-report";
import { getTranslations } from "@/lib/preferences";

const responseHeaders = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const { t, language } = await getTranslations();
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: t("Önce giriş yapmalısın.") }, { status: 401, headers: responseHeaders });
  }

  const keys = new URL(request.url).searchParams.getAll("hafta");
  const report = await getFamilyReport(session.user.id, keys.length > 1 ? "" : keys[0], undefined, language);
  if (report.status === "no-family" || report.status === "forbidden") {
    return Response.json({ error: t("Raporu yalnızca evin ebeveynleri indirebilir.") }, { status: 403, headers: responseHeaders });
  }
  if (report.status === "invalid-week") {
    return Response.json({ error: t("Geçerli bir rapor haftası seç.") }, { status: 400, headers: responseHeaders });
  }

  const fileName = t("el-at-hafta-{date}.csv", { date: report.key });
  return new Response(familyReportCsv(report.entries, language), {
    headers: {
      ...responseHeaders,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": language === "zh"
        ? `attachment; filename="el-at-week-${report.key}.csv"; filename*=UTF-8''${encodeURIComponent(fileName)}`
        : `attachment; filename="${fileName}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
