import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://bpdgllhwfzaqhmppoftu.supabase.co";

const supabaseAnonKey = "sb_publishable__qwV9qGyXhC9-8QfiXvuqg_W9lEh6Jz";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
