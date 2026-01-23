
(function () {
  'use strict';


  function $id(id) { return document.getElementById(id); }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

 const PLACEHOLDER = '/uploads/placeholder.png';

function makeUploadUrl(p) {
  if (!p) return PLACEHOLDER;


  if (typeof p === 'string' && p.startsWith('http')) {
    return p;
  }


  return '/' + String(p).replace(/^\/+/, '');
}






function extractImagePath(imageUrl) {
  if (!imageUrl) return null;
  

  if (imageUrl.startsWith('uploads/')) {
    return imageUrl;
  }
  
 
  const uploadsIndex = imageUrl.lastIndexOf('uploads/');
  if (uploadsIndex !== -1) {
    return imageUrl.substring(uploadsIndex);
  }
  

  const filename = imageUrl.split('/').pop();
  return 'uploads/' + filename;
}

function createImagePreviewElement(file, variantIdx, previewIndex, isNewFile = true) {
  const container = document.createElement('div');
  container.className = 'image-preview-container position-relative';
  container.style.display = 'inline-block';
  container.style.margin = '0 8px 8px 0';
  container.dataset.variantIdx = variantIdx;
  container.dataset.fileIndex = previewIndex;
  container.dataset.isNew = isNewFile.toString();
  container.dataset.originalIndex = previewIndex.toString();
  
  const img = document.createElement('img');
  

  let originalPath = null;
  
  if (file instanceof File) {
    img.src = URL.createObjectURL(file);
    img.dataset.blobUrl = img.src;
  } else if (file && file.url) {
    img.src = file.url;
    originalPath = file.url;
  } else if (file && typeof file === 'string') {
    img.src = makeUploadUrl(file);
    originalPath = file;
  } else {
    return container;
  }
  
  
if (originalPath && !isNewFile) {
 
  container.dataset.originalPath = originalPath;
}

  
  img.style.width = '80px';
  img.style.height = '60px';
  img.style.objectFit = 'cover';
  img.style.borderRadius = '6px';
  img.className = 'img-thumbnail';
  img.dataset.previewIndex = previewIndex;
  img.dataset.variantIndex = variantIdx;

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn-remove-preview';
  removeBtn.innerHTML = '✕';
  removeBtn.style.position = 'absolute';
  removeBtn.style.top = '-8px';
  removeBtn.style.right = '-8px';
  removeBtn.style.width = '24px';
  removeBtn.style.height = '24px';
  removeBtn.style.borderRadius = '50%';
  removeBtn.style.background = '#dc3545';
  removeBtn.style.color = 'white';
  removeBtn.style.border = 'none';
  removeBtn.style.fontSize = '12px';
  removeBtn.style.cursor = 'pointer';
  removeBtn.style.display = 'flex';
  removeBtn.style.alignItems = 'center';
  removeBtn.style.justifyContent = 'center';
  removeBtn.style.padding = '0';
  removeBtn.title = 'Remove this image';
  removeBtn.dataset.variantIdx = variantIdx;
  removeBtn.dataset.fileIndex = previewIndex;
  
  removeBtn.addEventListener('click', async function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const parentContainer = this.parentElement;
    const variantIdx = container.dataset.variantIdx;
    const isNewFile = container.dataset.isNew === 'true';
    const productId = editProductId?.value;
    

    if (img.src.startsWith('blob:')) {
      URL.revokeObjectURL(img.src);
    }
    
    if (isNewFile) {
     
      const fileIndex = parseInt(container.dataset.originalIndex);
      if (croppedEditVariantFiles && croppedEditVariantFiles[variantIdx]) {
        croppedEditVariantFiles[variantIdx].splice(fileIndex, 1);
      }
    } else {
    
      const imagePath = container.dataset.originalPath;
      
      if (imagePath && productId) {
        try {
          const row = container.closest('.variant-row');
          const variantId = row?.dataset?.variantId;
          
          const payload = { imagePath };
          if (variantId && variantId !== 'undefined' && variantId !== '') {
            payload.variantId = variantId;
          }
          
          const deleteResp = await axios.delete(`/admin/product/${productId}/image`, { data: payload });
          
          if (deleteResp.data.success) {
            toastr.success('Image deleted');
          } else {
            toastr.error('Failed to delete image');
            return;
          }
        } catch (deleteError) {
          console.error('Error deleting image:', deleteError);
          toastr.error('Error deleting image');
          return;
        }
      }
    }
    
  
    parentContainer.remove();
    
 
    updatePreviewIndices(variantIdx);
  });
  
  container.appendChild(img);
  container.appendChild(removeBtn);
  
  return container;
}


function updatePreviewIndices(variantIdx) {
  const row = document.querySelector(`.variant-row[data-idx="${variantIdx}"]`);
  if (!row) return;
  
  const previewContainer = row.querySelector('.variant-image-preview');
  if (!previewContainer) return;
  
  const previews = previewContainer.querySelectorAll('.image-preview-container');
  
  previews.forEach((preview, newIndex) => {
    preview.dataset.fileIndex = newIndex;
    const btn = preview.querySelector('.btn-remove-preview');
    if (btn) btn.dataset.fileIndex = newIndex;
    const img = preview.querySelector('img');
    if (img) img.dataset.previewIndex = newIndex;
  });
  
  updateVariantImageCount(variantIdx);
}

 function updateVariantImageCount(variantIdx) {
  const row = document.querySelector(`.variant-row[data-idx="${variantIdx}"]`);
  if (!row) return;
  
  const previewContainer = row.querySelector('.variant-image-preview');
  if (!previewContainer) return;
  
  const imageCount = previewContainer.querySelectorAll('.image-preview-container').length;
  
  let countMessage = row.querySelector('.image-count-message');
  if (!countMessage) {
    countMessage = document.createElement('div');
    countMessage.className = 'image-count-message small mt-2';
    previewContainer.parentNode.insertBefore(countMessage, previewContainer.nextSibling);
  }
  

  countMessage.className = `image-count-message small mt-2 ${imageCount >= 3 ? 'text-success' : 'text-danger'}`;
  
  console.log(`Variant ${variantIdx}: ${imageCount} images`);
}
  function buildProductRow(product) {
    const tr = document.createElement('tr');
    tr.dataset.id = product._id;
    
    if (product.status === 'blocked') {
      tr.classList.add('table-danger');
      tr.style.opacity = '0.7';
    }

 
    const tdThumb = document.createElement('td');
    tdThumb.className = 'px-4';
    const thumb = document.createElement('img');

    const thumbSrc = (product.images && product.images[0]) ? makeUploadUrl(product.images[0]) :
      (product.variants && product.variants[0] && product.variants[0].images && product.variants[0].images[0] ? 
        makeUploadUrl(product.variants[0].images[0]) : PLACEHOLDER);

    thumb.src = thumbSrc;
    thumb.style.maxWidth = '110px'; 
    thumb.style.maxHeight = '80px';
    thumb.style.objectFit = 'cover'; 
    thumb.style.borderRadius = '4px';
    if (thumbSrc === PLACEHOLDER) thumb.style.opacity = 0.6;
    tdThumb.appendChild(thumb);

   
    const tdName = document.createElement('td');
    tdName.className = 'px-4';
    const safeName = (product.name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const safeDesc = ((product.description || '').substring(0, 80)).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    tdName.innerHTML = `
      <div class="fw-semibold mb-1" style="color: #1a1a1a; font-size: 15px;">
        ${safeName}
        ${product.status === 'blocked' ? '<span class="badge bg-danger ms-2">Blocked</span>' : ''}
      </div>
      <div class="text-muted small" style="line-height: 1.4;">${safeDesc}</div>
    `;

   
    const tdCat = document.createElement('td');
    tdCat.className = 'px-4';
    const categoryText = product.category ? (product.category.name || product.category) : 'Uncategorized';
    tdCat.innerHTML = `
      <span class="badge rounded-pill px-3 py-2" 
            style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); 
                   color: #1976d2; 
                   font-weight: 500;">
        ${categoryText}
      </span>
    `;

 
    const tdStatus = document.createElement('td');
    tdStatus.className = 'px-4 text-center';
    
    const statusBadge = document.createElement('span');
    statusBadge.className = `badge rounded-pill px-3 py-2 ${product.status === 'active' ? 'bg-success' : 'bg-danger'}`;
    statusBadge.style.cursor = 'pointer';
    statusBadge.style.fontWeight = '500';
    statusBadge.dataset.id = product._id;
    statusBadge.dataset.status = product.status || 'active';
    statusBadge.title = `Click to ${product.status === 'active' ? 'block' : 'unblock'}`;
    statusBadge.textContent = product.status === 'active' ? 'Active' : 'Blocked';
    
    statusBadge.addEventListener('mouseenter', function() {
      this.style.transform = 'scale(1.05)';
      this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    });
    
    statusBadge.addEventListener('mouseleave', function() {
      this.style.transform = 'scale(1)';
      this.style.boxShadow = 'none';
    });
    
    tdStatus.appendChild(statusBadge);

    const tdVars = document.createElement('td');
    tdVars.className = 'px-4 text-center';
    const variantCount = (product.variants && product.variants.length) || 0;
    tdVars.innerHTML = `
      <span class="badge bg-secondary rounded-pill px-3 py-2" 
            style="font-size: 13px; font-weight: 500;">
        ${variantCount}
      </span>
    `;

    const tdActions = document.createElement('td');
    tdActions.className = 'px-4 text-center';
    tdActions.innerHTML = `
      <div class="d-flex gap-2 justify-content-center">
        <button class="btn btn-sm btn-outline-primary editBtn px-3" 
                data-id="${product._id}" 
                style="border-radius: 8px;"
                ${product.status === 'blocked' ? 'disabled' : ''}>
          <i class="bi bi-pencil me-1"></i>Edit
        </button>
        <button class="btn btn-sm btn-${product.status === 'active' ? 'outline-warning' : 'outline-success'} toggleStatusBtn px-3" 
                data-id="${product._id}" 
                data-status="${product.status || 'active'}"
                style="border-radius: 8px;">
          <i class="bi ${product.status === 'active' ? 'bi-lock' : 'bi-unlock'} me-1"></i>
          ${product.status === 'active' ? 'Block' : 'Unblock'}
        </button>
       
      </div>
    `;

    tr.appendChild(tdThumb);
    tr.appendChild(tdName);
    tr.appendChild(tdCat);
    tr.appendChild(tdVars);
    tr.appendChild(tdStatus);
    tr.appendChild(tdActions);

    return tr;
  }
  window.buildProductRow = buildProductRow;


  document.addEventListener('DOMContentLoaded', function () {
    console.log('product-management.js loaded');

   
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
   
const editCropArea = document.getElementById('editCropArea');
const editCropImage = document.getElementById('editCropImage');
const editCropControls = document.getElementById('editCropControls');
const editCropApply = document.getElementById('editCropApply');
const editCropNext = document.getElementById('editCropNext');
const editCropCancel = document.getElementById('editCropCancel');

let editCropper = null;
let editCroppingQueue = [];
let editCroppingInProgress = false;

let croppedEditProductFiles = [];
let croppedEditVariantFiles = {};


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
    const productStatusFilter = $id('productStatusFilter');
    const productLimitSelect = $id('productLimitSelect');
    const productPagination = $id('productPagination');
    const productsCountLabel = $id('productsCountLabel');
    const productSortFilter = $id('productSortFilter');

    let currentPage = 1, currentLimit = 10, currentQuery = '', currentCategory = 'all', currentStatus = 'all';
    let currentSort = ''; 
    let cropper = null;


    let croppingQueue = [];
    let croppingInProgress = false;
    window.croppingQueue = croppingQueue;
    window.croppingInProgress = croppingInProgress;

    const selectedProductFiles = [];
    let croppedVariantFiles = {};
    let variantCounter = 0;
    if (productSortFilter) {
  productSortFilter.addEventListener('change', function() { 
    currentSort = productSortFilter.value; 
    currentPage = 1; 
    loadProductsToTable(); 
  });
}
  if (editImages) {
  editImages.addEventListener('change', function (ev) {
    const files = Array.from(ev.target.files || []);
    if (!files.length) return;
    

    const editImagesPreview = $id('editImagesPreview');
    if (editImagesPreview) editImagesPreview.innerHTML = '';
    
 
    files.forEach(f => {
      enqueueEditCrop(f, { type: 'product' });
    });
    
   
    ev.target.value = '';
  });
}



    async function toggleProductStatusAPI(productId, currentStatus) {
      try {
        const response = await axios.post(`/admin/product/${productId}/toggle-status`);
        
        if (response.data.success) {
          toastr.success(response.data.message);
          return response.data.status;
        } else {
          toastr.error(response.data.message || 'Failed to update status');
          return null;
        }
      } catch (error) {
        console.error('Error toggling product status:', error);
        toastr.error('Server error updating status');
        return null;
      }
    }


    function blobToFile(blob, filename) {
      try { return new File([blob], filename, { type: blob.type, lastModified: Date.now() }); }
      catch (e) { blob.name = filename; return blob; }
    }


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

    function showSwalError(title, text) {
      if (window.Swal) {
        Swal.fire({
          icon: 'error',
          title: title || 'Invalid value',
          text: text || '',
          confirmButtonColor: '#d33'
        });
      } else if (window.toastr) {
        toastr.error(text || title || 'Invalid value');
      } else {
        alert((title ? title + '\n' : '') + (text || 'Invalid value'));
      }
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


    function enqueueCropForFile(file, meta) {
      croppingQueue.push({ file, meta });
      window.croppingQueue = croppingQueue;
      console.debug('enqueueCropForFile: queued item', meta, 'queueLen=', croppingQueue.length);

      if (!croppingInProgress) {
        processNextInCropQueue().catch(err => {
          console.error('processNextInCropQueue uncaught error', err);
          croppingInProgress = false;
          window.croppingInProgress = croppingInProgress;
          hideCropUI();
        });
      }
    }
 

function startEditCropper(dataURL) {
  if (!editCropImage || !editCropArea) {
    console.error('Edit crop DOM missing');
    return;
  }

  editCropImage.src = dataURL;

  setTimeout(() => {
    if (editCropper) {
      editCropper.destroy();
      editCropper = null;
    }

    editCropper = new Cropper(editCropImage, {
      viewMode: 1,
      autoCropArea: 0.9,
      responsive: true,
      background: false
    });

    editCropArea.style.display = 'block';
    if (editCropControls) editCropControls.style.display = 'flex';

    console.log('[DEBUG] Edit cropper started');
  }, 50);
}

function enqueueEditCrop(file, meta) {
  editCroppingQueue.push({ file, meta });
  if (!editCroppingInProgress) processNextEditCrop();
}

function processNextEditCrop() {
  if (!editCroppingQueue.length) {
    editCroppingInProgress = false;
    return;
  }

  editCroppingInProgress = true;
  const item = editCroppingQueue.shift();

  const reader = new FileReader();
  reader.onload = e => startEditCropper(e.target.result);
  reader.readAsDataURL(item.file);

  editCropArea.dataset.meta = JSON.stringify(item.meta);
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

        croppingInProgress = true;
        window.croppingInProgress = croppingInProgress;

        const item = croppingQueue.shift();
        window.croppingQueue = croppingQueue;
        if (!item) {
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
          } catch (err) {
            console.error('crop start error', err);
            setTimeout(() => processNextInCropQueue().catch(e => console.error(e)), 60);
          }
        };

        reader.onerror = function (ev) {
          console.error('FileReader error while reading file for crop', ev);
          setTimeout(() => processNextInCropQueue().catch(e => console.error(e)), 60);
        };

        reader.readAsDataURL(file);
      } catch (err) {
        console.error('processNextInCropQueue general error', err);
        croppingInProgress = false;
        window.croppingInProgress = croppingInProgress;
        hideCropUI();
      }
    }

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
          const newIndex = croppedVariantFiles[creationIdx].length;
          croppedVariantFiles[creationIdx].push(file);
          
          const row = variantsContainer && variantsContainer.querySelector(`.variant-row[data-idx="${creationIdx}"]`);
          if (row) {
            const preview = row.querySelector('.variant-image-preview');
            if (preview) {
           
              const previewElement = createImagePreviewElement(file, creationIdx, newIndex, true);
              preview.appendChild(previewElement);
              
       
              updateVariantImageCount(creationIdx);
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

    if (addCropApply) addCropApply.addEventListener('click', async function () {
      try {
        await applyCurrentCrop();
      } catch (err) {
        console.error('applyCurrentCrop error on Apply button', err);
      } finally {
        setTimeout(() => processNextInCropQueue().catch(e => console.error(e)), 60);
      }
    });

    if (addCropNext) addCropNext.addEventListener('click', function () {
      if (addCropArea) delete addCropArea.dataset.cropMeta;
      hideCropUI();
      setTimeout(() => processNextInCropQueue().catch(e => console.error(e)), 60);
    });

    if (addCropCancel) addCropCancel.addEventListener('click', function () {
      if (addCropArea) delete addCropArea.dataset.cropMeta;
      hideCropUI();
    });

    function waitForCroppingComplete(timeoutMs = 8000) {
      return new Promise((resolve, reject) => {
        const start = Date.now();
        (function poll() {
          if (!window.croppingInProgress && (!window.croppingQueue || window.croppingQueue.length === 0)) return resolve();
          if (Date.now() - start > timeoutMs) return reject(new Error('Cropping timed out'));
          setTimeout(poll, 150);
        })();
      });
    }
  

editCropApply.addEventListener('click', async () => {
  if (!editCropper) return;

  const canvas = editCropper.getCroppedCanvas({
    width: 1200,
    height: 1200,
    imageSmoothingQuality: 'high'
  });

  const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9));
  const meta = JSON.parse(editCropArea.dataset.meta || '{}');
  const file = new File([blob], `edit-${Date.now()}.jpg`, { type: 'image/jpeg' });

  if (meta.type === 'product') {
    croppedEditProductFiles.push(file);

    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.className = 'img-thumbnail me-1 mb-1';
    editImagesPreview.appendChild(img);

  } else if (meta.type === 'variant') {
    const idx = String(meta.variantIdx);
    croppedEditVariantFiles[idx] ||= [];
    croppedEditVariantFiles[idx].push(file);

    const row = editVariantsContainer.querySelector(
      `.variant-row[data-idx="${idx}"]`
    );
    row.querySelector('.variant-image-preview')
      .appendChild(createImagePreviewElement(file, idx, 0, true));
  }

  editCropper.destroy();
  editCropper = null;
  editCropArea.style.display = 'none';

  processNextEditCrop();
});

editCropCancel.addEventListener('click', () => {
  if (editCropper) editCropper.destroy();
  editCropper = null;
  editCropArea.style.display = 'none';
  editCroppingQueue = [];
});

editCropNext.addEventListener('click', () => {
  if (editCropper) editCropper.destroy();
  editCropper = null;
  editCropArea.style.display = 'none';
  processNextEditCrop();
});


    function clearCroppedVariantFiles() {
      Object.keys(croppedVariantFiles).forEach(k => delete croppedVariantFiles[k]);
    }

function addVariantRow(container, variantData) {
  variantCounter += 1;
  const creationIdx = variantCounter;
  const node = variantTpl.content.cloneNode(true);
  const row = node.querySelector('.variant-row');
  row.dataset.idx = creationIdx;

  const imgInput = row.querySelector('.variant-image');
  const preview = row.querySelector('.variant-image-preview');
  const colorEl = row.querySelector('.variant-color');
  const stockEl = row.querySelector('.variant-stock');
  const priceEl = row.querySelector('.variant-price');
  const removeBtn = row.querySelector('.removeVariantBtn');

  imgInput.name = `variants[${creationIdx}][image][]`;
  imgInput.multiple = true;

  imgInput.addEventListener('change', function (ev) {
    const files = Array.from(ev.target.files || []);
    if (!files.length) return;
    
    files.forEach(f => {
      enqueueCropForFile(f, { 
        type: 'variant', 
        variantIdx: creationIdx 
      });
    });
    
    ev.target.value = '';
  });

  if (variantData) {
    if (variantData.color) colorEl.value = variantData.color;
    if (typeof variantData.stock !== 'undefined') stockEl.value = variantData.stock;
    if (typeof variantData.price !== 'undefined') priceEl.value = variantData.price;
    if (variantData.images && variantData.images.length) {
      preview.innerHTML = '';
      variantData.images.forEach((imgPath, idx) => {
        const mockFile = {
          name: imgPath.split('/').pop(),
          type: 'image/jpeg',
          url: makeUploadUrl(imgPath)
        };
        const previewElement = createImagePreviewElement(mockFile, creationIdx, idx, false);
        preview.appendChild(previewElement);
      });
    }
  }

  removeBtn.addEventListener('click', function () {
    if (croppedVariantFiles[creationIdx]) delete croppedVariantFiles[creationIdx];
    row.remove();
  });

  const imageCountDiv = document.createElement('div');
  imageCountDiv.className = 'image-count-message small mt-2 text-danger';

  preview.parentNode.insertBefore(imageCountDiv, preview.nextSibling);

  container.appendChild(node);
  return row;
}

    if (variantsContainer && variantsContainer.children.length === 0) {
      addVariantRow(variantsContainer, null);
    }
    
    if (addVariantBtn) addVariantBtn.addEventListener('click', function () { addVariantRow(variantsContainer, null); });

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

    if (productTableBody) {
      productTableBody.addEventListener('click', async function (ev) {
        const editBtn = ev.target.closest('.editBtn');
        if (editBtn) {
          const id = editBtn.dataset.id; 
          await openEditModal(id);
          return;
        }
        
        const deleteBtn = ev.target.closest('.deleteBtn');
        if (deleteBtn) {
          const id = deleteBtn.dataset.id;
          if (!confirm('Move product to trash?')) return;
          try {
            const resp = await axios.delete(`/admin/product/${id}`);
            if (resp && resp.data && resp.data.success) { 
              toastr.success('Deleted'); 
              loadProductsToTable(); 
            } else {
              toastr.error(resp.data && resp.data.message ? resp.data.message : 'Delete failed');
            }
          } catch (err) { 
            console.error(err); 
            toastr.error('Server error'); 
          }
          return;
        }

        const toggleBtn = ev.target.closest('.toggleStatusBtn');
        if (toggleBtn) {
          const id = toggleBtn.dataset.id;
          const currentStatus = toggleBtn.dataset.status;
          const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
          const action = currentStatus === 'active' ? 'block' : 'unblock';
          
          const result = await Swal.fire({
    title: action === 'block' ? 'Block this product?' : 'Unblock this product?',
    text: action === 'block'
      ? 'This product will no longer be visible to users.'
      : 'This product will be visible to users again.',
    icon: action === 'block' ? 'warning' : 'question',
    showCancelButton: true,
    confirmButtonColor: action === 'block' ? '#d33' : '#16a34a',
    cancelButtonColor: '#6b7280',
    confirmButtonText: action === 'block' ? 'Yes, block it' : 'Yes, unblock it',
    cancelButtonText: 'Cancel'
  });
  if (!result.isConfirmed) return;
          
          const updatedStatus = await toggleProductStatusAPI(id, currentStatus);
          
          if (updatedStatus) {
            toggleBtn.dataset.status = updatedStatus;
            toggleBtn.innerHTML = `
              <i class="bi ${updatedStatus === 'active' ? 'bi-lock' : 'bi-unlock'} me-1"></i>
              ${updatedStatus === 'active' ? 'Block' : 'Unblock'}
            `;
            toggleBtn.className = `btn btn-sm btn-${updatedStatus === 'active' ? 'outline-warning' : 'outline-success'} toggleStatusBtn px-3`;
            
            const row = toggleBtn.closest('tr');
            const statusBadge = row.querySelector('.badge[data-id]');
            if (statusBadge) {
              statusBadge.textContent = updatedStatus === 'active' ? 'Active' : 'Blocked';
              statusBadge.className = `badge rounded-pill px-3 py-2 ${updatedStatus === 'active' ? 'bg-success' : 'bg-danger'}`;
              statusBadge.dataset.status = updatedStatus;
            }
            
            if (updatedStatus === 'blocked') {
              row.classList.add('table-danger');
              row.style.opacity = '0.7';
              const editBtn = row.querySelector('.editBtn');
              if (editBtn) editBtn.disabled = true;
            } else {
              row.classList.remove('table-danger');
              row.style.opacity = '1';
              const editBtn = row.querySelector('.editBtn');
              if (editBtn) editBtn.disabled = false;
            }
          }
          return;
        }
        
        const statusBadge = ev.target.closest('.badge[data-id]');
        if (statusBadge && statusBadge.dataset.id) {
          const id = statusBadge.dataset.id;
          const currentStatus = statusBadge.dataset.status;
          const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
          const action = currentStatus === 'active' ? 'block' : 'unblock';
          
          if (!confirm(`Are you sure you want to ${action} this product?`)) return;
          
          const updatedStatus = await toggleProductStatusAPI(id, currentStatus);
          
          if (updatedStatus) {
            statusBadge.textContent = updatedStatus === 'active' ? 'Active' : 'Blocked';
            statusBadge.className = `badge rounded-pill px-3 py-2 ${updatedStatus === 'active' ? 'bg-success' : 'bg-danger'}`;
            statusBadge.dataset.status = updatedStatus;
            
            const row = statusBadge.closest('tr');
            const toggleBtn = row.querySelector('.toggleStatusBtn');
            if (toggleBtn) {
              toggleBtn.dataset.status = updatedStatus;
              toggleBtn.innerHTML = `
                <i class="bi ${updatedStatus === 'active' ? 'bi-lock' : 'bi-unlock'} me-1"></i>
                ${updatedStatus === 'active' ? 'Block' : 'Unblock'}
              `;
              toggleBtn.className = `btn btn-sm btn-${updatedStatus === 'active' ? 'outline-warning' : 'outline-success'} toggleStatusBtn px-3`;
            }
            
            if (updatedStatus === 'blocked') {
              row.classList.add('table-danger');
              row.style.opacity = '0.7';
              const editBtn = row.querySelector('.editBtn');
              if (editBtn) editBtn.disabled = true;
            } else {
              row.classList.remove('table-danger');
              row.style.opacity = '1';
              const editBtn = row.querySelector('.editBtn');
              if (editBtn) editBtn.disabled = false;
            }
          }
        }
      });
    }

    if (productSearchInput) {
      let timer;
      productSearchInput.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(() => { 
          currentQuery = productSearchInput.value.trim(); 
          currentPage = 1; 
          loadProductsToTable(); 
        }, 350);
      });
    }
    
    if (productCategoryFilter) {
      productCategoryFilter.addEventListener('change', function () { 
        currentCategory = productCategoryFilter.value; 
        currentPage = 1; 
        loadProductsToTable(); 
      });
    }
    
    if (productStatusFilter) {
      productStatusFilter.addEventListener('change', function () { 
        currentStatus = productStatusFilter.value; 
        currentPage = 1; 
        loadProductsToTable(); 
      });
    }
    
    if (productLimitSelect) {
      productLimitSelect.addEventListener('change', function () { 
        currentLimit = parseInt(productLimitSelect.value, 10) || 10; 
        currentPage = 1; 
        loadProductsToTable(); 
      });
    }

    function renderPagination(pagination) {
      if (!productPagination) return;
      productPagination.innerHTML = '';
      const { page, pages } = pagination;
      
      const prevLi = document.createElement('li'); 
      prevLi.className = 'page-item' + (page <= 1 ? ' disabled' : '');
      prevLi.innerHTML = `<button class="page-link" ${page <= 1 ? 'tabindex="-1"' : ''}>Prev</button>`;
      prevLi.addEventListener('click', () => { 
        if (page > 1) { 
          currentPage = page - 1; 
          loadProductsToTable(); 
        } 
      });
      productPagination.appendChild(prevLi);

      const maxWindow = 7;
      let start = Math.max(1, page - Math.floor(maxWindow / 2));
      let end = Math.min(pages, start + maxWindow - 1);
      start = Math.max(1, end - maxWindow + 1);
      
      for (let p = start; p <= end; p++) {
        const li = document.createElement('li'); 
        li.className = 'page-item' + (p === page ? ' active' : '');
        li.innerHTML = `<button class="page-link">${p}</button>`;
        li.addEventListener('click', () => { 
          if (p !== page) { 
            currentPage = p; 
            loadProductsToTable(); 
          } 
        });
        productPagination.appendChild(li);
      }

      const nextLi = document.createElement('li'); 
      nextLi.className = 'page-item' + (page >= pages ? ' disabled' : '');
      nextLi.innerHTML = `<button class="page-link" ${page >= pages ? 'tabindex="-1"' : ''}>Next</button>`;
      nextLi.addEventListener('click', () => { 
        if (page < pages) { 
          currentPage = page + 1; 
          loadProductsToTable(); 
        } 
      });
      productPagination.appendChild(nextLi);
    }


    async function loadProductsToTable() {
      try {
        if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="6" class="text-center">Loading…</td></tr>`;
        const params = new URLSearchParams();
        params.set('page', String(currentPage));
        params.set('limit', String(currentLimit));
        if (currentQuery) params.set('q', currentQuery);
        if (currentCategory && currentCategory !== 'all') params.set('category', currentCategory);
        if (currentStatus && currentStatus !== 'all') params.set('status', currentStatus);
          if (currentSort) params.set('sort', currentSort); 
        const url = '/admin/product/data?' + params.toString();
        const resp = await axios.get(url);
        const data = resp && resp.data;
        
        if (!data || !data.success) {
          if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Failed to load products</td></tr>`;
          return;
        }
        
        const products = data.products || [];
        const pagination = data.pagination || { total: 0, page: 1, pages: 1, limit: currentLimit };
        
        if (productsCountLabel) {
          productsCountLabel.textContent = `${pagination.total} product${pagination.total === 1 ? '' : 's'}`;
        }
        
        if (productTableBody) {
          productTableBody.innerHTML = '';
          if (!products.length) {
            const tr = document.createElement('tr');
            const td = document.createElement('td'); 
            td.colSpan = 6; 
            td.className = 'text-center text-muted'; 
            td.textContent = 'No products found';
            tr.appendChild(td); 
            productTableBody.appendChild(tr);
          } else {
            products.forEach(p => productTableBody.appendChild(buildProductRow(p)));
          }
        }
        renderPagination(pagination);
      } catch (err) {
        console.error('loadProductsToTable error', err);
        if (productTableBody) productTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error loading products</td></tr>`;
      }
    }
    
    loadProductsToTable();
    
    if (reloadBtn) reloadBtn.addEventListener('click', loadProductsToTable);

    if (addForm) {
      addForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();

        addProductSubmit.disabled = true;
        addProductSubmit.textContent = 'Creating...';

        try {
          console.log('Waiting for cropping to complete...');
          await waitForCroppingComplete(10000);
          // ✅ At least ONE image required (product OR variant)
const productImageCount = selectedProductFiles.length;

let variantImageCount = 0;
Object.values(croppedVariantFiles).forEach(arr => {
  variantImageCount += arr.length;
});

const nativeVariantImages = Array.from(
  variantsContainer.querySelectorAll('.variant-image')
).reduce((sum, input) => sum + (input.files?.length || 0), 0);

const totalImages = productImageCount + variantImageCount + nativeVariantImages;

if (totalImages < 1) {
  toastr.error('At least one image is required for the product');
  throw new Error('No images provided');
}

          
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

          const fd = new FormData();
          fd.append('name', name);
          fd.append('description', pDescription?.value || '');
          if (pCategory?.value) fd.append('category', pCategory.value);

          selectedProductFiles.forEach(f => {
            fd.append('productImages[]', f);
          });

          variantRows.forEach((row, seq) => {
            const creationIdx = String(row.dataset.idx || '');
            const color = (row.querySelector('.variant-color')?.value || '').trim();
            const stockRaw = row.querySelector('.variant-stock')?.value ?? '';
            const priceRaw = row.querySelector('.variant-price')?.value ?? '';

            if (!color || stockRaw === '' || priceRaw === '') {
              showSwalError(
                'Missing fields',
                `Variant ${seq + 1}: color, stock and price are required.`
              );
              throw new Error('Variant validation failed');
            }

            const stockNum = Number(stockRaw);
            const priceNum = Number(priceRaw);

            if (!Number.isFinite(stockNum) || stockNum < 0) {
              showSwalError(
                'Invalid stock quantity',
                `Variant ${seq + 1}: stock cannot be negative. You entered "${stockRaw}".`
              );
              throw new Error('Variant stock invalid');
            }

            if (!Number.isFinite(priceNum) || priceNum < 0) {
              showSwalError(
                'Invalid price',
                `Variant ${seq + 1}: price cannot be negative. You entered "${priceRaw}".`
              );
              throw new Error('Variant price invalid');
            }

            fd.append(`variants[${seq}][color]`, color);
            fd.append(`variants[${seq}][stock]`, stockNum);
            fd.append(`variants[${seq}][price]`, priceNum);

            (croppedVariantFiles[creationIdx] || []).forEach(f => {
              fd.append(`variants[${seq}][image][]`, f);
            });

            const nativeInput = row.querySelector('.variant-image');
            if (nativeInput && nativeInput.files) {
              Array.from(nativeInput.files).forEach(f => {
                fd.append(`variants[${seq}][image][]`, f);
              });
            }

            const totalImages = (croppedVariantFiles[creationIdx] || []).length + 
                               (nativeInput?.files?.length || 0);
            
            if (totalImages < 3) {
              toastr.error(`Variant ${seq + 1} needs at least 3 images (has ${totalImages})`);
              throw new Error('Insufficient images');
            }
          });

          console.log('Sending product creation request...');
          const res = await axios.post('/admin/product', fd, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });

          if (res?.data?.success) {
            toastr.success('Product created successfully');
            
            addForm.reset();
            selectedProductFiles.length = 0;
            clearCroppedVariantFiles();
            if (pImagesPreview) pImagesPreview.innerHTML = '';
            variantsContainer.innerHTML = '';
            variantCounter = 0;
            addVariantRow(variantsContainer, null);
            
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

  
function addEditVariantRow(container, variantData) {
  const idx = container.children.length;

  const node = variantTpl.content.cloneNode(true);
  const row = node.querySelector('.variant-row');
  row.dataset.idx = idx;

 
  if (variantData && variantData._id) {
    row.dataset.variantId = variantData._id;
  }

  const imgInput = row.querySelector('.variant-image');
  const preview = row.querySelector('.variant-image-preview');
  const colorEl = row.querySelector('.variant-color');
  const stockEl = row.querySelector('.variant-stock');
  const priceEl = row.querySelector('.variant-price');
  const removeBtn = row.querySelector('.removeVariantBtn');

  imgInput.name = `variants[${idx}][image][]`;
  imgInput.multiple = true;

  if (variantData) {

    colorEl.value = variantData.color || '';
    stockEl.value = variantData.stock ?? '';
    priceEl.value = variantData.price ?? '';


    preview.innerHTML = '';
    (variantData.images || []).forEach((pth, index) => {
      const mockFile = {
        name: pth.split('/').pop(),
        type: 'image/jpeg',
        url: makeUploadUrl(pth)
      };
      const el = createImagePreviewElement(mockFile, idx, index, false);
      preview.appendChild(el);
    });
  }

  imgInput.addEventListener('change', function (ev) {
    const files = Array.from(ev.target.files || []);
    files.forEach(f => {
      enqueueEditCrop(f, { type: 'variant', variantIdx: idx });
    });
    ev.target.value = '';
  });

  removeBtn.addEventListener('click', function () {
    if (croppedEditVariantFiles[idx]) delete croppedEditVariantFiles[idx];
    row.remove();
  });

  container.appendChild(node);
  return row;
}

   async function openEditModal(id) {
  try {
    console.log('Opening edit modal for product ID:', id);
    
    
    editProductSubmit.disabled = true;
    editProductSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Loading...';
    

    const response = await axios.get(`/admin/product/${id}`);
    
    if (!response.data.success) {
      toastr.error(response.data.message || 'Failed to load product');
      return;
    }
    
    const product = response.data.product;
    console.log('Product loaded:', product.name);
    
   
    if (editProductId) editProductId.value = product._id;
    if (editName) editName.value = product.name || '';
    if (editDescription) editDescription.value = product.description || '';
    
   
    if (editCategory) {
      const categoryId = product.category ? (product.category._id || product.category) : '';
      editCategory.value = categoryId;
      console.log('Category set to:', categoryId);
    }

 
    if (editExistingImages) {
      editExistingImages.innerHTML = '';
      if (product.images && product.images.length) {
        console.log('Product has', product.images.length, 'images');
        product.images.forEach((pth, index) => {
          const container = document.createElement('div');
          container.className = 'position-relative d-inline-block me-2 mb-2';
          container.dataset.imageIndex = index;
          
          const img = document.createElement('img');
          img.src = makeUploadUrl(pth);
          img.style.width = '80px';
          img.style.height = '60px';
          img.style.objectFit = 'cover';
          img.className = 'img-thumbnail existing-product-image';
          img.dataset.imagePath = pth;
          
          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'btn btn-sm btn-danger p-0';
          removeBtn.innerHTML = '✕';
          removeBtn.style.position = 'absolute';
          removeBtn.style.top = '-5px';
          removeBtn.style.right = '-5px';
          removeBtn.style.width = '20px';
          removeBtn.style.height = '20px';
          removeBtn.style.borderRadius = '50%';
          removeBtn.style.fontSize = '10px';
          removeBtn.title = 'Remove this image';
          
          removeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (confirm('Delete this image from product?')) {
              container.remove();
             
              if (!window.deletedExistingImages) {
                window.deletedExistingImages = [];
              }
              window.deletedExistingImages.push(pth);
              console.log('Marked image for deletion:', pth);
            }
          });
          
          container.appendChild(img);
          container.appendChild(removeBtn);
          editExistingImages.appendChild(container);
        });
      } else {
        console.log('No product images found');
      }
    }

   
    if (editVariantsContainer) {
      editVariantsContainer.innerHTML = '';
      
      if (product.variants && product.variants.length) {
        console.log('Product has', product.variants.length, 'variants');
        product.variants.forEach((variant, index) => {
          console.log(`Variant ${index}:`, variant);
          const row = addEditVariantRow(editVariantsContainer, {
            _id: variant._id,
            color: variant.color,
            stock: variant.stock,
            price: variant.price,
            salePrice: variant.salePrice,
            images: variant.images || [],
            isListed: variant.isListed
          }, index);
        });
      } else {
        console.log('No variants found, adding empty row');
        addEditVariantRow(editVariantsContainer, null, 0);
      }
    }

 
    if (editImagesPreview) editImagesPreview.innerHTML = '';
    if (editImages) editImages.value = '';
    
   
    croppedEditProductFiles = [];
    croppedEditVariantFiles = {};
    editCroppingQueue = [];
    editCroppingInProgress = false;
    
    window.deletedExistingImages = [];
    window.deletedExistingVariantImages = {};

    const modal = new bootstrap.Modal(editModalEl);
    modal.show();
    
    
  } catch (err) {
    console.error('openEditModal error:', err);
    
    if (err.response) {
      console.error('Response error:', err.response.status, err.response.data);
      toastr.error(err.response.data?.message || `Server error (${err.response.status})`);
    } else if (err.request) {
      console.error('Request error:', err.request);
      toastr.error('Network error. Please check your connection.');
    } else {
      console.error('Error:', err.message);
      toastr.error('Failed to load product: ' + err.message);
    }
  } finally {
   
    editProductSubmit.disabled = false;
    editProductSubmit.innerHTML = '<i class="bi bi-check-circle me-2"></i>Save Changes';
  }
}

    if (editAddVariantBtn) editAddVariantBtn.addEventListener('click', function () { addEditVariantRow(editVariantsContainer, null); });

    if (editImages) {
      editImages.addEventListener('change', function (ev) {
        const files = Array.from(ev.target.files || []);
        if (!editImagesPreview) return;
        editImagesPreview.innerHTML = '';
        files.forEach((f, idx) => {
          const img = document.createElement('img');
          img.src = URL.createObjectURL(f);
          img.style.maxWidth = '120px'; img.style.maxHeight = '90px'; img.style.objectFit = 'cover';
          img.className = 'img-thumbnail me-1 mb-1';
          editImagesPreview.appendChild(img);
        });
      });
    }

  
function closeEditModal() {
  try {
    
    const modalInstance = bootstrap.Modal.getInstance(editModalEl);
    if (modalInstance) {
      modalInstance.hide();
      console.log('Modal closed via Bootstrap instance');
      return;
    }
    
  
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      const modal = new bootstrap.Modal(editModalEl);
      modal.hide();
      console.log('Modal closed via new Bootstrap instance');
      return;
    }
    
  
    if (typeof $ !== 'undefined' && $.fn.modal) {
      $('#editProductModal').modal('hide');
      console.log('Modal closed via jQuery');
      return;
    }
    

    editModalEl.classList.remove('show');
    editModalEl.style.display = 'none';
    document.body.classList.remove('modal-open');
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop) backdrop.remove();
    console.log('Modal closed via DOM manipulation');
    
  } catch (error) {
    console.error('Error closing modal:', error);
  }
}
if (editForm) {
  editForm.addEventListener('submit', async function (ev) {
    ev.preventDefault();

    const id = editProductId?.value;



const existingProductImages =
  (editExistingImages?.querySelectorAll('img')?.length || 0);


const newProductImages = croppedEditProductFiles.length;


const existingVariantImages = editVariantsContainer
  .querySelectorAll('.variant-image-preview img')
  .length;


let newVariantImages = 0;
Object.values(croppedEditVariantFiles).forEach(arr => {
  newVariantImages += arr.length;
});

const totalImages =
  existingProductImages +
  newProductImages +
  existingVariantImages +
  newVariantImages;

if (totalImages < 1) {
  toastr.error('At least one image is required for the product');
  editProductSubmit.disabled = false;
  editProductSubmit.innerHTML = '<i class="bi bi-check-circle me-2"></i>Save Changes';
  return;
}

    if (!id) {
      toastr.error('Missing product id');
      return;
    }

    const name = editName?.value?.trim();
    if (!name) {
      toastr.error('Name required');
      return;
    }

    editProductSubmit.disabled = true;
    editProductSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

    try {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('description', editDescription?.value || '');
      
      if (editCategory?.value) {
        fd.append('category', editCategory.value);
      }

      croppedEditProductFiles.forEach(f => {
        fd.append('images[]', f);
      });

      if (window.deletedExistingImages && window.deletedExistingImages.length > 0) {
        fd.append('deletedImages', JSON.stringify(window.deletedExistingImages));
        console.log('Sending deleted images:', window.deletedExistingImages);
      }

      const variantsArray = [];
      const rows = editVariantsContainer.querySelectorAll('.variant-row');
      
      let hasErrors = false;
      
      rows.forEach((row, index) => {
        const variantId = row.dataset.variantId;
        const color = row.querySelector('.variant-color')?.value?.trim() || '';
        const stock = row.querySelector('.variant-stock')?.value || '0';
        const price = row.querySelector('.variant-price')?.value || '0';
        
    
        if (!color) {
          toastr.error(`Variant ${index + 1}: Color is required`);
          hasErrors = true;
          return;
        }
        
        const stockNum = Number(stock);
        if (isNaN(stockNum) || stockNum < 0) {
          toastr.error(`Variant ${index + 1}: Stock must be a positive number`);
          hasErrors = true;
          return;
        }
        
        const priceNum = Number(price);
        if (isNaN(priceNum) || priceNum < 0) {
          toastr.error(`Variant ${index + 1}: Price must be a positive number`);
          hasErrors = true;
          return;
        }
        
        const variantObj = {
          _id: variantId || '',
          color: color,
          stock: stockNum,
          price: priceNum,
          isListed: true
        };
        
        variantsArray.push(variantObj);
        
        // Append to FormData
        fd.append(`variants[${index}][_id]`, variantId || '');
        fd.append(`variants[${index}][color]`, color);
        fd.append(`variants[${index}][stock]`, stock);
        fd.append(`variants[${index}][price]`, price);
        fd.append(`variants[${index}][isListed]`, 'true');
        // formData.append(`variants[${idx}][size]`, sizeValue);

        
        const deletedVariantImages = window.deletedExistingVariantImages?.[row.dataset.idx] || [];
        if (deletedVariantImages.length > 0) {
          fd.append(`variants[${index}][deletedImages]`, JSON.stringify(deletedVariantImages));
        }
        
        const newVariantFiles = croppedEditVariantFiles[row.dataset.idx] || [];
        newVariantFiles.forEach(file => {
          fd.append(`variants[${index}][image][]`, file);
        });
      });

      if (hasErrors) {
        editProductSubmit.disabled = false;
        editProductSubmit.innerHTML = '<i class="bi bi-check-circle me-2"></i>Save Changes';
        return;
      }

      fd.append('variants', JSON.stringify(variantsArray));
      
      console.log('Saving product with ID:', id);
      
      const resp = await axios.patch(`/admin/product/${id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (resp?.data?.success) {
        toastr.success('Product updated successfully');
        
        const editModal = bootstrap.Modal.getInstance(editModalEl);
        if (editModal) {
          editModal.hide();
          console.log('Modal hidden successfully');
        } else {
          $('#editProductModal').modal('hide');
          console.log('Modal hidden using jQuery fallback');
        }
        
        await loadProductsToTable();
        
      } else {
        toastr.error(resp?.data?.message || 'Update failed');
      }

    } catch (err) {
      console.error('Error in edit form submit:', err);
      
      if (err.response) {
        console.error('Response error:', err.response.status, err.response.data);
        toastr.error(err.response.data?.message || `Server error (${err.response.status})`);
      } else if (err.request) {
        console.error('Request error:', err.request);
        toastr.error('Network error. Please check your connection.');
      } else {
        console.error('Error:', err.message);
        toastr.error('Failed to update product: ' + err.message);
      }
      
    } finally {
      
      editProductSubmit.disabled = false;
      editProductSubmit.innerHTML = '<i class="bi bi-check-circle me-2"></i>Save Changes';
      
     
      window.deletedExistingImages = [];
      window.deletedExistingVariantImages = {};
    }
  });
}
   
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
    
  
    if (addCropImage) { 
      addCropImage.style.maxHeight = ''; 
      addCropImage.style.display = 'none'; 
    }
    if (addCropArea) addCropArea.style.display = 'none';
    
  
    if (cropper) { 
      cropper.destroy(); 
      cropper = null; 
    }
    
 
    const allImages = document.querySelectorAll('img[src^="blob:"]');
    allImages.forEach(img => {
      URL.revokeObjectURL(img.src);
    });
    
    
    croppingQueue = [];
    window.croppingQueue = [];
    croppingInProgress = false;
    window.croppingInProgress = false;
    selectedProductFiles.length = 0;
    clearCroppedVariantFiles();
    
   
    if (addForm) addForm.reset();
    
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
    

if (editModalEl) {
  editModalEl.addEventListener('hidden.bs.modal', function () {
    console.log('Edit modal hidden event triggered');
    
  
    if (editForm) editForm.reset();
    
 
    if (editImagesPreview) editImagesPreview.innerHTML = '';
    if (editExistingImages) editExistingImages.innerHTML = '';
    if (editVariantsContainer) editVariantsContainer.innerHTML = '';
    
   
    croppedEditProductFiles = [];
    croppedEditVariantFiles = {};
    editCroppingQueue = [];
    editCroppingInProgress = false;
    
    
    window.deletedExistingImages = [];
    window.deletedExistingVariantImages = {};
    
   
    if (editProductSubmit) {
      editProductSubmit.disabled = false;
      editProductSubmit.innerHTML = '<i class="bi bi-check-circle me-2"></i>Save Changes';
    }
    
   
    const allImages = document.querySelectorAll('img[src^="blob:"]');
    allImages.forEach(img => {
      URL.revokeObjectURL(img.src);
    });
  });
}
    console.log('product-management initialized');
  }); 
})(); 