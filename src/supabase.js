import { createClient } from "@supabase/supabase-js";


const supabaseUrl = 'https://yohvywgovsyyokbyetjv.supabase.co';
const supabaseKey    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvaHZ5d2dvdnN5eW9rYnlldGp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NTI4MDIsImV4cCI6MjA3NzQyODgwMn0.i5Id0oIfdxN9IvRYBnMKeUVsIvOZyvCpL_Tn9smGxkg';
const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;

