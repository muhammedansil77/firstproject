// public/admin/js/product-management.js
// Requires: axios, toastr, cropperjs, Bootstrap JS
(function () {
  'use strict';

  // ---------------- Helpers ----------------
  function $id(id) { return document.getElementById(id); }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  const PLACEHOLDER = '/uploads/placeholder.png';

  function makeUploadUrl(p) {
    if (!p) return PLACEHOLDER;
    return '/' + String(p).replace(/^\/+/, '');
  }

  function buildProductRow(product) {
    const tr = document.createElement('tr');
    tr.dataset.id = product._id;

    const tdThumb = document.createElement('td');
    const thumb = document.createElement('img');

    const thumbSrc = (product.images && product.images[0]) ? makeUploadUrl(product.images[0]) :
      (product.variants && product.variants[0] && product.variants[0].images && product.variants[0].images[0] ? makeUploadUrl(product.variants[0].images[0]) : PLACEHOLDER);

    thumb.src = thumbSrc;
    thumb.style.maxWidth = '110px'; thumb.style.maxHeight = '80px';
    thumb.style.objectFit = 'cover'; thumb.style.borderRadius = '4px';
    if (thumbSrc === PLACEHOLDER) thumb.style.opacity = 0.6;
    tdThumb.appendChild(thumb);

    const tdName = document.createElement('td');
    const safeName = (product.name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const safeDesc = ((product.description || '').substring(0, 80)).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    tdName.innerHTML = `<strong>${safeName}</strong><div class="text-muted small">${safeDesc}</div>`;

    const tdCat = document.createElement('td');
    tdCat.textContent = product.category ? (product.category.name || product.category) : '-';

    const tdVars = document.createElement('td');
    tdVars.textContent = (product.variants && product.variants.length) ? product.variants.length : 0;

    const tdActions = document.createElement('td');
    tdActions.innerHTML = `<button class="btn btn-sm btn-primary me-1 editBtn" data-id="${product._id}">Edit</button>
                           <button class="btn btn-sm btn-danger deleteBtn" data-id="${product._id}">Delete</button>`;

    tr.appendChild(tdThumb); tr.appendChild(tdName); tr.appendChild(tdCat); tr.appendChild(tdVars); tr.appendChild(tdActions);
    return tr;
  }
  window.buildProductRow = buildProductRow;

  // ---------------- DOMContentLoaded ----------------
  document.addEventListener('DOMContentLoaded', function () {
    console.log('product-management.js loaded');

    // DOM refs
    const productTableBody = $id('productTableBody');
    const reloadBtn = $id('reloadBtn');

    const addModalEl = $id('addProductModal');
    const addForm = $id('addProductForm');
    const pName = $id('pName');
    const pDescription = $id('pDescription');
    const pCategory = $id('pCategory');
    const pImages = $id('pImages');
    const pImagesPreview = $id('pImagesPreview');
    const addProductSubmit = $id('addProductSubmit');

    const addCropArea = $id('addCropArea');
    const addCropControls = $id('addCropControls');
    const addCropImage = $id('addCropImage');
    const addCropApply = $id('addCropApply');
    const addCropNext = $id('addCropNext');
    const addCropCancel = $id('addCropCancel');

    const variantTpl = $id('variantTpl');
    const variantsContainer = $id('variantsContainer');
    const addVariantBtn = $id('addVariantBtn');

    const editModalEl = $id('editProductModal');
    const editForm = $id('editProductForm');
    const editProductId = $id('editProductId');
    const editName = $id('editName');
    const editDescription = $id('editDescription');
    const editCategory = $id('editCategory');
    const editImages = $id('editImages');
    const editImagesPreview = $id('editImagesPreview');
    const editExistingImages = $id('editExistingImages');
    const editVariantsContainer = $id('editVariantsContainer');
    const editAddVariantBtn = $id('editAddVariantBtn');
    const editProductSubmit = $id('editProductSubmit');

    const productSearchInput = $id('productSearchInput');
    const productCategoryFilter = $id('productCategoryFilter');
    const productLimitSelect = $id('productLimitSelect');
    const productPagination = $id('productPagination');
    const productsCountLabel = $id('productsCountLabel');

   let currentPage = 1, currentLimit = 10, currentQuery = '', currentCategory = 'all';
let cropper = null;

let croppingQueue = [];
let croppingInProgress = false;
window.croppingQueue = croppingQueue;
window.croppingInProgress = croppingInProgress;

const selectedProductFiles = [];
let croppedVariantFiles = {};
let variantCounter = 0;


    // Expose debug helper for console inspection
    window.__adminDebug = function () {
      try {
        const rows = Array.from(document.querySelectorAll('.variant-row')).map((r, i) => {
          const creationIdx = String(r.dataset.idx || '');
          return {
            seq: i,
            creationIdx,
            nativeFiles: r.querySelector('.variant-image')?.files?.length || 0,
            croppedCount: (croppedVariantFiles[creationIdx] || []).length
          };
        });
        return {
          croppingInProgress: !!croppingInProgress,
          croppingQueueLength: croppingQueue.length,
          croppedVariantFilesSummary: Object.keys(croppedVariantFiles).reduce((o, k) => { o[k] = (croppedVariantFiles[k] || []).length; return o; }, {}),
          variantRows: rows,
          variantCounter
        };
      } catch (e) {
        return { error: e && e.message };
      }
    };

    // blob -> File helper
    function blobToFile(blob, filename) {
      try { return new File([blob], filename, { type: blob.type, lastModified: Date.now() }); }
      catch (e) { blob.name = filename; return blob; }
    }

    // start cropper for a dataURL
    function startCropperOnImageDataURL(dataURL, options = {}) {
      return new Promise((resolve, reject) => {
        if (!addCropImage) return reject(new Error('Crop image element missing'));
        addCropImage.src = dataURL;
        setTimeout(() => {
          try {
            if (cropper) { cropper.destroy(); cropper = null; }
            cropper = new Cropper(addCropImage, Object.assign({
              viewMode: 1, aspectRatio: NaN, autoCropArea: 0.9, responsive: true, background: false
            }, options));
            resolve();
          } catch (err) {
            reject(err);
          }
        }, 60);
      });
    }

    function showCropUI() {
      if (addCropArea) addCropArea.style.display = 'block';
      if (addCropControls) addCropControls.style.display = 'flex';
    }
    function hideCropUI() {
      if (addCropArea) addCropArea.style.display = 'none';
      if (addCropControls) addCropControls.style.display = 'none';
      if (cropper) { try { cropper.destroy(); } catch (e) {} cropper = null; }
      if (addCropImage) addCropImage.src = '';
    }

    // cropping queue manager
  function enqueueCropForFile(file, meta) {
  croppingQueue.push({ file, meta });
  window.croppingQueue = croppingQueue;
  console.debug('enqueueCropForFile: queued item', meta, 'queueLen=', croppingQueue.length);

  // if worker not running, start it (don't await)
  if (!croppingInProgress) {
    processNextInCropQueue().catch(err => {
      console.error('processNextInCropQueue uncaught error', err);
      croppingInProgress = false;
      window.croppingInProgress = croppingInProgress;
      hideCropUI();
    });
  }
}


async function processNextInCropQueue() {
  try {
    window.croppingQueue = croppingQueue;
    if (!croppingQueue || croppingQueue.length === 0) {
      croppingInProgress = false;
      window.croppingInProgress = croppingInProgress;
      hideCropUI();
      return;
    }

    // mark running
    croppingInProgress = true;
    window.croppingInProgress = croppingInProgress;

    // pop next item
    const item = croppingQueue.shift();
    window.croppingQueue = croppingQueue;
    if (!item) {
      // nothing to do; check again
      setTimeout(() => processNextInCropQueue().catch(e => console.error(e)), 60);
      return;
    }

    const file = item.file;
    const meta = item.meta;
    console.debug('processNextInCropQueue: processing', meta, 'remaining=', croppingQueue.length);

    const reader = new FileReader();

    reader.onload = async function (e) {
      try {
        await startCropperOnImageDataURL(e.target.result);
        if (addCropArea) addCropArea.dataset.cropMeta = JSON.stringify(meta);
        showCropUI();
        if (typeof window.adjustAddProductModal === 'function') window.adjustAddProductModal();
        // Important: do NOT auto-apply. Wait for user click on Apply / Next / Cancel
        // The Apply and Next handlers must trigger next processing (see below).
      } catch (err) {
        console.error('crop start error', err);
        // continue to next item after a short delay
        setTimeout(() => processNextInCropQueue().catch(e => console.error(e)), 60);
      }
    };

    reader.onerror = function (ev) {
      console.error('FileReader error while reading file for crop', ev);
      // continue
      setTimeout(() => processNextInCropQueue().catch(e => console.error(e)), 60);
    };

    reader.readAsDataURL(file);
  } catch (err) {
    console.error('processNextInCropQueue general error', err);
    // reset state and try to continue
    croppingInProgress = false;
    window.croppingInProgress = croppingInProgress;
    hideCropUI();
  }
}


    // apply current crop (product or variant)
    async function applyCurrentCrop() {
      if (!cropper) return;
      try {
        const canvas = cropper.getCroppedCanvas({ width: 1200, height: 1200, imageSmoothingQuality: 'high' });
        const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
        if (!blob) throw new Error('no blob');
        const meta = (addCropArea && addCropArea.dataset && addCropArea.dataset.cropMeta) ? JSON.parse(addCropArea.dataset.cropMeta) : { type: 'product' };
        const filename = (meta.type === 'product' ? `product-${Date.now()}.jpg` : `variant-${meta.variantIdx}-${Date.now()}.jpg`);
        const file = blobToFile(blob, filename);

        if (meta.type === 'product') {
          selectedProductFiles.push(file);
          if (pImagesPreview) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.style.maxWidth = '120px'; img.style.maxHeight = '90px'; img.style.objectFit = 'cover';
            img.className = 'img-thumbnail me-1 mb-1';
            pImagesPreview.appendChild(img);
          }
        } else if (meta.type === 'variant') {
          const creationIdx = String(meta.variantIdx);
          croppedVariantFiles[creationIdx] = croppedVariantFiles[creationIdx] || [];
          croppedVariantFiles[creationIdx].push(file);
          // preview in variant row
          const row = variantsContainer && variantsContainer.querySelector(`.variant-row[data-idx="${creationIdx}"]`);
          if (row) {
            const preview = row.querySelector('.variant-image-preview');
            if (preview) {
              preview.innerHTML = '';
              (croppedVariantFiles[creationIdx] || []).forEach(f => {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(f);
                img.style.maxWidth = '80px'; img.style.maxHeight = '60px'; img.style.objectFit = 'cover';
                img.className = 'img-thumbnail me-1 mb-1';
                preview.appendChild(img);
              });
            }
          }
        }

        if (addCropArea) delete addCropArea.dataset.cropMeta;
        hideCropUI();
        setTimeout(() => processNextInCropQueue(), 60);
      } catch (err) {
        console.error('applyCurrentCrop error', err);
        toastr.error('Failed to crop image');
        hideCropUI();
        setTimeout(() => processNextInCropQueue(), 60);
      }
    }
// Apply
if (addCropApply) addCropApply.addEventListener('click', async function () {
  try {
    await applyCurrentCrop();
  } catch (err) {
    console.error('applyCurrentCrop error on Apply button', err);
  } finally {
    // continue processing queue
    setTimeout(() => processNextInCropQueue().catch(e => console.error(e)), 60);
  }
});

// Next (skip)
if (addCropNext) addCropNext.addEventListener('click', function () {
  if (addCropArea) delete addCropArea.dataset.cropMeta;
  hideCropUI();
  setTimeout(() => processNextInCropQueue().catch(e => console.error(e)), 60);
});

// Cancel (stop processing current, do NOT continue automatically)
if (addCropCancel) addCropCancel.addEventListener('click', function () {
  if (addCropArea) delete addCropArea.dataset.cropMeta;
  hideCropUI();
  // we DO NOT automatically continue; but if queue has items and user wants to continue,
  // you can call processNextInCropQueue() — here we keep it manual to respect Cancel.
});


  // ===== Add near the top, after croppedVariantFiles and cropping variables =====
// wait until crop queue is drained (or timeout)
function waitForCroppingComplete(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function poll() {
      // uses croppingInProgress and croppingQueue which exist in your script
      if (!window.croppingInProgress && (!window.croppingQueue || window.croppingQueue.length === 0)) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('Cropping timed out'));
      setTimeout(poll, 150);
    })();
  });
}

