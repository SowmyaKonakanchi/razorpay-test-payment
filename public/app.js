const stripeButton = document.querySelector('#stripe-button');
const razorpayButton = document.querySelector('#razorpay-button');
const status = document.querySelector('#status');

function setStatus(message, type = '') {
  status.textContent = message;
  status.className = `status ${type}`;
}

stripeButton.addEventListener('click', async () => {
  stripeButton.disabled = true;
  setStatus('Preparing secure checkout...');

  try {
    const sessionResponse = await fetch('/api/create-checkout-session', { method: 'POST' });
    const session = await sessionResponse.json();

    if (!sessionResponse.ok) {
      throw new Error(session.error || 'Could not start checkout.');
    }

    window.location.assign(session.url);
  } catch (error) {
    stripeButton.disabled = false;
    setStatus(error.message, 'error');
  }
});

razorpayButton.addEventListener('click', async () => {
  razorpayButton.disabled = true;
  setStatus('Preparing Razorpay checkout...');

  try {
    const orderResponse = await fetch('/api/create-razorpay-order', { method: 'POST' });
    const order = await orderResponse.json();
    if (!orderResponse.ok) throw new Error(order.error || 'Could not create Razorpay order.');

    const checkout = new Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: 'Launch Kit',
      description: 'Launch Kit access',
      order_id: order.orderId,
      theme: { color: '#e65735' },
      handler: async (payment) => {
        const verificationResponse = await fetch('/api/verify-razorpay-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payment)
        });
        const result = await verificationResponse.json();
        if (!verificationResponse.ok) throw new Error(result.error || 'Payment verification failed.');
        setStatus(`Razorpay payment verified. ID: ${result.paymentId}`, 'success');
        razorpayButton.textContent = 'Razorpay payment complete';
      }
    });
    checkout.on('payment.failed', (response) => {
      razorpayButton.disabled = false;
      setStatus(response.error.description || 'Payment failed. Please try again.', 'error');
    });
    checkout.open();
  } catch (error) {
    razorpayButton.disabled = false;
    setStatus(error.message, 'error');
  }
});

const query = new URLSearchParams(window.location.search);
const paymentStatus = query.get('payment');
if (paymentStatus === 'success') {
  fetch(`/api/checkout-session-status?session_id=${encodeURIComponent(query.get('session_id') || '')}`)
    .then(async (response) => {
      const result = await response.json();
      if (!response.ok || result.paymentStatus !== 'paid') {
        throw new Error('Payment is still being confirmed.');
      }
      setStatus('Payment complete. Your Launch Kit is ready.', 'success');
          stripeButton.textContent = 'Stripe payment complete';
          stripeButton.disabled = true;
    })
    .catch((error) => setStatus(error.message, 'error'));
} else if (paymentStatus === 'cancelled') {
  setStatus('Checkout cancelled. You can try again whenever you are ready.');
  stripeButton.disabled = false;
}
