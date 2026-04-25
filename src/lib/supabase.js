import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://egtbinceijroacdgobpv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVndGJpbmNlaWpyb2FjZGdvYnB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MjA0MTgsImV4cCI6MjA5MTI5NjQxOH0.WYslQyP3q4s3jnrDRhTbKyNR5FKt6gGxzG264Ks16RI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
