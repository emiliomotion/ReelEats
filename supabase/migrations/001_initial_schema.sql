-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- Recipes
create table recipes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  summary text,
  creator_handle text,
  source_url text,
  thumbnail_url text,
  cuisine text,
  dietary_tags text[] default '{}',
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  total_time_min int,
  active_time_min int,
  servings int,
  is_recipe boolean not null default true,
  low_audio_signal boolean not null default false,
  favorited boolean not null default false,
  times_cooked int not null default 0,
  user_rating int check (user_rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ingredients
create table ingredients (
  id uuid primary key default uuid_generate_v4(),
  recipe_id uuid references recipes on delete cascade not null,
  position int not null default 0,
  item text not null,
  quantity numeric,
  unit text,
  descriptor text,
  was_vague boolean not null default false,
  notes text[] default '{}',
  confidence numeric not null default 1.0 check (confidence between 0 and 1)
);

-- Steps
create table steps (
  id uuid primary key default uuid_generate_v4(),
  recipe_id uuid references recipes on delete cascade not null,
  position int not null default 0,
  instruction text not null,
  duration_sec int,
  approximate boolean not null default false,
  temperature text,
  confidence numeric not null default 1.0 check (confidence between 0 and 1)
);

-- Equipment
create table equipment (
  id uuid primary key default uuid_generate_v4(),
  recipe_id uuid references recipes on delete cascade not null,
  item text not null
);

-- Cook logs
create table cook_logs (
  id uuid primary key default uuid_generate_v4(),
  recipe_id uuid references recipes on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  cooked_at timestamptz not null default now(),
  rating int check (rating between 1 and 5),
  notes text
);

-- Shopping lists
create table shopping_lists (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null default 'My Shopping List',
  created_at timestamptz not null default now()
);

-- Shopping list items
create table shopping_list_items (
  id uuid primary key default uuid_generate_v4(),
  shopping_list_id uuid references shopping_lists on delete cascade not null,
  item text not null,
  quantity numeric,
  unit text,
  category text,
  checked boolean not null default false,
  source_recipe_id uuid references recipes on delete set null
);

-- Raw inputs (retained for learning loop)
create table raw_inputs (
  id uuid primary key default uuid_generate_v4(),
  recipe_id uuid references recipes on delete cascade not null,
  caption text,
  transcript jsonb default '[]',
  ocr_frames jsonb default '[]',
  user_corrections jsonb
);

-- Indexes
create index recipes_user_id_idx on recipes(user_id);
create index recipes_created_at_idx on recipes(created_at desc);
create index recipes_favorited_idx on recipes(user_id, favorited) where favorited = true;

create index ingredients_recipe_id_idx on ingredients(recipe_id);
create index ingredients_item_trgm_idx on ingredients using gin(item gin_trgm_ops);

create index steps_recipe_id_idx on steps(recipe_id);

-- Full-text search on recipes
alter table recipes add column search_vector tsvector
  generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(cuisine, '') || ' ' || coalesce(creator_handle, ''))
  ) stored;

create index recipes_search_idx on recipes using gin(search_vector);

-- Updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger recipes_updated_at
  before update on recipes
  for each row execute function update_updated_at();

-- Row-level security
alter table recipes enable row level security;
alter table ingredients enable row level security;
alter table steps enable row level security;
alter table equipment enable row level security;
alter table cook_logs enable row level security;
alter table shopping_lists enable row level security;
alter table shopping_list_items enable row level security;
alter table raw_inputs enable row level security;

-- RLS Policies
create policy "Users see own recipes" on recipes
  for all using (auth.uid() = user_id);

create policy "Users see own ingredients" on ingredients
  for all using (
    exists (select 1 from recipes where recipes.id = ingredients.recipe_id and recipes.user_id = auth.uid())
  );

create policy "Users see own steps" on steps
  for all using (
    exists (select 1 from recipes where recipes.id = steps.recipe_id and recipes.user_id = auth.uid())
  );

create policy "Users see own equipment" on equipment
  for all using (
    exists (select 1 from recipes where recipes.id = equipment.recipe_id and recipes.user_id = auth.uid())
  );

create policy "Users see own cook logs" on cook_logs
  for all using (auth.uid() = user_id);

create policy "Users see own shopping lists" on shopping_lists
  for all using (auth.uid() = user_id);

create policy "Users see own shopping list items" on shopping_list_items
  for all using (
    exists (select 1 from shopping_lists where shopping_lists.id = shopping_list_items.shopping_list_id and shopping_lists.user_id = auth.uid())
  );

create policy "Users see own raw inputs" on raw_inputs
  for all using (
    exists (select 1 from recipes where recipes.id = raw_inputs.recipe_id and recipes.user_id = auth.uid())
  );
