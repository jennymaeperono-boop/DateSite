# tandem — a little date planner

A responsive, no-build date-planning website made with HTML, CSS, and JavaScript. It lets you plan a date, search for or pin a place on an OpenStreetMap map, and save and view shared plans with Supabase.

## Run it locally

Because the site uses JavaScript modules, serve the project with a local web server instead of opening `index.html` directly. For example, with Node.js installed:

```sh
npx serve .
```

Then open the local URL printed by the server.

## Connect Supabase

1. Create a Supabase project.
2. In the Supabase SQL Editor, run the schema and policies below.
3. In Supabase **Project Settings → API**, copy the Project URL and the **anon/public** key into `supabase-config.js`.
4. Serve or deploy the site and check that it can load and save plans.

The anon key is intended for browser use; never put a `service_role` key in this site. This no-sign-in version intentionally makes date plans publicly readable and allows anonymous visitors to add plans. Anyone who can access the website can read the messages and plans and submit new ones. Do not store anything private or sensitive here.

```sql
create table if not exists public.date_plans (
  id uuid primary key default gen_random_uuid(),
  date_type text not null check (char_length(date_type) between 1 and 100),
  location text not null check (char_length(location) between 1 and 160),
  plan_date date not null,
  plan_time time not null,
  activities text check (activities is null or char_length(activities) <= 1000),
  eatery text check (eatery is null or char_length(eatery) <= 160),
  message text check (message is null or char_length(message) <= 1000),
  map_lat double precision,
  map_lng double precision,
  created_at timestamptz not null default now(),
  check (
    (map_lat is null and map_lng is null)
    or (map_lat between -90 and 90 and map_lng between -180 and 180)
  )
);

alter table public.date_plans enable row level security;

grant usage on schema public to anon;
grant select, insert on public.date_plans to anon;

create policy "Anyone can view date plans"
  on public.date_plans for select to anon
  using (true);

create policy "Anyone can add date plans"
  on public.date_plans for insert to anon
  with check (true);
```

## Publish with GitHub Pages

Push the repository to GitHub, then open **Settings → Pages**. Choose **Deploy from a branch**, select your branch and the repository root (`/`), and save. The site is static, so no build command is needed. Configure Supabase before publishing.

The map uses OpenStreetMap tiles and Nominatim place search. Keep the map attribution visible; place search runs only when someone submits a search.