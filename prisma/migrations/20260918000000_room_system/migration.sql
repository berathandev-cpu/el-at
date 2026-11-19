-- FAZ-3: oda sistemi / ev haritası (rooms, space_type enum)

CREATE TYPE "space_type" AS ENUM ('ROOM', 'TASK_ZONE');

CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "space_type" NOT NULL DEFAULT 'ROOM',
    "base_score" INTEGER NOT NULL,
    "last_cleaned_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- Aynı evde aynı isimde iki oda olmasın (kendi kararım, doc'ta belirtilmedi).
CREATE UNIQUE INDEX "rooms_family_id_name_key" ON "rooms"("family_id", "name");

ALTER TABLE "rooms" ADD CONSTRAINT "rooms_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
