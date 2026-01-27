
'use strict';

console.log(" product1.js loaded");


window.PRODUCT_DATA = window.PRODUCT_DATA || {};


let selectedVariantId = window.PRODUCT_DATA.selectedVariantId || null;


function showError(msg) {
  console.error("Cart Error:", msg);
  const errorEl = document.getElementById('error-msg');
  if (!errorEl) {
    alert(msg);
    return;
  }
  errorEl.textContent = msg;
  errorEl.classList.remove('hidden');
  setTimeout(() => errorEl.classList.add('hidden'), 4000);
}


function updateStockDisplay(stock, stockBadge) {
  if (!stockBadge) return;
  
  const stockNum = parseInt(stock) || 0;
  

  stockBadge.className = 'px-3 py-1.5 rounded-full text-xs font-semibold border';
  
 
  if (stockNum <= 0) {
    stockBadge.classList.add('bg-gray-700/50', 'text-gray-300', 'border-gray-600');
    stockBadge.textContent = 'Out of Stock';
  } else if (stockNum < 50) {
    stockBadge.classList.add('bg-yellow-600/20', 'text-yellow-400', 'border-yellow-600/30', 'animate-pulse');
    stockBadge.textContent = `Only ${stockNum} left`;
  } else {
    stockBadge.classList.add('bg-green-600/20', 'text-green-400', 'border-green-600/30');
    stockBadge.textContent = `In Stock (${stockNum})`;
  }
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const msg = document.getElementById('toast-msg');

  if (!toast || !msg) return alert(message);

  msg.textContent = message;

  toast.classList.remove('hidden');
  toast.classList.remove('opacity-0', 'translate-y-2');

  if (type === 'error') {
    toast.classList.add('border-red-500/40', 'text-red-400');
  } else {
    toast.classList.add('border-[#d4af37]/40', 'text-[#d4af37]');
  }

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 2500);
}


