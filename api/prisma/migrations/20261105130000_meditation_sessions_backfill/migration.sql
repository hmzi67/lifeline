-- Favourites and the player work through a meditation's session, but meditations added in
-- the admin never got one. Give every meditation without a session an empty one; its length
-- can then be set from the admin.
INSERT INTO "meditation_sessions" ("id", "meditation_id", "duration_minutes")
SELECT 'ms' || substr(md5(random()::text || m."id"), 1, 23), m."id", NULL
FROM "meditations" m
WHERE NOT EXISTS (SELECT 1 FROM "meditation_sessions" s WHERE s."meditation_id" = m."id");
