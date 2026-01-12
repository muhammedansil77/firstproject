console.log('dashboard.js loaded');

document.addEventListener('DOMContentLoaded', () => {

  const data = window.DASHBOARD_DATA;
  if (!data) {
    console.warn('No dashboard data');
    return;
  }

  /* ================= REVENUE ================= */
  const revenueCanvas = document.getElementById('revenueChart');

  if (revenueCanvas && data.dailySales?.length) {
    new Chart(revenueCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: data.dailySales.map(d => d.date),
        datasets: [{
          label: 'Revenue',
          data: data.dailySales.map(d => d.revenue),
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }

  /* ================= PAYMENT ================= */
  const paymentCanvas = document.getElementById('paymentChart');

  if (paymentCanvas && data.paymentMethods?.length) {
    new Chart(paymentCanvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: data.paymentMethods.map(p => p.method),
        datasets: [{
          data: data.paymentMethods.map(p => p.count)
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }

  /* ================= STATUS ================= */
  const statusCanvas = document.getElementById('statusChart');

  if (statusCanvas && data.orderStatuses?.length) {
    new Chart(statusCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: data.orderStatuses.map(s => s.status),
        datasets: [{
          label: 'Orders',
          data: data.orderStatuses.map(s => s.count)
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }

  /* ================= HOURLY ================= */
  const hourlyCanvas = document.getElementById('hourlyChart');

  if (hourlyCanvas && data.hourlySales?.length) {
    new Chart(hourlyCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: data.hourlySales.map(h => h.hour),
        datasets: [{
          label: 'Hourly Revenue',
          data: data.hourlySales.map(h => h.revenue),
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }

});
