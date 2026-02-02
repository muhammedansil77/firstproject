// 🔍 SEARCH (Enter key → backend filter)
const searchInput = document.getElementById('searchOrders');
if (searchInput) {
  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      const url = new URL(window.location.href);
      url.searchParams.set('search', this.value.trim());
      url.searchParams.set('page', 1);
      window.location.href = url.toString();
    }
  });
}

// 🔃 SORT
const sortSelect = document.getElementById('sortOrders');
if (sortSelect) {
  sortSelect.addEventListener('change', function () {
    const url = new URL(window.location.href);
    url.searchParams.set('sort', this.value);
    url.searchParams.set('page', 1);
    window.location.href = url.toString();
  });
}

// ❌ CANCEL ORDER
function cancelOrder(orderId) {
  if (!confirm('Are you sure you want to cancel this order?')) return;

  fetch(`/orders/${orderId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert('Order cancelled successfully');
        location.reload();
      } else {
        alert(data.message || 'Cancel failed');
      }
    })
    .catch(() => alert('Network error'));
}

// 🔁 RETURN ORDER
function requestReturn(orderId) {
  window.location.href = `/orders/${orderId}/return`;
}
async function retryPayment(orderId, addressId) {
  try {
    const res = await fetch('/orders/retry-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId })
    });

    const data = await res.json();
    if (!data.success) {
      alert(data.message || 'Retry failed');
      return;
    }

    const options = {
      key: data.data.key_id,
      amount: data.data.amount,
      currency: data.data.currency,
      order_id: data.data.razorpayOrderId,
      name: 'Your Store',
      description: 'Retry Payment',

      handler: async function (response) {
        await fetch('/verify-razorpay-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            addressId: addressId,          // ✅ ADD THIS
            fromPayment: true              // ✅ IMPORTANT
          })
        });

        window.location.reload();
      }
    };

    const rzp = new Razorpay(options);
    rzp.open();

  } catch (err) {
    console.error(err);
    alert('Retry payment error');
  }
}

async function cancelEntireGroup(orderIds) {
  if (!Array.isArray(orderIds) || orderIds.length === 0) return;

  const { value: formData } = await Swal.fire({
    title: 'Cancel Order',
    icon: 'warning',
    html: `
      <div class="text-left space-y-4">

        <p class="text-sm text-gray-400">
          Please tell us why you want to cancel this order.
        </p>

        <div>
          <label class="block text-sm font-medium mb-1 text-gray-300">
            Cancellation Reason
          </label>
          <select id="cancel-reason"
            class="w-full px-3 py-2 rounded-lg bg-[#0f0f0f]
                   border border-[#2a2a2a] text-white focus:outline-none
                   focus:border-[#d4af37]">
            <option value="">Select a reason</option>
            <option value="changed_mind">Changed my mind</option>
            <option value="ordered_by_mistake">Ordered by mistake</option>
            <option value="found_cheaper">Found cheaper elsewhere</option>
            <option value="delivery_delay">Delivery taking too long</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div id="cancel-note-wrapper" class="hidden">
          <label class="block text-sm font-medium mb-1 text-gray-300">
            Additional Details
          </label>
          <textarea id="cancel-note"
            class="w-full px-3 py-2 rounded-lg bg-[#0f0f0f]
                   border border-[#2a2a2a] text-white focus:outline-none
                   focus:border-[#d4af37]"
            rows="3"
            placeholder="Please specify your reason..."></textarea>
        </div>

      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'Cancel Order',
    cancelButtonText: 'Keep Order',
    confirmButtonColor: '#d4af37',
    cancelButtonColor: '#374151',
    reverseButtons: true,
    focusConfirm: false,

    didOpen: () => {
      const reasonSelect = document.getElementById('cancel-reason');
      const noteWrapper = document.getElementById('cancel-note-wrapper');

      reasonSelect.addEventListener('change', () => {
        noteWrapper.classList.toggle('hidden', reasonSelect.value !== 'other');
      });
    },

    preConfirm: () => {
      const reasonCode = document.getElementById('cancel-reason').value;
      const note = document.getElementById('cancel-note').value.trim();

      if (!reasonCode) {
        Swal.showValidationMessage('Please select a cancellation reason');
        return false;
      }

      const reasonTextMap = {
        changed_mind: 'Changed my mind',
        ordered_by_mistake: 'Ordered by mistake',
        found_cheaper: 'Found cheaper elsewhere',
        delivery_delay: 'Delivery taking too long',
        other: note || 'Other'
      };

      return {
        reasonCode,
        reason: reasonTextMap[reasonCode]
      };
    }
  });

  if (!formData) return;

  try {
    let success = 0;
    let failed = 0;

    for (const orderId of orderIds) {
      const res = await fetch(`/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      res.ok && data.success ? success++ : failed++;
    }

    if (success > 0) {
      await Swal.fire({
        icon: 'success',
        title: 'Order Cancelled',
        text: `${success} order(s) cancelled successfully`,
        confirmButtonColor: '#d4af37'
      });
      window.location.reload();
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Cancellation Failed',
        text: 'Unable to cancel the order(s)'
      });
    }

  } catch (err) {
    console.error(err);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Something went wrong. Please try again later.'
    });
  }
}
