async function viewOrderDetails(orderId) {
  try {
    const response = await fetch(`/admin/orders/details/${orderId}`);
    const data = await response.json();
    
    if (data.success) {
      const order = data.order;
      let html = `
        <div class="row">
          <div class="col-md-6">
            <h6 class="fw-bold">Order Information</h6>
            <table class="table table-sm table-borderless">
              <tr>
                <td class="text-muted">Order ID:</td>
                <td class="fw-bold">${order.orderNumber}</td>
              </tr>
              <tr>
                <td class="text-muted">Date:</td>
                <td>${order.orderDate}</td>
              </tr>
              <tr>
                <td class="text-muted">Status:</td>
                <td><span class="badge bg-${getStatusColor(order.orderStatus)}">${order.orderStatus}</span></td>
              </tr>
              <tr>
                <td class="text-muted">Payment:</td>
                <td>${order.paymentMethod} - <span class="badge bg-${order.paymentStatus === 'Paid' ? 'success' : 'warning'}">${order.paymentStatus}</span></td>
              </tr>
            </table>
          </div>
          <div class="col-md-6">
            <h6 class="fw-bold">Customer Information</h6>
            <table class="table table-sm table-borderless">
              <tr>
                <td class="text-muted">Name:</td>
                <td>${order.user?.fullName || order.address?.fullName || 'N/A'}</td>
              </tr>
              <tr>
                <td class="text-muted">Phone:</td>
                <td>${order.user?.phone || order.address?.phone || 'N/A'}</td>
              </tr>
              <tr>
                <td class="text-muted">Email:</td>
                <td>${order.user?.email || 'N/A'}</td>
              </tr>
              <tr>
                <td class="text-muted">Address:</td>
                <td>${order.address?.street || ''}, ${order.address?.city || ''}, ${order.address?.state || ''} - ${order.address?.pinCode || ''}</td>
              </tr>
            </table>
          </div>
        </div>
        <hr>
        <h6 class="fw-bold">Order Items</h6>
        <div class="table-responsive">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Product</th>
                <th>Variant</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      order.items.forEach(item => {
        html += `
          <tr>
            <td>${item.product?.name || 'Product'}</td>
            <td>
              ${item.variant?.size ? 'Size: ' + item.variant.size : ''}
              ${item.variant?.color ? 'Color: ' + item.variant.color : ''}
            </td>
            <td>${item.quantity}</td>
            <td>${item.formattedPrice}</td>
            <td class="fw-bold">${item.formattedTotal}</td>
          </tr>
        `;
      });
      
      html += `
            </tbody>
            <tfoot class="table-light">
              <tr>
                <td colspan="4" class="text-end fw-bold">Subtotal:</td>
                <td class="fw-bold">${order.formattedAmount}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
      
      document.getElementById('orderDetailsContent').innerHTML = html;
      const modal = new bootstrap.Modal(document.getElementById('orderDetailsModal'));
      modal.show();
    }
  } catch (error) {
    console.error('Error fetching order details:', error);
    alert('Failed to load order details');
  }
}

// Function to open update status modal
function openUpdateStatusModal(orderId, currentStatus) {
  document.getElementById('statusOrderId').value = orderId;
  document.getElementById('newStatus').value = currentStatus;
  const modal = new bootstrap.Modal(document.getElementById('updateStatusModal'));
  modal.show();
}

// Handle status update form submission
document.getElementById('updateStatusForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const orderId = document.getElementById('statusOrderId').value;
  const status = document.getElementById('newStatus').value;
  const notes = document.getElementById('statusNotes').value;
  
  try {
    const response = await fetch(`/admin/orders/update-status/${orderId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status, notes })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Show success message
      showToast('Status updated successfully!', 'success');
      
      // Close modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('updateStatusModal'));
      modal.hide();
      
      // Reload page to see changes
      setTimeout(() => location.reload(), 1500);
    } else {
      showToast(data.message || 'Failed to update status', 'error');
    }
  } catch (error) {
    console.error('Error updating status:', error);
    showToast('Failed to update status', 'error');
  }
});

// Helper function for status color
function getStatusColor(status) {
  switch(status) {
    case 'Placed': return 'info';
    case 'Confirmed': return 'warning';
    case 'Shipped': return 'primary';
    case 'OutForDelivery': return 'warning';
    case 'Delivered': return 'success';
    case 'Cancelled': return 'danger';
    default: return 'secondary';
  }
}

// Toast notification function
function showToast(message, type = 'info') {
  // Use your existing toastr or create simple alert
  if (typeof toastr !== 'undefined') {
    toastr[type === 'error' ? 'error' : 'success'](message);
  } else {
    alert(message);
  }
}

// Update status from dropdown
function updateOrderStatus(orderId, status) {
  document.getElementById('statusOrderId').value = orderId;
  document.getElementById('newStatus').value = status;
  const modal = new bootstrap.Modal(document.getElementById('updateStatusModal'));
  modal.show();
}