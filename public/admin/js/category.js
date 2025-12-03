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

  // Bootstrap modal instances
  let editModalInstance = null;
  if (editModalEl && window.bootstrap && typeof bootstrap.Modal === 'function') {
    editModalInstance = new bootstrap.Modal(editModalEl);
  }

  // fallback image from EJS
  const FALLBACK_IMAGE = (window.CATEGORY_FALLBACK_IMAGE) ? window.CATEGORY_FALLBACK_IMAGE : '/uploads/placeholder.png';

  // render a single category row
  function renderRow(cat, index) {
    const id = cat._id || cat.id || '';
    const imgSrc = cat.imagePath ? cat.imagePath : FALLBACK_IMAGE;
    const name = esc(cat.name);
    const desc = esc(cat.description || '');
    const items = Number(cat.itemCount || 0);
    const active = !!cat.active;

    // action button label/class depends on active
    const btnLabel = active ? 'Block' : 'Unblock';
    const btnClass = active ? 'btn-danger' : 'btn-success';
    const statusText = active ? 'Active' : 'Blocked';

    // Build row HTML
    return `
      <tr data-id="${id}">
        <td class="ps-4">${index + 1}</td>
        <td>
          <img src="${imgSrc}" alt="${name}" style="width:56px;height:40px;object-fit:cover;border-radius:6px;margin-right:8px">
          <strong>${name}</strong>
        </td>
        <td>${desc}</td>
        <td>${items}</td>
        <td class="text-${active ? 'success' : 'warning'} category-active-cell">${statusText}</td>
        <td>
          <button class="btn btn-sm btn-outline-light me-2 edit-btn" data-id="${id}">Edit</button>
          <button class="btn btn-sm ${btnClass} category-block-toggle" data-id="${id}" data-action="${active ? 'block' : 'unblock'}">${btnLabel}</button>
        </td>
      </tr>
    `;
  }

  // load list and render
  async function load() {
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-secondary">Loading categories...</td></tr>';
    try {
      const res = await axios.get(LIST_ENDPOINT);
      const data = res && res.data ? res.data : res;
      const categories = Array.isArray(data.categories) ? data.categories : (data.data || []);
      if (!categories || !categories.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-secondary">No categories yet.</td></tr>';
        return;
      }

      // render rows
      tbody.innerHTML = '';
      categories.forEach((c, i) => {
        const wrapper = document.createElement('template');
        wrapper.innerHTML = renderRow(c, i).trim();
        tbody.appendChild(wrapper.content.firstChild);
      });
    } catch (err) {
      console.error('Failed to load categories', err);
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-danger">Failed to load categories.</td></tr>';
      toastr?.error(err.response?.data?.message || 'Failed to load categories');
    }
  }

  // image preview handlers
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

  // Add category submit
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
        // close modal if using bootstrap (Add button triggers modal automatically)
        const addModalEl = document.getElementById('addCategoryModal');
        if (addModalEl) {
          const m = bootstrap.Modal.getInstance(addModalEl) || new bootstrap.Modal(addModalEl);
          m.hide();
        }
      } else {
        toastr?.error(res?.data?.message || 'Create failed');
      }
    } catch (err) {
      console.error('create category error', err);
      toastr?.error(err.response?.data?.message || 'Create failed');
    }
  });

  // Delegated table click: edit / block-unblock
  tbody?.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.edit-btn');
    if (editBtn) {
      const id = editBtn.dataset.id;
      if (!id) return toastr?.error('Missing id');

      // fetch single category from server (or find it in the currently rendered rows by making an API call)
      try {
        // reuse list endpoint: get full list and find id (cheap for admin lists)
        const res = await axios.get(LIST_ENDPOINT);
        const list = res?.data?.categories || res?.data?.data || [];
        const cat = list.find(c => String(c._id) === String(id));
        if (!cat) {
          toastr?.error('Category not found');
          return;
        }

        // populate edit modal
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
      const action = blockBtn.dataset.action; // "block" or "unblock"
      if (!id || !action) return;

      blockBtn.disabled = true;
      try {
        const url = (action === 'block') ? BLOCK_ENDPOINT(id) : UNBLOCK_ENDPOINT(id);
        const res = await axios.post(url);
        if (res?.data?.success) {
          toastr?.success(res.data.message || 'Updated');
          // re-load the list (safe)
          await load();
        } else {
          toastr?.error(res?.data?.message || 'Update failed');
        }
      } catch (err) {
        console.error('block/unblock error', err);
        toastr?.error(err.response?.data?.message || 'Server error');
      } finally {
        blockBtn.disabled = false;
      }
      return;
    }
  });

  // Edit form submit (PUT multipart) — we use PUT as in your controller
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

  // initial load
  document.addEventListener('DOMContentLoaded', () => {
    load();
  });

  // expose load for other scripts if needed
  window.adminCategoryLoad = load;
})();
