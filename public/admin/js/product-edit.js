document.addEventListener('DOMContentLoaded', () => {

  /* ===============================
     BASIC REFERENCES
  =============================== */
  function showToast(message, type = 'danger') {
  const toastEl = document.getElementById('appToast');
  const toastMsg = document.getElementById('toastMessage');

  toastEl.className = `toast align-items-center text-bg-${type} border-0`;
  toastMsg.textContent = message;

  const toast = bootstrap.Toast.getOrCreateInstance(toastEl, {
    delay: 3000
  });
  toast.show();
}
function setEditLoading(isLoading) {
  const btn = document.getElementById('updateBtn');
  if (!btn) return;

  const text = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.spinner-border');

  if (isLoading) {
    btn.disabled = true;
    text.textContent = 'Updating...';
    spinner.classList.remove('d-none');
  } else {
    btn.disabled = false;
    text.textContent = 'Update Product';
    spinner.classList.add('d-none');
  }
}


  const form = document.getElementById('editProductForm');
  if (!form) return;

  const productId = form.dataset.id;
  const addVariantBtn = document.getElementById('addVariantBtn');
  const container = document.getElementById('variantsContainer');
  const tpl = document.getElementById('newVariantTpl');

  let newVariantIndex = document.querySelectorAll('.variant-row').length;

  /* ===============================
     CROPPER STATE
  =============================== */
  let cropper = null;
  let currentVariantIdx = null;
  const variantImages = {}; // { idx: [Blob, Blob] }

  const cropperModalEl = document.getElementById('cropperModal');
  const cropperImage = document.getElementById('cropperImage');
  const applyCropBtn = document.getElementById('applyCropBtn');

  const cropperModal = bootstrap.Modal.getOrCreateInstance(cropperModalEl);

  cropperModalEl.addEventListener('shown.bs.modal', () => {
    cropper = new Cropper(cropperImage, {
      aspectRatio: 1,
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 0.9,
      responsive: true,
      background: false
    });
  });

  cropperModalEl.addEventListener('hidden.bs.modal', () => {
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
  });

  /* ===============================
     ADD NEW VARIANT
  =============================== */
  addVariantBtn.addEventListener('click', () => {
    const clone = tpl.content.cloneNode(true);
    const row = clone.querySelector('.variant-row');
    const idx = newVariantIndex++;

    row.dataset.index = idx;

    row.querySelector('.variant-color').name = `variants[${idx}][color]`;
    row.querySelector('.variant-stock').name = `variants[${idx}][stock]`;
    row.querySelector('.variant-price').name = `variants[${idx}][price]`;

    const imgInput = row.querySelector('.variant-image-input');

      
    imgInput.dataset.index = idx;

    container.appendChild(row);
  });

  /* ===============================
     IMAGE SELECT → OPEN CROPPER
  =============================== */
  document.addEventListener('change', e => {
    if (!e.target.classList.contains('variant-image-input')) return;

    const file = e.target.files[0];
    if (!file) return;

    currentVariantIdx = e.target.dataset.index;
    variantImages[currentVariantIdx] ||= [];

    cropperImage.src = URL.createObjectURL(file);
    cropperModal.show();

    e.target.value = ''; // reset input
  });

  /* ===============================
     APPLY CROP
  =============================== */
  applyCropBtn.addEventListener('click', () => {
    if (!cropper || currentVariantIdx === null) return;

    cropper.getCroppedCanvas({
      width: 800,
      height: 800,
      imageSmoothingQuality: 'high'
    }).toBlob(blob => {

      variantImages[currentVariantIdx].push(blob);

      const row = document.querySelector(
        `.variant-row[data-index="${currentVariantIdx}"]`
      );

      const preview = row.querySelector('.variant-image-preview');

      const wrap = document.createElement('div');
      wrap.style.position = 'relative';

      const img = document.createElement('img');
      img.src = URL.createObjectURL(blob);
      img.style.width = '70px';
      img.style.height = '70px';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '6px';

      const remove = document.createElement('span');
      remove.textContent = '×';
      remove.style.cssText = `
        position:absolute;
        top:-6px;
        right:-6px;
        background:#dc3545;
        color:#fff;
        border-radius:50%;
        padding:0 6px;
        cursor:pointer;
        font-size:12px;
      `;

      remove.onclick = () => {
        const arr = variantImages[currentVariantIdx];
        arr.splice(arr.indexOf(blob), 1);
        wrap.remove();
      };

      wrap.appendChild(img);
      wrap.appendChild(remove);
      preview.appendChild(wrap);

      cropperModal.hide();
    }, 'image/jpeg', 0.9);
  });

  /* ===============================
     DELETE EXISTING IMAGE
  =============================== */
  document.addEventListener('click', async e => {
    if (!e.target.classList.contains('delete-image')) return;

    const variantId = e.target.dataset.variant;
    const imagePath = e.target.dataset.img;

    if (!confirm('Delete this image?')) return;

    const res = await fetch(`/admin/product/${productId}/image`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variantId, imagePath })
    });

    const data = await res.json();
    if (data.success) {
      e.target.parentElement.remove();
    } else {
      alert(data.message || 'Delete failed');
    }
  });

  /* ===============================
     SUBMIT FORM
  =============================== */
  form.addEventListener('submit', async e => {
    
    e.preventDefault();




    const fd = new FormData(form);

    // append cropped images
    for (const idx in variantImages) {
      variantImages[idx].forEach(blob => {
        fd.append(`variants[${idx}][image][]`, blob, 'variant.jpg');
      });
    }
setEditLoading(true);
    const res = await fetch(`/admin/product/${productId}`, {
      method: 'PATCH',
      body: fd
    });

    const data = await res.json();

    if (data.success) {
      showToast('Product updated successfully', 'success');

  setTimeout(() => {
    window.location.href = '/admin/product';
  }, 1800);
    } else {
          setEditLoading(false);
       showToast(data.message || 'Update failed', 'danger');
    }
  });

});
