// Global chart instances
let salesChart, paymentChart, statusChart;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadDashboardData();
    renderCharts();
    initializeEventListeners();
    
    initializeSearch();
    initializePagination();


});

// Load dashboard stats via AJAX
async function loadDashboardData() {
    try {
        const response = await fetch('/admin/reports/dashboard-data');
        const result = await response.json();
        
        if (result.success) {
            const data = result.data;
            
            // Update quick stats
            document.getElementById('todayRevenue').textContent = '₹' + data.today.revenue.toLocaleString();
            document.getElementById('todayOrders').textContent = data.today.orders;
            document.getElementById('monthRevenue').textContent = '₹' + data.month.revenue.toLocaleString();
            document.getElementById('yearRevenue').textContent = '₹' + data.year.revenue.toLocaleString();
            
            // Update revenue change indicator
            const changeElem = document.getElementById('revenueChange');
            const change = parseFloat(data.today.change);
            changeElem.textContent = (change > 0 ? '+' : '') + change + '%';
            changeElem.className = change > 0 ? 'text-success' : 'text-danger';
            
            // Render 7-day chart
            renderWeeklyChart(data.last7Days);
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// Render all charts
function renderCharts() {
    // Sales Chart (Daily/Hourly)
    const salesCtx = document.getElementById('salesChart').getContext('2d');
    
    const salesData = {
        labels: <%= JSON.stringify(charts.dailySales.map(d => d.date)) %>,
        datasets: [{
            label: 'Revenue (₹)',
            data: <%= JSON.stringify(charts.dailySales.map(d => d.revenue)) %>,
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4
        }, {
            label: 'Orders',
            data: <%= JSON.stringify(charts.dailySales.map(d => d.orders)) %>,
            borderColor: '#4fd1c5',
            backgroundColor: 'rgba(79, 209, 197, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4
        }]
    };
    
    salesChart = new Chart(salesCtx, {
        type: 'line',
        data: salesData,
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '₹' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
    
    // Payment Methods Chart
    const paymentCtx = document.getElementById('paymentChart').getContext('2d');
    const paymentData = {
        labels: <%= JSON.stringify(charts.paymentMethods.map(p => p.method)) %>,
        datasets: [{
            data: <%= JSON.stringify(charts.paymentMethods.map(p => p.count)) %>,
            backgroundColor: [
                '#667eea', '#4fd1c5', '#f56565', '#ed8936', '#ecc94b'
            ],
            borderWidth: 1,
            borderColor: '#fff'
        }]
    };
    
    paymentChart = new Chart(paymentCtx, {
        type: 'doughnut',
        data: paymentData,
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                }
            }
        }
    });
    
    // Order Status Chart
    const statusCtx = document.getElementById('statusChart').getContext('2d');
    const statusData = {
        labels: <%= JSON.stringify(charts.orderStatuses.map(s => s.status)) %>,
        datasets: [{
            data: <%= JSON.stringify(charts.orderStatuses.map(s => s.count)) %>,
            backgroundColor: [
                '#667eea', '#4299e1', '#38b2ac', '#ecc94b', '#f56565', '#9f7aea'
            ],
            borderWidth: 1,
            borderColor: '#fff'
        }]
    };
    
    statusChart = new Chart(statusCtx, {
        type: 'pie',
        data: statusData,
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                }
            }
        }
    });
}

// Render weekly chart for dashboard
function renderWeeklyChart(data) {
    const weeklyCtx = document.createElement('canvas');
    const container = document.querySelector('.card-body');
    
    // You can add this to a specific element if needed
}
function initializeSearch() {
    const searchInput = document.querySelector('input[name="search"]');
    let searchTimeout;
    
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                // Update URL with search parameter
                const searchTerm = e.target.value;
                const url = new URL(window.location.href);
                
                if (searchTerm) {
                    url.searchParams.set('search', searchTerm);
                    url.searchParams.set('page', 1); // Reset to first page
                } else {
                    url.searchParams.delete('search');
                }
                
                window.location.href = url.toString();
            }, 800);
        });
    }
}

