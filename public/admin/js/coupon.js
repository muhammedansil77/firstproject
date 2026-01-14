// public/js/coupon.js
// Global variables
let currentCouponId = null;
let isEditMode = false;
let isBulkMode = false;
let currentPage = 1;
const itemsPerPage = 10;
let totalPages = 1;
let searchTerm = '';
let statusFilter = '';
let sortBy = 'createdAt:desc';

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Coupon management page loaded');
    initializeElements();
    loadCoupons();
    setDefaultDates();
    initializeEventListeners();
});

// Initialize DOM elements
function initializeElements() {
    // Set default values for filters
    const statusSelect = document.getElementById('statusFilter');
    const sortSelect = document.getElementById('sortBy');
    
    if (statusSelect) {
        statusSelect.value = statusFilter;
    }
    
    if (sortSelect) {
        sortSelect.value = sortBy;
    }
}

// Set default dates for date inputs
function setDefaultDates() {
    const now = new Date();
    const startDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
        .toISOString()
        .slice(0, 16);
    const endDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000) - (now.getTimezoneOffset() * 60000))
        .toISOString()
        .slice(0, 16);
    
    // Only set if modal inputs exist
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    
    if (startDateInput && endDateInput) {
        startDateInput.value = startDate;
        endDateInput.value = endDate;
    }
}

// Initialize event listeners
function initializeEventListeners() {
    console.log('Initializing event listeners...');
    
    // Search input with debounce
    let searchTimeout;
    const searchInput = document.getElementById('searchInput');
    
    if (searchInput) {
        console.log('Found search input');
        searchInput.addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchTerm = e.target.value;
                loadCoupons(1);
            }, 500);
        });
    }

    // Status filter
    const statusFilterEl = document.getElementById('statusFilter');
    if (statusFilterEl) {
        statusFilterEl.addEventListener('change', function() {
            statusFilter = this.value;
            loadCoupons(1);
        });
    }

    // Sort options
    const sortByEl = document.getElementById('sortBy');
    if (sortByEl) {
        sortByEl.addEventListener('change', function() {
            sortBy = this.value;
            loadCoupons(1);
        });
    }

    // Apply filter button
    const applyBtn = document.querySelector('button[onclick="loadCoupons(1)"]');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => loadCoupons(1));
    }

    // Delete confirmation
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', deleteCoupon);
    }

    // Form submission
    const couponForm = document.getElementById('couponForm');
    if (couponForm) {
        console.log('Found coupon form');
        couponForm.addEventListener('submit', function(event) {
            event.preventDefault();
            console.log('Form submitted');
            saveCoupon(event);
        });
    } else {
        console.error('Coupon form not found!');
    }
    
    // Save button click
    const saveBtn = document.querySelector('button[onclick="saveCoupon()"]');
    if (saveBtn) {
        console.log('Found save button');
        saveBtn.addEventListener('click', function(event) {
            event.preventDefault();
            console.log('Save button clicked');
            saveCoupon(event);
        });
    }
}

// Show/hide loading spinner
function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    const tableBody = document.getElementById('couponTableBody');
    
    if (spinner) {
        spinner.style.display = show ? 'block' : 'none';
    }
    
    if (tableBody && show) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="sr-only">Loading...</span>
                    </div>
                </td>
            </tr>
        `;
    }
}

// Show alert message
function showAlert(message, type = 'info', duration = 5000) {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.alert-dismissible');
    existingAlerts.forEach(alert => alert.remove());
    
    const alertHtml = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert" 
             style="position: fixed; top: 20px; right: 20px; z-index: 9999; min-width: 300px;">
            ${message}
            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', alertHtml);
    
    // Auto remove after duration
    setTimeout(() => {
        const alert = document.querySelector('.alert-dismissible');
        if (alert) {
            alert.remove();
        }
    }, duration);
}

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Format date with time
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Main function to load coupons
async function loadCoupons(page = 1) {
    try {
        showLoading(true);
        currentPage = page;
        
        // Build query parameters
        const params = new URLSearchParams({
            page: page,
            limit: itemsPerPage,
            sortBy: sortBy.split(':')[0],
            sortOrder: sortBy.split(':')[1]
        });
        
        if (statusFilter) {
            params.append('status', statusFilter);
        }
        
        if (searchTerm) {
            params.append('search', searchTerm);
        }
        
        console.log('Loading coupons with params:', params.toString());
        
        // Make API call
        const response = await fetch(`/admin/api/coupons?${params.toString()}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Loaded coupons:', result);
        
        if (result.success) {
            renderCouponsTable(result.data);
            renderPagination(result.pagination);
        } else {
            throw new Error(result.error || 'Failed to load coupons');
        }
    } catch (error) {
        console.error('Error loading coupons:', error);
        showAlert(`Error loading coupons: ${error.message}`, 'error');
        renderEmptyState();
    } finally {
        showLoading(false);
    }
}

