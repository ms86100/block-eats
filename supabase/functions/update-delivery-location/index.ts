import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/** Haversine distance in meters */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** ETA in minutes based on distance + speed */
function calculateEta(distanceMeters: number, speedKmh: number | null): number {
  const speed = speedKmh && speedKmh > 2 ? speedKmh : 15; // default 15 km/h
  const roadFactor = 1.3;
  const distKm = (distanceMeters * roadFactor) / 1000;
  return Math.max(1, Math.round((distKm / speed) * 60));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { assignment_id, latitude, longitude, speed_kmh, heading, accuracy_meters } = await req.json();

    if (!assignment_id || latitude == null || longitude == null) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get assignment + order + society location
    const { data: assignment, error: aErr } = await supabase
      .from('delivery_assignments')
      .select('id, status, order_id, society_id, partner_id')
      .eq('id', assignment_id)
      .single();

    if (aErr || !assignment) {
      return new Response(JSON.stringify({ error: 'Assignment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only allow updates for active deliveries
    if (['delivered', 'failed', 'cancelled'].includes(assignment.status)) {
      return new Response(JSON.stringify({ error: 'Delivery is no longer active' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert location record
    const { error: locErr } = await supabase
      .from('delivery_locations')
      .insert({
        assignment_id,
        partner_id: assignment.partner_id || '00000000-0000-0000-0000-000000000000',
        latitude,
        longitude,
        speed_kmh,
        heading,
        accuracy_meters,
      });

    if (locErr) {
      console.error('Error inserting location:', locErr);
    }

    // Get destination (society coordinates)
    const { data: society } = await supabase
      .from('societies')
      .select('latitude, longitude')
      .eq('id', assignment.society_id)
      .single();

    let distanceMeters: number | null = null;
    let etaMinutes: number | null = null;

    if (society?.latitude && society?.longitude) {
      distanceMeters = Math.round(haversineDistance(latitude, longitude, society.latitude, society.longitude));
      etaMinutes = calculateEta(distanceMeters, speed_kmh);
    }

    // Update assignment with latest location + ETA
    const updateData: Record<string, unknown> = {
      last_location_lat: latitude,
      last_location_lng: longitude,
      last_location_at: new Date().toISOString(),
      eta_minutes: etaMinutes,
      distance_meters: distanceMeters,
    };

    await supabase
      .from('delivery_assignments')
      .update(updateData)
      .eq('id', assignment_id);

    // Auto-trigger proximity notifications (one-time)
    if (distanceMeters !== null && distanceMeters < 500 && assignment.status === 'picked_up') {
      // Get order buyer_id for notification
      const { data: order } = await supabase
        .from('orders')
        .select('buyer_id')
        .eq('id', assignment.order_id)
        .single();

      if (order?.buyer_id) {
        // Check if we already sent a proximity notification
        const { count } = await supabase
          .from('notification_queue')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', order.buyer_id)
          .eq('type', 'delivery_proximity')
          .eq('reference_path', `/orders/${assignment.order_id}`);

        if (!count || count === 0) {
          await supabase.from('notification_queue').insert({
            user_id: order.buyer_id,
            title: '📍 Almost there!',
            body: distanceMeters < 200
              ? 'Your delivery partner is almost at your doorstep!'
              : 'Your delivery partner is nearby and arriving soon!',
            type: 'delivery_proximity',
            reference_path: `/orders/${assignment.order_id}`,
            payload: { orderId: assignment.order_id, distance: distanceMeters },
          });

          // Flush notification queue
          supabase.functions.invoke('process-notification-queue').catch(() => {});
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      eta_minutes: etaMinutes,
      distance_meters: distanceMeters,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('update-delivery-location error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
