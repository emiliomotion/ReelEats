-- Helper function to increment times_cooked atomically
create or replace function increment_times_cooked(recipe_id uuid)
returns void as $$
begin
  update recipes
  set times_cooked = times_cooked + 1
  where id = recipe_id;
end;
$$ language plpgsql security definer;
