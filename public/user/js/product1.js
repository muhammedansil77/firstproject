(function () {
  // Read server-provided bootstrap object
  const BOOT = (typeof window !== 'undefined' && window.PRODUCT_PAGE) ? window.PRODUCT_PAGE : {};
  const PRODUCT_ID = BOOT.productId || null;
  const AVAILABILITY_URL = BOOT.availabilityUrl || null;
  const IS_UNAVAILABLE = !!BOOT.isUnavailable;

  let selectedVariantId = null;

  // if server said product is unavailable, redirect
  if (IS_UNAVAILABLE) {
    setTimeout(() => { window.location.href = (BOOT.redirectTo || '/user/shop'); }, 200);
    return;
  }

  // Thumbnail swap
  document.querySelectorAll('.thumb').forEach(btn => {
    btn.addEventListener('click', function () {
      const img = this.querySelector('img');
      if (!img) return;
      const src = img.getAttribute('src');
      const main = document.getElementById('main-product-image');
      if (main && src) main.setAttribute('src', src);
      if (main) {
        main.classList.add('scale-95');
        setTimeout(() => main.classList.remove('scale-95'), 300);
      }
    });
  });

  // Variant selection
  const variantBtns = document.querySelectorAll('.variant-btn');
  const mainImage = document.getElementById('main-product-image');
  const displayPrice = document.getElementById('display-price');

  // Find the initially selected variant (server-side selection)
  let initialSelected = document.querySelector('.variant-btn.selected');
  
  if (initialSelected) {
    selectedVariantId = initialSelected.getAttribute('data-variant-id');
  } else if (variantBtns.length > 0) {
    // If no variant is pre-selected, select the first one
    variantBtns[0].classList.add('selected');
    selectedVariantId = variantBtns[0].getAttribute('data-variant-id');
  }

variantBtns.forEach(btn => {
  btn.addEventListener('click', function() {
    // ... existing code (remove selected, add selected, etc.)

    // Get ALL images for this variant from data attribute
    const variantImagesJson = this.getAttribute('data-variant-images');
    let variantImages = [];

    try {
      variantImages = JSON.parse(variantImagesJson || '[]');
    } catch (e) {
      console.warn('Failed to parse variant images');
    }

    // Fallback: use product default images if variant has none
    if (!variantImages.length) {
      const defaultImgs = Array.from(document.querySelectorAll('#thumbnailsGrid .thumb-img'))
        .map(img => img.src);
      variantImages = defaultImgs.length ? defaultImgs : [];
    }

    // === UPDATE THUMBNAILS GRID ===
    const thumbnailsGrid = document.getElementById('thumbnailsGrid');

    if (thumbnailsGrid && variantImages.length > 0) {
      // Clear existing thumbnails
      thumbnailsGrid.innerHTML = '';

      // Limit to 12 thumbnails
      variantImages.slice(0, 12).forEach((imgSrc, idx) => {
        if (!imgSrc) return;

        const thumbBtn = document.createElement('button');
        thumbBtn.type = 'button';
        thumbBtn.className = 'thumb group relative w-full h-24 rounded-xl overflow-hidden border-2 border-[#2a2a2a] hover:border-[#d4af37] bg-[#0b0b0b] transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-[#d4af37]/20 thumb-btn';
        thumbBtn.setAttribute('data-thumb-index', idx);
        thumbBtn.setAttribute('aria-label', `Thumbnail ${idx + 1}`);

        thumbBtn.innerHTML = `
          <img src="${imgSrc}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 thumb-img" />
          <div class="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        `;

        // Click to change main image
        thumbBtn.addEventListener('click', function () {
          if (mainImage) {
            mainImage.setAttribute('src', imgSrc);
            mainImage.classList.add('scale-95');
            setTimeout(() => mainImage.classList.remove('scale-95'), 300);
          }
        });

        thumbnailsGrid.appendChild(thumbBtn);
      });
    }

    // Also update main image to first of new variant
    if (mainImage && variantImages[0]) {
      mainImage.setAttribute('src', variantImages[0]);
      mainImage.classList.add('scale-95');
      setTimeout(() => mainImage.classList.remove('scale-95'), 300);
    }

    // Update price (existing)
    if (displayPrice && variantPrice) {
      const priceNum = Number(variantPrice);
      displayPrice.textContent = '₹' + (isNaN(priceNum) ? '—' : priceNum.toLocaleString());
    }

    // Update URL
    const url = new URL(window.location);
    url.searchParams.set('variant', selectedVariantId);
    window.history.replaceState({}, '', url);
  });
});

  const addBtn = document.getElementById('add-to-cart');
  const buyBtn = document.getElementById('buy-now');
  const errorEl = document.getElementById('error-msg');

  function showError(msg) {
    if (!errorEl) {
      alert(msg);
      return;
    }
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
    errorEl.classList.add('block');
    
    // Auto-hide after 5 seconds
    setTimeout(() => hideError(), 5000);
  }

  function hideError() {
    if (!errorEl) return;
    errorEl.classList.add('hidden');
    errorEl.textContent = '';
  }

  async function checkAvailability() {
    if (!PRODUCT_ID || !AVAILABILITY_URL) return { ok: false, reason: 'invalid' };
    try {
      const res = await fetch(AVAILABILITY_URL, { credentials: 'same-origin' });
      if (res.status === 404 || res.status === 410) return { ok: false, reason: 'unavailable' };
      if (!res.ok) {
        const j = await res.json().catch(()=>({}));
        return { ok: false, reason: j && j.reason ? j.reason : 'error' };
      }
      return await res.json();
    } catch (e) {
      console.error('Availability check error:', e);
      return { ok: false, reason: 'network' };
    }
  }

  async function actionAddToCart() {
    hideError();
    
    if (!selectedVariantId) {
      return showError('Please select a color variant');
    }
    
    const avail = await checkAvailability();
    if (!avail.ok) {
      if (avail.reason === 'unavailable') return window.location.href = (BOOT.redirectTo || '/user/shop');
      return showError('Product unavailable or could not be checked');
    }
    if ((avail.stock || 0) <= 0) return showError('Product is sold out');

    try {
      const payload = { 
        productId: PRODUCT_ID, 
        variantId: selectedVariantId,
        qty: 1 
      };
      
      console.log('Adding to cart:', payload);
      
      const r = await fetch('/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
      
      if (r.status === 401) return window.location.href = '/auth/login?next=' + encodeURIComponent(location.pathname);
      if (!r.ok) {
        const j = await r.json().catch(()=>({}));
        return showError(j && j.message ? j.message : 'Could not add to cart');
      }
      
      // Success - redirect to cart
      window.location.href = '/cart';
    } catch (e) {
      console.error('Add to cart error:', e);
      showError('Network error. Please try again.');
    }
  }

  async function actionBuyNow() {
    hideError();
    
    if (!selectedVariantId) {
      return showError('Please select a color variant');
    }
    
    const avail = await checkAvailability();
    if (!avail.ok) {
      if (avail.reason === 'unavailable') return window.location.href = (BOOT.redirectTo || '/user/shop');
      return showError('Product unavailable or could not be checked');
    }
    if ((avail.stock || 0) <= 0) return showError('Product is sold out');

    let url = '/checkout?product=' + encodeURIComponent(PRODUCT_ID) + '&qty=1';
    if (selectedVariantId) url += '&variant=' + encodeURIComponent(selectedVariantId);
    
    console.log('Buy now redirect:', url);
    window.location.href = url;
  }

  if (addBtn) addBtn.addEventListener('click', e => { e.preventDefault(); actionAddToCart(); });
  if (buyBtn) buyBtn.addEventListener('click', e => { e.preventDefault(); actionBuyNow(); });

})();