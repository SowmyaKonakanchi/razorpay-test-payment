require('dotenv').config();

const crypto = require('crypto');
const path = require('path');
const express = require('express');
const Razorpay = require('razorpay');

const app = express();
const port = Number(process.env.PORT) || 3000;
const amount = 49900;

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.warn('Missing Razorpay credentials. Add them to .env before starting a payment.');
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_missing',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'missing'
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/create-order', async (req, res) => {
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

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Order creation failed:', error.error || error.message);
    res.status(502).json({ error: 'Unable to create a payment order.' });
  }
});

app.post('/api/verify-payment', (req, res) => {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;

  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({ error: 'Incomplete payment response.' });
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  if (expectedSignature !== signature) {
    return res.status(400).json({ error: 'Payment verification failed.' });
  }

  return res.json({ verified: true, paymentId });
});

app.listen(port, () => {
  console.log(`Razorpay demo running at http://localhost:${port}`);
});
