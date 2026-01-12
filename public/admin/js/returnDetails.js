
document.addEventListener('DOMContentLoaded', function() {
    const statusUpdateForm = document.getElementById('statusUpdateForm');
    const statusSelect = document.getElementById('newStatus');
    
    // Handle form submission
    if (statusUpdateForm) {
       statusUpdateForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const returnId = document.getElementById('returnId').value;
    const newStatus = document.getElementById('newStatus').value;
    const adminNotes = document.getElementById('adminNotes').value;

    if (!newStatus) {
        Swal.fire({
            icon: 'warning',
            title: 'Action Required',
            text: 'Please select an action from the dropdown'
        });
        return;
    }

    const statusLabel = statusSelect.options[statusSelect.selectedIndex].text;

    const confirmResult = await Swal.fire({
        title: 'Confirm Status Update',
        html: `<strong>${statusLabel}</strong><br><small>This action cannot be undone</small>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, Update',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#0d6efd',
        cancelButtonColor: '#6c757d'
    });

    if (!confirmResult.isConfirmed) return;

    try {
        Swal.fire({
            title: 'Processing...',
            text: 'Updating return status',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const response = await fetch(`/admin/returns/${returnId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus, adminNotes })
        });

        const data = await response.json();

        if (data.success) {
            await Swal.fire({
                icon: 'success',
                title: 'Updated!',
                text: 'Return status updated successfully',
                timer: 1500,
                showConfirmButton: false
            });
            location.reload();
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Failed',
                text: data.message || 'Something went wrong'
            });
        }

    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Server Error',
            text: 'Failed to update status. Please try again.'
        });
    }
});

    }
    
    // Quick action functions (optional)
    window.quickAction = function(action) {
        const statusSelect = document.getElementById('newStatus');
        const adminNotes = document.getElementById('adminNotes');
        
        // Set the dropdown value
        statusSelect.value = action;
        
        // Auto-fill notes based on action
        if (action === 'approved') {
            adminNotes.value = 'Return approved via quick action.';
        } else if (action === 'rejected') {
            adminNotes.value = 'Return rejected via quick action.';
        }
        
        // Trigger the form submission
        document.getElementById('statusUpdateForm').dispatchEvent(new Event('submit'));
    };
    
    // Simple alert function
    function showAlert(message, type = 'info') {
        // Remove existing alerts
        const existingAlerts = document.querySelectorAll('.simple-alert');
        existingAlerts.forEach(alert => alert.remove());
        
        // Create alert element
        const alertDiv = document.createElement('div');
        alertDiv.className = `simple-alert alert alert-${type === 'success' ? 'success' : type === 'error' ? 'danger' : type === 'warning' ? 'warning' : 'info'} alert-dismissible fade show`;
        alertDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            max-width: 400px;
        `;
        
        const icon = type === 'success' ? 'fa-check-circle' : 
                    type === 'error' ? 'fa-exclamation-circle' : 
                    type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle';
        
        alertDiv.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas ${icon} fa-lg me-2"></i>
                <div>${message}</div>
                <button type="button" class="btn-close ms-auto" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        document.body.appendChild(alertDiv);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
    
    // Add some simple CSS
    const style = document.createElement('style');
    style.textContent = `
        .simple-alert {
            animation: slideInRight 0.3s ease-out;
        }
        
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        /* Style the dropdown options */
        #newStatus option[value="approved"],
        #newStatus option[value="refund_completed"] {
            color: #198754;
            font-weight: 600;
        }
        
        #newStatus option[value="rejected"] {
            color: #dc3545;
            font-weight: 600;
        }
        
        #newStatus option[value="pickup_scheduled"] {
            color: #0d6efd;
            font-weight: 600;
        }
        
        #newStatus option[value="picked_up"] {
            color: #6c757d;
            font-weight: 600;
        }
        
        #newStatus option[value="refund_initiated"] {
            color: #6f42c1;
            font-weight: 600;
        }
    `;
    document.head.appendChild(style);
});
