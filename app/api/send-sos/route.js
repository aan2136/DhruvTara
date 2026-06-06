import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(req) {
  try {
    const { userId, lat, lng, reason, vehicleNumber } = await req.json();

    const mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
    const time = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true
    });

    // Get emergency contacts
    const { data: contacts } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', userId);

    // Get user info
    const { data: users } = await supabase
      .from('users')
      .select('name, phone')
      .eq('id', userId);

    const userName = users?.[0]?.name || 'Someone';
    const vehicle = vehicleNumber || 'Unknown';

    const message = `🚨 EMERGENCY ALERT from DhruvTara!

${userName} needs help RIGHT NOW!

📍 Live Location: ${mapsLink}
🚗 Vehicle: ${vehicle}
⏰ Time: ${time}
⚠️ Reason: ${reason}

Please call them immediately or go to their location.
This is an automated SOS from DhruvTara Safety App.`;

    // Send WhatsApp via Twilio
    const results = [];
    for (const contact of (contacts || [])) {
      try {
        const twilioRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + Buffer.from(
                `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
              ).toString('base64'),
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              From: `whatsapp:${process.env.TWILIO_PHONE}`,
              To: `whatsapp:+91${contact.contact_phone}`,
              Body: message
            })
          }
        );

        // Also send regular SMS as backup
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + Buffer.from(
                `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
              ).toString('base64'),
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              From: process.env.TWILIO_PHONE,
              To: `+91${contact.contact_phone}`,
              Body: message
            })
          }
        );

        results.push({ contact: contact.contact_name, sent: twilioRes.ok });
      } catch(e) {
        results.push({ contact: contact.contact_name, sent: false, error: e.message });
      }
    }

    // Save SOS to database
    await supabase.from('sos_alerts').insert([{
      user_id: userId,
      latitude: lat,
      longitude: lng,
      reason,
      vehicle_number: vehicleNumber,
      contacts_notified: results.filter(r=>r.sent).length,
      maps_link: mapsLink,
      created_at: new Date().toISOString()
    }]);

    return NextResponse.json({
      success: true,
      message: `SOS sent to ${results.filter(r=>r.sent).length} contacts`,
      results,
      mapsLink
    });

  } catch(e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}