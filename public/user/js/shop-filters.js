(function () {
  
  function getCurrentCategory() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('category');
  }

  function getSelectCategory() {
    const sel = document.getElementById('category-select');
    if (!sel) return 'all';
    const v = String(sel.value || '').trim();
    return v === 'all' ? null : v;
  }

  function setParamOrDelete(url, key, value) {
    if (value === undefined || value === null || String(value).trim() === '') {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, String(value).trim());
    }
  }

  function navigate(url) {
    console.log('[shop-filters] navigate ->', url.pathname + (url.search || ''));
    window.location.href = url.href;
  }

  window.applyFilter = function () {
    const url = new URL(window.location.href);
    
    url.searchParams.delete('page');
    
    const category = getSelectCategory();
    const sortBy = document.getElementById('sort-by')?.value || '';
    const minPrice = document.getElementById('price-from')?.value;
    const maxPrice = document.getElementById('price-to')?.value;
    const searchField = document.getElementById('search-field')?.value?.trim();
    
    setParamOrDelete(url, 'category', category);
    setParamOrDelete(url, 'sort', sortBy);
    setParamOrDelete(url, 'min', minPrice);
    setParamOrDelete(url, 'max', maxPrice);
    setParamOrDelete(url, 'search', searchField);
    
    navigate(url);
  };

  window.setPrice = function (min, max) {
    const url = new URL(window.location.href);
    url.searchParams.delete('page');
    
    setParamOrDelete(url, 'min', min);
    setParamOrDelete(url, 'max', max);
    
    navigate(url);
  };

  window.applySearch = function () {
    const url = new URL(window.location.href);
    url.searchParams.delete('page');
    
    const q = document.getElementById('search-field')?.value?.trim();
    setParamOrDelete(url, 'search', q);
    
    navigate(url);
  };

  window.clearAllFilters = function () {
    const url = new URL(window.location.href);
    window.location.href = url.pathname;
  };

  window.removePriceFilter = function () {
    const url = new URL(window.location.href);
    url.searchParams.delete('page');
    url.searchParams.delete('min');
    url.searchParams.delete('max');
    navigate(url);
  };

  window.removeFilter = function (name) {
    const url = new URL(window.location.href);
    url.searchParams.delete('page');
    url.searchParams.delete(name);
    navigate(url);
  };

  window.changePage = function (page) {
    const url = new URL(window.location.href);
    if (page && Number(page) > 0) {
      url.searchParams.set('page', String(page));
    }
    navigate(url);
  };


  

  window.toggleWishlist = async function(productId, variantId, button) {
    try {
      console.log(' toggleWishlist called:', { productId, variantId });
      

      if (!variantId || variantId === 'null' || variantId === '') {
        alert('Please select a variant first');
        return;
      }
      
     
      const isCurrentlyInWishlist = button.classList.contains('bg-red-500/20');
      console.log('Current state:', isCurrentlyInWishlist ? 'IN wishlist' : 'NOT in wishlist');
    
      const originalHTML = button.innerHTML;
      button.innerHTML = `
        <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="text-xs">Processing...</span>
      `;
      button.disabled = true;
      
     
      const endpoint = isCurrentlyInWishlist 
        ? `/user/api/wishlist/remove/${productId}`
        : `/user/api/wishlist/add`;
      
      const method = isCurrentlyInWishlist ? 'DELETE' : 'POST';
      
      console.log(' API call:', method, endpoint);
      
  
      const response = await fetch(endpoint, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          productId, 
          variantId 
        })
      });
    
