CREATE TYPE "task_status" AS ENUM (
  'OPEN',
  'COMPLETED',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

CREATE TABLE "tasks" (
  "id" TEXT NOT NULL,
  "family_id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "assigned_to_user_id" TEXT,
  "created_by_user_id" TEXT NOT NULL,
  "status" "task_status" NOT NULL DEFAULT 'OPEN',
  "submitted_at" TIMESTAMP(3),
  "point_snapshot" INTEGER,
  "reviewed_at" TIMESTAMP(3),
  "reviewed_by_user_id" TEXT,
  "review_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "point_ledger" (
  "id" TEXT NOT NULL,
  "family_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "point_ledger_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "point_ledger_points_positive" CHECK ("points" > 0)
);

CREATE UNIQUE INDEX "point_ledger_task_id_key" ON "point_ledger"("task_id");
CREATE INDEX "tasks_family_id_status_idx" ON "tasks"("family_id", "status");
CREATE INDEX "tasks_assigned_to_user_id_status_idx" ON "tasks"("assigned_to_user_id", "status");
CREATE INDEX "point_ledger_family_id_created_at_idx" ON "point_ledger"("family_id", "created_at");
CREATE INDEX "point_ledger_user_id_created_at_idx" ON "point_ledger"("user_id", "created_at");

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_family_id_fkey"
  FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_assigned_to_user_id_fkey"
  FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "point_ledger"
  ADD CONSTRAINT "point_ledger_family_id_fkey"
  FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "point_ledger"
  ADD CONSTRAINT "point_ledger_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "point_ledger"
  ADD CONSTRAINT "point_ledger_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
