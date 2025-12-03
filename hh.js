// public/admin/js/product.js
// Products + Variants support. Requires Cropper, Axios, Toastr, Bootstrap.
(() => {
  const API_BASE = '/admin/products';
  const MIN_IMAGES = 3;

  // DOM main references
  const addBtn = document.getElementById('openAddProduct');
  const addModal = document.getElementById('addProductModal');
  const addForm = document.getElementById('addProductForm');
  const addFiles = document.getElementById('addProductFiles');
  const addPreviewWrap = document.getElementById('addPreviewWrap');
  const variantsContainer = document.getElementById('variantsContainer');
  const addVariantBtn = document.getElementById('addVariantBtn');
  const productListWrap = document.getElementById('productList');

  // state
  const mainItems = []; // preview items for main images
  const variantStates = []; // each variant: { color, dialType, items: [ {file,img,cropper,container} ] }

  function escapeHtml(s){ return (s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

  // ---------- PREVIEW / CROPPER helpers ----------
  function createPreviewItem(imgSrc, containerParent, onRotate, onRemove) {
    const container = document.createElement('div');
    container.className = 'preview-item';
    container.style.display = 'inline-block';
    container.style.margin = '6px';
    container.innerHTML = `
      <div style="width:160px;height:160px;border:1px solid #ddd; overflow:hidden;display:flex;align-items:center;justify-content:center">
        <img style="max-width:100%; display:block" />
      </div>
      <div style="text-align:center;margin-top:6px">
        <button class="btn btn-sm btn-secondary rotate">⟳</button>
        <button class="btn btn-sm btn-danger remove">✖</button>
      </div>
    `;
    const img = container.querySelector('img');
    img.src = imgSrc;
    containerParent.appendChild(container);
    const rotateBtn = container.querySelector('.rotate');
    const removeBtn = container.querySelector('.remove');
    rotateBtn.addEventListener('click', (e)=>{ e.preventDefault(); onRotate && onRotate(); });
    removeBtn.addEventListener('click', (e)=>{ e.preventDefault(); onRemove && onRemove(); container.remove(); });
    return { container, img, rotateBtn, removeBtn };
  }

  function addMainPreviewForFile(file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { container, img } = createPreviewItem(ev.target.result, addPreviewWrap);
      const cropper = new Cropper(img, { aspectRatio: 1, viewMode: 1, autoCropArea: 1 });
      const rotate = container.querySelector('.rotate'); rotate.addEventListener('click', ()=>cropper.rotate(90));
      const remove = container.querySelector('.remove'); remove.addEventListener('click', ()=>{ try{cropper.destroy();}catch(e){}; const idx = mainItems.findIndex(it=>it.container===container); if (idx!==-1) mainItems.splice(idx,1); });
      mainItems.push({ file, img, cropper, container });
    };
    reader.readAsDataURL(file);
  }

  // variant: create UI block
  function createVariantBlock(index) {
    const wrapper = document.createElement('div');
    wrapper.className = 'variant-block p-3 border rounded bg-dark';
    wrapper.dataset.index = index;
    wrapper.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-2">
        <div><strong class="text-white">Variant ${index + 1}</strong></div>
        <div>
          <button type="button" class="btn btn-sm btn-danger remove-variant">Remove</button>
        </div>
      </div>

      <div class="row g-2 mb-2">
        <div class="col-6">
          <label class="form-label text-white">Color</label>
          <input type="text" class="form-control bg-secondary border-0 text-white variant-color" placeholder="e.g. Blue">
        </div>
        <div class="col-6">
          <label class="form-label text-white">Dial Type</label>
          <input type="text" class="form-control bg-secondary border-0 text-white variant-dial" placeholder="e.g. Sunburst">
        </div>
      </div>

      <div>
        <label class="form-label text-white">Variant Images (min 3)</label>
        <input type="file" accept="image/*" multiple class="form-control bg-secondary border-0 text-white variant-files">
        <div class="variant-preview mt-2 d-flex flex-wrap gap-2"></div>
      </div>
    `;
    variantsContainer.appendChild(wrapper);

    // ensure variantStates array entry
    variantStates[index] = variantStates[index] || { items: [] };

    const removeBtn = wrapper.querySelector('.remove-variant');
    removeBtn.addEventListener('click', ()=> {
      if (!confirm('Remove this variant?')) return;
      wrapper.remove();
      variantStates[index] = null; // mark removed
      // re-index UI? We keep indexes — server expects variantImages-<index>
    });

    // bind file input
    const filesInput = wrapper.querySelector('.variant-files');
    const previewBox = wrapper.querySelector('.variant-preview');
    filesInput.addEventListener('change', (e) => {
      // clear existing for this variant
      previewBox.innerHTML = '';
      // destroy old croppers for this variant
      if (variantStates[index] && variantStates[index].items) {
        variantStates[index].items.forEach(it=>{ try{ it.cropper.destroy(); }catch(e){} });
      }
      variantStates[index] = variantStates[index] || { items: [] };
      variantStates[index].items.length = 0;

      const files = Array.from(e.target.files || []).slice(0, 8);
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const { container, img } = createPreviewItem(ev.target.result, previewBox);
          const cropper = new Cropper(img, { aspectRatio: 1, viewMode: 1, autoCropArea: 1 });
          container.querySelector('.rotate').addEventListener('click', ()=>cropper.rotate(90));
          container.querySelector('.remove').addEventListener('click', ()=>{ try{cropper.destroy();}catch(e){}; const idx = variantStates[index].items.findIndex(it=>it.container===container); if (idx!==-1) variantStates[index].items.splice(idx,1); });
          variantStates[index].items.push({ file, img, cropper, container });
        };
        reader.readAsDataURL(file);
      });
    });
  }

  // allow adding variants dynamically
  (function wireAddVariantBtn(){
    if (!addVariantBtn) return;
    addVariantBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // find next index (first null or length)
      let idx = 0;
      while (variantStates[idx]) idx++;
      createVariantBlock(idx);
    });
  })();

  // bind main images input
  if (addFiles) {
    addFiles.addEventListener('change', (e) => {
      addPreviewWrap.innerHTML = '';
      mainItems.forEach(it=>{ try{ it.cropper.destroy(); }catch(e){} });
      mainItems.length = 0;
      const files = Array.from(e.target.files || []).slice(0, 12);
      files.forEach(f => addMainPreviewForFile(f));
    });
  }

  // helper to build FormData from add form (including variants)
  async function buildFormDataForCreate() {
    const fd = new FormData();
    const name = document.getElementById('addName')?.value || '';
    const price = document.getElementById('addPrice')?.value || '';
    const description = document.getElementById('addDescription')?.value || '';
    const category = document.getElementById('addCategory')?.value || '';

    fd.append('name', name);
    fd.append('price', price);
    fd.append('description', description);
    fd.append('category', category);

    // main images
    for (let i=0;i<mainItems.length;i++){
      const it = mainItems[i];
      const canvas = it.cropper.getCroppedCanvas({ width:1200, height:1200, imageSmoothingQuality: 'high' });
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9));
      fd.append('images', blob, `main-${i}.jpg`);
    }

    // variants: for each variantStates[i] that's not null
    const variantsMeta = [];
    for (let vi = 0; vi < variantStates.length; vi++) {
      const vs = variantStates[vi];
      if (!vs) continue;
      const wrapper = variantsContainer.querySelector(`div.variant-block[data-index="${vi}"]`);
      if (!wrapper) continue;
      const color = wrapper.querySelector('.variant-color')?.value || '';
      const dialType = wrapper.querySelector('.variant-dial')?.value || '';
      // require 3 images
      if (!vs.items || vs.items.length < 3) throw new Error(`Variant ${vi+1} must have at least 3 images`);
      // append variant images as fieldname variantImages-<vi>
      for (let j=0;j<vs.items.length;j++){
        const it = vs.items[j];
        const canvas = it.cropper.getCroppedCanvas({ width:1200, height:1200, imageSmoothingQuality:'high' });
        const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9));
        fd.append(`variantImages-${vi}`, blob, `variant-${vi}-${j}.jpg`);
      }
      variantsMeta.push({ name: `${color} ${dialType}`.trim(), color, dialType });
    }

    // variants metadata
    fd.append('variants', JSON.stringify(variantsMeta));

    return fd;
  }

  // create submit
  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const name = document.getElementById('addName')?.value || '';
        const price = document.getElementById('addPrice')?.value || '';
        if (!name || !price) { toastr?.error('Name and price required'); return; }
        if (mainItems.length < MIN_IMAGES) { toastr?.warning(`Add at least ${MIN_IMAGES} main images`); return; }

        const fd = await buildFormDataForCreate();
        const res = await axios.post(API_BASE, fd);
        if (res.data && res.data.success) {
          toastr?.success('Product created');
          // reset UI
          addForm.reset();
          addPreviewWrap.innerHTML = '';
          variantsContainer.innerHTML = '';
          variantStates.length = 0;
          mainItems.forEach(it=>{ try{ it.cropper.destroy(); }catch(e){} });
          mainItems.length = 0;
          // hide modal if present
          if (addModal) { try{ (bootstrap.Modal.getInstance(addModal) || new bootstrap.Modal(addModal)).hide(); }catch(e){} }
          // reload list
          setTimeout(()=> loadProducts(), 250);
        } else {
          toastr?.error(res.data?.message || 'Create failed');
        }
      } catch (err) {
        console.error('create err', err);
        toastr?.error(err.message || 'Create failed');
      }
    });
  }

  // ---------- Load products & render (with action buttons) ----------
  async function loadProducts() {
    try {
      const res = await axios.get(API_BASE);
      const list = res.data.products || [];
      if (!productListWrap) return;
      productListWrap.innerHTML = '';
      if (!list.length) { productListWrap.innerHTML = '<tr><td colspan="6" class="text-center">No products</td></tr>'; return; }

      productListWrap.innerHTML = list.map(p => {
        const imgs = (p.images && p.images[0]) ? `<img src="${escapeHtml(p.images[0])}" style="height:60px;"/>` : '';
        return `<tr data-id="${p._id}">
          <td>${escapeHtml(p.name)}</td>
          <td>${imgs}</td>
          <td>${p.price}</td>
          <td>${new Date(p.createdAt).toLocaleString()}</td>
          <td>
            <button class="btn btn-sm btn-primary btn-edit">Edit</button>
            <button class="btn btn-sm btn-danger btn-del">Delete</button>
            ${p.isBlocked ? '<button class="btn btn-sm btn-success btn-unblock">Unblock</button>' : '<button class="btn btn-sm btn-warning btn-block">Block</button>'}
            <button class="btn btn-sm btn-info btn-manage-variants">Variants</button>
          </td>
        </tr>`;
      }).join('');

      // attach handlers
      productListWrap.querySelectorAll('.btn-edit').forEach(b => b.addEventListener('click', async (ev) => {
        const id = ev.target.closest('tr').getAttribute('data-id');
        openEdit(id);
      }));
      productListWrap.querySelectorAll('.btn-del').forEach(b => b.addEventListener('click', (ev) => {
        const id = ev.target.closest('tr').getAttribute('data-id');
        softDelete(id);
      }));
      productListWrap.querySelectorAll('.btn-block').forEach(b => b.addEventListener('click', (ev) => {
        const id = ev.target.closest('tr').getAttribute('data-id');
        blockProduct(id);
      }));
      productListWrap.querySelectorAll('.btn-unblock').forEach(b => b.addEventListener('click', (ev) => {
        const id = ev.target.closest('tr').getAttribute('data-id');
        unblockProduct(id);
      }));
      productListWrap.querySelectorAll('.btn-manage-variants').forEach(b => b.addEventListener('click', async (ev) => {
        const id = ev.target.closest('tr').getAttribute('data-id');
        // open edit to manage variants
        await openEdit(id);
      }));
    } catch (err) {
      console.error('loadProducts error', err);
      if (productListWrap) productListWrap.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load</td></tr>';
    }
  }

  // block/unblock functions
  async function blockProduct(id) {
    try {
      const res = await axios.post(`${API_BASE}/${id}/block`);
      if (res.data && res.data.success) {
        toastr?.success('Product blocked');
        loadProducts();
      } else toastr?.error(res.data?.message || 'Block failed');
    } catch (err) { console.error(err); toastr?.error('Block failed'); }
  }
  async function unblockProduct(id) {
    try {
      const res = await axios.post(`${API_BASE}/${id}/unblock`);
      if (res.data && res.data.success) {
        toastr?.success('Product unblocked');
        loadProducts();
      } else toastr?.error(res.data?.message || 'Unblock failed');
    } catch (err) { console.error(err); toastr?.error('Unblock failed'); }
  }

  // edit: load product and populate edit modal / inline form for managing images & variants
  async function openEdit(id) {
    try {
      const res = await axios.get(`${API_BASE}/${id}`);
      if (!res.data || !res.data.success) { toastr?.error('Not found'); return; }
      const p = res.data.product;
      // open edit modal (reuse add modal pattern or have a dedicated edit modal)
      // For brevity, we'll reuse add modal UI but populate fields and variant blocks.
      // Populate add form with product data to allow editing (simplification).
      document.getElementById('addName').value = p.name || '';
      document.getElementById('addPrice').value = p.price || '';
      document.getElementById('addDescription').value = p.description || '';
      // reset previews & states
      addPreviewWrap.innerHTML = '';
      mainItems.forEach(it=>{ try{it.cropper.destroy();}catch(e){} });
      mainItems.length = 0;
      variantsContainer.innerHTML = '';
      variantStates.length = 0;

      // show current product images as existing (we'll show as static boxes with remove option)
      (p.images || []).forEach(img => {
        const wrap = document.createElement('div');
        wrap.style.display='inline-block'; wrap.style.margin='6px';
        wrap.innerHTML = `<div style="width:160px;height:160px;border:1px solid #333;display:flex;align-items:center;justify-content:center">
          <img src="${img}" style="max-width:100%;max-height:100%;" />
        </div>
        <div style="text-align:center;margin-top:6px">
          <button class="btn btn-sm btn-danger remove-existing">Remove</button>
        </div>`;
        addPreviewWrap.appendChild(wrap);
        wrap.querySelector('.remove-existing').addEventListener('click', ()=>{
          if (!confirm('Remove this image from product?')) return;
          // mark for removal using hidden input removeImages
          let rem = addForm.querySelector('input[name="removeImages"]');
          if (!rem) { rem = document.createElement('input'); rem.type='hidden'; rem.name='removeImages'; rem.value='[]'; addForm.appendChild(rem); }
          const arr = JSON.parse(rem.value || '[]');
          arr.push(img);
          rem.value = JSON.stringify(arr);
          wrap.remove();
        });
      });

      // render existing variants (if any) into variant blocks, prefill color/dial and show existing images as "existingImages" info
      (p.variants || []).forEach((v, idx) => {
        createVariantBlock(idx);
        const block = variantsContainer.querySelector(`div.variant-block[data-index="${idx}"]`);
        if (!block) return;
        block.querySelector('.variant-color').value = v.color || '';
        block.querySelector('.variant-dial').value = v.dialType || '';
        // show existing variant images in preview area (these are NOT croppers)
        const previewBox = block.querySelector('.variant-preview');
        v.images.forEach(src => {
          const wrap = document.createElement('div');
          wrap.style.display='inline-block'; wrap.style.margin='6px';
          wrap.innerHTML = `<div style="width:120px;height:120px;border:1px solid #333;display:flex;align-items:center;justify-content:center">
             <img src="${src}" style="max-width:100%;max-height:100%;" />
           </div>
           <div style="text-align:center;margin-top:6px">
             <button class="btn btn-sm btn-danger remove-existing-variant">Remove</button>
           </div>`;
          previewBox.appendChild(wrap);
          wrap.querySelector('.remove-existing-variant').addEventListener('click', ()=>{
            if (!confirm('Remove this variant image?')) return;
            // mark removed by adding to hidden existingImagesRemoved for this variant via a hidden meta structure: we store existing kept images in a hidden field inside block
            let existInput = block.querySelector('input[name="existingImages"]');
            if (!existInput) { existInput = document.createElement('input'); existInput.type='hidden'; existInput.name='existingImages'; existInput.value = JSON.stringify(v.images); block.appendChild(existInput); }
            // remove the image from the input array
            const arr = JSON.parse(existInput.value || '[]').filter(x => x !== src);
            existInput.value = JSON.stringify(arr);
            wrap.remove();
          });
        });
      });

      // open add/edit modal
      if (addModal) {
        try { (bootstrap.Modal.getInstance(addModal) || new bootstrap.Modal(addModal)).show(); } catch(e) { console.warn(e); }
      }

    } catch (err) {
      console.error('openEdit error', err);
      toastr?.error('Failed to load product');
    }
  }

  // soft-delete
  async function softDelete(id) {
    if (!confirm('Soft-delete product?')) return;
    try {
      const res = await axios.delete(`${API_BASE}/${id}`);
      if (res.data && res.data.success) {
        toastr?.success('Product soft-deleted');
        loadProducts();
      } else toastr?.error('Delete failed');
    } catch (err) { console.error(err); toastr?.error('Delete failed'); }
  }

  // initial load
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadProducts);
  else loadProducts();

  // expose some helpers for console if needed
  window.productAdmin = window.productAdmin || {};
  window.productAdmin.reload = loadProducts;

})();
