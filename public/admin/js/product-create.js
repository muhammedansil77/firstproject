document.addEventListener('DOMContentLoaded', () => {
  console.log('product-create.js loaded');
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
function showBackendErrorsAsToast(errors) {
  if (!errors) return;

  // Product-level errors
  if (errors.name) {
    showToast(errors.name, 'danger');
    return;
  }

  if (errors.category) {
    showToast(errors.category, 'danger');
    return;
  }

  // Variant form-level error
  if (errors.variants?._form) {
    showToast(errors.variants._form, 'danger');
    return;
  }

  // Variant field errors
  if (errors.variants) {
    for (const idx in errors.variants) {
      const vErr = errors.variants[idx];

      if (vErr.color) {
        showToast(`Variant ${Number(idx) + 1}: ${vErr.color}`, 'danger');
        return;
      }
      if (vErr.stock) {
        showToast(`Variant ${Number(idx) + 1}: ${vErr.stock}`, 'danger');
        return;
      }
      if (vErr.price) {
        showToast(`Variant ${Number(idx) + 1}: ${vErr.price}`, 'danger');
        return;
      }
      if (vErr.images) {
        showToast(`Variant ${Number(idx) + 1}: ${vErr.images}`, 'danger');
        return;
      }
    }
  }
}
function setLoading(isLoading) {
  const btn = document.getElementById('submitBtn');
  if (!btn) return;

  const text = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.spinner-border');

  if (isLoading) {
    btn.disabled = true;
    text.textContent = 'Creating...';
    spinner.classList.remove('d-none');
  } else {
    btn.disabled = false;
    text.textContent = 'Create Product';
    spinner.classList.add('d-none');
  }
}


  const form = document.getElementById('createProductForm');
  const addVariantBtn = document.getElementById('addVariantBtn');
  const container = document.getElementById('variantsContainer');
  const tpl = document.getElementById('variantTpl');

  if (!form || !addVariantBtn || !container || !tpl) {
    console.error('Required elements missing on create product page');
    return;
  }

  /* ===============================
     SAFE BOOTSTRAP MODAL INIT
  =============================== */
  const cropperModalEl = document.getElementById('cropperModal');
  const cropperImage = document.getElementById('cropperImage');
  const applyCropBtn = document.getElementById('applyCropBtn');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const rotateLeftBtn = document.getElementById('rotateLeft');
const rotateRightBtn = document.getElementById('rotateRight');

if (zoomInBtn) zoomInBtn.onclick = () => cropper && cropper.zoom(0.1);
if (zoomOutBtn) zoomOutBtn.onclick = () => cropper && cropper.zoom(-0.1);

if (rotateLeftBtn) rotateLeftBtn.onclick = () => cropper && cropper.rotate(-90);
if (rotateRightBtn) rotateRightBtn.onclick = () => cropper && cropper.rotate(90);

  let cropperModal = null;
  if (cropperModalEl instanceof HTMLElement) {
    cropperModal = bootstrap.Modal.getOrCreateInstance(cropperModalEl);
  }

  let cropper = null;
  let currentVariantIdx = null;

  if (cropperModalEl && cropperImage) {
    cropperModalEl.addEventListener('shown.bs.modal', () => {
     cropper = new Cropper(cropperImage, {
  aspectRatio: 1,
  viewMode: 1,
  dragMode: 'move',
  autoCropArea: 0.9,
  responsive: true,
  background: false,
  guides: true,
  center: true,
  highlight: false
});

    });

    cropperModalEl.addEventListener('hidden.bs.modal', () => {
      if (cropper) {
        cropper.destroy();
        cropper = null;
      }
    });
  }

  /* ===============================
     VARIANT STATE
  =============================== */
  let variantIndex = 0;
  const variantImages = {}; // { idx: [Blob, Blob, Blob] }

  /* ===============================
     ADD VARIANT
  =============================== */
  addVariantBtn.addEventListener('click', () => {
    const clone = tpl.content.cloneNode(true);
    const row = clone.querySelector('.variant-row');
    const idx = variantIndex++;

    row.dataset.idx = idx;
    variantImages[idx] = [];

    row.querySelector('.variant-color').name = `variants[${idx}][color]`;
    row.querySelector('.variant-stock').name = `variants[${idx}][stock]`;
    row.querySelector('.variant-price').name = `variants[${idx}][price]`;

    const imageInput = row.querySelector('.variant-image');
    const preview = row.querySelector('.variant-image-preview');

    imageInput.addEventListener('change', () => {
      const file = imageInput.files[0];
      if (!file || !cropperModal) return;

      currentVariantIdx = idx;
      cropperImage.src = URL.createObjectURL(file);
      cropperModal.show();

      // reset input so same file can be selected again
      imageInput.value = '';
    });

    row.querySelector('.removeVariantBtn').addEventListener('click', () => {
      delete variantImages[idx];
      row.remove();
    });

    container.appendChild(row);
  });

  /* ===============================
     APPLY CROP
  =============================== */
  if (applyCropBtn) {
    applyCropBtn.addEventListener('click', () => {
      if (!cropper || currentVariantIdx === null) return;

      cropper.getCroppedCanvas({
        width: 800,
        height: 800,
        imageSmoothingQuality: 'high'
      }).toBlob(blob => {
        variantImages[currentVariantIdx].push(blob);

        const row = document.querySelector(
          `.variant-row[data-idx="${currentVariantIdx}"]`
        );
        if (!row) return;

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
        remove.innerHTML = '×';
        remove.style.cssText = `
          position:absolute;
          top:-6px;
          right:-6px;
          background:#dc3545;
          color:#fff;
          border-radius:50%;
          padding:0 6px;
          font-size:12px;
          cursor:pointer;
        `;

        remove.onclick = () => {
          const arr = variantImages[currentVariantIdx];
          const i = arr.indexOf(blob);
          if (i > -1) arr.splice(i, 1);
          wrap.remove();
        };

        wrap.appendChild(img);
        wrap.appendChild(remove);
        preview.appendChild(wrap);

        cropperModal.hide();
      }, 'image/jpeg', 0.9);
    });
  }

  /* ===============================
     SUBMIT FORM
  =============================== */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fd = new FormData(form);
      if (Object.keys(variantImages).length === 0) {
    showToast('At least one variant is required', 'danger');
    return;
  }

    for (const idx in variantImages) {
      if (variantImages[idx].length < 3) {
        showToast(`Variant ${Number(idx) + 1} needs at least 3 images`, 'danger');
        return;
      }

      variantImages[idx].forEach(blob => {
        fd.append(`variants[${idx}][image][]`, blob, 'variant.jpg');
      });
    }
      setLoading(true);

try {
  const res = await fetch('/admin/product', {
    method: 'POST',
    body: fd
  });

  const data = await res.json();
  setLoading(false); // ✅ IMPORTANT

  if (data.success) {
    showToast('Product created successfully', 'success');

    setTimeout(() => {
      window.location.href = '/admin/product';
    }, 1500);
  } else {
    if (data.errors) {
      showBackendErrorsAsToast(data.errors);
    } else {
      showToast(data.message || 'Failed to create product', 'danger');
    }
  }
} catch (err) {
  console.error(err);
  setLoading(false); // ✅ IMPORTANT
  showToast('Server error while creating product', 'danger');
}

  });
});
function showBackendErrorsAsToast(errors) {
  if (!errors) return;

  // Product-level errors
  if (errors.name) {
    showToast(errors.name, 'danger');
    return;
  }

  if (errors.category) {
    showToast(errors.category, 'danger');
    return;
  }

  // Variant form-level error
  if (errors.variants?._form) {
    showToast(errors.variants._form, 'danger');
    return;
  }

  // Variant field errors
  if (errors.variants) {
    for (const idx in errors.variants) {
      const vErr = errors.variants[idx];

      if (vErr.color) {
        showToast(`Variant ${Number(idx) + 1}: ${vErr.color}`, 'danger');
        return;
      }
      if (vErr.stock) {
        showToast(`Variant ${Number(idx) + 1}: ${vErr.stock}`, 'danger');
        return;
      }
      if (vErr.price) {
        showToast(`Variant ${Number(idx) + 1}: ${vErr.price}`, 'danger');
        return;
      }
      if (vErr.images) {
        showToast(`Variant ${Number(idx) + 1}: ${vErr.images}`, 'danger');
        return;
      }
    }
  }
}
