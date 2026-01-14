// public/admin/js/category.js
// Full category page client script — load, create, edit, block/unblock
(function () {
  'use strict';

  // helpers
  function $id(id) { return document.getElementById(id); }
  function esc(s) { return s == null ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  // endpoints (adjust if your server uses a different path)
  const LIST_ENDPOINT   = '/admin/category/data';
  const CREATE_ENDPOINT = '/admin/category';
  const UPDATE_ENDPOINT = id => `/admin/category/${id}`;
  const BLOCK_ENDPOINT  = id => `/admin/category/${id}/block`;
  const UNBLOCK_ENDPOINT= id => `/admin/category/${id}/unblock`;
  const DELETE_ENDPOINT = id => `/admin/category/${id}`; // optional, we won't soft-delete

  // DOM elements (from your EJS)
  const tbody = $id('categoryList');
  const addForm = $id('addForm');
  const imageInput = $id('imageInput');
  const imagePreview = $id('imagePreview');
  const imagePreviewWrapper = $id('imagePreviewWrapper');

  const editModalEl = $id('editCategoryModal');
  const editForm = $id('editForm');
  const editIdInput = $id('editCategoryId');
  const editNameInput = $id('editNameInput');
  const editDescInput = $id('editDescInput');
  const editImageInput = $id('editImageInput');
  const editImagePreview = $id('editImagePreview');
  const editImagePreviewWrapper = $id('editImagePreviewWrapper');
  const currentImageBox = $id('currentImageBox');
    // Search + pagination state
  let currentPage = 1;
  let currentSearch = '';
  let currentStatus = 'all'; // you already support it in backend; you can add status filter later
  const pageSize = 10;

  const searchForm = $id('categorySearchForm');
  const searchInput = $id('searchInput');
  const clearSearchBtn = $id('clearSearchBtn');
  const paginationContainer = $id('categoryPagination');


  // Bootstrap modal instances
  let editModalInstance = null;
  if (editModalEl && window.bootstrap && typeof bootstrap.Modal === 'function') {
    editModalInstance = new bootstrap.Modal(editModalEl);
  }

  const FALLBACK_IMAGE = (window.CATEGORY_FALLBACK_IMAGE) ? window.CATEGORY_FALLBACK_IMAGE : '/uploads/placeholder.png';

 
function renderRow(cat, index) {
  const id = cat._id || cat.id || '';
  const imgSrc = cat.imagePath ? cat.imagePath : FALLBACK_IMAGE;
  const name = esc(cat.name);
  const desc = esc(cat.description || '');
  const items = Number(cat.itemCount || 0);
  const active = !!cat.active;

  const statusText = active ? 'Active' : 'Blocked';

  let toggleIconHtml = '';
  if (active) {
  
    toggleIconHtml = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="8"></circle>
        <line x1="8" y1="8" x2="16" y2="16"></line>
      </svg>
    `;
  } else {

    toggleIconHtml = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M5 13l4 4L19 7"></path>
        <circle cx="12" cy="12" r="9" stroke-width="1.5"></circle>
      </svg>
    `;
  }

  return `
    <tr data-id="${id}">
      <td class="col-id">${index + 1}</td>

      <td class="col-category">
        <div style="display:flex;align-items:center;gap:0.75rem;">
         
          <div style="display:flex;flex-direction:column;gap:0.1rem;">
            <span style="font-weight:600;">${name}</span>
            <span style="font-size:0.75rem;color:#6b7280;">Category ID: ${esc(id)}</span>
          </div>
        </div>
      </td>

      <td class="col-description">
        ${desc || '<span style="color:#6b7280;font-size:0.8rem;">No description</span>'}
      </td>

      <td class="col-items">
        ${items}
      </td>

      <td class="col-status category-active-cell">
        <span class="status-pill ${active ? 'status-active' : 'status-blocked'}">
          <span class="status-pill-dot"></span>
          <span>${statusText}</span>
        </span>
      </td>

      <td class="col-actions">
        <div class="actions-group">
          <!-- Edit button -->
          <button
            type="button"
            class="action-btn edit edit-btn"
            title="Edit category"
            data-id="${id}"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M11 4H6a2 2 0 0 0-2 2v12l3.5-3.5"></path>
              <path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L13 14l-3 1 1-3 7.5-7.5z"></path>
            </svg>
          </button>

          <!-- Block / Unblock button (icon only) -->
          <button
            type="button"
            class="action-btn toggle category-block-toggle"
            title="${active ? 'Block category' : 'Unblock category'}"
            data-id="${id}"
            data-action="${active ? 'block' : 'unblock'}"
          >
            ${toggleIconHtml}
          </button>
        </div>
      </td>
    </tr>
  `;
}
  function renderPagination(meta) {
    if (!paginationContainer) return;

    const {
      totalPages = 0,
      currentPage = 1,
      hasPrev = false,
      hasNext = false,
      prevPage = null,
      nextPage = null,
      totalItems = 0
    } = meta || {};

    if (!totalPages || totalPages <= 1) {
      paginationContainer.innerHTML = '';
      return;
    }

    let html = '<div class="pagination-inner">';

    // Info
    html += `<div class="pagination-info">Total: ${totalItems} categories</div>`;

    html += '<div class="pagination-buttons">';

    // Prev
    if (hasPrev && prevPage) {
      html += `<button class="page-btn" data-page="${prevPage}">&laquo; Prev</button>`;
    } else {
      html += `<button class="page-btn disabled" disabled>&laquo; Prev</button>`;
    }

    const maxButtons = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start < maxButtons - 1) {
      start = Math.max(1, end - maxButtons + 1);
    }

    for (let p = start; p <= end; p++) {
      if (p === currentPage) {
        html += `<button class="page-btn active" data-page="${p}">${p}</button>`;
      } else {
        html += `<button class="page-btn" data-page="${p}">${p}</button>`;
      }
    }

  
    if (hasNext && nextPage) {
      html += `<button class="page-btn" data-page="${nextPage}">Next &raquo;</button>`;
    } else {
      html += `<button class="page-btn disabled" disabled>Next &raquo;</button>`;
    }

    html += '</div></div>';

    paginationContainer.innerHTML = html;
  }

  async function load(options = {}) {
    if (!tbody) return;

    if (typeof options.page === 'number') {
      currentPage = options.page;
    }
    if (typeof options.search === 'string') {
      currentSearch = options.search;
    }
    if (typeof options.status === 'string') {
      currentStatus = options.status;
    }

    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="loading-cell">
          <div class="loading-spinner"></div>
          <span>Loading categories...</span>
        </td>
      </tr>
    `;

    try {
      const res = await axios.get(LIST_ENDPOINT, {
        params: {
          page: currentPage,
          limit: pageSize,
          search: currentSearch,
          status: currentStatus
        }
      });

      const data = res && res.data ? res.data : res;
      const categories = Array.isArray(data.categories)
        ? data.categories
        : (data.data || []);

      if (!categories || !categories.length) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="loading-cell">
              <span>No categories found.</span>
            </td>
          </tr>
        `;
        renderPagination({
          totalPages: data.totalPages,
          currentPage: data.currentPage,
          hasPrev: data.hasPrev,
          hasNext: data.hasNext,
          prevPage: data.prevPage,
          nextPage: data.nextPage,
          totalItems: data.totalItems
        });
        return;
      }

      tbody.innerHTML = '';
      categories.forEach((c, i) => {
        const wrapper = document.createElement('template');
        wrapper.innerHTML = renderRow(c, i + (currentPage - 1) * pageSize).trim();
        tbody.appendChild(wrapper.content.firstChild);
      });

     
      renderPagination({
        totalPages: data.totalPages,
        currentPage: data.currentPage,
        hasPrev: data.hasPrev,
        hasNext: data.hasNext,
        prevPage: data.prevPage,
        nextPage: data.nextPage,
        totalItems: data.totalItems
      });

    } catch (err) {
      console.error('Failed to load categories', err);
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="loading-cell">
            <span style="color:#f97373;">Failed to load categories.</span>
          </td>
        </tr>
      `;
      toastr?.error(err.response?.data?.message || 'Failed to load categories');
    }
  }

 
  imageInput?.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) {
      if (imagePreviewWrapper) imagePreviewWrapper.style.display = 'none';
      if (imagePreview) imagePreview.src = '';
      return;
    }
    const url = URL.createObjectURL(file);
    if (imagePreview) imagePreview.src = url;
    if (imagePreviewWrapper) imagePreviewWrapper.style.display = 'block';
  });

  editImageInput?.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) {
      if (editImagePreviewWrapper) editImagePreviewWrapper.style.display = 'none';
      if (editImagePreview) editImagePreview.src = '';
      return;
    }
    editImagePreview.src = URL.createObjectURL(file);
    editImagePreviewWrapper.style.display = 'block';
  });
 
  searchForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = searchInput?.value?.trim() || '';
    load({ page: 1, search: q });
  });


  clearSearchBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    load({ page: 1, search: '' }); 
  });

  
  addForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $id('nameInput')?.value?.trim();
    const description = $id('descInput')?.value?.trim();

    if (!name || name.length < 2) {
      toastr?.error('Name must be at least 2 characters');
      return;
    }

    const fd = new FormData();
    fd.append('name', name);
    fd.append('description', description || '');
    const file = imageInput?.files?.[0];
    if (file) fd.append('image', file);

    try {
      const res = await axios.post(CREATE_ENDPOINT, fd, { headers: { 'Content-Type': 'multipart/form-data' }});
      if (res?.data?.success) {
        toastr?.success(res.data.message || 'Category created');
        addForm.reset();
        if (imagePreviewWrapper) imagePreviewWrapper.style.display = 'none';
        setTimeout(() => load(), 250);
        const addModalEl = document.getElementById('addCategoryModal');
        if (addModalEl) {
          const m = bootstrap.Modal.getInstance(addModalEl) || new bootstrap.Modal(addModalEl);
          m.hide();
        }
      } else {
      
      }
    } catch (err) {
      console.error('create category error', err);
    
    }
  });

  tbody?.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.edit-btn');
    if (editBtn) {
      const id = editBtn.dataset.id;
      if (!id) return toastr?.error('Missing id');

      
      try {
        
        const res = await axios.get(LIST_ENDPOINT);
        const list = res?.data?.categories || res?.data?.data || [];
        const cat = list.find(c => String(c._id) === String(id));
        if (!cat) {
          toastr?.error('Category not found');
          return;
        }

 
        editIdInput.value = cat._id;
        editNameInput.value = cat.name || '';
        editDescInput.value = cat.description || '';
        editImageInput.value = '';
        if (currentImageBox) {
          const src = cat.imagePath ? cat.imagePath : FALLBACK_IMAGE;
          currentImageBox.innerHTML = `<img src="${src}" style="max-width:120px;border-radius:8px;border:1px solid #333;">`;
        }
        if (editImagePreviewWrapper) editImagePreviewWrapper.style.display = 'none';
        if (editModalInstance) editModalInstance.show();
      } catch (err) {
        console.error('open edit error', err);
        toastr?.error('Failed to open edit modal');
      }
      return;
    }

   const blockBtn = e.target.closest('.category-block-toggle');
if (blockBtn) {
  const id = blockBtn.dataset.id;
  const action = blockBtn.dataset.action; // block | unblock

  const isBlock = action === 'block';

  const result = await Swal.fire({
    title: isBlock ? 'Block this category?' : 'Unblock this category?',
    text: isBlock
      ? 'All products under this category will become unavailable.'
      : 'Products under this category will become available again.',
    icon: isBlock ? 'warning' : 'question',
    showCancelButton: true,
    confirmButtonColor: isBlock ? '#d33' : '#16a34a',
    cancelButtonColor: '#6b7280',
    confirmButtonText: isBlock ? 'Yes, block it' : 'Yes, unblock it',
    cancelButtonText: 'Cancel'
  });

  if (!result.isConfirmed) return;

  blockBtn.disabled = true;

  try {
    const url = isBlock ? BLOCK_ENDPOINT(id) : UNBLOCK_ENDPOINT(id);
    const res = await axios.post(url);

    if (res?.data?.success) {
      Swal.fire({
        icon: 'success',
        title: 'Success',
        text: res.data.message || 'Category updated',
        timer: 1500,
        showConfirmButton: false
      });
      await load();
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Failed',
        text: res?.data?.message || 'Update failed'
      });
    }
  } catch (err) {
    console.error('block/unblock error', err);
    Swal.fire({
      icon: 'error',
      title: 'Server Error',
      text: err.response?.data?.message || 'Something went wrong'
    });
  } finally {
    blockBtn.disabled = false;
  }
  return;
}

  });

  paginationContainer?.addEventListener('click', (e) => {
    const btn = e.target.closest('.page-btn');
    if (!btn || btn.classList.contains('disabled') || btn.classList.contains('active')) return;

    const page = parseInt(btn.dataset.page, 10);
    if (!isNaN(page)) {
      load({ page });
    }
  });



 
  editForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = editIdInput?.value;
    if (!id) return toastr?.error('Missing id');

    const name = editNameInput?.value?.trim();
    const description = editDescInput?.value?.trim();
    if (!name || name.length < 2) return toastr?.error('Name must be at least 2 characters');

    const fd = new FormData();
    fd.append('name', name);
    fd.append('description', description || '');
    const file = editImageInput?.files?.[0];
    if (file) fd.append('image', file);

    try {
      const res = await axios.put(UPDATE_ENDPOINT(id), fd, { headers: { 'Content-Type': 'multipart/form-data' }});
      if (res?.data?.success) {
        toastr?.success(res.data.message || 'Category updated');
        editModalInstance?.hide();
        setTimeout(() => load(), 250);
      } else {
        toastr?.error(res?.data?.message || 'Update failed');
      }
    } catch (err) {
      console.error('update error', err);
      toastr?.error(err.response?.data?.message || 'Update failed');
    }
  });

  
  document.addEventListener('DOMContentLoaded', () => {
    load();
  });

 
  window.adminCategoryLoad = load;
})();
