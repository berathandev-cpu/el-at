CREATE TABLE "floor_plans" (
    "family_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "shapes" JSONB NOT NULL,

    CONSTRAINT "floor_plans_pkey" PRIMARY KEY ("family_id"),
    CONSTRAINT "floor_plans_family_id_fkey" FOREIGN KEY ("family_id")
        REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "floor_plans_revision_check" CHECK ("revision" > 0),
    CONSTRAINT "floor_plans_shapes_array_check" CHECK (jsonb_typeof("shapes") = 'array')
);
