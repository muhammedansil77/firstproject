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
