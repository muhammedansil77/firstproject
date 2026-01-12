function exportReturns() {
  const currentUrl = new URL(window.location.href);

  // Build export URL with SAME filters
  const exportUrl = new URL('/admin/returns/export/csv', window.location.origin);

  currentUrl.searchParams.forEach((value, key) => {
    exportUrl.searchParams.set(key, value);
  });

  fetch(exportUrl)
    .then(res => {
      if (!res.ok) throw new Error('Export failed');
      return res.blob();
    })
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `returns_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    })
    .catch(err => {
      console.error('Export failed:', err);
      alert('Failed to export returns');
    });
}

document.addEventListener('DOMContentLoaded', function () {
  const exportBtn = document.getElementById('exportBtn');

  if (!exportBtn) {
    console.warn('exportBtn not found on page');
    return;
  }

  exportBtn.addEventListener('click', async function () {
    try {
      const params = new URLSearchParams(window.location.search);
      let url = '/admin/returns/export';

      if (params.toString()) {
        url += '?' + params.toString();
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `returns_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();

      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export returns');
    }
  });
});

function selectAllReturns() {
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.return-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll.checked;
    });
}

// Bulk update
function bulkUpdateStatus(status) {
    const selectedReturns = Array.from(document.querySelectorAll('.return-checkbox:checked'))
        .map(cb => cb.value);
    
    if (selectedReturns.length === 0) {
        alert('Please select at least one return request');
        return;
    }
    
    if (confirm(`Are you sure you want to update ${selectedReturns.length} return(s) to "${status}"?`)) {
        fetch('/admin/returns/bulk-update', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                returnIds: selectedReturns,
                status: status
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert(`Updated ${data.updatedCount} return(s) successfully!`);
                location.reload();
            } else {
                alert('Error: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to update returns');
        });
    }
}

// Apply filters
function applyFilters() {
    const status = document.getElementById('statusFilter').value;
    const method = document.getElementById('methodFilter').value;
    const date = document.getElementById('dateFilter').value;
    
    let url = '/admin/returns?';
    if (status) url += `status=${status}&`;
    if (method) url += `method=${method}&`;
    if (date) url += `date=${date}&`;
    
    window.location.href = url.slice(0, -1);
}

// Export functionality

