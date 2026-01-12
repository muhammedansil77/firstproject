document.getElementById('updateStatusForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const orderId = document.getElementById('orderId').value;
  const status = document.getElementById('newStatus').value;
  const notes = document.getElementById('statusNotes').value;

  if (!status) {
    Swal.fire({
      icon: 'warning',
      title: 'Select Status',
      text: 'Please select a status before updating'
    });
    return;
  }

  // 🔒 Extra safety (Delivered already locked)
  if (status === 'Delivered') {
    const confirmDelivery = await Swal.fire({
      title: 'Mark as Delivered?',
      text: 'This action cannot be undone. You will NOT be able to change the status again.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, mark Delivered',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#6c757d'
    });

    if (!confirmDelivery.isConfirmed) return;
  } else {
    const confirmChange = await Swal.fire({
      title: 'Confirm Status Change',
      text: `Are you sure you want to change the order status to "${status}"?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Update',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#0d6efd',
      cancelButtonColor: '#6c757d'
    });

    if (!confirmChange.isConfirmed) return;
  }

  const submitBtn = this.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Updating...';
  submitBtn.disabled = true;

  try {
    const response = await fetch(`/admin/orders/update-status/${orderId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes })
    });

    const data = await response.json();

    if (data.success) {
      Swal.fire({
        icon: 'success',
        title: 'Updated!',
        text: 'Order status updated successfully',
        timer: 2000,
        showConfirmButton: false
      });

      setTimeout(() => location.reload(), 2000);
    } else {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;

      Swal.fire({
        icon: 'error',
        title: 'Failed',
        text: data.message || 'Failed to update order status'
      });
    }

  } catch (err) {
    console.error(err);
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;

    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Something went wrong while updating status'
    });
  }
});

// Initialize tooltips
document.addEventListener('DOMContentLoaded', function() {
  var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  var tooltipList = tooltipTriggerList.map(function(tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });
});
async function cancelOrder(orderId) {
  if (!confirm("Are you sure you want to cancel this order?")) return;

  try {
    const res = await fetch(`/orders/${orderId}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    });

    const data = await res.json();

    if (data.success) {
      alert("Order cancelled successfully");
      location.reload();
    } else {
      alert(data.message || "Unable to cancel order");
    }
  } catch (err) {
    console.error(err);
    alert("Something went wrong");
  }
}