-- An Apple subject identifies exactly one Lifeline account. PostgreSQL unique
-- indexes still permit multiple NULL values for users without Apple auth.
CREATE UNIQUE INDEX "users_subject_key" ON "users"("subject");
