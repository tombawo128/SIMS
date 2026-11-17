-- GoTrue v2.197 scans nullable token fields into Go strings. Hand-seeded
-- auth.users rows may contain NULL in these fields, causing password sign-in
-- to return HTTP 500 before Storage authorization can be exercised.
-- Normalize only the two isolated accounts used by the Storage API smoke test.
UPDATE auth.users
SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  reauthentication_token = COALESCE(reauthentication_token, '')
WHERE email IN ('student1@baystate.edu', 'student2@baystate.edu');
