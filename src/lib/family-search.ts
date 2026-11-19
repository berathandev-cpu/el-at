import { Prisma, type SpaceType, type TaskStatus } from "@prisma/client";

import { createTranslator, type Language } from "./i18n";
import { prisma } from "./prisma";

export type FamilySearchResult = {
  id: string;
  kind: "task" | "room";
  title: string;
  detail: string;
  href: string;
};

const turkishLetters = "ÇĞİIÖŞÜçğıöşü";
const foldedLetters = "cgiiosucgiosu";
const taskLimit = 8;
const roomLimit = 4;

/** Both sides fold Turkish letters before lowercasing, independently of locale. */
export function normalizeFamilySearchQuery(value: string): string | null {
  const query = value.trim().normalize("NFC");
  if (query.length > 160 || /\p{Cc}/u.test(query)) return null;
  const length = Array.from(query).length;
  if (length < 2 || length > 80) return null;
  return query.replace(/[ÇĞİIÖŞÜçğıöşü]/gu, (letter) =>
    foldedLetters.charAt(turkishLetters.indexOf(letter)),
  ).toLowerCase();
}

function folded(column: Prisma.Sql) {
  return Prisma.sql`lower(translate(normalize(${column}, NFC), ${turkishLetters}, ${foldedLetters}))`;
}

const taskStatusLabels: Record<TaskStatus, string> = {
  OPEN: "Açık",
  COMPLETED: "Onay bekliyor",
  APPROVED: "Onaylandı",
  REJECTED: "Düzeltme istendi",
  CANCELLED: "İptal edildi",
};

const roomTypeLabels: Record<SpaceType, string> = {
  ROOM: "Oda",
  TASK_ZONE: "Görev bölgesi",
};

type SearchRow =
  | { id: string; kind: "task"; title: string; state: TaskStatus; roomName: string; openToClaim: boolean }
  | { id: string; kind: "room"; title: string; state: SpaceType; roomName: null; openToClaim: false };

export async function searchFamily(userId: string, rawQuery: string, language: Language = "tr"): Promise<FamilySearchResult[]> {
  const query = normalizeFamilySearchQuery(rawQuery);
  if (!query) return [];
  const t = createTranslator(language);

  // The membership and visible records are checked in one database snapshot.
  // strpos keeps % and _ literal in search terms.
  const rows = await prisma.$queryRaw<SearchRow[]>`
    WITH viewer AS (
      SELECT family_id, role FROM family_members WHERE user_id = ${userId}
    ),
    task_matches AS (
      SELECT
        t.id, 'task' AS kind, t.title, t.status::text AS state,
        r.name AS "roomName", t.open_to_claim AS "openToClaim",
        CASE WHEN candidate.title = ${query} THEN 0
             WHEN strpos(candidate.title, ${query}) = 1 THEN 1
             WHEN strpos(candidate.title, ${query}) > 0 THEN 2
             ELSE 3 END AS relevance,
        CASE WHEN t.status IN ('OPEN', 'REJECTED', 'COMPLETED') THEN 0 ELSE 1 END AS archived,
        t.updated_at AS last_change
      FROM viewer v
      JOIN tasks t ON t.family_id = v.family_id
      JOIN rooms r ON r.id = t.room_id AND r.family_id = v.family_id
      CROSS JOIN LATERAL (
        SELECT ${folded(Prisma.sql`t.title`)} AS title,
               ${folded(Prisma.sql`coalesce(t.description, '')`)} AS description
      ) candidate
      WHERE (
        v.role IN ('MOTHER', 'FATHER')
        OR t.assigned_to_user_id = ${userId}
        OR (t.status = 'OPEN' AND t.open_to_claim AND t.assigned_to_user_id IS NULL)
      ) AND (strpos(candidate.title, ${query}) > 0 OR strpos(candidate.description, ${query}) > 0)
      ORDER BY relevance, archived, last_change DESC, t.id
      LIMIT ${taskLimit}
    ),
    room_matches AS (
      SELECT
        r.id, 'room' AS kind, r.name AS title, r.type::text AS state,
        NULL::text AS "roomName", false AS "openToClaim",
        CASE WHEN candidate.name = ${query} THEN 0
             WHEN strpos(candidate.name, ${query}) = 1 THEN 1
             ELSE 2 END AS relevance,
        0 AS archived, r.updated_at AS last_change
      FROM viewer v
      JOIN rooms r ON r.family_id = v.family_id
      CROSS JOIN LATERAL (SELECT ${folded(Prisma.sql`r.name`)} AS name) candidate
      WHERE strpos(candidate.name, ${query}) > 0
      ORDER BY relevance, archived, last_change DESC, r.id
      LIMIT ${roomLimit}
    )
    SELECT id, kind, title, state, "roomName", "openToClaim"
    FROM (SELECT * FROM task_matches UNION ALL SELECT * FROM room_matches) results
    ORDER BY relevance, archived, last_change DESC, kind, id
  `;

  return rows.map((result) => {
    const id = encodeURIComponent(result.id);
    if (result.kind === "room") {
      return {
        id: result.id, kind: result.kind, title: result.title,
        detail: t(roomTypeLabels[result.state]),
        href: `/ev/${id}`,
      };
    }
    const state = result.openToClaim && result.state === "OPEN"
      ? "Aileye açık"
      : taskStatusLabels[result.state];
    return {
      id: result.id, kind: result.kind, title: result.title,
      detail: `${result.roomName} · ${t(state)}`,
      href: `/gorevler#gorev-${id}`,
    };
  });
}
