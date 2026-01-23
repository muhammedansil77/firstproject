let currentOfferId = null;
let currentAction = null;
let searchTimeout = null;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    initializeForm();
    setupEventListeners();
    showExistingToasts();
});

function setupEventListeners() {
    // Filter form submission
    document.getElementById('filterForm')?.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const params = new URLSearchParams(formData).toString();
        window.location.href = `/admin/offers?${params}`;
    });
    
    // Confirm modal button
    document.getElementById('confirmActionBtn')?.addEventListener('click', handleConfirmAction);
    
    // Search input listeners for products
    const productSearchInput = document.getElementById('productSearchInput');
    if (productSearchInput) {
        productSearchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchProducts(this.value);
            }, 300);
        });
        
        // Enter key to search
        productSearchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchProducts(this.value);
            }
        });
    }
    
    // Search input listeners for categories
    const categorySearchInput = document.getElementById('categorySearchInput');
    if (categorySearchInput) {
        categorySearchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchCategories(this.value);
            }, 300);
        });
        
        // Enter key to search
        categorySearchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchCategories(this.value);
            }
        });
    }
}

function initializeForm() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Format dates for datetime-local input
    const formatDate = (date) => {
        return date.toISOString().slice(0, 16);
    };
    
    const startDateInput = document.querySelector('input[name="startDate"]');
    const endDateInput = document.querySelector('input[name="endDate"]');
    
    if (startDateInput && endDateInput) {
        startDateInput.value = formatDate(now);
        endDateInput.value = formatDate(tomorrow);
    }
}

// Show existing flash messages as toasts
function showExistingToasts() {
    // Check for URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('success')) {
        showToast(decodeURIComponent(urlParams.get('success')), 'success');
        // Remove success param from URL
        urlParams.delete('success');
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        window.history.replaceState({}, '', newUrl);
    }
    
    if (urlParams.has('error')) {
        showToast(decodeURIComponent(urlParams.get('error')), 'danger');
        // Remove error param from URL
        urlParams.delete('error');
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        window.history.replaceState({}, '', newUrl);
    }
}

function openCreateModal() {
    currentOfferId = null;
    document.getElementById('offerModalLabel').textContent = 'Create New Offer';
    document.getElementById('submitBtn').textContent = 'Create Offer';
    document.getElementById('offerForm').reset();
    document.getElementById('targetSection').style.display = 'none';
    
    // Clear search inputs
    document.getElementById('productSearchInput').value = '';
    document.getElementById('categorySearchInput').value = '';
    
    // Clear select dropdowns
    document.getElementById('productSelect').innerHTML = '<option value="">Select a product...</option>';
    document.getElementById('categorySelect').innerHTML = '<option value="">Select a category...</option>';
    
    toggleDiscountFields();
    initializeForm();
    
    // Set default action
    document.getElementById('offerForm').action = '/admin/offers/create';
    
    const modal = new bootstrap.Modal(document.getElementById('offerModal'));
    modal.show();
}

async function openEditModal(offerId) {
    try {
        currentOfferId = offerId;
        
        const response = await fetch(`/admin/offers/${offerId}/json`);
        const data = await response.json();
        
        if (data.success) {
            const offer = data.data;
            
            document.getElementById('offerModalLabel').textContent = 'Edit Offer';
            document.getElementById('submitBtn').textContent = 'Update Offer';
            
            // Fill form
            document.querySelector('input[name="title"]').value = offer.title || '';
            document.querySelector('textarea[name="description"]').value = offer.description || '';
            
            // Set offer type radio button
            const typeProductRadio = document.getElementById('typeProduct');
            const typeCategoryRadio = document.getElementById('typeCategory');
            
            if (offer.type === 'product') {
                typeProductRadio.checked = true;
                toggleTargetSelection('product');
                
                // Load and select the product
                const productResponse = await fetch(`/admin/offers/ajax/products?selectedIds=${offer.targetId}`);
                const productData = await productResponse.json();
                
                if (productData.success && productData.data.length > 0) {
                    const product = productData.data[0];
                    const productSelect = document.getElementById('productSelect');
                    productSelect.innerHTML = `<option value="${product._id}" selected>${product.name}</option>`;
                }
                
            } else if (offer.type === 'category') {
                typeCategoryRadio.checked = true;
                toggleTargetSelection('category');
                
                // Load and select the category
                const categoryResponse = await fetch(`/admin/offers/ajax/categories?selectedIds=${offer.targetId}`);
                const categoryData = await categoryResponse.json();
                
                if (categoryData.success && categoryData.data.length > 0) {
                    const category = categoryData.data[0];
                    const categorySelect = document.getElementById('categorySelect');
                    categorySelect.innerHTML = `<option value="${category._id}" selected>${category.name}</option>`;
                }
            }
            
            // Fill other form fields
            document.querySelector('select[name="discountType"]').value = offer.discountType || '';
            document.querySelector('input[name="discountValue"]').value = offer.discountValue || '';
            document.querySelector('input[name="maxDiscountAmount"]').value = offer.maxDiscountAmount || '';
            document.querySelector('input[name="startDate"]').value = new Date(offer.startDate).toISOString().slice(0, 16);
            document.querySelector('input[name="endDate"]').value = new Date(offer.endDate).toISOString().slice(0, 16);
            document.querySelector('select[name="priority"]').value = offer.priority || 1;
            document.querySelector('input[name="minPurchaseAmount"]').value = offer.conditions?.minPurchaseAmount || '';
            
            // Set form action
            document.getElementById('offerForm').action = `/admin/offers/${offerId}/edit`;
            
            toggleDiscountFields();
            
            const modal = new bootstrap.Modal(document.getElementById('offerModal'));
            modal.show();
        } else {
            showToast(data.message || 'Failed to load offer', 'danger');
        }
    } catch (error) {
        console.error('Error loading offer:', error);
        showToast('Failed to load offer details', 'danger');
    }
}