// Render coupons in table
function renderCouponsTable(coupons) {
    const tableBody = document.getElementById('couponTableBody');
    
    if (!coupons || coupons.length === 0) {
        renderEmptyState();
        return;
    }
    
    tableBody.innerHTML = '';
    
    coupons.forEach(coupon => {
        const row = document.createElement('tr');
        
        // Calculate status
        const now = new Date();
        const startDate = new Date(coupon.startDate);
        const endDate = new Date(coupon.endDate);
        const isExpired = endDate < now;
        const isNotStarted = startDate > now;
        
        let statusBadge, statusText, badgeClass;
        
        if (!coupon.isActive) {
            statusText = 'Inactive';
            badgeClass = 'secondary';
        } else if (isExpired) {
            statusText = 'Expired';
            badgeClass = 'danger';
        } else if (isNotStarted) {
            statusText = 'Upcoming';
            badgeClass = 'info';
        } else {
            statusText = 'Active';
            badgeClass = 'success';
        }
        
        statusBadge = `<span class="badge badge-${badgeClass}">${statusText}</span>`;
        
        // Calculate usage percentage
        let usagePercentage = 0;
        let usageText = '0/0';
        let progressClass = 'bg-success';
        
        if (coupon.usageLimit > 0) {
            usagePercentage = Math.round((coupon.usedCount / coupon.usageLimit) * 100);
            usageText = `${coupon.usedCount}/${coupon.usageLimit}`;
            if (usagePercentage >= 80) {
                progressClass = 'bg-warning';
            }
            if (usagePercentage >= 100) {
                progressClass = 'bg-danger';
            }
        } else {
            usageText = `${coupon.usedCount}/∞`;
        }
        
        // Format dates
        const startDateStr = formatDate(coupon.startDate);
        const endDateStr = formatDate(coupon.endDate);
        
        // Format discount value
        const discountValue = coupon.discountType === 'percentage' ? 
            `${coupon.discountValue}%` : `₹${coupon.discountValue}`;
        
        // Calculate days left
        const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
        const validityText = daysLeft > 0 ? `${daysLeft} days left` : 'Expired';
        
        // Create row HTML
        row.innerHTML = `
            <td>
                <div class="d-flex align-items-start">
                    <div class="mr-3">
                        <div class="bg-primary rounded-circle text-white d-flex align-items-center justify-content-center" 
                             style="width: 40px; height: 40px;">
                            <i class="fas fa-tag"></i>
                        </div>
                    </div>
                    <div>
                        <h6 class="mb-1 font-weight-bold text-primary">${coupon.code}</h6>
                        <p class="mb-1 text-dark">${coupon.name}</p>
                        ${coupon.description ? `<small class="text-muted">${coupon.description}</small>` : ''}
                    </div>
                </div>
            </td>
            <td>
                <div class="font-weight-bold text-success">${discountValue}</div>
                ${coupon.minPurchaseAmount > 0 ? 
                    `<small class="text-muted d-block">Min: ₹${coupon.minPurchaseAmount}</small>` : ''}
                ${coupon.maxDiscountAmount ? 
                    `<small class="text-muted d-block">Max: ₹${coupon.maxDiscountAmount}</small>` : ''}
            </td>
            <td>
                <div class="mb-1">
                    <i class="fas fa-calendar-alt text-primary mr-1"></i>
                    <span class="font-weight-bold">${startDateStr}</span>
                    <span class="mx-1">to</span>
                    <span class="font-weight-bold">${endDateStr}</span>
                </div>
                <div>
                    <span class="badge ${daysLeft > 0 ? 'badge-info' : 'badge-danger'}">
                        ${validityText}
                    </span>
                </div>
                <small class="text-muted d-block mt-1">
                    Created: ${formatDate(coupon.createdAt)}
                </small>
            </td>
            <td>
                <div class="mb-2">
                    <div class="d-flex justify-content-between">
                        <span>Usage:</span>
                        <span class="font-weight-bold">${usageText}</span>
                    </div>
                    <div class="progress" style="height: 8px;">
                        <div class="progress-bar ${progressClass}" 
                             role="progressbar" 
                             style="width: ${Math.min(usagePercentage, 100)}%">
                        </div>
                    </div>
                </div>
                <div>
                    <small class="text-muted">
                        Per user: ${coupon.perUserLimit} time${coupon.perUserLimit > 1 ? 's' : ''}
                    </small>
                </div>
            </td>
            <td>
                ${statusBadge}
                <div class="mt-2">
                    <small class="text-muted d-block">
                        ${coupon.isActive ? 'Enabled' : 'Disabled'}
                    </small>
                </div>
            </td>
            <td>
                <div class="btn-group-vertical btn-group-sm" role="group">
                    <button class="btn btn-outline-info mb-1" onclick="viewCoupon('${coupon._id}')" 
                            data-toggle="tooltip" title="View Details">
                        <i class="fas fa-eye mr-1"></i>View
                    </button>
                    <button class="btn btn-outline-warning mb-1" onclick="editCoupon('${coupon._id}')" 
                            data-toggle="tooltip" title="Edit Coupon">
                        <i class="fas fa-edit mr-1"></i>Edit
                    </button>
                 
                    <button class="btn btn-outline-danger mb-1" onclick="toggleCouponStatus('${coupon._id}', ${!coupon.isActive})" 
                            data-toggle="tooltip" title="${coupon.isActive ? 'Deactivate' : 'Activate'}">
                        <i class="fas ${coupon.isActive ? 'fa-toggle-off' : 'fa-toggle-on'} mr-1"></i>
                        ${coupon.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    ${coupon.usedCount === 0 ? `
                      
                    ` : ''}
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Initialize tooltips
    $('[data-toggle="tooltip"]').tooltip();
}

// Render empty state
function renderEmptyState() {
    const tableBody = document.getElementById('couponTableBody');
    tableBody.innerHTML = `
        <tr>
            <td colspan="6" class="text-center py-5">
                <div class="empty-state">
                    <i class="fas fa-tags fa-4x text-muted mb-3"></i>
                    <h4 class="text-muted">No coupons found</h4>
                    <p class="text-muted">${searchTerm || statusFilter ? 'Try changing your filters' : 'Create your first coupon to get started'}</p>
                    ${!searchTerm && !statusFilter ? `
                        <button class="btn btn-primary mt-2" onclick="openNewCouponModal()">
                            <i class="fas fa-plus mr-1"></i>Create New Coupon
                        </button>
                    ` : `
                        <button class="btn btn-outline-primary mt-2" onclick="resetFilters()">
                            <i class="fas fa-redo mr-1"></i>Reset Filters
                        </button>
                    `}
                </div>
            </td>
        </tr>
    `;
    
    // Hide pagination if no results
    document.getElementById('paginationContainer').innerHTML = '';
}

// Reset all filters
function resetFilters() {
    searchTerm = '';
    statusFilter = '';
    sortBy = 'createdAt:desc';
    
    const searchInput = document.getElementById('searchInput');
    const statusSelect = document.getElementById('statusFilter');
    const sortSelect = document.getElementById('sortBy');
    
    if (searchInput) searchInput.value = '';
    if (statusSelect) statusSelect.value = '';
    if (sortSelect) sortSelect.value = 'createdAt:desc';
    
    loadCoupons(1);
}

// Render pagination controls
function renderPagination(pagination) {
    const paginationContainer = document.getElementById('paginationContainer');
    
    if (!pagination || pagination.pages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    totalPages = pagination.pages;
    
    let paginationHtml = `
        <nav aria-label="Coupon pagination">
            <ul class="pagination justify-content-center mb-0">
    `;
    
    // Previous button
    const prevDisabled = currentPage === 1 ? 'disabled' : '';
    paginationHtml += `
        <li class="page-item ${prevDisabled}">
            <a class="page-link" href="#" data-page="${currentPage - 1}" 
               ${prevDisabled ? 'tabindex="-1" aria-disabled="true"' : ''}>
                <i class="fas fa-chevron-left"></i>
            </a>
        </li>
    `;
    
    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // Adjust if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // First page
    if (startPage > 1) {
        paginationHtml += `
            <li class="page-item">
                <a class="page-link" href="#" data-page="1">1</a>
            </li>
        `;
        if (startPage > 2) {
            paginationHtml += `
                <li class="page-item disabled">
                    <span class="page-link">...</span>
                </li>
            `;
        }
    }
    
    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        const activeClass = i === currentPage ? 'active' : '';
        paginationHtml += `
            <li class="page-item ${activeClass}">
                <a class="page-link" href="#" data-page="${i}">${i}</a>
            </li>
        `;
    }
    
    // Last page
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHtml += `
                <li class="page-item disabled">
                    <span class="page-link">...</span>
                </li>
            `;
        }
        paginationHtml += `
            <li class="page-item">
                <a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a>
            </li>
        `;
    }
    
    // Next button
    const nextDisabled = currentPage === totalPages ? 'disabled' : '';
    paginationHtml += `
        <li class="page-item ${nextDisabled}">
            <a class="page-link" href="#" data-page="${currentPage + 1}" 
               ${nextDisabled ? 'tabindex="-1" aria-disabled="true"' : ''}>
                <i class="fas fa-chevron-right"></i>
            </a>
        </li>
    `;
    
    paginationHtml += `
            </ul>
        </nav>
        <div class="text-center mt-2 text-muted">
            Showing ${((currentPage - 1) * itemsPerPage) + 1} to ${Math.min(currentPage * itemsPerPage, pagination.total)} of ${pagination.total} coupons
        </div>
    `;
    
    paginationContainer.innerHTML = paginationHtml;
    
    // Add click event listeners to page links
    const pageLinks = paginationContainer.querySelectorAll('.page-link');
    pageLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = parseInt(this.getAttribute('data-page'));
            if (page && page !== currentPage) {
                loadCoupons(page);
            }
        });
    });
}

// Open modal for new coupon
function openNewCouponModal() {
    console.log('Opening new coupon modal');
    currentCouponId = null;
    isEditMode = false;
    isBulkMode = false;
    
    document.getElementById('modalTitle').textContent = 'Create New Coupon';
    document.getElementById('couponForm').reset();
    document.getElementById('couponId').value = '';
    document.getElementById('bulkSection').style.display = 'none';
    document.getElementById('bulkToggleBtn').innerHTML = '<i class="fas fa-copy mr-1"></i> Bulk Mode';
    document.getElementById('bulkToggleBtn').style.display = 'block';
    document.getElementById('saveBtn').innerHTML = '<i class="fas fa-save mr-1"></i> Save Coupon';
    
    // Set default dates
    const now = new Date();
    const startDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
        .toISOString()
        .slice(0, 16);
    const endDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000) - (now.getTimezoneOffset() * 60000))
        .toISOString()
        .slice(0, 16);
    
    document.getElementById('startDate').value = startDate;
    document.getElementById('endDate').value = endDate;
    
    // Enable code field
    document.getElementById('code').disabled = false;
    document.getElementById('code').placeholder = 'Auto-generated if empty';
    
    // Generate code
    generateCode();
    
    // Show modal
    $('#couponModal').modal('show');
}

// Generate coupon code
function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    
    // Generate 8-character random code
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Add timestamp
    const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
    code += '-' + timestamp;
    
    document.getElementById('code').value = code;
}

// Toggle bulk section
function toggleBulkSection() {
    const bulkSection = document.getElementById('bulkSection');
    const bulkToggleBtn = document.getElementById('bulkToggleBtn');
    const codeInput = document.getElementById('code');
    
    if (isBulkMode) {
        // Switch to single mode
        bulkSection.style.display = 'none';
        bulkToggleBtn.innerHTML = '<i class="fas fa-copy mr-1"></i> Bulk Mode';
        bulkToggleBtn.className = 'btn btn-info';
        codeInput.disabled = false;
        codeInput.placeholder = 'Auto-generated if empty';
        isBulkMode = false;
    } else {
        // Switch to bulk mode
        bulkSection.style.display = 'block';
        bulkToggleBtn.innerHTML = '<i class="fas fa-times mr-1"></i> Single Mode';
        bulkToggleBtn.className = 'btn btn-secondary';
        codeInput.disabled = true;
        codeInput.placeholder = 'Auto-generated for bulk coupons';
        isBulkMode = true;
    }
}

// Edit coupon
async function editCoupon(id) {
    try {
        console.log('Editing coupon:', id);
        const response = await fetch(`/admin/api/coupons/${id}`);
        const result = await response.json();
        
        if (result.success) {
            currentCouponId = id;
            isEditMode = true;
            isBulkMode = false;
            
            const coupon = result.data;
            
            document.getElementById('modalTitle').textContent = 'Edit Coupon';
            document.getElementById('couponId').value = coupon._id;
            document.getElementById('name').value = coupon.name;
            document.getElementById('code').value = coupon.code;
            document.getElementById('description').value = coupon.description || '';
            document.getElementById('discountType').value = coupon.discountType;
            document.getElementById('discountValue').value = coupon.discountValue;
            document.getElementById('maxDiscountAmount').value = coupon.maxDiscountAmount || '';
            document.getElementById('minPurchaseAmount').value = coupon.minPurchaseAmount || 0;
            document.getElementById('usageLimit').value = coupon.usageLimit || 0;
            document.getElementById('perUserLimit').value = coupon.perUserLimit || 1;
            document.getElementById('isActive').checked = coupon.isActive;
            
            // Format dates for datetime-local input
            const startDate = new Date(coupon.startDate);
            const endDate = new Date(coupon.endDate);
            document.getElementById('startDate').value = startDate.toISOString().slice(0, 16);
            document.getElementById('endDate').value = endDate.toISOString().slice(0, 16);
            
            // Hide bulk section for edit
            document.getElementById('bulkSection').style.display = 'none';
            document.getElementById('bulkToggleBtn').style.display = 'none';
            
            $('#couponModal').modal('show');
        }
    } catch (error) {
        console.error('Error loading coupon for edit:', error);
        showAlert('Error loading coupon data', 'error');
    }
}

// Save coupon (create or update)
async function saveCoupon(event) {
    if (event) event.preventDefault();
    
    try {
        console.log('Saving coupon...');
        showLoading(true);
        
        const form = document.getElementById('couponForm');
        if (!form) {
            throw new Error('Form not found');
        }
        
        const formData = new FormData(form);
        const couponData = Object.fromEntries(formData.entries());
        
        console.log('Form data:', couponData);
        
        // Validate required fields
        if (!couponData.name || !couponData.discountValue || !couponData.startDate || !couponData.endDate) {
            throw new Error('Please fill all required fields');
        }
        
        // Prepare data
        couponData.startDate = new Date(couponData.startDate).toISOString();
        couponData.endDate = new Date(couponData.endDate).toISOString();
        couponData.discountValue = parseFloat(couponData.discountValue);
        couponData.minPurchaseAmount = parseFloat(couponData.minPurchaseAmount) || 0;
        couponData.maxDiscountAmount = couponData.maxDiscountAmount ? parseFloat(couponData.maxDiscountAmount) : null;
        couponData.usageLimit = parseInt(couponData.usageLimit) || 0;
        couponData.perUserLimit = parseInt(couponData.perUserLimit) || 1;
        couponData.isActive = document.getElementById('isActive')?.checked || true;
        
        // Check if bulk mode
        const bulkSection = document.getElementById('bulkSection');
        const isBulkMode = bulkSection && bulkSection.style.display !== 'none';
        
        if (isBulkMode) {
            couponData.bulkCount = parseInt(document.getElementById('bulkCount')?.value) || 5;
            couponData.bulkPrefix = document.getElementById('bulkPrefix')?.value || '';
            couponData.couponType = 'bulk';
        }
        
        const couponId = document.getElementById('couponId')?.value;
        let url = '/admin/api/coupons';
        let method = 'POST';
        
        if (couponId) {
            url = `/admin/api/coupons/${couponId}`;
            method = 'PUT';
        }
        
        console.log('Sending request:', { url, method, data: couponData });
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(couponData)
        });
        
        const result = await response.json();
        console.log('Server response:', result);
        
        if (result.success) {
            showAlert(result.message || 'Coupon saved successfully!', 'success');
            $('#couponModal').modal('hide');
            loadCoupons();
            updateStats();
        } else {
            throw new Error(result.error || 'Failed to save coupon');
        }
    } catch (error) {
        console.error('Error saving coupon:', error);
        showAlert(`Error: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

// Update statistics
async function updateStats() {
    try {
        const response = await fetch('/admin/api/coupons/stats');
        const result = await response.json();
        
        if (result.success) {
            const stats = result.data;
            document.getElementById('totalCoupons').textContent = stats.totalCoupons;
            document.getElementById('activeCoupons').textContent = stats.activeCoupons;
            document.getElementById('expiredCoupons').textContent = stats.expiredCoupons;
            document.getElementById('expiringSoonCoupons').textContent = stats.expiringSoon;
        }
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

// View coupon details
async function viewCoupon(id) {
    try {
        const response = await fetch(`/admin/api/coupons/${id}`);
        const result = await response.json();
        
        if (result.success) {
            const coupon = result.data;
            
            // Create modal content
            const modalContent = `
                <div class="row">
                    <div class="col-md-6">
                        <h6>Basic Information</h6>
                        <table class="table table-sm">
                            <tr>
                                <th width="40%">Name:</th>
                                <td>${coupon.name}</td>
                            </tr>
                            <tr>
                                <th>Code:</th>
                                <td><code class="font-weight-bold">${coupon.code}</code></td>
                            </tr>
                            <tr>
                                <th>Description:</th>
                                <td>${coupon.description || 'N/A'}</td>
                            </tr>
                            <tr>
                                <th>Status:</th>
                                <td>
                                    ${coupon.isActive ? 
                                        '<span class="badge badge-success">Active</span>' : 
                                        '<span class="badge badge-secondary">Inactive</span>'}
                                </td>
                            </tr>
                            <tr>
                                <th>Created:</th>
                                <td>${formatDateTime(coupon.createdAt)}</td>
                            </tr>
                            <tr>
                                <th>Last Updated:</th>
                                <td>${formatDateTime(coupon.updatedAt)}</td>
                            </tr>
                        </table>
                    </div>
                    <div class="col-md-6">
                        <h6>Discount Details</h6>
                        <table class="table table-sm">
                            <tr>
                                <th width="40%">Type:</th>
                                <td>${coupon.discountType === 'percentage' ? 'Percentage' : 'Fixed Amount'}</td>
                            </tr>
                            <tr>
                                <th>Value:</th>
                                <td class="text-success font-weight-bold">
                                    ${coupon.discountType === 'percentage' ? 
                                        coupon.discountValue + '%' : 
                                        '₹' + coupon.discountValue}
                                </td>
                            </tr>
                            <tr>
                                <th>Min Purchase:</th>
                                <td>₹${coupon.minPurchaseAmount || '0'}</td>
                            </tr>
                            <tr>
                                <th>Max Discount:</th>
                                <td>${coupon.maxDiscountAmount ? '₹' + coupon.maxDiscountAmount : 'No limit'}</td>
                            </tr>
                            <tr>
                                <th>Per User Limit:</th>
                                <td>${coupon.perUserLimit} time${coupon.perUserLimit > 1 ? 's' : ''}</td>
                            </tr>
                            <tr>
                                <th>Total Usage:</th>
                                <td>${coupon.usedCount}/${coupon.usageLimit || '∞'}</td>
                            </tr>
                        </table>
                    </div>
                </div>
                
                <div class="row mt-3">
                    <div class="col-md-6">
                        <h6>Validity Period</h6>
                        <table class="table table-sm">
                            <tr>
                                <th width="40%">Start Date:</th>
                                <td>${formatDateTime(coupon.startDate)}</td>
                            </tr>
                            <tr>
                                <th>End Date:</th>
                                <td>${formatDateTime(coupon.endDate)}</td>
                            </tr>
                            <tr>
                                <th>Days Left:</th>
                                <td>
                                    ${(() => {
                                        const now = new Date();
                                        const end = new Date(coupon.endDate);
                                        const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
                                        if (daysLeft > 0) {
                                            return `<span class="text-success">${daysLeft} days</span>`;
                                        } else {
                                            return `<span class="text-danger">Expired</span>`;
                                        }
                                    })()}
                                </td>
                            </tr>
                        </table>
                    </div>
                </div>
            `;
            
            // Update modal body
            document.getElementById('viewModalBody').innerHTML = modalContent;
            
            // Show modal
            $('#viewModal').modal('show');
            
        } else {
            throw new Error(result.error || 'Failed to load coupon details');
        }
    } catch (error) {
        console.error('Error viewing coupon:', error);
        showAlert(`Error: ${error.message}`, 'error');
    }
}

// Duplicate coupon
async function duplicateCoupon(id) {
    try {
        if (!confirm('Duplicate this coupon?')) return;
        
        showLoading(true);
        
        const response = await fetch(`/admin/api/coupons/${id}`);
        const result = await response.json();
        
        if (result.success) {
            const original = result.data;
            const newCode = generateCouponCode();
            
            const couponData = {
                name: `${original.name} (Copy)`,
                code: newCode,
                description: original.description,
                discountType: original.discountType,
                discountValue: original.discountValue,
                minPurchaseAmount: original.minPurchaseAmount,
                maxDiscountAmount: original.maxDiscountAmount,
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                usageLimit: original.usageLimit,
                perUserLimit: original.perUserLimit,
                isActive: true
            };
            
            const createResponse = await fetch('/admin/api/coupons', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(couponData)
            });
            
            if (createResponse.ok) {
                const createResult = await createResponse.json();
                if (createResult.success) {
                    showAlert('Coupon duplicated successfully!', 'success');
                    loadCoupons();
                    updateStats();
                } else {
                    throw new Error(createResult.error || 'Failed to create duplicate coupon');
                }
            } else {
                throw new Error('Failed to create duplicate coupon');
            }
        }
    } catch (error) {
        console.error('Error duplicating coupon:', error);
        showAlert(`Error: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}


async function toggleCouponStatus(id, newStatus) {
    const isActivate = newStatus === true;

    const result = await Swal.fire({
        title: isActivate ? 'Activate this coupon?' : 'Deactivate this coupon?',
        text: isActivate
            ? 'Users will be able to apply this coupon.'
            : 'Users will no longer be able to use this coupon.',
        icon: isActivate ? 'question' : 'warning',
        showCancelButton: true,
        confirmButtonColor: isActivate ? '#16a34a' : '#d33',
        cancelButtonColor: '#6b7280',
        confirmButtonText: isActivate ? 'Yes, activate' : 'Yes, deactivate',
        cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    try {
        const response = await fetch(`/admin/api/coupons/${id}/toggle-status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success) {
            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: data.message || 'Coupon status updated',
                timer: 1500,
                showConfirmButton: false
            });

            loadCoupons(currentPage);
            updateStats();
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Failed',
                text: data.error || 'Failed to update coupon status'
            });
        }
    } catch (error) {
        console.error('Error toggling coupon status:', error);
        Swal.fire({
            icon: 'error',
            title: 'Server Error',
            text: error.message || 'Something went wrong'
        });
    }
}



