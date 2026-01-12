// Clear search functionality
document.addEventListener('DOMContentLoaded', function() {
  const clearSearchBtn = document.getElementById('clearSearch');
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', function() {
      document.getElementById('searchInput').value = '';
      document.getElementById('searchForm').submit();
    });
  }

  // Block/Unblock with confirmation
  const blockButtons = document.querySelectorAll('.block-btn');
  const modal = document.getElementById('confirmationModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalMessage = document.getElementById('modalMessage');
  const modalAction = document.getElementById('modalAction');
  const blockForm = document.getElementById('blockForm');
  const cancelBtn = document.getElementById('cancelBtn');
  const confirmBtn = document.getElementById('confirmBtn');
  const reasonInput = document.getElementById('reasonInput');

  let currentUserId = null;

  // Replace the blockButtons event listener with this simpler version:
blockButtons.forEach(button => {
  button.addEventListener('click', function() {
    const userId = this.dataset.userId;
    const userName = this.dataset.userName;
    const currentStatus = this.dataset.currentStatus;
    const action = currentStatus === 'blocked' ? 'unblock' : 'block';
    const actionText = action === 'block' ? 'Block' : 'Unblock';
    
    Swal.fire({
      title: `${actionText} User?`,
      html: `Are you sure you want to <strong>${action}</strong> user <strong>"${userName}"</strong>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: `Yes, ${actionText}`,
      confirmButtonColor: action === 'block' ? '#d33' : '#3085d6',
      cancelButtonText: 'Cancel',
      cancelButtonColor: '#aaa',
      reverseButtons: true
    }).then(async (result) => {
      if (result.isConfirmed) {
        // Show loading
        Swal.fire({
          title: 'Processing...',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        try {
          const response = await fetch(`/admin/users/${userId}/block`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({ action: action })
          });

          const data = await response.json();
          Swal.close();

          if (data.success) {
            Swal.fire({
              title: 'Success!',
              text: data.message,
              icon: 'success',
              confirmButtonText: 'OK'
            }).then(() => {
              window.location.reload();
            });
          } else {
            Swal.fire({
              title: 'Error!',
              text: data.message,
              icon: 'error'
            });
          }
        } catch (error) {
          Swal.fire({
            title: 'Error!',
            text: 'Failed to process request',
            icon: 'error'
          });
        }
      }
    });
  });
});
  // Handle block/unblock response
  function handleBlockResponse(data, action, userName) {
    if (data.success) {
      showAlert(`${userName} has been ${action}ed successfully`, 'success');
      // Reload page after 1.5 seconds to show updated status
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      showAlert(data.message || `Failed to ${action} user`, 'error');
    }
  }

  // Show alert message
  function showAlert(message, type) {
    // Remove any existing alerts
    const existingAlert = document.querySelector('.alert-message');
    if (existingAlert) {
      existingAlert.remove();
    }

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert-message alert-${type}`;
    alertDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: ${type === 'success' ? '#66f3a6' : '#ff8b8b'};
      background: ${type === 'success' ? 'rgba(34,64,40,0.9)' : 'rgba(64,24,24,0.9)'};
      border: 1px solid ${type === 'success' ? 'rgba(102,255,170,0.3)' : 'rgba(255,102,102,0.3)'};
      z-index: 1001;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideIn 0.3s ease;
    `;
    
    alertDiv.textContent = message;
    document.body.appendChild(alertDiv);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
          if (alertDiv.parentNode) {
            alertDiv.remove();
          }
        }, 300);
      }
    }, 5000);
  }

  // Add CSS for animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);

  // Modal handlers
  cancelBtn.addEventListener('click', function() {
    modal.style.display = 'none';
    reasonInput.value = '';
    currentUserId = null;
  });

  // Handle form submission via AJAX
  blockForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    const action = this.querySelector('[name="action"]').value;
    const userName = document.querySelector(`[data-user-id="${currentUserId}"]`).dataset.userName;
    
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Processing...';
    
    try {
      const response = await fetch(this.action, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Close modal
        modal.style.display = 'none';
        reasonInput.value = '';
        currentUserId = null;
        
        // Show success message
        showAlert(data.message, 'success');
        
        // Reload page after delay to show updated status
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        // Show error message
        showAlert(data.message || 'Failed to process request.', 'error');
        modal.style.display = 'none';
        reasonInput.value = '';
        currentUserId = null;
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm';
      }
    } catch (error) {
      console.error('Error:', error);
      showAlert('Network error. Please try again.', 'error');
      modal.style.display = 'none';
      reasonInput.value = '';
      currentUserId = null;
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Confirm';
    }
  });

  // Close modal when clicking outside
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      modal.style.display = 'none';
      reasonInput.value = '';
      currentUserId = null;
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modal.style.display === 'flex') {
      modal.style.display = 'none';
      reasonInput.value = '';
      currentUserId = null;
    }
    
    // Clear search with Ctrl+K
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
    
    // Submit form with Enter in modal
    if (e.key === 'Enter' && modal.style.display === 'flex' && 
        document.activeElement !== reasonInput) {
      e.preventDefault();
      confirmBtn.click();
    }
  });

  // Focus trap in modal
  const focusableElements = modal.querySelectorAll('button, textarea, input');
  const firstFocusableElement = focusableElements[0];
  const lastFocusableElement = focusableElements[focusableElements.length - 1];

  modal.addEventListener('keydown', function(e) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstFocusableElement) {
        e.preventDefault();
        lastFocusableElement.focus();
      }
    } else {
      if (document.activeElement === lastFocusableElement) {
        e.preventDefault();
        firstFocusableElement.focus();
      }
    }
  });
});