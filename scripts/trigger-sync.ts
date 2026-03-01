import { runRefreshCycle } from '../src/lib/refreshCycle';
import { createClient } from '@supabase/supabase-js';

async function trigger() {
  console.log('Triggering refresh cycle...');
  const result = await runRefreshCycle('manual_seed_script');
  console.log('Result:', JSON.stringify(result, null, 2));

  // Purge any existing adult content that might have been imported previously
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

  console.log('Purging adult content...');
  const { count, error } = await supabaseAdmin
    .from('anime_cache')
    .delete()
    .eq('is_adult', true);

  if (error) console.error('Purge error:', error);
  else console.log(`Purged adult content records.`);
}

trigger().catch(console.error);
