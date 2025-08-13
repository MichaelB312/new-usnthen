import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Helper functions
export const uploadImage = async (file: File, path: string) => {
  const { data, error } = await supabase.storage
    .from('illustrations')
    .upload(path, file);
    
  if (error) throw error;
  
  const { data: { publicUrl } } = supabase.storage
    .from('illustrations')
    .getPublicUrl(path);
    
  return publicUrl;
};

export const saveBookToDatabase = async (bookData: any) => {
  const { data, error } = await supabase
    .from('memories')
    .insert(bookData)
    .select()
    .single();
    
  if (error) throw error;
  return data;
};
