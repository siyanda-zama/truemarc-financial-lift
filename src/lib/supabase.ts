import { createClient } from '@supabase/supabase-js'

// These environment variables are automatically provided by Lovable
const supabaseUrl = window.location.origin.includes('lovable.app') 
  ? `https://${window.location.hostname.split('.')[0]}.supabase.co` 
  : 'http://localhost:54321'

const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtb3F0ZWJ3dGtobHN3b3FheXBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM0Mzg0MDAsImV4cCI6MjA0OTAxNDQwMH0.Rb4mVkJhgNdjnLShAGUTUJT6Zn4QlR8JV4VFo2-mB8k'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)