-- Optional starter projects. Easiest is to add projects from the app's Settings
-- screen after signing in (so user_id resolves to you automatically).

insert into public.haru_projects (name, color, sort) values
  ('Personal',  '#3A46B8', 0),
  ('Northwind',  '#0E6B5C', 1),
  ('Acme',       '#8A5CF6', 2)
on conflict do nothing;
