# Database workflow (Supabase CLI migrations)

1. **Create a new migration**
   - Install and log into the Supabase CLI, then run `supabase migration new <short-description>` from the repo root.
   - The CLI scaffolds `supabase/migrations/<timestamp>_<name>.sql`; edit that file to include the new schema change or helper SQL.
   - Keep each migration focused on one logical change and avoid destructive ops unless absolutely necessary (document any drops with a comment).

2. **Apply migrations locally**
   - Start from a clean local dev database and run `supabase db reset --force --project-ref ginulfnipylayhsxcmzh` (this recreates the local DB and clears data).
   - Next, run `supabase db push --project-ref ginulfnipylayhsxcmzh` to execute every migration in `supabase/migrations/`.
   - Run `supabase db diff origin/main --project-ref ginulfnipylayhsxcmzh` if you need to compare the current state against an existing remote before pushing new migrations.

3. **Push migrations to remote**
   - After verifying the diff, run `supabase db push --project-ref ginulfnipylayhsxcmzh` again to ensure the remote is in sync.
   - If you added seeded rows (`supabase/seed/*.sql`), execute them separately via `supabase db run supabase/seed/<file>.sql` or use your deployment process to run them after `db push`.

4. **Handle rollbacks**
   - Supabase migrations are append-only. To roll back, revert the offending migration file via Git, then run `supabase db reset --force` locally to rebuild from scratch and `supabase db push` to replay the adjusted history.
   - For remote emergencies, create a corrective migration that reverses the unwanted change instead of deleting past migrations.

5. **Remote safety checks**
   - Before every deployment, run `supabase db diff --project-ref ginulfnipylayhsxcmzh` to confirm no drift exists between the local migration history and the live database.
   - Never edit the remote schema directly; always make schema adjustments through migrations, even when hot-fixing production tables.
