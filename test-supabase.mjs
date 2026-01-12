import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

console.log('SUPABASE_URL:', supabaseUrl);
console.log('SUPABASE_ANON_KEY:', supabaseAnonKey ? 'SET (length: ' + supabaseAnonKey.length + ')' : 'NOT SET');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('\n--- Testing Supabase connection ---\n');

// Test 1: Check if profiles table exists
console.log('1. Checking profiles table...');
const { data: profiles, error: profileError } = await supabase
  .from('profiles')
  .select('*')
  .limit(1);

if (profileError) {
  console.error('❌ Error accessing profiles table:', profileError.message);
  console.error('   Code:', profileError.code);
  console.error('   Details:', profileError.details);
} else {
  console.log('✅ Profiles table exists!');
}

// Test 2: Try to sign up a test user
console.log('\n2. Testing signup...');
const testEmail = `test.${Date.now()}@gmail.com`;
const testPassword = 'testpassword123';

const { data: authData, error: authError } = await supabase.auth.signUp({
  email: testEmail,
  password: testPassword,
});

if (authError) {
  console.error('❌ Signup error:', authError.message);
  console.error('   Status:', authError.status);
} else {
  console.log('✅ Signup successful!');
  console.log('   User ID:', authData.user?.id);
  console.log('   Email:', authData.user?.email);
  console.log('   Session exists:', !!authData.session);
}

// Test 3: Check events table
console.log('\n3. Checking events table...');
const { data: events, error: eventsError } = await supabase
  .from('events')
  .select('*')
  .limit(1);

if (eventsError) {
  console.error('❌ Error accessing events table:', eventsError.message);
} else {
  console.log('✅ Events table exists! Found', events?.length || 0, 'events');
}

console.log('\n--- Test completed ---');
