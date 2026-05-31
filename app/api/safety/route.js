import { NextResponse } from 'next/server';
import { getAreaSafetyScore } from '../../../lib/safetyML.js';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat'));
  const lng = parseFloat(searchParams.get('lng'));

  if (!lat || !lng) return NextResponse.json({ error: 'Missing coordinates' }, { status: 400 });

  const result = await getAreaSafetyScore(lat, lng);
  return NextResponse.json(result);
}