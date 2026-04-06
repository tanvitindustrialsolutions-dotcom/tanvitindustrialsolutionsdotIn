// Deploy: `supabase functions deploy billing-create-subscription --no-verify-jwt` (or verify JWT in code).
// Set secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_PLAN_MONTHLY_ID, RAZORPAY_PLAN_YEARLY_ID
// Create plans in Razorpay Dashboard (₹100/mo, ₹1000/yr) and paste plan_ids here via env.
//
// This handler should: 1) verify Supabase JWT, 2) load user trial from user_subscription,
// 3) create Razorpay customer + subscription with start_at = trial end, 4) return { key_id, subscription_id } for Checkout.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
  }
  return new Response(JSON.stringify({ error: 'Not implemented — add Razorpay API calls and deploy. See app.js BILLING_CONFIG.CREATE_SUBSCRIPTION_FUNCTION.' }), {
    status: 501,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
});