function toggleTargetSelection(type) {
    const targetSection = document.getElementById('targetSection');
    const productSearchContainer = document.getElementById('productSearchContainer');
    const categorySearchContainer = document.getElementById('categorySearchContainer');
    
    targetSection.style.display = 'block';
    
    if (type === 'product') {
        productSearchContainer.style.display = 'block';
        categorySearchContainer.style.display = 'none';
        
        // Clear category search and select
        document.getElementById('categorySearchInput').value = '';
        document.getElementById('categorySelect').innerHTML = '<option value="">Select a category...</option>';
        
        // Load initial products
        searchProducts('');
        
    } else if (type === 'category') {
        productSearchContainer.style.display = 'none';
        categorySearchContainer.style.display = 'block';
        
        // Clear product search and select
        document.getElementById('productSearchInput').value = '';
        document.getElementById('productSelect').innerHTML = '<option value="">Select a product...</option>';
        
        // Load initial categories
        searchCategories('');
    }
}

async function searchProducts(searchTerm = '') {
    try {
        const productSelect = document.getElementById('productSelect');
        productSelect.innerHTML = '<option value="">Loading...</option>';
        
        const response = await fetch(`/admin/offers/ajax/products?search=${encodeURIComponent(searchTerm)}`);
        const data = await response.json();
        
        if (data.success) {
            productSelect.innerHTML = '<option value="">Select a product...</option>';
            
            data.data.forEach(product => {
                const option = document.createElement('option');
                option.value = product._id;
                option.textContent = product.name;
                productSelect.appendChild(option);
            });
            
            // If only one result, auto-select it
            if (data.data.length === 1 && searchTerm.trim() !== '') {
                productSelect.value = data.data[0]._id;
            }
        } else {
            productSelect.innerHTML = '<option value="">Error loading products</option>';
        }
    } catch (error) {
        console.error('Error searching products:', error);
        document.getElementById('productSelect').innerHTML = '<option value="">Error loading products</option>';
    }
}

async function searchCategories(searchTerm = '') {
    try {
        const categorySelect = document.getElementById('categorySelect');
        categorySelect.innerHTML = '<option value="">Loading...</option>';
        
        const response = await fetch(`/admin/offers/ajax/categories?search=${encodeURIComponent(searchTerm)}`);
        const data = await response.json();
        
        if (data.success) {
            categorySelect.innerHTML = '<option value="">Select a category...</option>';
            
            data.data.forEach(category => {
                const option = document.createElement('option');
                option.value = category._id;
                option.textContent = category.name;
                categorySelect.appendChild(option);
            });
            
            // If only one result, auto-select it
            if (data.data.length === 1 && searchTerm.trim() !== '') {
                categorySelect.value = data.data[0]._id;
            }
        } else {
            categorySelect.innerHTML = '<option value="">Error loading categories</option>';
        }
    } catch (error) {
        console.error('Error searching categories:', error);
        document.getElementById('categorySelect').innerHTML = '<option value="">Error loading categories</option>';
    }
}

