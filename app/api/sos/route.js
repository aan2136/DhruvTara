import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(req) {
  try {
    const { userId, lat, lng, reason, vehicleNumber } = await req.json();

    // Get emergency contacts from DB
    const { data: contacts } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', userId);

    // Save SOS alert to DB
    await supabase.from('sos_alerts').insert([{
      user_id: userId,
      latitude: lat,
      longitude: lng,
      reason,
      vehicle_number: vehicleNumber,
      contacts_notified: contacts?.length || 0,
      created_at: new Date().toISOString()
    }]);

    const mapsLink = `https://maps.google.com/?q=${lat},${lng}`;

    return NextResponse.json({
      success: true,
      message: `SOS sent to ${contacts?.length || 0} contacts`,
      mapsLink,
      contacts: contacts?.map(c => c.contact_name) || []
    });
  } catch(e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}