// Pagination handling
function initializePagination() {
    // Handle items per page change
    const limitSelect = document.querySelector('select[name="limit"]');
    if (limitSelect) {
        limitSelect.addEventListener('change', function() {
            const url = new URL(window.location.href);
            url.searchParams.set('limit', this.value);
            url.searchParams.set('page', 1); // Reset to first page
            window.location.href = url.toString();
        });
    }
}

// Update date range visibility (keep existing)
function updateDateRange() {
    const periodSelect = document.getElementById('periodSelect');
    const customRange = document.getElementById('customDateRange');
    const customRangeEnd = document.getElementById('customDateRangeEnd');
    
    if (periodSelect.value === 'custom') {
        customRange.style.display = 'block';
        customRangeEnd.style.display = 'block';
    } else {
        customRange.style.display = 'none';
        customRangeEnd.style.display = 'none';
    }
}

// Quick pagination helper
function goToPage(page) {
    const url = new URL(window.location.href);
    url.searchParams.set('page', page);
    window.location.href = url.toString();
}

// Keyboard shortcuts for pagination
document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    if (e.key === 'ArrowLeft' && <%= pagination.hasPrevPage %>) {
        goToPage(<%= pagination.prevPage %>);
    } else if (e.key === 'ArrowRight' && <%= pagination.hasNextPage %>) {
        goToPage(<%= pagination.nextPage %>);
    }
});

// Change chart type (Daily/Hourly)
function changeChartType(type) {
    // Update button states
    document.querySelectorAll('.btn-group-sm button').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update chart data based on type
    if (type === 'hourly') {
        const hourlyData = {
            labels: <%= JSON.stringify(charts.hourlySales.map(h => h.hour)) %>,
            datasets: [{
                label: 'Revenue (₹)',
                data: <%= JSON.stringify(charts.hourlySales.map(h => h.revenue)) %>,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 2,
                fill: true
            }]
        };
        
        salesChart.data = hourlyData;
        salesChart.options.scales.x.title.text = 'Hour of Day';
        salesChart.update();
    } else {
        // Revert to daily data
        const dailyData = {
            labels: <%= JSON.stringify(charts.dailySales.map(d => d.date)) %>,
            datasets: [{
                label: 'Revenue (₹)',
                data: <%= JSON.stringify(charts.dailySales.map(d => d.revenue)) %>,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }, {
                label: 'Orders',
                data: <%= JSON.stringify(charts.dailySales.map(d => d.orders)) %>,
                borderColor: '#4fd1c5',
                backgroundColor: 'rgba(79, 209, 197, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        };
        
        salesChart.data = dailyData;
        salesChart.options.scales.x.title.text = 'Date';
        salesChart.update();
    }
}

// Update date range visibility
function updateDateRange() {
    const periodSelect = document.getElementById('periodSelect');
    const customRange = document.getElementById('customDateRange');
    const customRangeEnd = document.getElementById('customDateRangeEnd');
    
    if (periodSelect.value === 'custom') {
        customRange.style.display = 'block';
        customRangeEnd.style.display = 'block';
    } else {
        customRange.style.display = 'none';
        customRangeEnd.style.display = 'none';
    }
}

// Refresh dashboard
function refreshDashboard() {
    loadDashboardData();
    
    // Show loading state
    const refreshBtn = event.target;
    const originalHTML = refreshBtn.innerHTML;
    refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise me-2"></i>Refreshing...';
    refreshBtn.disabled = true;
    
    setTimeout(() => {
        refreshBtn.innerHTML = originalHTML;
        refreshBtn.disabled = false;
    }, 1000);
}

// Initialize event listeners
function initializeEventListeners() {
    // Update date inputs max to today
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(input => {
        input.max = today;
    });
    
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.forEach(function (tooltipTriggerEl) {
        new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// Helper function for export links
function getFilterParams() {
    return '<%= "&period=" + filters.period + "&paymentMethod=" + filters.paymentMethod + "&orderStatus=" + filters.orderStatus + (filters.startDate ? "&startDate=" + filters.startDate : "") + (filters.endDate ? "&endDate=" + filters.endDate : "") %>';
}

// Auto-refresh every 5 minutes
setInterval(loadDashboardData, 300000);