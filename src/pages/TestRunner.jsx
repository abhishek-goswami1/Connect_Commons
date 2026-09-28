import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

export default function TestRunner() {
  const [results, setResults] = useState("Running tests...");

  useEffect(() => {
    async function runTests() {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseKey) {
          setResults("Error: No service role key found in env.");
          return;
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        
        let report = {
          tables: {},
          buckets: {},
          policies: []
        };

        // 1. Check Tables
        const { data: tablesData, error: tablesErr } = await supabase.rpc('get_tables_info').catch(() => ({ data: null }));
        // Since we don't have rpc, let's query the tables directly by trying to select 0 rows
        const tablesToCheck = [
          "assignments", "assignment_users", "assignment_files",
          "submissions", "submission_files", "submission_feedback",
          "profiles"
        ];
        
        for (const t of tablesToCheck) {
          const { error } = await supabase.from(t).select('id').limit(1);
          report.tables[t] = error ? `Error: ${error.message}` : "Exists";
        }

        // 2. Check Buckets
        const { data: bucketsData, error: bucketsErr } = await supabase.storage.listBuckets();
        if (bucketsErr) {
          report.buckets.error = bucketsErr.message;
        } else {
          const buckets = bucketsData.map(b => b.name);
          report.buckets['assignment-reference-files'] = buckets.includes('assignment-reference-files') ? "Exists" : "Missing";
          report.buckets['assignment-submissions'] = buckets.includes('assignment-submissions') ? "Exists" : "Missing";
          report.buckets._all = buckets;
        }

        // 3. Try to query policies via REST is hard without a function. 
        // We will just report table and bucket existence.
        
        setResults(JSON.stringify(report, null, 2));
      } catch (err) {
        setResults("Exception: " + err.message);
      }
    }
    runTests();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Test Runner Results</h1>
      <pre id="test-results">{results}</pre>
    </div>
  );
}
