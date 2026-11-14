-- Demo dataset. All accounts use the password: Password123!

insert into public.universities (id, name, slug, domain, status) values
  ('11111111-1111-4111-8111-111111111101', 'Bay State University', 'bay-state', 'baystate.edu', 'active'),
  ('11111111-1111-4111-8111-111111111102', 'Northbridge Tech', 'northbridge', 'northbridge.edu', 'active');

insert into public.companies (id, name, slug, industry, website, status) values
  ('22222222-2222-4222-8222-222222222201', 'Acme Software', 'acme-software', 'Software', 'https://acme.example.com', 'active'),
  ('22222222-2222-4222-8222-222222222202', 'Globex Data', 'globex-data', 'Data & Analytics', 'https://globex.example.com', 'active'),
  ('22222222-2222-4222-8222-222222222203', 'Initech Finance', 'initech-finance', 'Financial Services', 'https://initech.example.com', 'active');

-- Auth users. The on_auth_user_created trigger builds profiles (and student_profiles).
-- Staff role/tenant assignments live in raw_app_meta_data with sims_provisioned = true,
-- mirroring what the invite-user function writes; public signup can never set this.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '99999999-9999-4999-8999-999999999001',
    'authenticated', 'authenticated', 'admin@sims.dev',
    crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"],"sims_provisioned":true,"role":"platform_admin"}'::jsonb,
    '{"full_name":"Morgan Ellis"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '99999999-9999-4999-8999-999999999002',
    'authenticated', 'authenticated', 'coordinator@baystate.edu',
    crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"],"sims_provisioned":true,"role":"coordinator","university_id":"11111111-1111-4111-8111-111111111101"}'::jsonb,
    '{"full_name":"Dana Whitfield"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '99999999-9999-4999-8999-999999999003',
    'authenticated', 'authenticated', 'coordinator@northbridge.edu',
    crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"],"sims_provisioned":true,"role":"coordinator","university_id":"11111111-1111-4111-8111-111111111102"}'::jsonb,
    '{"full_name":"Priya Raman"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '99999999-9999-4999-8999-999999999011',
    'authenticated', 'authenticated', 'faculty1@baystate.edu',
    crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"],"sims_provisioned":true,"role":"faculty_supervisor","university_id":"11111111-1111-4111-8111-111111111101"}'::jsonb,
    '{"full_name":"Dr. Alan Reyes"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '99999999-9999-4999-8999-999999999012',
    'authenticated', 'authenticated', 'faculty2@baystate.edu',
    crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"],"sims_provisioned":true,"role":"faculty_supervisor","university_id":"11111111-1111-4111-8111-111111111101"}'::jsonb,
    '{"full_name":"Dr. Lena Fischer"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '99999999-9999-4999-8999-999999999013',
    'authenticated', 'authenticated', 'faculty3@northbridge.edu',
    crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"],"sims_provisioned":true,"role":"faculty_supervisor","university_id":"11111111-1111-4111-8111-111111111102"}'::jsonb,
    '{"full_name":"Dr. Omar Haddad"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '99999999-9999-4999-8999-999999999021',
    'authenticated', 'authenticated', 'student1@baystate.edu',
    crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"],"sims_provisioned":true,"role":"student","university_id":"11111111-1111-4111-8111-111111111101"}'::jsonb,
    '{"full_name":"Ava Thompson","student_id":"BSU-2024-001","program":"Computer Science","year":"3"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '99999999-9999-4999-8999-999999999022',
    'authenticated', 'authenticated', 'student2@baystate.edu',
    crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"],"sims_provisioned":true,"role":"student","university_id":"11111111-1111-4111-8111-111111111101"}'::jsonb,
    '{"full_name":"Noah Kim","student_id":"BSU-2024-002","program":"Information Systems","year":"4"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '99999999-9999-4999-8999-999999999023',
    'authenticated', 'authenticated', 'student3@northbridge.edu',
    crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"],"sims_provisioned":true,"role":"student","university_id":"11111111-1111-4111-8111-111111111102"}'::jsonb,
    '{"full_name":"Sofia Alvarez","student_id":"NT-2024-010","program":"Data Science","year":"3"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '99999999-9999-4999-8999-999999999024',
    'authenticated', 'authenticated', 'student4@northbridge.edu',
    crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"],"sims_provisioned":true,"role":"student","university_id":"11111111-1111-4111-8111-111111111102"}'::jsonb,
    '{"full_name":"Liam Patel","student_id":"NT-2024-011","program":"Computer Engineering","year":"4"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '99999999-9999-4999-8999-999999999031',
    'authenticated', 'authenticated', 'supervisor1@acme.com',
    crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"],"sims_provisioned":true,"role":"site_supervisor","company_id":"22222222-2222-4222-8222-222222222201"}'::jsonb,
    '{"full_name":"Grace Okafor"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '99999999-9999-4999-8999-999999999032',
    'authenticated', 'authenticated', 'supervisor2@acme.com',
    crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"],"sims_provisioned":true,"role":"site_supervisor","company_id":"22222222-2222-4222-8222-222222222201"}'::jsonb,
    '{"full_name":"Ben Carter"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '99999999-9999-4999-8999-999999999033',
    'authenticated', 'authenticated', 'supervisor3@globex.com',
    crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"],"sims_provisioned":true,"role":"site_supervisor","company_id":"22222222-2222-4222-8222-222222222202"}'::jsonb,
    '{"full_name":"Hana Sato"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '99999999-9999-4999-8999-999999999034',
    'authenticated', 'authenticated', 'supervisor4@initech.com',
    crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"],"sims_provisioned":true,"role":"site_supervisor","company_id":"22222222-2222-4222-8222-222222222203"}'::jsonb,
    '{"full_name":"Victor Lang"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '99999999-9999-4999-8999-999999999041',
    'authenticated', 'authenticated', 'admin@acme.com',
    crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"],"sims_provisioned":true,"role":"company_admin","company_id":"22222222-2222-4222-8222-222222222201"}'::jsonb,
    '{"full_name":"Rosa Delgado"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '99999999-9999-4999-8999-999999999042',
    'authenticated', 'authenticated', 'admin@globex.com',
    crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"],"sims_provisioned":true,"role":"company_admin","company_id":"22222222-2222-4222-8222-222222222202"}'::jsonb,
    '{"full_name":"Ethan Brooks"}'::jsonb,
    now(), now()
  );

