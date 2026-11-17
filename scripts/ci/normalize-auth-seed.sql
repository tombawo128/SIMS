-- GoTrue v2.197 expects token columns on auth.users to be non-NULL.
-- The hand-seeded demo users omit these fields, and older/local schema defaults
-- can leave confirmation_token NULL, causing password sign-in to return HTTP 500.
-- Limit the normalization to the two isolated users used by the Storage API smoke test.
UPDATE auth.users
SET confirmation_token = ''
WHERE email IN ('student1@baystate.edu', 'student2@baystate.edu')
  AND confirmation_token IS NULL;
