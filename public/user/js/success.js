// Modal state variables
let selectedOrderId = null;

// Open cancel modal
function openCancelModal(orderId) {
  console.log('Opening cancel modal for order:', orderId);
  selectedOrderId = orderId;
  document.getElementById('cancelModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  
  // Reset form
  document.querySelector('input[name="cancellationReason"][value="changed_mind"]').checked = true;
  document.getElementById('customReason').value = '';
  toggleCustomReason();
}

// Close cancel modal
function closeCancelModal() {
  document.getElementById('cancelModal').classList.add('hidden');
  document.body.style.overflow = 'auto';
  selectedOrderId = null;
}

// Toggle custom reason input
function toggleCustomReason() {
  const selectedReason = document.querySelector('input[name="cancellationReason"]:checked').value;
  const customReasonContainer = document.getElementById('customReasonContainer');
  const customReasonInput = document.getElementById('customReason');
  
  if (selectedReason === 'other') {
    customReasonContainer.classList.remove('hidden');
    customReasonInput.required = true;
  } else {
    customReasonContainer.classList.add('hidden');
    customReasonInput.required = false;
  }
}

// Submit cancellation
async function submitCancellation() {
  if (!selectedOrderId) {
    alert('No order selected');
    return;
  }
  
  const selectedReason = document.querySelector('input[name="cancellationReason"]:checked').value;
  let reasonText = '';
  
  // Get reason text
  const reasonOptions = {
    'changed_mind': 'Changed my mind',
    'found_better_price': 'Found better price elsewhere',
    'shipping_delay': 'Shipping takes too long',
    'ordered_by_mistake': 'Ordered by mistake',
    'financial_issues': 'Financial issues',
    'product_not_needed': 'Product no longer needed',
    'other': 'Other reason'
  };
  
  if (selectedReason === 'other') {
    const customReason = document.getElementById('customReason').value.trim();
    if (!customReason) {
      alert('Please specify your reason for cancellation');
      document.getElementById('customReason').focus();
      return;
    }
    reasonText = customReason;
  } else {
    reasonText = reasonOptions[selectedReason];
  }
  
  console.log('Cancelling order:', selectedOrderId);
  console.log('Reason:', reasonText);
  
  // Show loading state
  const confirmBtn = document.querySelector('button[onclick="submitCancellation()"]');
  const originalText = confirmBtn.innerHTML;
  confirmBtn.innerHTML = `
    <svg class="w-5 h-5 animate-spin text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
    </svg>
    Processing...
  `;
  confirmBtn.disabled = true;
  
  try {
    const response = await fetch(`/orders/${selectedOrderId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: reasonText,
        reasonCode: selectedReason
      })
    });
    
    const result = await response.json();
    
    // Reset button
    confirmBtn.innerHTML = originalText;
    confirmBtn.disabled = false;
    
    if (result.success) {
      // Show success message
      showNotification('Order cancelled successfully!', 'success');
      
      // Close modal
      closeCancelModal();
      
      // Reload page after 2 seconds
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } else {
      showNotification(result.message || 'Failed to cancel order', 'error');
    }
  } catch (error) {
    console.error('Error cancelling order:', error);
    
    // Reset button
    confirmBtn.innerHTML = originalText;
    confirmBtn.disabled = false;
    
    showNotification('Error cancelling order: ' + error.message, 'error');
  }
}

// Show notification
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transform transition-all duration-300 ${
    type === 'success' ? 'bg-green-900/90 border border-green-700' :
    type === 'error' ? 'bg-red-900/90 border border-red-700' :
    'bg-blue-900/90 border border-blue-700'
  }`;
  
  notification.innerHTML = `
    <div class="flex items-center gap-3">
      <svg class="w-5 h-5 ${
        type === 'success' ? 'text-green-400' :
        type === 'error' ? 'text-red-400' :
        'text-blue-400'
      }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${
          type === 'success' ? 'M5 13l4 4L19 7' :
          type === 'error' ? 'M6 18L18 6M6 6l12 12' :
          'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
        }"/>
      </svg>
      <span class="text-white">${message}</span>
    </div>
  `;
  
  // Add to page
  document.body.appendChild(notification);
  
  // Remove after 5 seconds
  setTimeout(() => {
    notification.style.transform = 'translateX(100%)';
    notification.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 5000);
}

// Close modal when clicking outside
document.getElementById('cancelModal')?.addEventListener('click', function(e) {
  if (e.target === this) {
    closeCancelModal();
  }
});

// Close modal with Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && !document.getElementById('cancelModal').classList.contains('hidden')) {
    closeCancelModal();
  }
});
const postalCodeInput = document.getElementById('postalCode');
const addressForm = document.getElementById('addressForm');

// Allow ONLY numbers while typing
postalCodeInput.addEventListener('input', () => {
  postalCodeInput.value = postalCodeInput.value.replace(/\D/g, '');
});

// Validate on form submit
addressForm.addEventListener('submit', function (e) {
  const postalCode = postalCodeInput.value.trim();

  if (!/^\d{5,}$/.test(postalCode)) {
    e.preventDefault();

    showToast(
      'Postal code must contain at least 5 digits and only numbers',
      'error'
    );

    postalCodeInput.focus();
    postalCodeInput.classList.add('border-red-500');
    return false;
  }

  postalCodeInput.classList.remove('border-red-500');
});
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `
    px-4 py-3 rounded-lg shadow-lg text-white
    ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}
  `;
  toast.textContent = message;

  const container = document.getElementById('toastContainer');
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