-- Demo identities represent already-approved users so authorization tests
-- exercise each role rather than the default pending-account state.
update public.profiles
set account_status = 'active'
where id::text like '99999999-9999-4999-8999-99999999%';

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(),
  u.id,
  u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  now(),
  now(),
  now()
from auth.users u
where u.id::text like '99999999-9999-4999-8999-99999999%';

update public.student_profiles set skills = array['TypeScript', 'React', 'SQL']
  where user_id = '99999999-9999-4999-8999-999999999021';
update public.student_profiles set skills = array['Java', 'Spring', 'SQL']
  where user_id = '99999999-9999-4999-8999-999999999022';
update public.student_profiles set skills = array['Python', 'Pandas', 'SQL']
  where user_id = '99999999-9999-4999-8999-999999999023';
update public.student_profiles set skills = array['C++', 'Python', 'MATLAB']
  where user_id = '99999999-9999-4999-8999-999999999024';

insert into public.job_postings (
  id, company_id, created_by, title, type, description, requirements, location,
  is_remote, duration_months, stipend, deadline, status, visibility, created_at
) values
  (
    '44444444-4444-4444-8444-444444440001',
    '22222222-2222-4222-8222-222222222201', '99999999-9999-4999-8999-999999999041',
    'Software Engineering Intern', 'internship',
    'Join the platform team for a 12-week internship. You will ship production React and TypeScript features, pair with senior engineers, and own a small service end-to-end. Expect code review, design discussions, and a real feature in production by week six.',
    'Currently enrolled in a CS or related program. Familiarity with JavaScript/TypeScript and Git. Bonus: React, Node.js, or PostgreSQL experience.',
    'Boston, MA', false, 12, '$2,800 / month', '2026-12-15', 'published', 'all_universities', now() - interval '20 days'
  ),
  (
    '44444444-4444-4444-8444-444444440002',
    '22222222-2222-4222-8222-222222222201', '99999999-9999-4999-8999-999999999041',
    'Junior Backend Developer', 'graduate_job',
    'Full-time role starting after graduation. You will build APIs and data pipelines in Node.js and PostgreSQL, work closely with product, and take part in our on-call rotation after a six-month ramp-up.',
    'Final-year students from Bay State University. Strong fundamentals in SQL and one backend language. No prior industry experience required.',
    'Boston, MA (hybrid)', true, null, '$78,000 / year', '2026-12-01', 'published', 'selected_universities', now() - interval '12 days'
  ),
  (
    '44444444-4444-4444-8444-444444440003',
    '22222222-2222-4222-8222-222222222202', '99999999-9999-4999-8999-999999999042',
    'Data Analyst Intern', 'internship',
    'Work with the analytics team to turn messy operational data into dashboards and recommendations. You will write SQL, maintain dbt models, and present findings to non-technical stakeholders.',
    'Comfortable with SQL and spreadsheets. Python or R a plus. Strong written communication.',
    'Remote (US)', true, 3, '$2,200 / month', '2026-11-30', 'published', 'all_universities', now() - interval '15 days'
  ),
  (
    '44444444-4444-4444-8444-444444440004',
    '22222222-2222-4222-8222-222222222202', '99999999-9999-4999-8999-999999999042',
    'Data Operations Assistant', 'part_time',
    'Part-time role supporting data quality and operations. Roughly 20 hours per week during term, fully remote. Ideal for a student who wants hands-on experience with production data systems.',
    'Open to Northbridge Tech students in their final two years. Detail-oriented and comfortable with Excel or Google Sheets.',
    'Remote (US)', true, 6, '$28 / hour', '2026-11-20', 'published', 'selected_universities', now() - interval '10 days'
  ),
  (
    '44444444-4444-4444-8444-444444440005',
    '22222222-2222-4222-8222-222222222203', '99999999-9999-4999-8999-999999999034',
    'Finance Intern', 'internship',
    'Support the FP&A team with monthly reporting, variance analysis, and process automation. This posting is being finalized and is not yet open for applications.',
    'Accounting or finance coursework. Advanced Excel.',
    'New York, NY', false, 10, '$2,000 / month', '2027-01-15', 'draft', 'all_universities', now() - interval '3 days'
  ),
  (
    '44444444-4444-4444-8444-444444440006',
    '22222222-2222-4222-8222-222222222203', '99999999-9999-4999-8999-999999999034',
    'Risk Analyst Graduate', 'graduate_job',
    'Two-year graduate program rotating through credit risk, market risk, and regulatory reporting.',
    'Graduating seniors with a quantitative degree.',
    'New York, NY', false, null, '$85,000 / year', '2026-09-30', 'closed', 'all_universities', now() - interval '60 days'
  );

