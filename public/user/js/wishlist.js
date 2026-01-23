

async function removeFromWishlist(itemId, button) {
  try {
    const card = button.closest('.group');
    
    card.style.opacity = '0.5';
    card.style.pointerEvents = 'none';
    
    const response = await fetch(`/user/api/wishlist/remove/${itemId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    const result = await response.json();
    
    if (response.ok) {
      card.style.transition = 'all 0.5s ease';
      card.style.transform = 'translateX(-100px)';
      card.style.opacity = '0';
      
      setTimeout(() => {
        card.remove();
        showNotification('Item removed from wishlist', 'success');
        if (result.remainingCount !== undefined) {
          updateWishlistCount(result.remainingCount);
        } else {
          updateWishlistCount();
        }
      }, 500);
    } else {
      throw new Error(result.message || 'Failed to remove item');
    }
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    card.style.opacity = '1';
    card.style.pointerEvents = 'auto';
    showNotification(error.message, 'error');
  }
}

async function moveToCart(itemId, button) {
  try {
    const card = button.closest('.group');
    const originalContent = button.innerHTML;
    
    button.innerHTML = `
      <div class="flex items-center justify-center gap-2">
        <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        <span>Adding...</span>
      </div>
    `;
    button.disabled = true;
    button.classList.add('opacity-75');
    
    const response = await fetch('/user/api/wishlist/move-to-cart', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ itemId: itemId })
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      button.innerHTML = `
        <div class="flex items-center justify-center gap-2">
          <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          <span>Added!</span>
        </div>
      `;
      button.classList.remove('bg-gradient-to-r', 'from-blue-600', 'to-purple-600');
      button.classList.add('bg-gradient-to-r', 'from-green-500', 'to-teal-600');
      
      setTimeout(() => {
        card.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        card.style.transform = 'scale(0.95)';
        card.style.opacity = '0';
        
        setTimeout(() => {
          card.remove();
          showNotification(result.message || 'Added to cart!', 'success');
          updateCartCount(result.cartCount);
          updateWishlistCount(result.wishlistCount);
        }, 500);
      }, 1000);
      
    }else if (response.ok && result.alreadyInCart) {
  showNotification(result.message, 'info');

  button.innerHTML = `
    <div class="flex items-center justify-center gap-2">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4"/>
      </svg>
      <span>Already in Cart</span>
    </div>
  `;
  button.disabled = true;
  button.style.opacity = '0.6';
}
    
    else {
      throw new Error(result.message || 'Failed to add to cart');
    }
    
  } catch (error) {
    console.error('Error moving to cart:', error);
    
    button.innerHTML = `
      <div class="flex items-center justify-center gap-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
        </svg>
        <span>Add to Cart</span>
      </div>
    `;
    button.disabled = false;
    button.classList.remove('opacity-75');
    
    showNotification(error.message, 'error');
  }
}

async function moveAllToCart() {
  try {
    const confirmMove = confirm('Add all available items to cart?');
    if (!confirmMove) return;
    
    const button = document.querySelector('button[onclick*="moveAllToCart"]');
    if (button) {
      const originalText = button.innerHTML;
      button.innerHTML = `
        <div class="flex items-center justify-center gap-2">
          <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          <span>Adding All...</span>
        </div>
      `;
      button.disabled = true;
    }
    
    const response = await fetch('/user/api/wishlist/move-all-to-cart', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      if (button) {
        button.innerHTML = `
          <div class="flex items-center justify-center gap-2">
            <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            <span>Added ${result.added} items!</span>
          </div>
        `;
        button.classList.remove('bg-gradient-to-r', 'from-emerald-500', 'to-teal-600');
        button.classList.add('bg-gradient-to-r', 'from-green-500', 'to-teal-600');
      }
      
      showNotification(`Successfully added ${result.added} item(s) to cart!`, 'success');
      
      updateCartCount(result.cartCount);
      updateWishlistCount(result.wishlistCount);
      
      if (result.added > 0) {
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
      
    } else {
      throw new Error(result.message || 'Failed to add items to cart');
    }
    
  } catch (error) {
    console.error('Error moving all to cart:', error);
    
    const button = document.querySelector('button[onclick*="moveAllToCart"]');
    if (button) {
      button.innerHTML = `
        <svg class="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
        </svg>
        Add All to Cart
      `;
      button.disabled = false;
    }
    
    showNotification(error.message, 'error');
  }
}

function updateCartCount(count) {
  const countElements = document.querySelectorAll('.cart-count');
  countElements.forEach(element => {
    element.textContent = count || 0;
    element.classList.add('animate-ping');
    setTimeout(() => {
      element.classList.remove('animate-ping');
    }, 1000);
  });
}

function updateWishlistCount(count) {
  const countElement = document.querySelector('.wishlist-count');
  if (countElement) {
    if (count !== undefined) {
      countElement.textContent = count;
    } else {
      fetch('/user/api/wishlist/count')
        .then(res => res.json())
        .then(data => {
          if (data.count !== undefined) {
            countElement.textContent = data.count;
          }
        })
        .catch(console.error);
    }
    countElement.classList.add('animate-ping');
    setTimeout(() => {
      countElement.classList.remove('animate-ping');
    }, 1000);
  }
}

function showNotification(message, type = 'info') {
  const existingNotifications = document.querySelectorAll('.notification-toast');
  existingNotifications.forEach(notif => notif.remove());
  
  const notification = document.createElement('div');
  notification.className = `notification-toast fixed top-6 right-6 z-50 px-6 py-4 rounded-xl shadow-2xl transform transition-all duration-500 translate-x-0 ${
    type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 
    type === 'error' ? 'bg-gradient-to-r from-red-500 to-rose-600' : 
    'bg-gradient-to-r from-blue-500 to-indigo-600'
  } text-white border border-white/10 backdrop-blur-sm`;
  
  let icon = '';
  if (type === 'success') {
    icon = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
  } else if (type === 'error') {
    icon = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
  } else {
    icon = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
  }
  
  notification.innerHTML = `
    <div class="flex items-center gap-3">
      ${icon}
      <span class="font-medium">${message}</span>
      <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white/70 hover:text-white transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

document.addEventListener('DOMContentLoaded', function() {
  console.log('Wishlist page loaded');
  
  const addToCartButtons = document.querySelectorAll('button[onclick*="moveToCart"]');
  addToCartButtons.forEach(button => {
    button.addEventListener('mouseenter', function() {
      this.classList.add('shadow-lg');
    });
    button.addEventListener('mouseleave', function() {
      this.classList.remove('shadow-lg');
    });
  });
});