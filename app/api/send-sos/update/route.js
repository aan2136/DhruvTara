import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(req) {
  try {
    const { sosId, lat, lng } = await req.json();
    
    await supabase.from('sos_alerts')
      .update({ 
        latitude: lat, 
        longitude: lng,
        maps_link: `https://maps.google.com/?q=${lat},${lng}`,
        last_updated: new Date().toISOString()
      })
      .eq('id', sosId);

    return NextResponse.json({ success: true });
  } catch(e) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}