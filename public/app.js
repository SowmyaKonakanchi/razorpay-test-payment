const payButton = document.querySelector('#pay-button');
const status = document.querySelector('#status');

function setStatus(message, type = '') {
  status.textContent = message;
  status.className = `status ${type}`;
}

payButton.addEventListener('click', async () => {
  payButton.disabled = true;
  setStatus('Preparing secure checkout...');

  try {
    const orderResponse = await fetch('/api/create-order', { method: 'POST' });
    const order = await orderResponse.json();

    if (!orderResponse.ok) {
      throw new Error(order.error || 'Could not create order.');
    }

    const checkout = new Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: 'Launch Kit',
      description: 'Launch Kit access',
      order_id: order.orderId,
      theme: { color: '#e65735' },
      handler: async (payment) => {
        setStatus('Verifying payment...');
        const verificationResponse = await fetch('/api/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payment)
        });
        const result = await verificationResponse.json();

        if (!verificationResponse.ok) {
          throw new Error(result.error || 'Payment verification failed.');
        }

        setStatus(`Payment verified. ID: ${result.paymentId}`, 'success');
        payButton.textContent = 'Payment complete';
      },
      modal: {
        ondismiss: () => {
          payButton.disabled = false;
          setStatus('Checkout closed. Your order is still waiting.');
        }
      }
    });

    checkout.on('payment.failed', (response) => {
      payButton.disabled = false;
      setStatus(response.error.description || 'Payment failed. Please try again.', 'error');
    });
    checkout.open();
  } catch (error) {
    payButton.disabled = false;
    setStatus(error.message, 'error');
  }
});
