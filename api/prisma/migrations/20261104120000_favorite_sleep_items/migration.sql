-- Sleep sounds and stories a user has hearted on Better Sleep / Sleep Stories.
CREATE TABLE "user_favorite_sleep_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sound_id" TEXT,
    "story_id" TEXT,
    "favorited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_favorite_sleep_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_favorite_sleep_items_one_item" CHECK (("sound_id" IS NULL) <> ("story_id" IS NULL))
);

CREATE UNIQUE INDEX "user_favorite_sleep_items_user_id_sound_id_key" ON "user_favorite_sleep_items"("user_id", "sound_id");
CREATE UNIQUE INDEX "user_favorite_sleep_items_user_id_story_id_key" ON "user_favorite_sleep_items"("user_id", "story_id");
CREATE INDEX "user_favorite_sleep_items_user_id_idx" ON "user_favorite_sleep_items"("user_id");

ALTER TABLE "user_favorite_sleep_items" ADD CONSTRAINT "user_favorite_sleep_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_favorite_sleep_items" ADD CONSTRAINT "user_favorite_sleep_items_sound_id_fkey" FOREIGN KEY ("sound_id") REFERENCES "sleep_sounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_favorite_sleep_items" ADD CONSTRAINT "user_favorite_sleep_items_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "sleep_stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
