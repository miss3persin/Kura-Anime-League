import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';

// Load variables before any business logic
loadEnvConfig(process.cwd());

// Now import the refresh cycle, which depends on those variables
import { runRefreshCycle } from '../src/lib/refreshCycle';

async function trigger() {
  console.log('Triggering refresh cycle...');
  const result = await runRefreshCycle('manual_seed_script');
  console.log('Result:', JSON.stringify(result, null, 2));

  // Access fresh env vars after loading
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
