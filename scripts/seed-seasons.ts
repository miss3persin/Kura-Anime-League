import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';

// Load environment variables from .env.local
const projectRoot = process.cwd();
loadEnvConfig(projectRoot);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

async function seed() {
  console.log('Seeding seasons...');
  
  // Clear existing seasons to avoid conflicts during testing
  await supabaseAdmin.from('seasons').delete().neq('name', 'KEEP_NONE');

  const { data: winter, error: winterErr } = await supabaseAdmin.from('seasons').insert({
    name: 'Winter 2026',
    season_number: 1,
    status: 'active',
    start_date: '2026-01-01',
    end_date: '2026-03-31',
    week_number: 8,
    total_weeks: 12
  }).select().single();

  if (winterErr) console.error('Winter Error:', winterErr);
  else {
    console.log('Winter 2026 seeded:', winter.id);
    // Link anime to new winter season
    const { error: updErr } = await supabaseAdmin
      .from('anime_cache')
      .update({ season_uuid: winter.id })
      .eq('season_name', 'Winter 2026');
    if (updErr) console.error('Winter Update Error:', updErr);
  }

  const { data: spring, error: springErr } = await supabaseAdmin.from('seasons').insert({
    name: 'Spring 2026',
    season_number: 2,
    status: 'upcoming',
    draft_opens_at: '2026-02-25T00:00:00Z', // Opened a few days ago
    draft_closes_at: '2026-03-31T23:59:59Z',
    start_date: '2026-04-01',
    end_date: '2026-06-30',
    week_number: 0,
    total_weeks: 12
  }).select().single();

  if (springErr) console.error('Spring Error:', springErr);
  else {
    console.log('Spring 2026 seeded:', spring.id);
    // Link anime to new spring season
    const { error: updErr } = await supabaseAdmin
      .from('anime_cache')
      .update({ season_uuid: spring.id })
      .eq('season_name', 'Spring 2026');
    if (updErr) console.error('Spring Update Error:', updErr);
  }
}

seed().catch(console.error);