insert into public.posting_universities (posting_id, university_id) values
  ('44444444-4444-4444-8444-444444440002', '11111111-1111-4111-8111-111111111101'),
  ('44444444-4444-4444-8444-444444440004', '11111111-1111-4111-8111-111111111102');

insert into public.applications (
  id, posting_id, student_id, university_id, company_id, cover_letter, status,
  reviewed_by, reviewed_at, rejection_reason, created_at
) values
  (
    '55555555-5555-4555-8555-555555550001',
    '44444444-4444-4444-8444-444444440001', '99999999-9999-4999-8999-999999999021',
    '11111111-1111-4111-8111-111111111101', '22222222-2222-4222-8222-222222222201',
    'I have built two production React apps during coursework and would love to work on a real product team. I learn quickly and enjoy code review.',
    'accepted', '99999999-9999-4999-8999-999999999041', now() - interval '50 days', null, now() - interval '55 days'
  ),
  (
    '55555555-5555-4555-8555-555555550002',
    '44444444-4444-4444-8444-444444440001', '99999999-9999-4999-8999-999999999022',
    '11111111-1111-4111-8111-111111111101', '22222222-2222-4222-8222-222222222201',
    'I am looking to strengthen my frontend skills and contribute to a shipping product. My coursework included a full-stack capstone.',
    'submitted', null, null, null, now() - interval '8 days'
  ),
  (
    '55555555-5555-4555-8555-555555550003',
    '44444444-4444-4444-8444-444444440003', '99999999-9999-4999-8999-999999999023',
    '11111111-1111-4111-8111-111111111102', '22222222-2222-4222-8222-222222222202',
    'I enjoy turning raw data into decisions and would like to work with a real analytics team.',
    'rejected', '99999999-9999-4999-8999-999999999042', now() - interval '30 days', 'Student accepted another opportunity', now() - interval '40 days'
  ),
  (
    '55555555-5555-4555-8555-555555550004',
    '44444444-4444-4444-8444-444444440004', '99999999-9999-4999-8999-999999999023',
    '11111111-1111-4111-8111-111111111102', '22222222-2222-4222-8222-222222222202',
    'I am interested in data operations and can commit 20 hours per week alongside my studies.',
    'accepted', '99999999-9999-4999-8999-999999999042', now() - interval '41 days', null, now() - interval '45 days'
  ),
  (
    '55555555-5555-4555-8555-555555550005',
    '44444444-4444-4444-8444-444444440003', '99999999-9999-4999-8999-999999999024',
    '11111111-1111-4111-8111-111111111102', '22222222-2222-4222-8222-222222222202',
    'My engineering background helps me ask good questions of data. I would like to move toward analytics.',
    'shortlisted', '99999999-9999-4999-8999-999999999042', now() - interval '6 days', null, now() - interval '20 days'
  ),
  (
    '55555555-5555-4555-8555-555555550006',
    '44444444-4444-4444-8444-444444440002', '99999999-9999-4999-8999-999999999022',
    '11111111-1111-4111-8111-111111111101', '22222222-2222-4222-8222-222222222201',
    'I graduate next spring and want to stay in Boston. I have strong SQL and Java fundamentals.',
    'under_review', '99999999-9999-4999-8999-999999999041', now() - interval '2 days', null, now() - interval '9 days'
  ),
  (
    '55555555-5555-4555-8555-555555550007',
    '44444444-4444-4444-8444-444444440003', '99999999-9999-4999-8999-999999999021',
    '11111111-1111-4111-8111-111111111101', '22222222-2222-4222-8222-222222222202',
    'I would love to add analytics experience to my product engineering background.',
    'rejected', '99999999-9999-4999-8999-999999999042', now() - interval '18 days', 'Position filled', now() - interval '25 days'
  ),
  (
    '55555555-5555-4555-8555-555555550008',
    '44444444-4444-4444-8444-444444440004', '99999999-9999-4999-8999-999999999024',
    '11111111-1111-4111-8111-111111111102', '22222222-2222-4222-8222-222222222202',
    'I am organized, comfortable with spreadsheets, and looking for part-time work during my final year.',
    'submitted', null, null, null, now() - interval '4 days'
  ),
  (
    '55555555-5555-4555-8555-555555550009',
    '44444444-4444-4444-8444-444444440003', '99999999-9999-4999-8999-999999999022',
    '11111111-1111-4111-8111-111111111101', '22222222-2222-4222-8222-222222222202',
    'Draft application - still refining my cover letter.',
    'draft', null, null, null, now() - interval '1 day'
  );

