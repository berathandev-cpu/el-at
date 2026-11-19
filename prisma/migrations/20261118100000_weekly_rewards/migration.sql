CREATE TABLE "weekly_rewards" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "week_start" TIMESTAMP(3) NOT NULL,
    "title" VARCHAR(100) NOT NULL,

    CONSTRAINT "weekly_rewards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "weekly_rewards_family_id_week_start_key"
    ON "weekly_rewards"("family_id", "week_start");

ALTER TABLE "weekly_rewards" ADD CONSTRAINT "weekly_rewards_family_id_fkey"
    FOREIGN KEY ("family_id") REFERENCES "families"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
