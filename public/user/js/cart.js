console.log("🔥 cart.js LOADED");
// ✅ GLOBAL TOAST (usable everywhere)
window.showNotification = function (message, type = 'info') {
  const toast = document.createElement('div');

  toast.className = `
    fixed top-6 right-6 z-50 px-5 py-3 rounded-lg shadow-xl
    ${type === 'error' ? 'bg-red-600' :
      type === 'warning' ? 'bg-yellow-600' :
      'bg-green-600'}
    text-white
  `;

  toast.innerHTML = `
    <div class="flex items-center gap-3">
      <span>${message}</span>
      <button onclick="this.parentElement.parentElement.remove()">✖</button>
    </div>
  `;

  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
};


/* ================= CLICK HANDLER ================= */
document.addEventListener('click', async (e) => {
  console.log("Click event on:", e.target);
  const MAX_QTY_PER_ITEM = 5;


  /* ---------- REMOVE ---------- */
  const removeBtn = e.target.closest('.remove-item');
if (removeBtn) {
  const cartItem = removeBtn.closest('.cart-item');
  if (!cartItem) return;

  const variantId = cartItem.dataset.variantId;

  const result = await Swal.fire({
    title: 'Remove item?',
    text: 'This product will be removed from your cart.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d4af37',
    cancelButtonColor: '#555',
    confirmButtonText: 'Yes, remove',
    cancelButtonText: 'Cancel',
    background: '#0f0f0f',
    color: '#fff'
  });

  if (!result.isConfirmed) return;

  await removeItem(cartItem, variantId);
  return;
}


  /* ---------- INC / DEC ---------- */
  const incBtn = e.target.closest('.qty-increase');
  const decBtn = e.target.closest('.qty-decrease');
  
  console.log("Inc button:", incBtn, "Dec button:", decBtn);
  
  if (incBtn || decBtn) {
    console.log("Quantity button clicked");
    const btn = incBtn || decBtn;
    const cartItem = btn.closest('.cart-item');
    if (!cartItem) {
      console.log("No cart item found");
      return;
    }

    const input = cartItem.querySelector('.qty-input');
    const variantId = cartItem.dataset.variantId;

    console.log("Variant ID:", variantId, "Current value:", input.value);

  
    const isOutOfStock = cartItem.hasAttribute('data-out-of-stock') || 
                         cartItem.querySelector('.qty-input:disabled');
    
    if (isOutOfStock) {
      console.log("Item is out of stock, ignoring click");
      return;
    }

    let qty = parseInt(input.value, 10);
   const stockMax = parseInt(input.max, 10) || MAX_QTY_PER_ITEM;
const max = Math.min(stockMax, MAX_QTY_PER_ITEM);


    console.log("Current qty:", qty, "Max:", max);
if (incBtn) {
  const maxAllowed = Math.min(stockMax, MAX_QTY_PER_ITEM);

  if (qty >= maxAllowed) {
    showNotification(
      `Maximum allowed quantity is ${maxAllowed}`,
      'warning'
    );
    return;
  }

  qty = qty + 1;
}


if (decBtn) {
  qty = Math.max(1, qty - 1);
}


    await updateQuantity(cartItem, variantId, qty);
  }
});

/* ================= UPDATE QTY ================= */
async function updateQuantity(cartItem, variantId, quantity) {
  console.log("🔄 Updating quantity for variant:", variantId, "to:", quantity);
  
  const input = cartItem.querySelector('.qty-input');
  const increaseBtn = cartItem.querySelector('.qty-increase');
  const decreaseBtn = cartItem.querySelector('.qty-decrease');
  
  // Disable buttons during update
  if (input) input.disabled = true;
  if (increaseBtn) increaseBtn.disabled = true;
  if (decreaseBtn) decreaseBtn.disabled = true;

  try {
    const res = await axios.post('/user/cart/update', {
      variantId,
      quantity
    }, { withCredentials: true });

    console.log("Update response:", res.data);

    if (!res.data.ok) {
      console.error("Update failed:", res.data.message);
      alert(res.data.message || "Update failed");
      return;
    }

    // Update UI
    if (input) {
      input.value = quantity;
      input.disabled = false;
    }

    // Enable/disable buttons based on new quantity
    if (decreaseBtn) {
      decreaseBtn.disabled = quantity <= 1;
    }
    
    if (increaseBtn) {
      const max = parseInt(input?.max, 10) || 99;
      increaseBtn.disabled = quantity >= max;
    }

    // Update item subtotal
    const subtotalEl = cartItem.querySelector('.item-subtotal');
    if (subtotalEl) {
      const unitPrice = Number(subtotalEl.dataset.unitPrice);
      const newSubtotal = unitPrice * quantity;
      subtotalEl.textContent = '₹' + newSubtotal.toLocaleString('en-IN');
    }

    // Recalculate totals
    recalcCartTotals();

  } catch (err) {
    console.error("Update quantity error:", err);
    if (err.response?.data?.message) {
      alert(err.response.data.message);
    } else {
      alert("Network error. Please try again.");
    }
  } finally {
    // Re-enable inputs
    if (input) input.disabled = false;
    if (increaseBtn) increaseBtn.disabled = false;
    if (decreaseBtn) decreaseBtn.disabled = false;
  }
}

/* ================= REMOVE ITEM ================= */
async function removeItem(cartItem, variantId) {
  console.log("🗑️ Removing item:", variantId);
  
  try {
    const res = await axios.post('/user/cart/remove', {
      variantId
    }, { withCredentials: true });

    console.log("Remove response:", res.data);

    if (!res.data.ok) {
      alert(res.data.message || "Remove failed");
      return;
    }

    cartItem.remove();
    recalcCartTotals();

    // If cart empty → reload (or show empty UI)
    if (!document.querySelector('.cart-item')) {
      location.reload();
    }

  } catch (err) {
    console.error(err);
    alert("Network error");
  }
}

