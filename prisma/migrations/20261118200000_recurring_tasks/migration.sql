CREATE TYPE "recurring_task_frequency" AS ENUM ('DAILY', 'WEEKLY');

CREATE TABLE "recurring_task_rules" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "assigned_to_user_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "description" VARCHAR(280),
    "frequency" "recurring_task_frequency" NOT NULL,
    "weekday" INTEGER,
    "starts_on" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_task_rules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "recurring_task_rules_schedule_check" CHECK (
        ("frequency" = 'DAILY' AND "weekday" IS NULL) OR
        ("frequency" = 'WEEKLY' AND "weekday" IS NOT NULL AND "weekday" BETWEEN 1 AND 7)
    )
);

CREATE INDEX "recurring_task_rules_family_id_active_starts_on_idx"
    ON "recurring_task_rules"("family_id", "active", "starts_on");

ALTER TABLE "recurring_task_rules" ADD CONSTRAINT "recurring_task_rules_family_id_fkey"
    FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recurring_task_rules" ADD CONSTRAINT "recurring_task_rules_room_id_fkey"
    FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recurring_task_rules" ADD CONSTRAINT "recurring_task_rules_assigned_to_user_id_fkey"
    FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recurring_task_rules" ADD CONSTRAINT "recurring_task_rules_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tasks" ADD COLUMN "recurring_rule_id" TEXT,
    ADD COLUMN "occurrence_day" DATE;

CREATE UNIQUE INDEX "tasks_recurring_rule_id_occurrence_day_key"
    ON "tasks"("recurring_rule_id", "occurrence_day");

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_recurring_rule_id_fkey"
    FOREIGN KEY ("recurring_rule_id") REFERENCES "recurring_task_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