function toggleDiscountFields() {
    const discountType = document.querySelector('select[name="discountType"]');
    const maxDiscountField = document.getElementById('maxDiscountField');
    const discountSuffix = document.getElementById('discountSuffix');
    
    if (!discountType || !maxDiscountField || !discountSuffix) return;
    
    if (discountType.value === 'percentage') {
        maxDiscountField.style.display = 'block';
        discountSuffix.textContent = '%';
    } else if (discountType.value === 'fixed') {
        maxDiscountField.style.display = 'none';
        discountSuffix.textContent = '₹';
    } else {
        maxDiscountField.style.display = 'none';
        discountSuffix.textContent = '';
    }
}

// Rest of your functions remain the same (toggleOfferStatus, deleteOffer, handleConfirmAction, etc.)

function toggleOfferStatus(offerId) {
    currentOfferId = offerId;
    currentAction = 'toggle';
    
    document.getElementById('confirmTitle').textContent = 'Toggle Offer Status';
    document.getElementById('confirmMessage').textContent = 'Are you sure you want to change the status of this offer?';
    document.getElementById('confirmActionBtn').className = 'btn btn-warning';
    document.getElementById('confirmActionBtn').textContent = 'Toggle Status';
    
    const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
    modal.show();
}

function deleteOffer(offerId) {
    currentOfferId = offerId;
    currentAction = 'delete';
    
    document.getElementById('confirmTitle').textContent = 'Delete Offer';
    document.getElementById('confirmMessage').textContent = 'Are you sure you want to delete this offer? This action cannot be undone.';
    document.getElementById('confirmActionBtn').className = 'btn btn-danger';
    document.getElementById('confirmActionBtn').textContent = 'Delete';
    
    const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
    modal.show();
}

async function handleConfirmAction() {
    let message = '';
    let type = 'success';
    
    try {
        if (currentAction === 'toggle') {
            const response = await fetch(`/admin/offers/${currentOfferId}/toggle-status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                }
            });
            
            if (response.ok) {
                message = 'Offer status updated successfully';
            } else {
                message = 'Failed to update offer status';
                type = 'danger';
            }
        } else if (currentAction === 'delete') {
            const response = await fetch(`/admin/offers/${currentOfferId}/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                }
            });
            
            if (response.ok) {
                message = 'Offer deleted successfully';
            } else {
                message = 'Failed to delete offer';
                type = 'danger';
            }
        }
        
        // Show toast notification
        showToast(message, type);
        
        // Hide modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('confirmModal'));
        if (modal) modal.hide();
        
        // Reload page after a short delay to show toast
        setTimeout(() => {
            window.location.reload();
        }, 1500);
        
    } catch (error) {
        console.error('Error:', error);
        showToast('An error occurred', 'danger');
        const modal = bootstrap.Modal.getInstance(document.getElementById('confirmModal'));
        if (modal) modal.hide();
    }
}

// Toast notification function
function showToast(message, type = 'info') {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.position = 'fixed';
        toastContainer.style.top = '20px';
        toastContainer.style.right = '20px';
        toastContainer.style.zIndex = '9999';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toastId = 'toast-' + Date.now();
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    // Toast content
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="bi ${getToastIcon(type)} me-2"></i>
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    // Add toast to container
    toastContainer.appendChild(toast);
    
    // Initialize and show toast
    const bsToast = new bootstrap.Toast(toast, {
        animation: true,
        autohide: true,
        delay: 5000
    });
    
    bsToast.show();
    
    // Remove toast from DOM after it's hidden
    toast.addEventListener('hidden.bs.toast', function () {
        toast.remove();
    });
}

// Get appropriate icon for toast type
function getToastIcon(type) {
    switch(type) {
        case 'success': return 'bi-check-circle-fill';
        case 'danger': return 'bi-exclamation-circle-fill';
        case 'warning': return 'bi-exclamation-triangle-fill';
        case 'info': return 'bi-info-circle-fill';
        default: return 'bi-info-circle-fill';
    }
}

