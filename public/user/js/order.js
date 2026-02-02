console.log('Order.js loading...');


if (typeof axios === 'undefined') {
    console.log('📦 Loading axios from CDN...');
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/axios@1.6.7/dist/axios.min.js';
    document.head.appendChild(script);
}


let orderInProgress = false;
let orderLockDuration = 5000; 

let lastRazorpayOrderData = null;



function showToast(message, type = 'info') {
 
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'fixed top-4 right-4 z-50 space-y-2';
        document.body.appendChild(toastContainer);
    }
    
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-500' : 
                   type === 'error' ? 'bg-red-500' : 
                   type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500';
    
    toast.className = `${bgColor} text-white px-6 py-3 rounded-lg shadow-lg flex items-center justify-between min-w-[300px] max-w-[400px] transform transition-transform duration-300 translate-x-full`;
    toast.innerHTML = `
        <span>${message}</span>
        <button class="ml-4 text-white hover:text-gray-200 text-xl" onclick="this.parentElement.remove()">
            &times;
        </button>
    `;
    
    toastContainer.appendChild(toast);

    setTimeout(() => toast.classList.remove('translate-x-full'), 10);
    

    setTimeout(() => {
        toast.classList.add('translate-x-full');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}


function showCouponMessage(message, type = 'info') {
    console.log(` Coupon message: ${message} (${type})`);
    
    const couponMessage = document.getElementById('couponMessage');
    if (!couponMessage) {
        console.log(' Coupon message element not found');
        return;
    }
    
    couponMessage.textContent = message;
    couponMessage.className = 'text-sm mt-2';
    
    switch(type) {
        case 'success':
            couponMessage.classList.add('text-green-400');
            couponMessage.classList.remove('text-red-400', 'text-yellow-400', 'text-gray-400');
            break;
        case 'error':
            couponMessage.classList.add('text-red-400');
            couponMessage.classList.remove('text-green-400', 'text-yellow-400', 'text-gray-400');
            break;
        case 'loading':
            couponMessage.classList.add('text-yellow-400');
            couponMessage.classList.remove('text-green-400', 'text-red-400', 'text-gray-400');
            break;
        default:
            couponMessage.classList.add('text-gray-400');
            couponMessage.classList.remove('text-green-400', 'text-red-400', 'text-yellow-400');
    }
}


function updatePlaceOrderButton() {
    console.log('🔄 Updating place order button state');
    const hasAddress = document.querySelector('input[name="deliveryAddress"]:checked');
    const hasPayment = document.querySelector('input[name="paymentMethod"]:checked');
    

    const cartItemsData = document.getElementById('cartItemsData');
    const hasCartItems = cartItemsData && cartItemsData.value === 'true';
    
    console.log('Validation check:', {
        hasAddress: !!hasAddress,
        hasPayment: !!hasPayment,
        hasCartItems: hasCartItems,
        cartItemsElement: cartItemsData
    });
    
    const placeOrderBtn = document.getElementById('placeOrderBtn');
    if (placeOrderBtn) {
        const isDisabled = !(hasAddress && hasPayment && hasCartItems);
        placeOrderBtn.disabled = isDisabled;
        console.log('Place order button disabled:', isDisabled);
    }
}


function stylePaymentOptions() {
    console.log('🎨 Styling payment options');
    
    const paymentOptions = document.querySelectorAll('input[name="paymentMethod"]');
    const paymentContainers = {
        'cod': document.getElementById('codOption'),
        'wallet': document.getElementById('walletOption'),
        'razorpay': document.getElementById('razorpayOption')
    };
    
    paymentOptions.forEach(option => {
        option.addEventListener('change', function() {
            console.log('💳 Payment method changed to:', this.value);
            
         
            Object.values(paymentContainers).forEach(container => {
                if (container) {
                    container.classList.remove('border-[#d4af37]', 'bg-[#d4af37]/5');
                    container.classList.add('border-[#2a2a2a]');
                }
            });
            
      
            const selectedContainer = paymentContainers[this.value.toLowerCase()];
            if (selectedContainer) {
                selectedContainer.classList.add('border-[#d4af37]', 'bg-[#d4af37]/5');
                selectedContainer.classList.remove('border-[#2a2a2a]');
            }
            
            updatePlaceOrderButton();
        });
        
   
        if (option.checked) {
            const selectedContainer = paymentContainers[option.value.toLowerCase()];
            if (selectedContainer) {
                selectedContainer.classList.add('border-[#d4af37]', 'bg-[#d4af37]/5');
                selectedContainer.classList.remove('border-[#2a2a2a]');
            }
        }
    });
}


function validateWalletPayment() {
    const walletOption = document.getElementById('wallet');
    if (!walletOption) return;
    
   
    const walletBalanceElem = document.getElementById('walletBalanceData');
    const walletBalance = walletBalanceElem ? parseFloat(walletBalanceElem.value) : 0;
    
    
    const finalAmountElem = document.querySelector('[data-final-amount]');
    const finalAmount = finalAmountElem ? parseFloat(finalAmountElem.dataset.finalAmount) : 0;
    
    console.log(' Wallet validation:', {
        balance: walletBalance,
        finalAmount: finalAmount,
        isSufficient: walletBalance >= finalAmount
    });
    
 
    if (walletBalance < finalAmount) {
        walletOption.disabled = true;
        const walletContainer = document.getElementById('walletOption');
        if (walletContainer) {
            walletContainer.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }
}


async function handleRazorpayPayment(orderData) {
    try {
        console.log(' Starting Razorpay payment for order:', orderData);
       
lastRazorpayOrderData = orderData;

        
    
        let finalAmount;
        
       
        const amountElement = document.getElementById('finalAmountData');
        if (amountElement && amountElement.dataset.amount) {
            const amountStr = amountElement.dataset.amount;
            finalAmount = parseFloat(amountStr);
            console.log('Amount from data attribute:', amountStr, '->', finalAmount);
        }
        
        
        if (!finalAmount || isNaN(finalAmount) || finalAmount <= 0) {
            const displayElement = document.getElementById('displayedFinalAmount');
            if (displayElement) {
                const amountText = displayElement.textContent.replace('₹', '').replace(/,/g, '').trim();
                finalAmount = parseFloat(amountText);
                console.log('Amount from displayed text:', amountText, '->', finalAmount);
            }
        }
        
    
        if (!finalAmount || isNaN(finalAmount) || finalAmount <= 0) {
          
            const ejsAmount = '<%= finalAmount %>';
          
            finalAmount = parseFloat(ejsAmount.replace(/,/g, ''));
            console.log('Amount from EJS variable:', ejsAmount, '->', finalAmount);
        }
        
        console.log('💰 Final amount determined:', {
            value: finalAmount,
            isValid: !isNaN(finalAmount) && finalAmount > 0,
            type: typeof finalAmount
        });

        if (!finalAmount || isNaN(finalAmount) || finalAmount <= 0) {
            console.error('Invalid final amount:', finalAmount);
            showToast('Invalid order amount. Please refresh the page.', 'error');
            return;
        }

     
        finalAmount = Math.round(finalAmount * 100) / 100;
        console.log(` Creating Razorpay order for ₹${finalAmount}`);

      
        showToast('Creating payment link...', 'info');

        
        const orderResponse = await axios.post('/create-razorpay-order', {
          
             addressId: orderData.addressId 
        });
        
        if (!orderResponse.data.success) {
            throw new Error(orderResponse.data.message || 'Failed to create payment');
        }
        
        const razorpayOrder = orderResponse.data.data;
        lastRazorpayOrderData.internalOrderId = razorpayOrder.internalOrderId;
        
        console.log(' Razorpay order created:', razorpayOrder.id);

    
        await loadRazorpayScript();
        
     
        const userName = '<%= user.fullName %>' || '';
        const userEmail = '<%= user.email %>' || '';
        const userPhone = '<%= user.phone %>' || '';

        const options = {
            key: razorpayOrder.key_id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            name: 'Your Store',
            description: 'Order Payment',
            order_id: razorpayOrder.id,
            handler: async function (response) {
                console.log('✅ Razorpay payment successful:', {
                    orderId: response.razorpay_order_id,
                    paymentId: response.razorpay_payment_id
                });
                
             
                showToast('Verifying payment...', 'info');
                
                try {
                   
                    const verifyResponse = await axios.post('/verify-razorpay-payment', {
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature,
                        addressId: orderData.addressId
                    });
                    
                    if (verifyResponse.data.success) {
                      
                        showSuccessModal(verifyResponse.data);
                    } else {
                       showFailedModal(verifyResponse.data.message || 'Payment verification failed');

                       
                        const placeOrderBtn = document.getElementById('placeOrderBtn');
                        if (placeOrderBtn) {
                            placeOrderBtn.disabled = false;
                            placeOrderBtn.innerHTML = 'Place Order';
                        }
                    }
                } catch (error) {
                    console.error(' Payment verification error:', error);
                    showToast(error.response?.data?.message || 'Payment verification failed', 'error');
               
                    const placeOrderBtn = document.getElementById('placeOrderBtn');
                    if (placeOrderBtn) {
                        placeOrderBtn.disabled = false;
                        placeOrderBtn.innerHTML = 'Place Order';
                    }
                }
            },
            prefill: {
                name: userName,
                email: userEmail,
                contact: userPhone
            },
            theme: {
                color: '#d4af37'
            },
           modal: {
  ondismiss: async function () {
    console.log('⚠️ Razorpay modal dismissed');

    if (lastRazorpayOrderData?.internalOrderId) {
      await axios.post('/orders/payment-failed', {
        orderId: lastRazorpayOrderData.internalOrderId
      });
    }

    showFailedModal('Payment was cancelled. Please try again.');

    const placeOrderBtn = document.getElementById('placeOrderBtn');
    if (placeOrderBtn) {
      placeOrderBtn.disabled = false;
      placeOrderBtn.innerHTML = 'Place Order';
    }
  }
}
,
            notes: {
                order_type: 'E-commerce purchase'
            }
        };
        
        const rzp = new Razorpay(options);
        
        
        rzp.open();
        
      
       rzp.on('payment.failed', async function (response) {
  console.error(' Razorpay payment failed:', response.error);

  if (lastRazorpayOrderData?.internalOrderId) {
    await axios.post('/orders/payment-failed', {
      orderId: lastRazorpayOrderData.internalOrderId
    });
  }

  showFailedModal(`Payment failed: ${response.error.description}`);

  const placeOrderBtn = document.getElementById('placeOrderBtn');
  if (placeOrderBtn) {
    placeOrderBtn.disabled = false;
    placeOrderBtn.innerHTML = 'Place Order';
  }
});

        
    } catch (error) {
        console.error('Razorpay setup error:', error);
        showToast(error.message || 'Payment setup failed', 'error');
        
       
        const placeOrderBtn = document.getElementById('placeOrderBtn');
        if (placeOrderBtn) {
            placeOrderBtn.disabled = false;
            placeOrderBtn.innerHTML = 'Place Order';
        }
        throw error;
    }
}


function loadRazorpayScript() {
    return new Promise((resolve, reject) => {
        if (window.Razorpay) {
            console.log('✅ Razorpay already loaded');
            resolve();
            return;
        }
        
        console.log(' Loading Razorpay script...');
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => {
            console.log(' Razorpay script loaded successfully');
            resolve();
        };
        script.onerror = (error) => {
            console.error(' Failed to load Razorpay script:', error);
            reject(new Error('Failed to load payment gateway. Please check your internet connection.'));
        };
        document.body.appendChild(script);
    });
}


function showSuccessModal(responseData) {
    const orderNumber = responseData.orderNumber || 
        `ORD-${responseData.orderId?.slice(-8).toUpperCase() || 'ORDER'}`;
    const orderIdDisplay = document.getElementById('orderNumberDisplay');
    const orderDetailsLink = document.getElementById('orderDetailsLink');
    
    if (orderIdDisplay) {
        orderIdDisplay.textContent = orderNumber;
    }
    
    if (orderDetailsLink && responseData.orderId) {
        orderDetailsLink.href = `/orders/${responseData.orderId}`;
    }
    
    const successModal = document.getElementById('successModal');
    if (successModal) {
        successModal.classList.remove('hidden');
        console.log('🎉 Success modal shown');
        
       
        setTimeout(() => {
            if (responseData.orderId) {
                window.location.href = `/orders/${responseData.orderId}`;
            }
        }, 5000);
    }
}


async function applyCoupon() {
    console.log(' Applying coupon...');
    const couponCodeInput = document.getElementById('couponCode');
    const couponCode = couponCodeInput ? couponCodeInput.value.trim() : '';
    
    if (!couponCode) {
        console.log(' No coupon code entered');
        showCouponMessage('Please enter a coupon code', 'error');
        return;
    }
    
    console.log('Coupon code entered:', couponCode);
    
    try {
        showCouponMessage('Applying coupon...', 'loading');
        
        const response = await axios.post('/checkout/apply-coupon', {
            couponCode: couponCode
        });
        
        console.log('Coupon response:', response.data);
        
        if (response.data.success) {
            console.log(' Coupon applied successfully');
            showCouponMessage(response.data.message, 'success');
            
         
            updateOrderSummary(response.data.data);
            
            
            updateCouponUI(response.data.data, couponCode);
            
        } else {
            console.log(' Coupon application failed:', response.data.message);
            showCouponMessage(response.data.message, 'error');
        }
    } catch (error) {
    console.error('Error applying coupon:', error);

    const message =
        error.response?.data?.message ||
        'Failed to apply coupon';


    showCouponMessage(message, 'error');
    showToast(message, 'error');

  
    if (
        message.toLowerCase().includes('disabled') ||
        message.toLowerCase().includes('blocked') ||
        message.toLowerCase().includes('inactive')
    ) {
        restoreCouponInput();
    }
}

}


function updateCouponUI(couponData, couponCode) {
    console.log(' Updating coupon UI...');
    

    const couponInputSection = document.querySelector('.coupon-input-section');
    if (couponInputSection) {
        couponInputSection.style.display = 'none';
    }
    
   
    let couponAppliedDiv = document.querySelector('.coupon-applied');
    
    if (!couponAppliedDiv) {
       
        couponAppliedDiv = document.createElement('div');
        couponAppliedDiv.className = 'bg-gradient-to-r from-green-900/20 to-emerald-900/10 border border-green-500/30 rounded-xl p-4 mb-3 coupon-applied';
        
       
        const removeButton = document.getElementById('removeCouponBtn');
        if (removeButton) {
            removeButton.style.display = 'block';
        }
    }
    
   
    couponAppliedDiv.innerHTML = `
        <div class="flex justify-between items-center">
            <div>
                <div class="flex items-center gap-2">
                    <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span class="font-bold text-green-400 coupon-code">${couponData.code}</span>
                    <span class="text-sm text-gray-300">${couponData.name}</span>
                </div>
                <p class="text-sm text-gray-400 mt-1">
                    ${couponData.discountType === 'percentage' ? `${couponData.discountValue}% OFF` : `₹${couponData.discountValue} OFF`}
                </p>
            </div>
            <div class="flex items-center gap-3">
                <span class="text-lg font-bold text-green-400">-₹${couponData.discountAmount}</span>
              
            </div>
        </div>
    `;
    
   
    const couponMessage = document.getElementById('couponMessage');
    const couponSection = document.querySelector('.coupon-section');
    
    if (couponSection && !document.querySelector('.coupon-applied')) {
        if (couponMessage) {
            couponMessage.insertAdjacentElement('beforebegin', couponAppliedDiv);
        } else {
            const couponInputSection = document.querySelector('.coupon-input-section');
            if (couponInputSection) {
                couponInputSection.insertAdjacentElement('afterend', couponAppliedDiv);
            }
        }
    }
    
   
    setTimeout(() => {
        const messageElement = document.getElementById('couponMessage');
        if (messageElement) {
            messageElement.textContent = '';
        }
    }, 3000);
}

async function removeCoupon() {
    console.log(' Removing coupon...');
    
    try {
        showCouponMessage('Removing coupon...', 'loading');
        
        const response = await axios.post('/checkout/remove-coupon');
        
        console.log('Remove coupon response:', response.data);
        
        if (response.data.success) {
            console.log(' Coupon removed successfully');
            showCouponMessage(response.data.message, 'success');
            
            
            updateOrderSummary(response.data.data);
            
           
            restoreCouponInput();
            
           
            setTimeout(() => {
                const messageElement = document.getElementById('couponMessage');
                if (messageElement) {
                    messageElement.textContent = '';
                }
            }, 3000);
            
        } else {
            console.log(' Coupon removal failed:', response.data.message);
            showCouponMessage(response.data.message, 'error');
        }
    } catch (error) {
        console.error(' Error removing coupon:', error);
        showCouponMessage('Error removing coupon. Please try again.', 'error');
    }
}


function restoreCouponInput() {
    console.log(' Restoring coupon input...');
    
 
    const couponAppliedDiv = document.querySelector('.coupon-applied');
    if (couponAppliedDiv) {
        couponAppliedDiv.remove();
    }
    
    const couponInputSection = document.querySelector('.coupon-input-section');
    if (couponInputSection) {
        couponInputSection.style.display = 'flex';
    }
    
    const couponCodeInput = document.getElementById('couponCode');
    if (couponCodeInput) {
        couponCodeInput.value = '';
    }
    
    const removeButton = document.getElementById('removeCouponBtn');
    if (removeButton) {
        removeButton.style.display = 'none';
    }
}

function updateOrderSummary(data) {
    console.log(' Updating order summary with coupon data:', data);
    
    function updateTextContent(selector, text) {
        const element = document.querySelector(selector);
        if (element) {
            element.textContent = text;
            console.log(`Updated ${selector}: ${text}`);
        }
    }
    
    updateTextContent('.summary-subtotal', `₹${data.subtotal}`);
    
    updateTextContent('.summary-tax', `₹${data.tax}`);
    
    const shippingElement = document.querySelector('.summary-shipping');
    if (shippingElement) {
        if (data.shipping === '0.00') {
            shippingElement.textContent = 'FREE';
            shippingElement.classList.remove('text-white');
            shippingElement.classList.add('text-green-400');
        } else {
            shippingElement.textContent = `₹${data.shipping}`;
            shippingElement.classList.remove('text-green-400');
            shippingElement.classList.add('text-white');
        }
    }
    

    const discountRow = document.querySelector('.summary-discount');
    const discountAmount = document.querySelector('.discount-amount');
    
    if (parseFloat(data.discount) > 0) {
        if (discountRow) {
            discountRow.style.display = 'flex';
        }
        if (discountAmount) {
            discountAmount.textContent = `-₹${data.discount}`;
        }
    } else {
        if (discountRow) {
            discountRow.style.display = 'none';
        }
    }
    

    updateTextContent('.summary-final', `₹${data.finalAmount}`);
    
 
    const finalAmountInput = document.getElementById('finalAmountData');
    if (finalAmountInput) {
        finalAmountInput.setAttribute('data-amount', data.finalAmount);
        console.log('Updated finalAmountData to:', data.finalAmount);
    }
    
   
    validateWalletPayment();
}


function setupPlaceOrderButton() {
    const placeOrderBtn = document.getElementById('placeOrderBtn');
    if (!placeOrderBtn) return;
    
    placeOrderBtn.addEventListener('click', async function() {
        console.log('🛒 Place order button clicked at:', new Date().toISOString());
        
    
        if (orderInProgress) {
            showToast('Please wait, your order is being processed', 'warning');
            return;
        }
        
        const selectedAddress = document.querySelector('input[name="deliveryAddress"]:checked');
        const selectedPayment = document.querySelector('input[name="paymentMethod"]:checked');
        
        if (!selectedAddress) {
            showToast('Please select a delivery address', 'error');
            return;
        }
        
        if (!selectedPayment) {
            showToast('Please select a payment method', 'error');
            return;
        }
        
     
        orderInProgress = true;
        const originalText = placeOrderBtn.innerHTML;
        const originalDisabled = placeOrderBtn.disabled;
        
        placeOrderBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        placeOrderBtn.disabled = true;
        
        
        setTimeout(() => {
            orderInProgress = false;
        }, orderLockDuration);
        
        try {
            const orderData = {
                addressId: selectedAddress.value,
                paymentMethod: selectedPayment.value
            };
            
            
            const couponCode = document.querySelector('.coupon-code');
            if (couponCode) {
                orderData.couponCode = couponCode.textContent;
                console.log(' Adding coupon to order:', couponCode.textContent);
            }
            
            console.log(' Sending order:', orderData);
            
           if (selectedPayment.value === 'Razorpay') {

    // 🔍 STEP 1: VALIDATE ORDER FIRST (NO PAYMENT)
    const validateResponse = await axios.post('/place-order', {
        ...orderData,
        validateOnly: true
    });

    if (!validateResponse.data.success) {
        const message = validateResponse.data.message || 'Order validation failed';

        showToast(message, 'error');
        showFailedModal(message);

        // Coupon blocked → remove it
        if (
            message.toLowerCase().includes('coupon') ||
            message.toLowerCase().includes('blocked') ||
            message.toLowerCase().includes('disabled')
        ) {
            restoreCouponInput();
            showCouponMessage('Coupon was disabled by admin', 'error');
        }

        placeOrderBtn.innerHTML = originalText;
        placeOrderBtn.disabled = false;
        orderInProgress = false;
        return;
    }

    // ✅ STEP 2: ONLY NOW OPEN RAZORPAY
    await handleRazorpayPayment(orderData);
    return;
}
else {
              
                const response = await axios.post('/place-order', orderData);
                console.log(' Order response:', response.data);
                
                if (response.data.success) {
                    showSuccessModal(response.data);
                   
                    return;
                } else {
    const message = response.data.message || 'Order failed';

    // Show modal + toast
    showFailedModal(message);
    showToast(message, 'error');

    // If coupon was blocked / invalid → auto remove it
    if (
        message.toLowerCase().includes('coupon') ||
        message.toLowerCase().includes('disabled') ||
        message.toLowerCase().includes('blocked')
    ) {
        console.warn('🚫 Coupon invalidated by admin, removing from UI');

        // Remove coupon UI
        restoreCouponInput();

        // Clear coupon message
        showCouponMessage('Coupon was removed by admin', 'error');
    }
}
            }
        } catch (error) {
    console.error('❌ Error placing order:', error);

    const message =
        error.response?.data?.message ||
        'Order failed. Please try again.';

    // 🔔 SHOW TOAST
    showToast(message, 'error');

   
    showFailedModal(message);

 
    if (
        message.toLowerCase().includes('coupon') ||
        message.toLowerCase().includes('disabled') ||
        message.toLowerCase().includes('blocked')
    ) {
        console.warn('🚫 Coupon blocked by admin, clearing coupon UI');

        // Remove coupon UI
        restoreCouponInput();

        // Update coupon message text
        showCouponMessage('Coupon was disabled by admin', 'error');
    }
}
 finally {
          
            if (orderInProgress) {
                placeOrderBtn.innerHTML = originalText;
                placeOrderBtn.disabled = originalDisabled;
                orderInProgress = false;
            }
        }
    });
}


document.addEventListener('DOMContentLoaded', function() {
    console.log(' DOM fully loaded');
    
 
    const addressModal = document.getElementById('addressModal');
    const addAddressBtn = document.getElementById('addAddressBtn');
    const closeModalBtn = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const modalTitle = document.getElementById('modalTitle');
    const addressIdInput = document.getElementById('addressId');
    const addressForm = document.getElementById('addressForm');
    const saveAddressBtn = document.getElementById('saveAddressBtn');
    const saveSpinner = saveAddressBtn ? saveAddressBtn.querySelector('.fa-spinner') : null;
    
    console.log(' Elements found:', {
        placeOrderBtn: !!document.getElementById('placeOrderBtn'),
        addressModal: !!addressModal,
        addAddressBtn: !!addAddressBtn,
        addressForm: !!addressForm
    });
    
  
    console.log(' Initializing coupon functionality');
    const applyCouponBtn = document.getElementById('applyCouponBtn');
    const removeCouponBtn = document.getElementById('removeCouponBtn');
    const couponCodeInput = document.getElementById('couponCode');
    
    if (applyCouponBtn) {
        console.log(' Setting up apply coupon button');
        applyCouponBtn.addEventListener('click', function(e) {
            e.preventDefault();
            applyCoupon();
        });
    }
    
    if (removeCouponBtn) {
        console.log(' Setting up remove coupon button');
        removeCouponBtn.addEventListener('click', function(e) {
            e.preventDefault();
            removeCoupon();
        });
    }
    
    if (couponCodeInput) {
        console.log(' Setting up coupon input field');
        couponCodeInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyCoupon();
            }
        });
    }
    

    if (addAddressBtn && addressModal) {
        console.log(' Setting up add address button');
        addAddressBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log(' Add address button clicked');
            
       
            if (modalTitle) modalTitle.textContent = 'Add New Address';
            if (addressForm) addressForm.reset();
            if (addressIdInput) addressIdInput.value = '';
            
        
            addressModal.classList.remove('hidden');
            console.log('✅ Add address modal opened');
        });
    }
 
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', function() {
            console.log(' Closing modal');
            if (addressModal) addressModal.classList.add('hidden');
        });
    }
    
  
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            console.log('❌ Canceling modal');
            if (addressModal) addressModal.classList.add('hidden');
        });
    }
    
 
    if (addressModal) {
        addressModal.addEventListener('click', function(e) {
            if (e.target === addressModal) {
                console.log(' Closing modal by clicking outside');
                addressModal.classList.add('hidden');
            }
        });
    }
    

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && addressModal && !addressModal.classList.contains('hidden')) {
            console.log('⌨️ Closing modal with Escape key');
            addressModal.classList.add('hidden');
        }
    });
    
   
    console.log(' Setting up edit address buttons');
    
    document.querySelectorAll('.edit-address-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const addressId = this.getAttribute('data-address-id');
            console.log(' Editing address:', addressId);
            
            try {
                
                if (saveSpinner) {
                    saveSpinner.classList.remove('hidden');
                    saveAddressBtn.disabled = true;
                }
                
              
                const response = await axios.get(`/api/address/${addressId}`);
                console.log('📥 Address data:', response.data);
                
                if (response.data.success) {
                    const address = response.data.data;
                    
                   
                    if (modalTitle) modalTitle.textContent = 'Edit Address';
                    if (addressIdInput) addressIdInput.value = addressId;
                    
                   
                    document.getElementById('fullName').value = address.fullName || '';
                    document.getElementById('phone').value = address.phone || '';
                    document.getElementById('addressLine1').value = address.addressLine1 || '';
                    document.getElementById('addressLine2').value = address.addressLine2 || '';
                    document.getElementById('city').value = address.city || '';
                    document.getElementById('state').value = address.state || '';
                    document.getElementById('postalCode').value = address.postalCode || '';
                    document.getElementById('country').value = address.country || 'India';
                    
                   
                    const addressTypeSelect = document.getElementById('addressType');
                    if (addressTypeSelect && address.addressType) {
                        addressTypeSelect.value = address.addressType;
                    }
                    
                    
                    const isDefaultCheckbox = document.getElementById('isDefault');
                    if (isDefaultCheckbox) {
                        isDefaultCheckbox.checked = address.isDefault || false;
                    }
                    
                   
                    addressModal.classList.remove('hidden');
                    console.log('✅ Edit modal opened');
                } else {
                    showToast('Failed to load address', 'error');
                }
            } catch (error) {
                console.error('Error loading address:', error);
                showToast('Error loading address details', 'error');
            } finally {
             
                if (saveSpinner) {
                    saveSpinner.classList.add('hidden');
                    saveAddressBtn.disabled = false;
                }
            }
        });
    });
    
 
    document.querySelectorAll('.delete-address-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const addressId = this.getAttribute('data-address-id');
            console.log('🗑️ Deleting address:', addressId);
            
            if (!confirm('Are you sure you want to delete this address?')) {
                return;
            }
            
            try {
                const response = await axios.delete(`/api/address/${addressId}`);
                
                if (response.data.success) {
                    showToast('Address deleted successfully', 'success');
                   
                    const card = document.querySelector(`[data-address-id="${addressId}"]`);
                    if (card) {
                        card.style.opacity = '0.5';
                        setTimeout(() => card.remove(), 300);
                    }
                } else {
                    showToast(response.data.message, 'error');
                }
            } catch (error) {
                console.error(' Error deleting address:', error);
                showToast('Error deleting address', 'error');
            }
        });
    });
    
    
    if (addressForm) {
        addressForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log(' Saving address form');
            
            const formData = {
                fullName: document.getElementById('fullName').value,
                phone: document.getElementById('phone').value,
                addressLine1: document.getElementById('addressLine1').value,
                addressLine2: document.getElementById('addressLine2').value,
                city: document.getElementById('city').value,
                state: document.getElementById('state').value,
                postalCode: document.getElementById('postalCode').value,
                country: document.getElementById('country').value,
                addressType: document.getElementById('addressType').value,
                isDefault: document.getElementById('isDefault').checked
            };
            
            const addressId = addressIdInput.value;
            console.log('Address ID for save:', addressId);
            
            try {
              
                if (saveSpinner) {
                    saveSpinner.classList.remove('hidden');
                    saveAddressBtn.disabled = true;
                }
                
                let response;
                if (addressId) {
                    
                    console.log('Updating address with PATCH');
                    response = await axios.patch(`/api/address/${addressId}`, formData);
                } else {
               
                    console.log(' Creating new address with POST');
                    response = await axios.post('/api/address', formData);
                }
                
                console.log(' Save response:', response.data);
                
                if (response.data.success) {
                    showToast(response.data.message, 'success');
                    addressModal.classList.add('hidden');
                    
                    
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } else {
                    showToast(response.data.message, 'error');
                }
            } catch (error) {
                console.error(' Error saving address:', error);
                const errorMsg = error.response?.data?.message || 'Error saving address';
                showToast(errorMsg, 'error');
            } finally {
           
                if (saveSpinner) {
                    saveSpinner.classList.add('hidden');
                    saveAddressBtn.disabled = false;
                }
            }
        });
    }
    
    
    const addressCards = document.querySelectorAll('[data-address-id]');
    console.log(' Found address cards:', addressCards.length);
    
    addressCards.forEach(card => {
        const radio = card.querySelector('input[type="radio"]');
        if (radio) {
            radio.addEventListener('change', function() {
                console.log(' Address selected:', this.value);
                
               
                addressCards.forEach(c => {
                 
                });
              card.classList.add('border-[#d4af37]', 'bg-[#d4af37]/5');

                
               
                updatePlaceOrderButton();
            });
        }
    });
    
  
    document.querySelectorAll('input[name="paymentMethod"]').forEach(option => {
        option.addEventListener('change', function() {
            console.log('💳 Payment method changed:', this.value);
            updatePlaceOrderButton();
        });
    });
    
    
    updatePlaceOrderButton();
    stylePaymentOptions();
    validateWalletPayment();
    setupPlaceOrderButton();
    
    console.log('Order.js setup complete!');
});


