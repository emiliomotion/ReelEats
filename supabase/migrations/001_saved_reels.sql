-- Saved reels bookmarking table
create extension if not exists "uuid-ossp";

create table saved_reels (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users on delete cascade not null,
  source_url    text not null,
  thumbnail_url text,
  title         text not null,
  cuisine       text,
  meal_type     text,
  dietary_tags  text[] default '{}',
  difficulty    text check (difficulty in ('easy', 'medium', 'hard')),
  tried         boolean not null default false,
  notes         text,
  created_at    timestamptz not null default now()
);

create index saved_reels_user_id_idx on saved_reels(user_id);
create index saved_reels_created_at_idx on saved_reels(created_at desc);
create index saved_reels_cuisine_idx on saved_reels(user_id, cuisine);
create index saved_reels_meal_type_idx on saved_reels(user_id, meal_type);
create index saved_reels_tried_idx on saved_reels(user_id, tried);

-- Full-text search on title + notes
alter table saved_reels add column search_vector tsvector
  generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(notes, ''))
  ) stored;

create index saved_reels_search_idx on saved_reels using gin(search_vector);

-- Row-level security
alter table saved_reels enable row level security;

create policy "Users see own saved reels" on saved_reels
  for all using (auth.uid() = user_id);