if (response.status === 401) {
  showNotification('Please login to use wishlist ', 'error');


  setTimeout(() => {
    window.location.href = '/user/login';
  }, 1500);

  return;
}

      
      console.log('Response status:', response.status);
      
    
      const result = await response.json();
      console.log('📦 Response data:', result);
      
      if (!response.ok) {
        throw new Error(result.message || 'Request failed');
      }
      
      
      if (isCurrentlyInWishlist) {
       
        button.classList.remove('bg-red-500/20', 'text-red-400', 'border-red-500/40');
        button.classList.add('bg-gray-900/50', 'text-gray-300', 'border-gray-700');
        button.innerHTML = `
          <svg class="w-4 h-4 text-gray-400 group-hover/wishlist:text-red-400 group-hover/wishlist:scale-110 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <span class="text-xs font-medium text-gray-400 group-hover/wishlist:text-red-400">Save</span>
        `;
        button.title = "Add to wishlist";
      } else {
      
        button.classList.remove('bg-gray-900/50', 'text-gray-300', 'border-gray-700');
        button.classList.add('bg-red-500/20', 'text-red-400', 'border-red-500/40');
        button.innerHTML = `
          <svg class="w-4 h-4 text-red-500 group-hover/wishlist:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <span class="text-xs font-medium">Saved</span>
        `;
        button.title = "Remove from wishlist";
      }
      
      button.disabled = false;
      
    
      showNotification(
        result.message || (isCurrentlyInWishlist ? 'Removed from wishlist' : 'Added to wishlist!'), 
        'success'
      );
      
    } catch (error) {
      console.error(' toggleWishlist error:', error);
      
    
      button.innerHTML = originalHTML;
      button.disabled = false;
      
     
      showNotification(error.message || 'Failed to update wishlist', 'error');
    }
  };
  

  window.showNotification = function(message, type = 'info') {
  
    const existing = document.querySelector('.notification-toast');
    if (existing) existing.remove();
    
  
    const notification = document.createElement('div');
    notification.className = `notification-toast fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full ${
      type === 'success' ? 'bg-green-600/90 backdrop-blur-sm' : 
      type === 'error' ? 'bg-red-600/90 backdrop-blur-sm' : 
      'bg-blue-600/90 backdrop-blur-sm'
    } text-white border border-white/10`;
    
 
    let icon = '';
    if (type === 'success') {
      icon = '<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
    } else if (type === 'error') {
      icon = '<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
    } else {
      icon = '<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
    }
    
    notification.innerHTML = `
      <div class="flex items-center">
        ${icon}
        <span>${message}</span>
        <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white/70 hover:text-white">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    `;
    
    
    document.body.appendChild(notification);
    
 
    setTimeout(() => {
      notification.classList.remove('translate-x-full');
    }, 10);
    
  
    setTimeout(() => {
      notification.classList.add('translate-x-full');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  };
  

  window.updateWishlistCount = function() {
    const countElement = document.querySelector('.wishlist-count');
    if (countElement) {
      fetch('/user/api/wishlist/count')
        .then(res => res.json())
        .then(data => {
          if (data.count !== undefined) {
            countElement.textContent = data.count;
          }
        })
        .catch(console.error);
    }
  };

  document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    
    const categorySelect = document.getElementById('category-select');
    if (categorySelect) {
      const currentCategory = urlParams.get('category');
      if (currentCategory) {
        categorySelect.value = currentCategory;
      } else {
        categorySelect.value = 'all';
      }
    }
   
    const sortSelect = document.getElementById('sort-by');
    if (sortSelect) {
      const currentSort = urlParams.get('sort');
      if (currentSort) {
        sortSelect.value = currentSort;
      }
    }
    
    const minInput = document.getElementById('price-from');
    const maxInput = document.getElementById('price-to');
    if (minInput) minInput.value = urlParams.get('min') || '';
    if (maxInput) maxInput.value = urlParams.get('max') || '';
    
    const searchInput = document.getElementById('search-field');
    if (searchInput) searchInput.value = urlParams.get('search') || '';
    
  
    console.log('toggleWishlist function loaded:', typeof window.toggleWishlist === 'function');
  });

})();


const style = document.createElement('style');
style.textContent = `
  @keyframes heartBeat {
    0% { transform: scale(1); }
    25% { transform: scale(1.1); }
    50% { transform: scale(0.95); }
    100% { transform: scale(1); }
  }
  
  .animate-spin {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const toastType = params.get('toast');

  if (toastType !== 'product_blocked') return;

  const toast = document.getElementById('toast');
  const msg = document.getElementById('toast-msg');

  if (!toast || !msg) return;

  msg.textContent = "🚫 This product is blocked by admin";
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);

  // ✅ Clean URL after showing toast
  params.delete('toast');
  const newUrl =
    window.location.pathname +
    (params.toString() ? '?' + params.toString() : '');
  window.history.replaceState({}, '', newUrl);
});