// clear the croppedVariantFiles object (do not reassign const)
function clearCroppedVariantFiles() {
  Object.keys(croppedVariantFiles).forEach(k => delete croppedVariantFiles[k]);
}


    // Variant row creation
    function addVariantRow(container, variantData) {
      variantCounter += 1;
      const creationIdx = variantCounter; // creation index (stable while row exists)
      const node = variantTpl.content.cloneNode(true);
      const row = node.querySelector('.variant-row');
      row.dataset.idx = creationIdx;

      const imgInput = row.querySelector('.variant-image');
      const preview = row.querySelector('.variant-image-preview');
      const colorEl = row.querySelector('.variant-color');
      const stockEl = row.querySelector('.variant-stock');
      const priceEl = row.querySelector('.variant-price');
      const removeBtn = row.querySelector('.removeVariantBtn');

      // ensure name; we'll remap indices on submit
      imgInput.name = `variants[${creationIdx}][image][]`;
      imgInput.multiple = true;

      if (variantData) {
        if (variantData.color) colorEl.value = variantData.color;
        if (typeof variantData.stock !== 'undefined') stockEl.value = variantData.stock;
        if (typeof variantData.price !== 'undefined') priceEl.value = variantData.price;
        if (variantData.images && variantData.images.length) {
          preview.innerHTML = '';
          variantData.images.forEach(imgPath => {
            const img = document.createElement('img');
            img.src = makeUploadUrl(imgPath);
            img.style.maxWidth = '80px'; img.style.maxHeight = '60px'; img.style.objectFit = 'cover';
            img.className = 'img-thumbnail me-1 mb-1';
            preview.appendChild(img);
          });
        }
      }

   imgInput.addEventListener('change', function (ev) {
  const files = Array.from(ev.target.files || []);
  if (!files.length) {
    ev.target.value = ''; // clear to allow re-select later
    return;
  }
  (async () => {
    for (const f of files) {
      await enqueueCropForFile(f, { type: 'variant', variantIdx: creationIdx });
    }
  })();
  // keep native input files as fallback until submit.
  // Clear value so future identical selection fires change
  ev.target.value = '';
});




      removeBtn.addEventListener('click', function () {
        if (croppedVariantFiles[creationIdx]) delete croppedVariantFiles[creationIdx];
        row.remove();
      });

      container.appendChild(node);
      return row;
    }

    // ensure at least one variant row on add modal
    if (variantsContainer && variantsContainer.children.length === 0) {
      addVariantRow(variantsContainer, null);
    }
    if (addVariantBtn) addVariantBtn.addEventListener('click', function () { addVariantRow(variantsContainer, null); });

    // product images input -> crop queue (optional main images)
    if (pImages) {
      pImages.addEventListener('change', function (ev) {
        const files = Array.from(ev.target.files || []);
        if (!files.length) return;
        (async () => {
          for (const f of files) {
            await enqueueCropForFile(f, { type: 'product' });
          }
        })();
        pImages.value = '';
      });
    }

    // Pagination/search/filter wiring
    if (productSearchInput) {
      let timer;
      productSearchInput.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(() => { currentQuery = productSearchInput.value.trim(); currentPage = 1; loadProductsToTable(); }, 350);
      });
    }
    if (productCategoryFilter) productCategoryFilter.addEventListener('change', function () { currentCategory = productCategoryFilter.value; currentPage = 1; loadProductsToTable(); });
    if (productLimitSelect) productLimitSelect.addEventListener('change', function () { currentLimit = parseInt(productLimitSelect.value, 10) || 10; currentPage = 1; loadProductsToTable(); });

    function renderPagination(pagination) {
      if (!productPagination) return;
      productPagination.innerHTML = '';
      const { page, pages } = pagination;
      const prevLi = document.createElement('li'); prevLi.className = 'page-item' + (page <= 1 ? ' disabled' : '');
      prevLi.innerHTML = `<button class="page-link" ${page <= 1 ? 'tabindex="-1"' : ''}>Prev</button>`;
      prevLi.addEventListener('click', () => { if (page > 1) { currentPage = page - 1; loadProductsToTable(); } });
      productPagination.appendChild(prevLi);

      const maxWindow = 7;
      let start = Math.max(1, page - Math.floor(maxWindow / 2));
      let end = Math.min(pages, start + maxWindow - 1);
      start = Math.max(1, end - maxWindow + 1);
      for (let p = start; p <= end; p++) {
        const li = document.createElement('li'); li.className = 'page-item' + (p === page ? ' active' : '');
        li.innerHTML = `<button class="page-link">${p}</button>`;
        li.addEventListener('click', () => { if (p !== page) { currentPage = p; loadProductsToTable(); } });
        productPagination.appendChild(li);
      }

      const nextLi = document.createElement('li'); nextLi.className = 'page-item' + (page >= pages ? ' disabled' : '');
      nextLi.innerHTML = `<button class="page-link" ${page >= pages ? 'tabindex="-1"' : ''}>Next</button>`;
      nextLi.addEventListener('click', () => { if (page < pages) { currentPage = page + 1; loadProductsToTable(); } });
      productPagination.appendChild(nextLi);
    }

    async function loadProductsToTable() {
      try {
        if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="5" class="text-center">Loading…</td></tr>`;
        const params = new URLSearchParams();
        params.set('page', String(currentPage));
        params.set('limit', String(currentLimit));
        if (currentQuery) params.set('q', currentQuery);
        if (currentCategory && currentCategory !== 'all') params.set('category', currentCategory);
        const url = '/admin/product/data?' + params.toString();
        const resp = await axios.get(url);
        const data = resp && resp.data;
        if (!data || !data.success) {
          if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Failed to load products</td></tr>`;
          return;
        }
        const products = data.products || [];
        const pagination = data.pagination || { total: 0, page: 1, pages: 1, limit: currentLimit };
        if (productsCountLabel) productsCountLabel.textContent = `${pagination.total} product${pagination.total === 1 ? '' : 's'}`;
        if (productTableBody) {
          productTableBody.innerHTML = '';
          if (!products.length) {
            const tr = document.createElement('tr');
            const td = document.createElement('td'); td.colSpan = 5; td.className = 'text-center text-muted'; td.textContent = 'No products found';
            tr.appendChild(td); productTableBody.appendChild(tr);
          } else {
            products.forEach(p => productTableBody.appendChild(buildProductRow(p)));
          }
        }
        renderPagination(pagination);
      } catch (err) {
        console.error('loadProductsToTable error', err);
        if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error loading products</td></tr>`;
      }
    }
    loadProductsToTable();
    if (reloadBtn) reloadBtn.addEventListener('click', loadProductsToTable);

    // === FIXED ADD PRODUCT SUBMIT HANDLER ===
    // === Replace the addForm submit handler with this ===
// === Diagnostic + robust addForm submit handler ===
// === Replace current addForm submit handler with this fixed version ===
// REPLACE your current addForm submit handler with this diagnostic version
// This will show us exactly what's being sent to the server

// === Robust Add Product submit handler (drop-in replacement) ===
if (addForm) {
  addForm.addEventListener('submit', async function (ev) {
    ev.preventDefault();

    // Disable submit button
    addProductSubmit.disabled = true;
    addProductSubmit.textContent = 'Creating...';

    try {
      // 1. Wait for cropping to finish
      console.log('Waiting for cropping to complete...');
      await waitForCroppingComplete(10000);
      
      // 2. Basic validation
      const name = (pName && pName.value || '').trim();
      if (!name) {
        toastr.error('Product name is required');
        throw new Error('Name required');
      }

      const variantRows = Array.from(variantsContainer.querySelectorAll('.variant-row'));
      if (!variantRows.length) {
        toastr.error('Please add at least one variant');
        throw new Error('No variants');
      }

      // 3. Build FormData
      const fd = new FormData();
      fd.append('name', name);
      fd.append('description', pDescription?.value || '');
      if (pCategory?.value) fd.append('category', pCategory.value);

      // Add product images
      selectedProductFiles.forEach(f => {
        fd.append('productImages[]', f);
      });

      // Add variants
      variantRows.forEach((row, seq) => {
        const creationIdx = String(row.dataset.idx || '');
        const color = (row.querySelector('.variant-color')?.value || '').trim();
        const stock = row.querySelector('.variant-stock')?.value || '0';
        const price = row.querySelector('.variant-price')?.value || '0';

        if (!color || !stock || !price) {
          toastr.error(`Variant ${seq + 1}: color, stock and price are required`);
          throw new Error('Variant validation failed');
        }

        fd.append(`variants[${seq}][color]`, color);
        fd.append(`variants[${seq}][stock]`, stock);
        fd.append(`variants[${seq}][price]`, price);

        // Add cropped images
        (croppedVariantFiles[creationIdx] || []).forEach(f => {
          fd.append(`variants[${seq}][image][]`, f);
        });

        // Add native files (if any)
        const nativeInput = row.querySelector('.variant-image');
        if (nativeInput && nativeInput.files) {
          Array.from(nativeInput.files).forEach(f => {
            fd.append(`variants[${seq}][image][]`, f);
          });
        }

        // Validate at least 3 images
        const totalImages = (croppedVariantFiles[creationIdx] || []).length + 
                           (nativeInput?.files?.length || 0);
        
        if (totalImages < 3) {
          toastr.error(`Variant ${seq + 1} needs at least 3 images (has ${totalImages})`);
          throw new Error('Insufficient images');
        }
      });

      // 4. Send request
      console.log('Sending product creation request...');
      const res = await axios.post('/admin/product', fd, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (res?.data?.success) {
        toastr.success('Product created successfully');
        
        // Reset form
        addForm.reset();
        selectedProductFiles.length = 0;
        clearCroppedVariantFiles();
        if (pImagesPreview) pImagesPreview.innerHTML = '';
        variantsContainer.innerHTML = '';
        variantCounter = 0;
        addVariantRow(variantsContainer, null);
        
        // Reload table and close modal
        await loadProductsToTable();
        bootstrap.Modal.getInstance(addModalEl)?.hide();
      } else {
        toastr.error(res?.data?.message || 'Failed to create product');
      }

    } catch (err) {
      console.error('Error creating product:', err);
      if (!err.message.includes('Name required') && 
          !err.message.includes('No variants') &&
          !err.message.includes('Variant validation') &&
          !err.message.includes('Insufficient images')) {
        toastr.error(err.response?.data?.message || 'Server error occurred');
      }
    } finally {
      addProductSubmit.disabled = false;
      addProductSubmit.textContent = 'Add Product';
    }
  });
}

    // Edit modal helpers (unchanged except naming consistency)
    function addEditVariantRow(container, variantData) {
      variantCounter += 1;
      const idx = variantCounter;
      const node = variantTpl.content.cloneNode(true);
      const row = node.querySelector('.variant-row');
      row.dataset.idx = idx;
      const imgInput = row.querySelector('.variant-image');
      const preview = row.querySelector('.variant-image-preview');
      const colorEl = row.querySelector('.variant-color');
      const stockEl = row.querySelector('.variant-stock');
      const priceEl = row.querySelector('.variant-price');
      const removeBtn = row.querySelector('.removeVariantBtn');

      imgInput.name = `variants[${idx}][image][]`;
      imgInput.multiple = true;

      if (variantData) {
        if (variantData.color) colorEl.value = variantData.color;
        if (typeof variantData.stock !== 'undefined') stockEl.value = variantData.stock;
        if (typeof variantData.price !== 'undefined') priceEl.value = variantData.price;
        if (variantData.images && variantData.images.length) {
          preview.innerHTML = '';
          variantData.images.forEach(pth => {
            const img = document.createElement('img');
            img.src = makeUploadUrl(pth);
            img.style.maxWidth = '80px'; img.style.maxHeight = '60px'; img.style.objectFit = 'cover';
            img.className = 'img-thumbnail me-1 mb-1';
            preview.appendChild(img);
          });
        }
      }

      imgInput.addEventListener('change', function (ev) {
        const files = Array.from(ev.target.files || []);
        if (!files.length) return;
        preview.innerHTML = '';
        files.forEach(f => {
          const img = document.createElement('img');
          img.src = URL.createObjectURL(f);
          img.style.maxWidth = '80px'; img.style.maxHeight = '60px'; img.style.objectFit = 'cover';
          img.className = 'img-thumbnail me-1 mb-1';
          preview.appendChild(img);
        });
      });

      removeBtn.addEventListener('click', function () { row.remove(); });

      container.appendChild(node);
      return row;
    }

    async function openEditModal(id) {
      try {
        const listResp = await axios.get('/admin/product/data?page=1&limit=1000');
        const products = listResp && listResp.data && listResp.data.products ? listResp.data.products : [];
        const product = products.find(p => String(p._id) === String(id));
        if (!product) { toastr.error('Product not found'); return; }

        if (editProductId) editProductId.value = product._id;
        if (editName) editName.value = product.name || '';
        if (editDescription) editDescription.value = product.description || '';
        if (editCategory) editCategory.value = product.category ? (product.category._id || product.category) : '';

        if (editExistingImages) {
          editExistingImages.innerHTML = '';
          if (product.images && product.images.length) {
            product.images.forEach(pth => {
              const img = document.createElement('img');
              img.src = makeUploadUrl(pth);
              img.style.maxWidth = '120px'; img.style.maxHeight = '90px'; img.style.objectFit = 'cover';
              img.className = 'img-thumbnail me-1 mb-1';
              editExistingImages.appendChild(img);
            });
          } else editExistingImages.innerHTML = '<div class="text-muted">No images</div>';
        }

        if (editVariantsContainer) {
          editVariantsContainer.innerHTML = '';
          (product.variants || []).forEach(v => addEditVariantRow(editVariantsContainer, v));
          if (editVariantsContainer.children.length === 0) addEditVariantRow(editVariantsContainer, null);
        }

        if (editImagesPreview) editImagesPreview.innerHTML = '';
        if (editImages) editImages.value = '';

        const m = bootstrap.Modal.getOrCreateInstance(editModalEl);
        m.show();
      } catch (err) {
        console.error('openEditModal error', err);
        toastr.error('Failed to load product for edit');
      }
    }

    // table delegate edit/delete
    if (productTableBody) {
      productTableBody.addEventListener('click', async function (ev) {
        const editBtn = ev.target.closest('.editBtn');
        const deleteBtn = ev.target.closest('.deleteBtn');
        if (editBtn) {
          const id = editBtn.dataset.id; await openEditModal(id);
        } else if (deleteBtn) {
          const id = deleteBtn.dataset.id;
          if (!confirm('Move product to trash?')) return;
          try {
            const resp = await axios.delete(`/admin/product/${id}`);
            if (resp && resp.data && resp.data.success) { toastr.success('Deleted'); loadProductsToTable(); }
            else toastr.error(resp.data && resp.data.message ? resp.data.message : 'Delete failed');
          } catch (err) { console.error(err); toastr.error('Server error'); }
        }
      });
    }

    if (editAddVariantBtn) editAddVariantBtn.addEventListener('click', function () { addEditVariantRow(editVariantsContainer, null); });

    if (editImages) {
      editImages.addEventListener('change', function (ev) {
        const files = Array.from(ev.target.files || []);
        if (!editImagesPreview) return;
        editImagesPreview.innerHTML = '';
        files.forEach(f => {
          const img = document.createElement('img');
          img.src = URL.createObjectURL(f);
          img.style.maxWidth = '120px'; img.style.maxHeight = '90px'; img.style.objectFit = 'cover';
          img.className = 'img-thumbnail me-1 mb-1';
          editImagesPreview.appendChild(img);
        });
      });
    }

    // Edit submit (PATCH)
    if (editForm) {
      editForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        const id = editProductId && editProductId.value;
        if (!id) return toastr.error('Missing product id');
        const name = editName && editName.value && editName.value.trim();
        if (!name) return toastr.error('Name required');

        const fd = new FormData();
        fd.append('name', name);
        fd.append('description', editDescription && editDescription.value || '');
        if (editCategory && editCategory.value) fd.append('category', editCategory.value);

        // replacement product images (if provided) must be >=3
        const newFiles = Array.from(editImages.files || []);
        if (newFiles.length > 0 && newFiles.length < 3) return toastr.error('To replace main images choose at least 3 files.');
        newFiles.forEach(f => fd.append('productImages[]', f));

        // collect variant rows: append fields and any uploaded files
        const rows = editVariantsContainer.querySelectorAll('.variant-row');
        for (const row of rows) {
          const idx = row.dataset.idx;
          const colorEl = row.querySelector('.variant-color');
          const stockEl = row.querySelector('.variant-stock');
          const priceEl = row.querySelector('.variant-price');
          const fileEl = row.querySelector('.variant-image');

          if (colorEl) fd.append(`variants[${idx}][color]`, colorEl.value || '');
          if (stockEl) fd.append(`variants[${idx}][stock]`, stockEl.value || 0);
          if (priceEl) fd.append(`variants[${idx}][price]`, priceEl.value || 0);

          if (fileEl && fileEl.files && fileEl.files.length) {
            Array.from(fileEl.files).forEach(f => fd.append(`variants[${idx}][image][]`, f));
          }
        }

        try {
          editProductSubmit.disabled = true; editProductSubmit.textContent = 'Saving...';
          const resp = await axios.patch(`/admin/product/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
          if (resp && resp.data && resp.data.success) {
            toastr.success('Updated');
            const m = bootstrap.Modal.getInstance(editModalEl) || new bootstrap.Modal(editModalEl);
            m.hide();
            loadProductsToTable();
          } else {
            toastr.error(resp.data && resp.data.message ? resp.data.message : 'Update failed');
          }
        } catch (err) {
          console.error('edit submit error', err);
          toastr.error('Server error during update');
        } finally {
          editProductSubmit.disabled = false; editProductSubmit.textContent = 'Save Changes';
        }
      });
    }

    // ---------- Modal sizing & cleanup for Add Product modal ----------
    (function () {
      const modalBody = (addModalEl && addModalEl.querySelector('.modal-body')) || null;

      if (!addModalEl || !modalBody) {
        window.adjustAddProductModal = function () { /* noop */ };
        return;
      }

      function adjustAddModalSize() {
        try {
          const viewportH = window.innerHeight || document.documentElement.clientHeight;
          const header = addModalEl.querySelector('.modal-header');
          const footer = addModalEl.querySelector('.modal-footer');
          const headerH = header ? header.getBoundingClientRect().height : 56;
          const footerH = footer ? footer.getBoundingClientRect().height : 56;
          const safeGap = 96;
          const maxBody = Math.max(200, Math.floor(viewportH - headerH - footerH - safeGap));
          modalBody.style.maxHeight = maxBody + 'px';
          modalBody.style.overflowY = 'auto';
          modalBody.style.webkitOverflowScrolling = 'touch';

          if (addCropImage) {
            const imgMax = Math.floor(maxBody * 0.60);
            addCropImage.style.maxHeight = imgMax + 'px';
            addCropImage.style.width = 'auto';
            addCropImage.style.display = addCropImage.src ? 'block' : 'none';
          }
          if (addCropArea) addCropArea.style.overflow = 'auto';

          try { if (cropper && typeof cropper.resize === 'function') cropper.resize(); } catch (e) { /* ignore */ }
        } catch (e) {
          console.warn('adjustAddModalSize error', e && e.message);
        }
      }

      addModalEl.addEventListener('shown.bs.modal', function () {
        adjustAddModalSize();
        requestAnimationFrame(() => requestAnimationFrame(adjustAddModalSize));
        const firstInput = addModalEl.querySelector('#pName');
        if (firstInput) firstInput.focus();
      });

      addModalEl.addEventListener('hidden.bs.modal', function () {
        try {
          if (pImagesPreview) pImagesPreview.innerHTML = '';
          modalBody.style.maxHeight = '';
          modalBody.style.overflowY = '';
          if (addCropImage) { addCropImage.style.maxHeight = ''; addCropImage.style.display = 'none'; }
          if (addCropArea) addCropArea.style.display = 'none';
          try { if (cropper) { cropper.destroy(); cropper = null; } } catch (e) { /* ignore */ }
          const ev = new CustomEvent('adminAddProductModalHidden');
          addModalEl.dispatchEvent(ev);
        } catch (e) {
          console.warn('Add modal hidden cleanup error', e && e.message);
        }
      });

      window.addEventListener('resize', function () {
        if (addModalEl.classList.contains('show')) adjustAddModalSize();
      });

      if (addCropArea && typeof MutationObserver !== 'undefined') {
        const mo = new MutationObserver(function () {
          if (addModalEl.classList.contains('show')) adjustAddModalSize();
        });
        mo.observe(addCropArea, { childList: true, subtree: true, attributes: true });
      }

      window.adjustAddProductModal = adjustAddModalSize;
    })();

    console.log('product-management initialized');
  }); // DOMContentLoaded
})(); // IIFE
