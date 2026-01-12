// refundRequest.js
document.addEventListener('DOMContentLoaded', function() {
  // Get order details from data attributes or hidden elements
  const orderDataElement = document.getElementById('orderData');
  
  if (!orderDataElement) {
    console.error('Order data element not found');
    return;
  }
  
  // Store order details including discount from server
  const orderDetails = {
    id: orderDataElement.dataset.orderId,
    subtotal: parseFloat(orderDataElement.dataset.subtotal) || 0,
    discount: parseFloat(orderDataElement.dataset.discount) || 0,
    tax: parseFloat(orderDataElement.dataset.tax) || 0,
    shipping: parseFloat(orderDataElement.dataset.shipping) || 0,
    finalAmount: parseFloat(orderDataElement.dataset.finalAmount) || 0,
    couponCode: orderDataElement.dataset.couponCode || ''
  };
  
  console.log('Order details with discount:', orderDetails);
  console.log('Discount amount:', orderDetails.discount);
  
  let selectedAddressId = null;
  let selectedItems = new Map();
  
  // Get order ID properly
  const orderId = orderDetails.id;
  
  console.log('Order ID:', orderId);
  
  // Calculate refund amount with proportional discount
  function calculateRefundWithDiscount(selectedItemsTotal) {
    console.log('Calculating refund with discount...');
    console.log('Selected items total:', selectedItemsTotal);
    console.log('Order subtotal:', orderDetails.subtotal);
    console.log('Order discount:', orderDetails.discount);
    
    if (orderDetails.discount <= 0 || selectedItemsTotal <= 0 || orderDetails.subtotal <= 0) {
      console.log('No discount or invalid values');
      return selectedItemsTotal;
    }
    
    // Calculate what percentage of the original order subtotal is being returned
    const returnPercentage = selectedItemsTotal / orderDetails.subtotal;
    console.log('Return percentage:', (returnPercentage * 100).toFixed(2) + '%');
    
    // Apply the same percentage of discount to the returned amount
    const applicableDiscount = orderDetails.discount * returnPercentage;
    console.log('Applicable discount:', applicableDiscount);
    
    // Also apply proportional tax and shipping (if returning partial order)
    const returnTax = returnPercentage * orderDetails.tax;
    const returnShipping = returnPercentage * orderDetails.shipping;
    console.log('Return tax:', returnTax);
    console.log('Return shipping:', returnShipping);
    
    // Calculate final refund amount
    let refundAmount = selectedItemsTotal - applicableDiscount + returnTax + returnShipping;
    console.log('Refund calculation:', {
      selectedItemsTotal,
      minusDiscount: applicableDiscount,
      plusTax: returnTax,
      plusShipping: returnShipping,
      equals: refundAmount
    });
    
    // Ensure non-negative
    refundAmount = Math.max(0, refundAmount);
    console.log('Final refund amount:', refundAmount);
    
    return refundAmount;
  }
  
  // Toggle item selection
  function toggleItemSelection(itemElement, index) {
    console.log('Toggling item selection:', index);
    
    // Toggle selected class
    itemElement.classList.toggle('selected');
    
    // Show/hide selection indicator
    const indicator = itemElement.querySelector('.selected-indicator');
    indicator.classList.toggle('hidden');
    
    // Add/remove selected border
    if (itemElement.classList.contains('selected')) {
      itemElement.classList.add('border-[#d4af37]', 'bg-[#d4af37]/5');
      itemElement.classList.remove('border-[#2a2a2a]');
    } else {
      itemElement.classList.remove('border-[#d4af37]', 'bg-[#d4af37]/5');
      itemElement.classList.add('border-[#2a2a2a]');
    }
    
    // Store or remove item data
    if (itemElement.classList.contains('selected')) {
      selectedItems.set(index, {
        price: parseFloat(itemElement.dataset.price) || 0,
        quantity: parseInt(itemElement.dataset.quantity) || 1,
        total: parseFloat(itemElement.dataset.total) || 0,
        product: itemElement.dataset.product || '',
        variant: itemElement.dataset.variant || ''
      });
    } else {
      selectedItems.delete(index);
    }
    
    console.log('Selected items:', selectedItems);
    
    // Update refund summary
    updateRefundAmount();
  }
  
  // Update refund amount based on selected items (WITH DISCOUNT)
  function updateRefundAmount() {
    console.log('=== UPDATING REFUND AMOUNT ===');
    
    const selectedItemsCount = selectedItems.size;
    let totalItemsAmount = 0;
    
    // Calculate total from selected items (without discount)
    selectedItems.forEach(item => {
      totalItemsAmount += item.total;
    });
    
    console.log('Selected items count:', selectedItemsCount);
    console.log('Total items amount (before discount):', totalItemsAmount);
    console.log('Original order discount:', orderDetails.discount);
    
    // Calculate final refund amount WITH discount
    let finalRefundAmount = totalItemsAmount;
    
    if (orderDetails.discount > 0 && totalItemsAmount > 0 && orderDetails.subtotal > 0) {
      console.log('Applying discount calculation...');
      finalRefundAmount = calculateRefundWithDiscount(totalItemsAmount);
      console.log('Final refund amount (with discount):', finalRefundAmount);
    } else {
      console.log('No discount to apply');
      console.log('Final refund amount (no discount):', finalRefundAmount);
    }
    
    // Round to 2 decimal places
    finalRefundAmount = Math.round(finalRefundAmount * 100) / 100;
    console.log('Rounded refund amount:', finalRefundAmount);
    
    // Update the UI
    const selectedItemsCountEl = document.getElementById('selectedItemsCount');
    const itemsValueEl = document.getElementById('itemsValue');
    const estimatedRefundEl = document.getElementById('estimatedRefund');
    const submitBtn = document.getElementById('submitRefundBtn');
    
    if (selectedItemsCountEl) selectedItemsCountEl.textContent = selectedItemsCount;
    if (itemsValueEl) itemsValueEl.textContent = `₹${totalItemsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (estimatedRefundEl) estimatedRefundEl.textContent = `₹${finalRefundAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    
    // Enable/disable submit button
    if (submitBtn) {
      submitBtn.disabled = selectedItemsCount === 0;
      
      // Update button text with refund amount
      if (selectedItemsCount > 0) {
        submitBtn.innerHTML = `
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          Submit Refund Request (₹${finalRefundAmount.toFixed(2)})
        `;
      } else {
        submitBtn.innerHTML = `
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          Select Items to Refund
        `;
      }
    }
    
    // Update hidden field for refund amount
    let refundAmountInput = document.querySelector('input[name="refundAmount"]');
    if (!refundAmountInput) {
      refundAmountInput = document.createElement('input');
      refundAmountInput.type = 'hidden';
      refundAmountInput.name = 'refundAmount';
      refundAmountInput.id = 'refundAmountInput';
      const refundForm = document.getElementById('refundForm');
      if (refundForm) {
        refundForm.appendChild(refundAmountInput);
      }
    }
    if (refundAmountInput) {
      refundAmountInput.value = finalRefundAmount.toFixed(2);
    }
    
    console.log('Hidden refund amount input value:', refundAmountInput?.value);
    console.log('=== REFUND AMOUNT UPDATE COMPLETE ===\n');
  }
  
  // Toggle custom reason for primary refund
  function toggleCustomReason() {
    const selectedReason = document.querySelector('input[name="reasonCode"]:checked');
    const customReasonContainer = document.getElementById('customReasonContainer');
    const customReasonInput = document.getElementById('customReason');
    
    if (selectedReason && customReasonContainer && customReasonInput) {
      if (selectedReason.value === 'other') {
        customReasonContainer.classList.remove('hidden');
        customReasonInput.required = true;
      } else {
        customReasonContainer.classList.add('hidden');
        customReasonInput.required = false;
      }
    }
  }
  
  // Select address
  function selectAddress(addressId) {
    selectedAddressId = addressId;
    console.log('Selected address:', addressId);
  }
  
  // Show notification
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transform transition-all duration-300 ${
      type === 'success' ? 'bg-green-900/90 border border-green-700' :
      type === 'error' ? 'bg-red-900/90 border border-red-700' :
      'bg-blue-900/90 border border-blue-700'
    }`;
    
    notification.innerHTML = `
      <div class="flex items-center gap-3">
        <svg class="w-5 h-5 ${
          type === 'success' ? 'text-green-400' :
          type === 'error' ? 'text-red-400' :
          'text-blue-400'
        }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${
            type === 'success' ? 'M5 13l4 4L19 7' :
            type === 'error' ? 'M6 18L18 6M6 6l12 12' :
            'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
          }"/>
        </svg>
        <span class="text-white">${message}</span>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 5000);
  }
  
  // Get selected items data
  function getSelectedItemsData() {
    const items = [];
    
    selectedItems.forEach((itemData, index) => {
      items.push({
        product: itemData.product,
        variant: itemData.variant,
        quantity: itemData.quantity,
        price: itemData.price,
        total: itemData.total,
        reason: "general"
      });
    });
    
    console.log('Selected items for submission:', items);
    return items;
  }
  
  // Validate form
  function validateForm() {
    console.log('Validating form...');
    
    if (selectedItems.size === 0) {
      showNotification('Please select at least one item to return', 'error');
      return false;
    }
    
    const selectedAddress = document.querySelector('input[name="returnAddress"]:checked');
    if (!selectedAddress) {
      showNotification('Please select a return address', 'error');
      return false;
    }
    
    const primaryReason = document.querySelector('input[name="reasonCode"]:checked');
    if (!primaryReason) {
      showNotification('Please select a primary reason for refund', 'error');
      return false;
    }
    
    if (primaryReason.value === 'other') {
      const customReason = document.getElementById('customReason');
      if (!customReason.value.trim()) {
        showNotification('Please describe your reason for refund', 'error');
        customReason.focus();
        return false;
      }
    }
    
    const refundAmount = parseFloat(document.querySelector('input[name="refundAmount"]')?.value || 0);
    if (refundAmount <= 0) {
      showNotification('Invalid refund amount', 'error');
      return false;
    }
    
    console.log('Form validation passed');
    return true;
  }
  
  // Submit refund request
  async function submitRefundRequest() {
    console.log('=== SUBMIT REFUND REQUEST STARTED ===');
    console.log('Using order ID:', orderId);
    console.log('Original order discount:', orderDetails.discount);
    
    if (!validateForm()) {
      console.log('Form validation failed');
      return;
    }
    
    const submitBtn = document.getElementById('submitRefundBtn');
    if (!submitBtn) return;
    
    const originalText = submitBtn.innerHTML;
    
    // Show loading
    submitBtn.innerHTML = `
      <svg class="w-5 h-5 animate-spin text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
      </svg>
      Processing...
    `;
    submitBtn.disabled = true;
    
    try {
      const selectedAddress = document.querySelector('input[name="returnAddress"]:checked').value;
      const reasonCode = document.querySelector('input[name="reasonCode"]:checked').value;
      const customReason = document.getElementById('customReason')?.value || '';
      const additionalDetails = document.querySelector('textarea[name="additionalDetails"]')?.value || '';
      const refundMethod = document.querySelector('select[name="refundMethod"]').value;
      const refundAmount = parseFloat(document.querySelector('input[name="refundAmount"]')?.value || 0);
      
      // Get selected items
      const items = getSelectedItemsData();
      
      console.log('Form data:', {
        orderId: orderId,
        selectedAddress: selectedAddress,
        reasonCode: reasonCode,
        customReason: customReason,
        additionalDetails: additionalDetails,
        refundMethod: refundMethod,
        refundAmount: refundAmount,
        itemsCount: items.length,
        originalOrderDiscount: orderDetails.discount
      });
      
      if (items.length === 0) {
        throw new Error('No items selected for return');
      }
      
      // Prepare payload
      const payload = {
        orderId: orderId,
        reasonCode: reasonCode,
        customReason: customReason,
        additionalDetails: additionalDetails,
        returnAddress: selectedAddress,
        refundMethod: refundMethod,
        refundAmount: refundAmount,
        items: items
      };
      
      console.log('Submitting payload:', payload);
      
      // Send request
      const response = await fetch('/api/refunds/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      console.log('Response status:', response.status);
      
      const result = await response.json();
      console.log('Response data:', result);
      
      // Reset button
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
      
      if (result.success) {
        showNotification('Refund request submitted successfully!', 'success');
        
        // Redirect to order details after 2 seconds
        setTimeout(() => {
          window.location.href = `/orders/${orderId}`;
        }, 2000);
      } else {
        showNotification(result.message || 'Failed to submit refund request', 'error');
      }
    } catch (error) {
      console.error('Error submitting refund request:', error);
      
      // Reset button
      if (submitBtn) {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
      
      showNotification('Error: ' + error.message, 'error');
    }
  }
  
  // Initialize on page load
  console.log('Refund page loaded');
  console.log('Order ID on load:', orderId);
  console.log('Order details with discount:', orderDetails);
  
  // Show discount information in console
  if (orderDetails.discount > 0) {
    console.log('⚠️ Original order had discount of ₹' + orderDetails.discount.toFixed(2));
    console.log('Coupon code:', orderDetails.couponCode);
  }
  
  // Initialize refund amount
  updateRefundAmount();
  
  // Add click handlers to all items
  document.querySelectorAll('.selectable-item').forEach((item, index) => {
    item.addEventListener('click', function() {
      toggleItemSelection(this, index);
    });
  });
  
  // Auto-select first address if none selected
  const firstAddressRadio = document.querySelector('input[name="returnAddress"]');
  if (firstAddressRadio) {
    selectAddress(firstAddressRadio.value);
  }
  
  // Add event listeners for address selection
  document.querySelectorAll('input[name="returnAddress"]').forEach(radio => {
    radio.addEventListener('change', function() {
      selectAddress(this.value);
    });
  });
  
  // Add event listener for reason code changes
  document.querySelectorAll('input[name="reasonCode"]').forEach(radio => {
    radio.addEventListener('change', toggleCustomReason);
  });
  
  // Initialize custom reason field
  toggleCustomReason();
  
  // Make submitRefundRequest globally available
  window.submitRefundRequest = submitRefundRequest;
});