insert into public.placements (
  id, application_id, student_id, university_id, company_id, posting_id,
  site_supervisor_id, faculty_supervisor_id, start_date, end_date, status, created_at
) values
  (
    '66666666-6666-4666-8666-666666660001',
    '55555555-5555-4555-8555-555555550001', '99999999-9999-4999-8999-999999999021',
    '11111111-1111-4111-8111-111111111101', '22222222-2222-4222-8222-222222222201',
    '44444444-4444-4444-8444-444444440001', '99999999-9999-4999-8999-999999999031',
    '99999999-9999-4999-8999-999999999011', '2026-09-15', '2026-12-15', 'active', now() - interval '50 days'
  ),
  (
    '66666666-6666-4666-8666-666666660002',
    '55555555-5555-4555-8555-555555550004', '99999999-9999-4999-8999-999999999023',
    '11111111-1111-4111-8111-111111111102', '22222222-2222-4222-8222-222222222202',
    '44444444-4444-4444-8444-444444440004', '99999999-9999-4999-8999-999999999033',
    '99999999-9999-4999-8999-999999999013', '2026-10-01', '2027-03-31', 'active', now() - interval '41 days'
  );

insert into public.weekly_logs (
  id, placement_id, week_number, hours, tasks, learning_outcomes, status,
  supervisor_comment, submitted_at, reviewed_at, reviewed_by, created_at
) values
  (
    '77777777-7777-4777-8777-777777770001', '66666666-6666-4666-8666-666666660001', 1, 32,
    'Onboarded to the monorepo, set up local development, and shipped a small UI bug fix.',
    'Learned the team code review process and how feature flags are used.',
    'approved', 'Good first week. Keep asking questions.', now() - interval '46 days', now() - interval '45 days',
    '99999999-9999-4999-8999-999999999031', now() - interval '47 days'
  ),
  (
    '77777777-7777-4777-8777-777777770002', '66666666-6666-4666-8666-666666660001', 2, 36,
    'Built a filter component and added tests. Paired with a senior engineer on the data layer.',
    'Improved my understanding of React state management and integration tests.',
    'approved', 'Nice progress on tests.', now() - interval '39 days', now() - interval '38 days',
    '99999999-9999-4999-8999-999999999031', now() - interval '40 days'
  ),
  (
    '77777777-7777-4777-8777-777777770003', '66666666-6666-4666-8666-666666660001', 3, 34,
    'Started work on the onboarding flow and reviewed two pull requests.',
    'Practiced giving constructive code review feedback.',
    'submitted', null, now() - interval '5 days', null, null, now() - interval '6 days'
  ),
  (
    '77777777-7777-4777-8777-777777770004', '66666666-6666-4666-8666-666666660001', 4, 28,
    'Implemented empty states and fixed accessibility issues.',
    'Learned how accessibility checks are run in CI.',
    'needs_revision', 'Please add a more specific outcome for the accessibility work.',
    now() - interval '4 days', now() - interval '3 days', '99999999-9999-4999-8999-999999999031', now() - interval '5 days'
  ),
  (
    '77777777-7777-4777-8777-777777770005', '66666666-6666-4666-8666-666666660002', 1, 20,
    'Learned the data quality checklist and cleaned a batch of customer records.',
    'Understood how source systems feed the warehouse.',
    'approved', 'Solid start.', now() - interval '34 days', now() - interval '33 days',
    '99999999-9999-4999-8999-999999999033', now() - interval '35 days'
  ),
  (
    '77777777-7777-4777-8777-777777770006', '66666666-6666-4666-8666-666666660002', 2, 22,
    'Automated a weekly reconciliation report and documented the process.',
    'Learned how to validate data before publishing a report.',
    'submitted', null, now() - interval '2 days', null, null, now() - interval '3 days'
  ),
  (
    '77777777-7777-4777-8777-777777770007', '66666666-6666-4666-8666-666666660002', 3, 18,
    'Drafted a data dictionary for the operations dataset.',
    'Practiced writing documentation for non-technical readers.',
    'draft', null, null, null, null, now() - interval '1 day'
  );

