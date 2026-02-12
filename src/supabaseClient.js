import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vznztplsjsmpspcfnvqk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6bnp0cGxzanNtcHNwY2ZudnFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1OTkzMjIsImV4cCI6MjA4NjE3NTMyMn0.oqlMDdSV6yEWQjY0fz9cbXYvsgaWyHY-9Gyzjv_Kj8Q'

export const supabase = createClient(supabaseUrl, supabaseKey)