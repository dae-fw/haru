-- Optional starter projects. Run AFTER you've signed in once (so auth.uid() resolves
-- to your user in the SQL editor you must replace :uid, or just add projects from the app).
-- Easiest: add projects from the Settings screen in the app instead of running this.

insert into public.projects (name, color, sort) values
  ('Personal',  '#3A46B8', 0),
  ('Northwind',  '#0E6B5C', 1),
  ('Acme',       '#8A5CF6', 2)
on conflict do nothing;