// Form validation with toast notifications
document.getElementById('offerForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    const errors = [];
    
    // Basic validation
    if (!formData.get('title')?.trim()) errors.push('Title is required');
    
    const offerType = document.querySelector('input[name="type"]:checked');
    if (!offerType) errors.push('Offer type is required');
    
    const targetId = formData.get('targetId');
    if (!targetId) errors.push('Target selection is required');
    
    if (!formData.get('discountType')) errors.push('Discount type is required');
    if (!formData.get('discountValue') || parseFloat(formData.get('discountValue')) <= 0) 
        errors.push('Valid discount value is required');
    if (!formData.get('startDate') || !formData.get('endDate')) 
        errors.push('Start and end dates are required');
    
    const startDate = new Date(formData.get('startDate'));
    const endDate = new Date(formData.get('endDate'));
    if (endDate <= startDate) errors.push('End date must be after start date');
    // ===== ADVANCED OFFER VALIDATION =====

const discountType = formData.get('discountType');
const discountValue = parseFloat(formData.get('discountValue'));
const minPurchaseAmount = parseFloat(formData.get('minPurchaseAmount')) || 0;
const maxDiscountAmount = parseFloat(formData.get('maxDiscountAmount')) || 0;

// ❌ Negative min purchase
if (minPurchaseAmount < 0) {
  errors.push('Minimum purchase amount cannot be negative');
}

// ❌ Percentage discount rules
if (discountType === 'percentage') {
  if (discountValue <= 0) {
    errors.push('Percentage discount must be greater than 0');
  }

  if (discountValue > 100) {
    errors.push('Percentage discount cannot exceed 100%');
  }

  if (maxDiscountAmount < 0) {
    errors.push('Max discount amount cannot be negative');
  }

  if (maxDiscountAmount > 0 && maxDiscountAmount > minPurchaseAmount) {
    errors.push('Max discount cannot exceed minimum purchase amount');
  }
}

// ❌ Fixed discount rules
if (discountType === 'fixed') {
  if (discountValue <= 0) {
    errors.push('Fixed discount must be greater than 0');
  }

  if (minPurchaseAmount > 0 && discountValue > minPurchaseAmount) {
    errors.push('Fixed discount cannot exceed minimum purchase amount');
  }
}

    
    if (errors.length > 0) {
        errors.forEach(error => showToast(error, 'warning'));
        return;
    }
    
    // Submit form via AJAX
    await submitOfferForm(this);
});

// AJAX form submission
// AJAX form submission - UPDATED
async function submitOfferForm(form) {
    const isEdit = form.action.includes('/edit');
    
    // Show loading state
    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.textContent;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Processing...';
    submitBtn.disabled = true;
    
    try {
        // Get form data
        const formData = new FormData(form);
        
        // Convert FormData to URL-encoded string
        const urlEncodedData = new URLSearchParams();
        for (const pair of formData.entries()) {
            urlEncodedData.append(pair[0], pair[1]);
        }
        
        console.log('Submitting form data:', Object.fromEntries(formData.entries()));
        
        const response = await fetch(form.action, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: urlEncodedData.toString()
        });
        
        // Try to parse response as JSON first
        let result;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            result = await response.json();
        } else {
            // If not JSON, assume it's a redirect
            if (response.ok) {
                showToast(isEdit ? 'Offer updated successfully!' : 'Offer created successfully!', 'success');
                
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('offerModal'));
                if (modal) modal.hide();
                
                // Reload page after delay
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
                return;
            } else {
                throw new Error('Server returned non-JSON response');
            }
        }
        
        if (result.success) {
            showToast(isEdit ? 'Offer updated successfully!' : 'Offer created successfully!', 'success');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('offerModal'));
            if (modal) modal.hide();
            
            // Reload page after delay
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } else {
            showToast(result.message || 'Operation failed', 'danger');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('An error occurred. Please try again.', 'danger');
    } finally {
        // Restore button state
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// Add CSS for better styling
const customStyles = document.createElement('style');
customStyles.textContent = `
.searchable-dropdown select {
    border: 1px solid #ced4da;
    border-radius: 0.375rem;
    padding: 0.375rem 0.75rem;
    width: 100%;
}

.searchable-dropdown select option {
    padding: 8px 12px;
    border-bottom: 1px solid #eee;
    cursor: pointer;
}

.searchable-dropdown select option:hover {
    background-color: #f8f9fa;
}

.searchable-dropdown select option:checked {
    background-color: #0d6efd;
    color: white;
}

.searchable-dropdown .input-group {
    margin-bottom: 0.5rem;
}

.searchable-dropdown small {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.875em;
    color: #6c757d;
}

/* Toast styling */
.toast {
    min-width: 300px;
    margin-bottom: 10px;
    box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
    border-radius: 0.375rem;
}

.toast.success {
    background-color: #198754 !important;
}

.toast.danger {
    background-color: #dc3545 !important;
}

.toast.warning {
    background-color: #ffc107 !important;
    color: #212529 !important;
}

.toast.info {
    background-color: #0dcaf0 !important;
}

.toast .toast-body {
    font-weight: 500;
}
`;
document.head.appendChild(customStyles);