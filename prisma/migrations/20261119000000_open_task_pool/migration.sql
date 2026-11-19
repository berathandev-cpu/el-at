ALTER TABLE "tasks"
    ADD COLUMN "open_to_claim" BOOLEAN NOT NULL DEFAULT false,
    ADD CONSTRAINT "tasks_open_to_claim_check" CHECK (
        NOT "open_to_claim" OR ("assigned_to_user_id" IS NULL AND "status" = 'OPEN')
    );
