import { createClient } from "@supabase/supabase-js";


const supabaseUrl = 'https://ayjfdicqjmyabpvcgfug.supabase.co';
const supabaseKey    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5amZkaWNxam15YWJwdmNnZnVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MDIwNjgsImV4cCI6MjA3OTQ3ODA2OH0.0do7nlSKDjT4fIBUH6lvVz-1_t7_e1Px9iVEbIU8kF0';
const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;