insert into public.evaluations (
  id, placement_id, evaluator_id, evaluator_role, type, rubric_scores, comments, overall_score, created_at
) values
  (
    '88888888-8888-4888-8888-888888880001', '66666666-6666-4666-8666-666666660001',
    '99999999-9999-4999-8999-999999999031', 'site_supervisor', 'midterm',
    '{"professionalism": 4, "technical_skill": 5, "communication": 4, "initiative": 4}'::jsonb,
    'Ava is ahead of where we expect an intern to be at midterm. Strong technical execution; keep working on writing up decisions.',
    4.25, now() - interval '20 days'
  ),
  (
    '88888888-8888-4888-8888-888888880002', '66666666-6666-4666-8666-666666660002',
    '99999999-9999-4999-8999-999999999033', 'site_supervisor', 'midterm',
    '{"professionalism": 4, "technical_skill": 4, "communication": 4, "initiative": 4}'::jsonb,
    'Sofia has been reliable and thorough. Good progress on automation.',
    4.0, now() - interval '14 days'
  );

insert into public.check_ins (
  id, placement_id, faculty_supervisor_id, type, notes, occurred_at
) values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001', '66666666-6666-4666-8666-666666660001',
    '99999999-9999-4999-8999-999999999011', 'visit',
    'Met with Grace and Ava on site. Ava is integrating well with the team. Discussed the midterm evaluation and remaining coursework deadlines.',
    now() - interval '18 days'
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0002', '66666666-6666-4666-8666-666666660002',
    '99999999-9999-4999-8999-999999999013', 'call',
    'Called Sofia and Hana. Sofia is managing the part-time schedule well. Confirmed the final report timeline.',
    now() - interval '7 days'
  );

insert into public.notifications (id, user_id, title, body, link, read_at, created_at) values
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0001', '99999999-9999-4999-8999-999999999021',
    'Weekly log needs revision', 'Your week 4 log needs a more specific learning outcome.',
    '/placements/66666666-6666-4666-8666-666666660001', null, now() - interval '3 days'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0002', '99999999-9999-4999-8999-999999999022',
    'Application update', 'Your application for Junior Backend Developer is under review.',
    '/applications', now() - interval '1 day', now() - interval '2 days'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0003', '99999999-9999-4999-8999-999999999031',
    'Weekly log submitted', 'Ava submitted a weekly log for review.',
    '/placements/66666666-6666-4666-8666-666666660001', null, now() - interval '5 days'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0004', '99999999-9999-4999-8999-999999999002',
    'New placement recorded', 'A student from your university has been placed at Acme Software.',
    '/placements/66666666-6666-4666-8666-666666660001', now() - interval '45 days', now() - interval '50 days'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0005', '99999999-9999-4999-8999-999999999013',
    'Weekly log submitted', 'Sofia submitted a weekly log for review.',
    '/placements/66666666-6666-4666-8666-666666660002', null, now() - interval '2 days'
  );
