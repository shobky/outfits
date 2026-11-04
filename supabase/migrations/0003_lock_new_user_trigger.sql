-- handle_new_user only runs as a trigger, so it shouldn't be callable through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
