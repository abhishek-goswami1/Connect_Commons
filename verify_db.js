import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log("=== Checking Tables ===");
  const tablesToCheck = ['assignments', 'assignment_users', 'assignment_files', 'profiles', 'submissions', 'submission_files', 'submission_feedback'];
  
  for (const table of tablesToCheck) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`[FAIL] Table ${table}: ${error.message}`);
    } else {
      console.log(`[PASS] Table ${table} exists.`);
    }
  }

  console.log("\n=== Checking Storage Buckets ===");
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  if (bucketsError) {
    console.log(`[FAIL] Storage: ${bucketsError.message}`);
  } else {
    const bucketNames = buckets.map(b => b.name);
    console.log("Buckets found:", bucketNames.join(', '));
    const requiredBuckets = ['assignment-reference-files', 'assignment-submissions'];
    for (const b of requiredBuckets) {
      if (bucketNames.includes(b)) {
         console.log(`[PASS] Bucket ${b} exists.`);
      } else {
         console.log(`[FAIL] Bucket ${b} is missing.`);
      }
    }
  }
}

runTests();