/* ================= RECALCULATE TOTAL ================= */
function recalcCartTotals() {
  console.log("🔄 Recalculating cart totals");
  
  let total = 0;

  document.querySelectorAll('.item-subtotal').forEach(el => {
    const value = el.textContent.replace('₹', '').replace(/,/g, '');
    total += Number(value) || 0;
  });

  const cartTotalEl = document.getElementById('cart-total');
  const cartSubtotalEl = document.getElementById('cart-subtotal');

  if (cartTotalEl) {
    cartTotalEl.textContent = '₹' + total.toLocaleString('en-IN');
  }
  
  if (cartSubtotalEl) {
    cartSubtotalEl.textContent = '₹' + total.toLocaleString('en-IN');
  }

  console.log("💰 New cart total:", total);
}

/* ================= INPUT CHANGE EVENT ================= */
document.addEventListener('change', async (e) => {
  if (e.target.classList.contains('qty-input')) {
    console.log("Input changed:", e.target.value);
    
    const input = e.target;
    const cartItem = input.closest('.cart-item');
    const variantId = cartItem.dataset.variantId;
    
    let quantity = parseInt(input.value, 10);
    const max = parseInt(input.max, 10) || 99;
    
    // Validate quantity
    if (isNaN(quantity) || quantity < 1) {
      quantity = 1;
    } else if (quantity > max) {
      quantity = max;
    }
    
    // Update input value
    input.value = quantity;
    
    console.log("📝 INPUT CHANGE →", variantId, quantity);
    await updateQuantity(cartItem, variantId, quantity);
  }
});

/* ================= INITIALIZE CART ================= */
function initCart() {
  console.log("🛒 Cart initialized");
  
  // Add event listeners for remove buttons

  
  // Initial calculation
  setTimeout(() => {
    console.log("🔄 Initial cart total calculation");
    recalcCartTotals();
  }, 500);
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCart);
} else {
  initCart();
}
// cart.js
document.addEventListener('DOMContentLoaded', function() {
  // Check for blocked products on page load
  const blockedItems = document.querySelectorAll('.cart-item[data-available="false"]');
  
  if (blockedItems.length > 0) {
    // Show notification about blocked products
    showNotification(
      `Some items in your cart are no longer available. They will be removed automatically.`,
      'warning'
    );
    
    // Automatically remove blocked products after 5 seconds
    setTimeout(() => {
      blockedItems.forEach(item => {
        const variantId = item.dataset.variantId;
        removeBlockedItem(variantId);
      });
    }, 5000);
  }
  
  // Function to remove blocked item
  async function removeBlockedItem(variantId) {
    try {
      const response = await fetch('/user/api/cart/remove', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ variantId })
      });
      
      const data = await response.json();
      
      if (data.ok) {
        // Remove item from DOM
        const itemElement = document.querySelector(`.cart-item[data-variant-id="${variantId}"]`);
        if (itemElement) {
          itemElement.style.opacity = '0.5';
          itemElement.style.pointerEvents = 'none';
          
          setTimeout(() => {
            itemElement.remove();
            updateCartTotals();
            checkIfCartEmpty();
          }, 500);
        }
      }
    } catch (error) {
      console.error('Error removing blocked item:', error);
    }
  }
  
  // Function to update cart totals
  function updateCartTotals() {
    const availableItems = document.querySelectorAll('.cart-item[data-available="true"]');
    let subtotal = 0;
    
    availableItems.forEach(item => {
      const subtotalElement = item.querySelector('.item-subtotal');
      if (subtotalElement) {
        const itemSubtotal = parseFloat(subtotalElement.textContent.replace(/[^0-9.]/g, ''));
        subtotal += itemSubtotal;
      }
    });
    
    // Update UI
    document.getElementById('cart-subtotal').textContent = `₹${subtotal.toLocaleString('en-IN')}`;
    document.getElementById('cart-total').textContent = `₹${subtotal.toLocaleString('en-IN')}`;
  }
  
  // Function to check if cart is empty
  function checkIfCartEmpty() {
    const items = document.querySelectorAll('.cart-item');
    if (items.length === 0) {
      window.location.reload();
    }
  }
  
  // Notification function
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-xl shadow-2xl z-50 animate-fade-in ${
      type === 'warning' ? 'bg-yellow-600/90 text-white' : 
      type === 'error' ? 'bg-red-600/90 text-white' : 
      'bg-blue-600/90 text-white'
    }`;
    notification.innerHTML = `
      <div class="flex items-center gap-3">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span>${message}</span>
        <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white/80 hover:text-white">
          &times;
        </button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }
});
document.getElementById('checkout-btn')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;

  // Prevent double click
  if (btn.disabled) return;

  // Save original text
  const originalHTML = btn.innerHTML;

  // Set loading state
  btn.disabled = true;
  btn.innerHTML = `
    <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10"
              stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
    </svg>
    <span>Processing...</span>
  `;
  btn.classList.add('flex', 'items-center', 'justify-center', 'gap-3');

  try {
    const res = await fetch('/user/validate');
    const data = await res.json();

    if (!data.ok) {
      showNotification(
        data.errors?.join(', ') || data.message,
        'error'
      );

      // ❌ restore button
      btn.disabled = false;
      btn.innerHTML = originalHTML;
      return;
    }

    // ✅ redirect
    window.location.href = '/checkout';

  } catch (err) {
    showNotification('Unable to validate checkout', 'error');

    // ❌ restore button
    btn.disabled = false;
    btn.innerHTML = originalHTML;
  }
});