// Confirm delete
function confirmDelete(id) {
    currentCouponId = id;
    $('#deleteModal').modal('show');
}


async function deleteCoupon() {
    try {
        $('#deleteModal').modal('hide');
        showLoading(true);
        
        const response = await fetch(`/admin/api/coupons/${currentCouponId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert(result.message, 'success');
            loadCoupons(currentPage);
            updateStats();
        } else {
            throw new Error(result.error || 'Failed to delete coupon');
        }
    } catch (error) {
        console.error('Error deleting coupon:', error);
        showAlert(`Error: ${error.message}`, 'error');
    } finally {
        showLoading(false);
        currentCouponId = null;
    }
}

// Helper function for generating codes
function generateCouponCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
    return `${code}-${timestamp}`;
}

// Test function
function testSave() {
    console.log('Test save function');
    const testData = {
        name: 'Test Coupon',
        code: 'TEST' + Date.now(),
        description: 'Test coupon',
        discountType: 'percentage',
        discountValue: 10,
        minPurchaseAmount: 0,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        usageLimit: 10,
        perUserLimit: 1,
        isActive: true
    };
    
    fetch('/admin/api/coupons', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(testData)
    })
    .then(response => response.json())
    .then(result => console.log('Test result:', result))
    .catch(error => console.error('Test error:', error));
}