document.addEventListener('DOMContentLoaded', () => {


  const variantBtns = document.querySelectorAll('.variant-btn');
  const mainImage = document.getElementById('main-product-image');
  const displayPrice = document.getElementById('display-price');
  const addBtn = document.getElementById('add-to-cart');
  const buyBtn = document.getElementById('buy-now');
  const stockBadge = document.getElementById('variant-stock-badge');




  const initiallySelectedBtn = document.querySelector('.variant-btn.selected');

  if (initiallySelectedBtn) {
    selectedVariantId = initiallySelectedBtn.dataset.variantId;

    const initialStock = initiallySelectedBtn.dataset.variantStock;
    if (stockBadge && initialStock !== undefined) {
      updateStockDisplay(initialStock, stockBadge);
    }
  } else if (variantBtns.length > 0) {
    variantBtns[0].classList.add('selected');
    selectedVariantId = variantBtns[0].dataset.variantId;
 
    const initialStock = variantBtns[0].dataset.variantStock;
    if (stockBadge && initialStock !== undefined) {
      updateStockDisplay(initialStock, stockBadge);
    }
  }


  document.querySelectorAll('.thumb').forEach(btn => {
    btn.addEventListener('click', () => {
      const img = btn.querySelector('img');
      if (img && mainImage) {
        mainImage.src = img.src;
        mainImage.classList.add('scale-95');
        setTimeout(() => mainImage.classList.remove('scale-95'), 300);
      }
    });
  });

 
  variantBtns.forEach(btn => {
    btn.addEventListener('click', () => {

      selectedVariantId = btn.dataset.variantId;

  
      variantBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');

      if (displayPrice && btn.dataset.variantPrice) {
        const price = Number(btn.dataset.variantPrice);
        displayPrice.textContent =
          '₹' + (isNaN(price) ? '—' : price.toLocaleString('en-IN'));
      }

 
      if (stockBadge && btn.dataset.variantStock !== undefined) {
        const stock = btn.dataset.variantStock;
        updateStockDisplay(stock, stockBadge);
      }


      try {
        const images = JSON.parse(btn.dataset.variantImages || '[]');
        if (images.length && mainImage) {
          mainImage.src = images[0];
          
       
          const thumbnailGrid = document.getElementById('thumbnailsGrid');
          if (thumbnailGrid) {
            const allThumbBtns = thumbnailGrid.querySelectorAll('.thumb-btn');
            allThumbBtns.forEach((thumbBtn, index) => {
              const thumbImg = thumbBtn.querySelector('.thumb-img');
              if (thumbImg && images[index]) {
                thumbImg.src = images[index];
              }
            });
          }
        }
      } catch (e) {
        console.warn("Variant image parse failed:", e);
      }

      
      const url = new URL(window.location.href);
      url.searchParams.set('variant', selectedVariantId);
      window.history.replaceState({}, '', url);
    });
  });
function setButtonLoading(btn, text) {
  if (!btn) return;

  btn.dataset.originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `
    <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10"
              stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
    </svg>
    <span>${text}</span>
  `;
  btn.classList.add('flex', 'items-center', 'justify-center', 'gap-2');
}

function resetButton(btn) {
  if (!btn) return;
  btn.disabled = false;
  btn.innerHTML = btn.dataset.originalHtml;
}


async function actionAddToCart(redirect = false) {
  console.log("🟢 Add to Cart clicked");

  const productId = window.PRODUCT_DATA.productId;
  const btn = redirect ? buyBtn : addBtn;

  if (!productId) {
    showError("Product data not loaded. Refresh page.");
    return;
  }

  if (!selectedVariantId) {
    showError("Please select a variant");
    return;
  }

  // Stock check
  const selectedBtn = document.querySelector('.variant-btn.selected');
  if (selectedBtn) {
    const stock = parseInt(selectedBtn.dataset.variantStock) || 0;
    if (stock <= 0) {
      showError("This variant is out of stock");
      return;
    }
  }

  // 🔥 SET LOADING STATE
  setButtonLoading(btn, redirect ? 'Processing...' : 'Adding...');

  try {
    const res = await axios.post(
      '/user/cart/add',
      {
        productId,
        variantId: selectedVariantId,
        quantity: 1
      },
      { withCredentials: true }
    );

    console.log("🛒 Cart response:", res.data);

    if (!res.data.ok) {
      showError(res.data.message || "Unable to add to cart");
      resetButton(btn);
      return;
    }

    // ✅ SUCCESS → REDIRECT
    window.location.href = redirect ? '/user/checkout' : '/user/cart';

  } catch (err) {
    console.error("Axios error:", err);

    resetButton(btn);

 if (err.response?.status === 401) {
  // 🔔 Just show toast
  if (typeof showNotification === 'function') {
    showNotification('Please login to add items to your cart 🛒', 'error');
  } else {
    showToast('Please login to add items to your cart 🛒', 'error');
  }

  resetButton(btn); // re-enable button
  return; // ⛔ stay on same page
}

 else {
      showError(err.response?.data?.message || "Server error");
    }
  }
}



  async function actionBuyNow() {
    console.log(" Buy Now clicked");
    await actionAddToCart(true);
  }


  if (addBtn) {
    addBtn.addEventListener('click', e => {
      e.preventDefault();
      actionAddToCart(false);
    });
  }

  if (buyBtn) {
    buyBtn.addEventListener('click', e => {
      e.preventDefault();
      actionBuyNow();
    });
  }


  const urlParams = new URLSearchParams(window.location.search);
  const urlVariant = urlParams.get('variant');
  
  if (urlVariant && variantBtns.length > 0) {
   
    const matchingBtn = Array.from(variantBtns).find(
      btn => btn.dataset.variantId === urlVariant
    );
    
    if (matchingBtn && !matchingBtn.classList.contains('selected')) {

      matchingBtn.click();
    }
  }
   const wishlistBtn = document.getElementById('wishlist-btn');
const wishlistIcon = document.getElementById('wishlist-icon');

if (wishlistBtn) {
  wishlistBtn.addEventListener('click', async () => {
    const productId = wishlistBtn.dataset.productId;
    const variantId = selectedVariantId;

    try {
      const res = await axios.post('/user/api/wishlist/add', {
        productId,
        variantId
      });

      if (res.data.success) {
        wishlistBtn.style.background = 'rgba(212,175,55,0.25)';
        wishlistBtn.style.borderColor = '#d4af37';

        wishlistIcon.style.fill = '#d4af37';
        wishlistIcon.style.stroke = '#d4af37';

        showToast('Added to wishlist ');
      }
    } catch (err) {
      showToast('Failed to add wishlist', 'error');
    }
  });
}


 
  const mainImageWrapper = document.getElementById('main-image-wrapper');
  if (mainImageWrapper && mainImage) {
    mainImageWrapper.addEventListener('mouseenter', () => {
      mainImage.style.transform = 'scale(1.1)';
      mainImage.style.transition = 'transform 0.5s ease';
    });

    mainImageWrapper.addEventListener('mouseleave', () => {
      mainImage.style.transform = 'scale(1)';
    });

    
    mainImageWrapper.addEventListener('click', () => {
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4';
      modal.innerHTML = `
        <div class="relative max-w-4xl max-h-full">
          <img src="${mainImage.src}" alt="Enlarged view" class="max-w-full max-h-screen object-contain rounded-lg">
          <button class="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-70 transition">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      modal.querySelector('button').addEventListener('click', () => {
        document.body.removeChild(modal);
      });
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          document.body.removeChild(modal);
        }
      });
    });
  }

 
  const writeReviewBtn = document.getElementById('write-review-btn');
  if (writeReviewBtn) {
    writeReviewBtn.addEventListener('click', () => {
   
      axios.get('/user/auth/check', { withCredentials: true })
        .then(response => {
          if (response.data.loggedIn) {
       
            const reviewModal = document.createElement('div');
            reviewModal.className = 'fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4';
            reviewModal.innerHTML = `
              <div class="bg-gradient-to-br from-[#0b0b0b] to-[#151515] border border-[#2a2a2a] rounded-2xl p-8 max-w-md w-full">
                <h3 class="text-xl font-bold text-white mb-6">Write a Review</h3>
                <div class="mb-6">
                  <div class="flex items-center gap-1 mb-4">
                    ${[1, 2, 3, 4, 5].map(i => `
                      <button type="button" class="star-rating text-2xl text-gray-600 hover:text-yellow-400" data-rating="${i}">★</button>
                    `).join('')}
                  </div>
                  <textarea 
                    id="review-text" 
                    class="w-full h-32 bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-4 text-white resize-none focus:border-[#d4af37] focus:outline-none"
                    placeholder="Share your experience with this product..."
                  ></textarea>
                </div>
                <div class="flex gap-3">
                  <button id="submit-review" class="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b8941f] text-black font-semibold hover:shadow-xl hover:shadow-[#d4af37]/30">
                    Submit
                  </button>
                  <button id="cancel-review" class="px-6 py-3 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-800">
                    Cancel
                  </button>
                </div>
              </div>
            `;
            
            document.body.appendChild(reviewModal);
            
       
            let selectedRating = 0;
            reviewModal.querySelectorAll('.star-rating').forEach((star, index) => {
              star.addEventListener('click', () => {
                selectedRating = index + 1;
                reviewModal.querySelectorAll('.star-rating').forEach((s, i) => {
                  s.className = `star-rating text-2xl ${i < selectedRating ? 'text-yellow-400' : 'text-gray-600'}`;
                });
              });
            });
            
         
            reviewModal.querySelector('#cancel-review').addEventListener('click', () => {
              document.body.removeChild(reviewModal);
            });
            
           
            reviewModal.querySelector('#submit-review').addEventListener('click', () => {
              const reviewText = reviewModal.querySelector('#review-text').value.trim();
              if (selectedRating === 0) {
                alert('Please select a rating');
                return;
              }
              
              if (!reviewText) {
                alert('Please enter your review');
                return;
              }
              
             
              const productId = window.PRODUCT_DATA.productId;
              axios.post('/user/review/add', {
                productId,
                rating: selectedRating,
                comment: reviewText,
                variantId: selectedVariantId
              }, { withCredentials: true })
                .then(response => {
                  if (response.data.ok) {
                    alert('Review submitted successfully!');
                    document.body.removeChild(reviewModal);
                    location.reload();
                  } else {
                    alert(response.data.message || 'Failed to submit review');
                  }
                })
                .catch(error => {
                  console.error('Review submission error:', error);
                  alert('Failed to submit review. Please try again.');
                });
            });
            
      
            reviewModal.addEventListener('click', (e) => {
              if (e.target === reviewModal) {
                document.body.removeChild(reviewModal);
              }
            });
          } else {
           
            window.location.href = `/user/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
          }
        })
        .catch(error => {
          console.error('Auth check error:', error);
          window.location.href = `/user/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
        });
    });
  }

});


window.addEventListener('error', function(e) {
  console.error('Global error:', e.error);
});


function updateCartCount(count) {
  const cartCountEl = document.querySelector('.cart-count');
  if (cartCountEl) {
    cartCountEl.textContent = count;
    cartCountEl.classList.remove('hidden');
  }
}


if (typeof window.addEventListener === 'function') {
  document.addEventListener('cartUpdated', function(e) {
    if (e.detail && e.detail.count !== undefined) {
      updateCartCount(e.detail.count);
    }
  });
}
  