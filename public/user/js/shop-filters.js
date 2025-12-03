// public/user/js/shop-filters.js
(function () {
  // Get current category from URL
  function getCurrentCategory() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('category');
  }

  // Get category from select
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

  // MAIN FILTER FUNCTION
  window.applyFilter = function () {
    const url = new URL(window.location.href);
    
    // Clear page when applying new filters
    url.searchParams.delete('page');
    
    // Get values
    const category = getSelectCategory();
    const sortBy = document.getElementById('sort-by')?.value || '';
    const minPrice = document.getElementById('price-from')?.value;
    const maxPrice = document.getElementById('price-to')?.value;
    const searchField = document.getElementById('search-field')?.value?.trim();
    
    // Apply filters
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
    // Keep only the base URL
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

  // Initialize page - set selected values from URL
  document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Set category select
    const categorySelect = document.getElementById('category-select');
    if (categorySelect) {
      const currentCategory = urlParams.get('category');
      if (currentCategory) {
        categorySelect.value = currentCategory;
      } else {
        categorySelect.value = 'all';
      }
    }
    
    // Set sort select
    const sortSelect = document.getElementById('sort-by');
    if (sortSelect) {
      const currentSort = urlParams.get('sort');
      if (currentSort) {
        sortSelect.value = currentSort;
      }
    }
    
    // Set price inputs
    const minInput = document.getElementById('price-from');
    const maxInput = document.getElementById('price-to');
    if (minInput) minInput.value = urlParams.get('min') || '';
    if (maxInput) maxInput.value = urlParams.get('max') || '';
    
    // Set search input
    const searchInput = document.getElementById('search-field');
    if (searchInput) searchInput.value = urlParams.get('search') || '';
  });

})();