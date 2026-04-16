/**
 * BLOOD CONNECTOR — Backend Server
 * server.js
 *
 * Node.js + Express
 * Handles: Paystack webhooks, subscription verification,
 *          NIA API proxy, certificate generation, admin ops
 *
 * Deploy on: Railway / Render / VPS
 */

const express    = require('express');
const cors       = require('cors');
const crypto     = require('crypto');
const axios      = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3001;

// ── SUPABASE (service role — full access, server only)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY   // NOT the anon key
);

// ── CORS — allow your frontend domain only
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'https://bloodconnector.com.gh',       // your production domain
  'https://www.bloodconnector.com.gh',
];

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());

// Raw body needed for Paystack webhook signature verification
app.use('/webhook/paystack', express.raw({ type: 'application/json' }));


// ════════════════════════════════════════════
// HEALTH CHECK
// ════════════════════════════════════════════
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Blood Connector API', timestamp: new Date() });
});


// ════════════════════════════════════════════
// PAYSTACK — VERIFY PAYMENT (called by frontend after redirect)
// POST /api/payment/verify
// Body: { reference: "BC_1234567890" }
// ════════════════════════════════════════════
app.post('/api/payment/verify', async (req, res) => {
  const { reference, hospital_id } = req.body;
  if(!reference) return res.status(400).json({ error: 'Reference required' });

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );

    const data = response.data.data;

    if(data.status !== 'success') {
      return res.status(400).json({ error: 'Payment not successful', status: data.status });
    }

    const amountGHS = data.amount / 100; // Paystack stores in pesewas

    // Save subscription to Supabase
    const validUntil = new Date();
    validUntil.setMonth(validUntil.getMonth() + 1);

    await supabase.from('subscriptions').insert({
      hospital_id,
      paystack_ref:  reference,
      amount:        data.amount,
      currency:      'GHS',
      status:        'success',
      paid_at:       new Date().toISOString(),
      valid_until:   validUntil.toISOString()
    });

    // Activate hospital subscription
    await supabase.from('hospitals')
      .update({ subscription_active: true, subscription_ref: reference, subscription_end: validUntil })
      .eq('id', hospital_id);

    res.json({
      success: true,
      amount: amountGHS,
      valid_until: validUntil,
      message: `Subscription activated — GHS ${amountGHS} paid`
    });

  } catch(err) {
    console.error('Paystack verify error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});


// ════════════════════════════════════════════
// PAYSTACK — WEBHOOK (auto-renewal & events)
// POST /webhook/paystack
// ════════════════════════════════════════════
app.post('/webhook/paystack', async (req, res) => {
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(req.body)
    .digest('hex');

  if(hash !== req.headers['x-paystack-signature']) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(req.body);
  console.log('Paystack webhook:', event.event);

  if(event.event === 'charge.success') {
    const ref  = event.data.reference;
    const meta = event.data.metadata || {};
    const hospitalId = meta.hospital_id;

    if(hospitalId) {
      const validUntil = new Date();
      validUntil.setMonth(validUntil.getMonth() + 1);

      await supabase.from('subscriptions').upsert({
        hospital_id:  hospitalId,
        paystack_ref: ref,
        amount:       event.data.amount,
        status:       'success',
        paid_at:      new Date().toISOString(),
        valid_until:  validUntil.toISOString()
      }, { onConflict: 'paystack_ref' });

      await supabase.from('hospitals')
        .update({ subscription_active: true, subscription_end: validUntil })
        .eq('id', hospitalId);
    }
  }

  if(event.event === 'subscription.disable') {
    // Subscription cancelled — deactivate hospital
    const code = event.data.subscription_code;
    await supabase.from('hospitals')
      .update({ subscription_active: false })
      .eq('subscription_ref', code);
  }

  res.sendStatus(200);
});


// ════════════════════════════════════════════
// NIA API — GHANA CARD VERIFICATION
// POST /api/nia/verify
// Body: { card_number, first_name, last_name, dob }
// ════════════════════════════════════════════
app.post('/api/nia/verify', async (req, res) => {
  const { card_number, first_name, last_name, dob, donor_id } = req.body;

  if(!card_number) return res.status(400).json({ error: 'Card number required' });

  // Validate format: GHA-XXXXXXXXX-X
  if(!/^GHA-\d{9}-\d$/.test(card_number)) {
    return res.status(400).json({ error: 'Invalid Ghana Card format. Expected: GHA-000000000-0' });
  }

  try {
    // ── REAL NIA API CALL (uncomment when you have NIA credentials)
    /*
    const niaResponse = await axios.post(
      'https://api.nia.gov.gh/v1/verify',   // replace with real NIA endpoint
      { pin: card_number, firstName: first_name, lastName: last_name, dateOfBirth: dob },
      {
        headers: {
          'Authorization': `Bearer ${process.env.NIA_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if(!niaResponse.data.verified) {
      return res.status(400).json({ error: 'NIA verification failed — card details do not match records' });
    }

    const niaPerson = niaResponse.data.person;
    */

    // ── SIMULATED RESPONSE (remove once NIA API is connected)
    const niaPerson = {
      firstName: first_name || 'KWAME',
      lastName:  last_name  || 'MENSAH',
      dob:       dob        || '1998-01-01',
      cardNumber: card_number,
      verified: true
    };
    // ── END SIMULATION

    // Update donor NIA status in Supabase
    if(donor_id) {
      await supabase.from('donors')
        .update({ nia_verified: true, ghana_card_no: card_number })
        .eq('id', donor_id);
    }

    res.json({ success: true, person: niaPerson });

  } catch(err) {
    console.error('NIA API error:', err.response?.data || err.message);
    res.status(500).json({ error: 'NIA verification service unavailable. Try again later.' });
  }
});


// ════════════════════════════════════════════
// FACEIO — VERIFY LIVENESS RESULT
// POST /api/face/verify
// Body: { faceio_payload, donor_id }
// ════════════════════════════════════════════
app.post('/api/face/verify', async (req, res) => {
  const { faceio_payload, donor_id } = req.body;

  // FaceIO sends a payload after successful enrollment
  // In production, validate this payload server-side
  // See: https://faceio.net/integration-guide#server-side

  if(!faceio_payload) {
    return res.status(400).json({ error: 'FaceIO payload required' });
  }

  try {
    // Mark donor as face verified
    if(donor_id) {
      await supabase.from('donors')
        .update({ face_verified: true })
        .eq('id', donor_id);
    }
    res.json({ success: true, message: 'Liveness check passed' });
  } catch(err) {
    res.status(500).json({ error: 'Face verification update failed' });
  }
});


// ════════════════════════════════════════════
// DONATION CONFIRMATION — Hospital marks done
// POST /api/confirm/hospital
// ════════════════════════════════════════════
app.post('/api/confirm/hospital', async (req, res) => {
  const { request_id, donor_id, hospital_id } = req.body;
  if(!request_id || !donor_id) return res.status(400).json({ error: 'request_id and donor_id required' });

  try {
    const { data: existing } = await supabase
      .from('donation_confirmations')
      .select('*')
      .eq('request_id', request_id)
      .eq('donor_id', donor_id)
      .single();

    let result;
    if(existing) {
      const { data } = await supabase
        .from('donation_confirmations')
        .update({ hospital_confirmed: true, hospital_confirmed_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
      result = data;
    } else {
      const { data } = await supabase
        .from('donation_confirmations')
        .insert({ request_id, donor_id, hospital_id, hospital_confirmed: true, hospital_confirmed_at: new Date().toISOString() })
        .select()
        .single();
      result = data;
    }

    // Check if certificate should be issued
    const { data: donor } = await supabase.from('donors').select('donations, first_name, last_name, email').eq('id', donor_id).single();
    if(donor && donor.donations >= 10) {
      await supabase.from('donors').update({ certificate_issued: true }).eq('id', donor_id);
      // TODO: trigger certificate email here
    }

    res.json({ success: true, confirmation: result, donationCount: donor?.donations });
  } catch(err) {
    console.error('Confirm error:', err.message);
    res.status(500).json({ error: 'Confirmation failed' });
  }
});


// ════════════════════════════════════════════
// DONATION CONFIRMATION — Donor marks done
// POST /api/confirm/donor
// ════════════════════════════════════════════
app.post('/api/confirm/donor', async (req, res) => {
  const { request_id, donor_id } = req.body;

  try {
    const { data: existing } = await supabase
      .from('donation_confirmations')
      .select('*')
      .eq('request_id', request_id)
      .eq('donor_id', donor_id)
      .single();

    if(existing?.hospital_confirmed) {
      // Both confirmed — valid
      await supabase.from('donation_confirmations')
        .update({ donor_confirmed: true, donor_confirmed_at: new Date().toISOString(), status: 'confirmed' })
        .eq('id', existing.id);
      res.json({ success: true, status: 'confirmed' });
    } else {
      // Donor only — FLAG IT
      await supabase.from('donation_confirmations')
        .upsert({ request_id, donor_id, donor_confirmed: true, donor_confirmed_at: new Date().toISOString(), status: 'flagged', flag_reason: 'Donor confirmed but hospital has not yet confirmed.' },
          { onConflict: 'request_id,donor_id' });
      res.json({ success: true, status: 'flagged', message: 'Recorded. Awaiting hospital confirmation.' });
    }
  } catch(err) {
    res.status(500).json({ error: 'Confirmation failed' });
  }
});


// ════════════════════════════════════════════
// ADMIN — Get platform stats
// GET /api/admin/stats
// ════════════════════════════════════════════
app.get('/api/admin/stats', async (req, res) => {
  // TODO: add admin JWT check middleware
  try {
    const [donors, hospitals, requests, confs, subs] = await Promise.all([
      supabase.from('donors').select('id, active, nia_verified, donations', { count:'exact' }),
      supabase.from('hospitals').select('id, subscription_active, verified', { count:'exact' }),
      supabase.from('blood_requests').select('id, status', { count:'exact' }),
      supabase.from('donation_confirmations').select('id, status', { count:'exact' }),
      supabase.from('subscriptions').select('amount').eq('status','success'),
    ]);

    const totalRevenue = (subs.data || []).reduce((s, r) => s + (r.amount / 100), 0);

    res.json({
      donors: {
        total:    donors.count,
        active:   (donors.data||[]).filter(d=>d.active).length,
        verified: (donors.data||[]).filter(d=>d.nia_verified).length,
      },
      hospitals: {
        total:      hospitals.count,
        subscribed: (hospitals.data||[]).filter(h=>h.subscription_active).length,
        verified:   (hospitals.data||[]).filter(h=>h.verified).length,
      },
      requests: {
        total:     requests.count,
        open:      (requests.data||[]).filter(r=>r.status==='open').length,
        fulfilled: (requests.data||[]).filter(r=>r.status==='fulfilled').length,
      },
      donations: {
        total:    confs.count,
        confirmed: (confs.data||[]).filter(c=>c.status==='confirmed').length,
        flagged:   (confs.data||[]).filter(c=>c.status==='flagged').length,
      },
      revenue: {
        total_ghs: totalRevenue,
        currency:  'GHS'
      }
    });
  } catch(err) {
    res.status(500).json({ error: 'Stats fetch failed' });
  }
});


// ════════════════════════════════════════════
// ADMIN — Toggle hospital verification
// POST /api/admin/verify-hospital
// ════════════════════════════════════════════
app.post('/api/admin/verify-hospital', async (req, res) => {
  const { hospital_id, verified } = req.body;
  await supabase.from('hospitals').update({ verified }).eq('id', hospital_id);
  res.json({ success: true });
});


// ════════════════════════════════════════════
// START SERVER
// ════════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`✓ Blood Connector API running on port ${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
