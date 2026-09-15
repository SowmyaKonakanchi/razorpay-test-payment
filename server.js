require('dotenv').config();

const path = require('path');
const express = require('express');
const Stripe = require('stripe');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const app = express();
const port = Number(process.env.PORT) || 3000;
const amount = 49900;

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('Missing Stripe credentials. Add STRIPE_SECRET_KEY to .env before starting a payment.');
}

const stripe = Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_missing');
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_missing',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'missing'
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/create-checkout-session', async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Stripe is not configured. Add STRIPE_SECRET_KEY to .env.' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'inr',
          product_data: { name: 'Launch Kit' },
          unit_amount: amount
        },
        quantity: 1
      }],
      success_url: `${req.protocol}://${req.get('host')}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.protocol}://${req.get('host')}/?payment=cancelled`
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Checkout session creation failed:', error.message);
    res.status(502).json({ error: 'Unable to start Stripe Checkout.' });
  }
});

app.get('/api/checkout-session-status', async (req, res) => {
  const sessionId = req.query.session_id;

  if (!process.env.STRIPE_SECRET_KEY || typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) {
    return res.status(400).json({ error: 'Invalid checkout session.' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    res.json({ paymentStatus: session.payment_status });
  } catch (error) {
    console.error('Checkout session lookup failed:', error.message);
    res.status(502).json({ error: 'Unable to verify the checkout session.' });
  }
});

app.post('/api/create-razorpay-order', async (req, res) => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return res.status(503).json({ error: 'Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env.' });
  }

  try {
    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: { product: 'Launch Kit' }
    });
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (error) {
    console.error('Razorpay order creation failed:', error.error || error.message);
    res.status(502).json({ error: 'Unable to create a Razorpay order.' });
  }
});

app.post('/api/verify-razorpay-payment', (req, res) => {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({ error: 'Incomplete Razorpay payment response.' });
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  if (expectedSignature !== signature) {
    return res.status(400).json({ error: 'Razorpay payment verification failed.' });
  }
  res.json({ verified: true, paymentId });
});

app.listen(port, () => {
  console.log(`Stripe and Razorpay payment demo running at http://localhost:${port}`);
});