window.testEditModal = function(addressId) {
    console.log('🔧 Test: Opening edit modal for', addressId);
  
    const editBtn = document.querySelector(`[data-address-id="${addressId}"] .edit-address-btn`);
    if (editBtn) editBtn.click();
};
function showFailedModal(message) {
  const modal = document.getElementById("failedModal");
  const msgEl = document.getElementById("failedMessage");

  if (msgEl) {
    msgEl.textContent = message || "Order failed. Please try again.";
  }

  modal.classList.remove("hidden");
}

async function retryRazorpayPayment() {
  console.log(' Retrying Razorpay payment');

 

  if (!lastRazorpayOrderData) {
    showToast('No payment data found. Please try again.', 'error');
    return;
  }

  try {
    const placeOrderBtn = document.getElementById('placeOrderBtn');
    if (placeOrderBtn) {
      placeOrderBtn.disabled = true;
      placeOrderBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Retrying...';
    }

    await handleRazorpayPayment(lastRazorpayOrderData);

  } catch (error) {
    console.error(' Retry payment failed:', error);
    showToast('Retry failed. Please try again.', 'error');
  }
}
const couponModal = document.getElementById('couponModal');
  const openCouponModalBtn = document.getElementById('openCouponModal');
  const closeCouponModalBtn = document.getElementById('closeCouponModal');
  const couponInput = document.getElementById('couponCode');
  const applyCouponBtn = document.getElementById('applyCouponBtn');

  if (openCouponModalBtn) {
    openCouponModalBtn.addEventListener('click', () => {
      couponModal.classList.remove('hidden');
    });
  }

  if (closeCouponModalBtn) {
    closeCouponModalBtn.addEventListener('click', () => {
      couponModal.classList.add('hidden');
    });
  }

  document.querySelectorAll('.applyCouponFromModal').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.dataset.code;

      if (couponInput) {
        couponInput.value = code;
      }

      couponModal.classList.add('hidden');

      // Trigger existing apply logic
      if (applyCouponBtn) {
        applyCouponBtn.click();
      }
    });
  });



console.log(' Coupon functionality added to order.js');