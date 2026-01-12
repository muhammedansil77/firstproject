// Hardcode your Razorpay key here
const RAZORPAY_KEY = 'rzp_test_Rnzlor5sRgTtD2';

// Store last payment attempt details for retry
let lastPaymentAttempt = null;

// Modal functions
function openAddMoneyModal() {
    document.getElementById('addMoneyModal').classList.remove('hidden');
    document.getElementById('addMoneyModal').classList.add('flex');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('addMoneyModal').classList.add('hidden');
    document.getElementById('addMoneyModal').classList.remove('flex');
    document.body.style.overflow = 'auto';
    resetPayButton();
}

// Close modal on outside click
document.getElementById('addMoneyModal').addEventListener('click', function(e) {
    if (e.target.id === 'addMoneyModal') {
        closeModal();
    }
});

function showPaymentSuccessModal(message) {
    const modal = document.getElementById('paymentSuccessModal');
    const messageEl = document.getElementById('successMessage');

    messageEl.textContent = message || 'Amount added to your wallet successfully.';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

function closeSuccessModal() {
    const modal = document.getElementById('paymentSuccessModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = 'auto';

    // Refresh wallet after success
    window.location.reload();
}

// Payment failed modal functions
function showPaymentFailedModal(message) {
    const modal = document.getElementById('paymentFailedModal');
    const messageEl = document.getElementById('failedMessage');

    if (!modal || !messageEl) {
        console.error('❌ Failed modal elements not found');
        return;
    }

    messageEl.textContent =
        message || 'We encountered an issue processing your payment. Please try again.';

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';

    console.log('✅ Failed modal opened');
}


function closeFailedModal() {
    const modal = document.getElementById('paymentFailedModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = 'auto';
    resetPayButton();
    lastPaymentAttempt = null;
}

function retryPayment() {
    closeFailedModal();
    if (lastPaymentAttempt) {
        const { amount } = lastPaymentAttempt;
        document.getElementById('amountInput').value = amount;
        setTimeout(() => processPayment(), 300);
    } else {
        openAddMoneyModal();
    }
}

// Amount functions
function setAmount(amount) {
    document.getElementById('amountInput').value = amount;
}

// Show toast functions
function showToast(message) {
    document.getElementById('toastMessage').textContent = message;
    document.getElementById('successToast').classList.remove('hidden');
    setTimeout(hideToast, 5000);
}

function hideToast() {
    document.getElementById('successToast').classList.add('hidden');
}

function showErrorToast(message) {
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorToast').classList.remove('hidden');
    setTimeout(hideErrorToast, 5000);
}

function hideErrorToast() {
    document.getElementById('errorToast').classList.add('hidden');
}

// Update pay button state
function setPayButtonLoading(isLoading) {
    const button = document.getElementById('payButton');
    const buttonText = document.getElementById('payButtonText');
    const buttonLoading = document.getElementById('payButtonLoading');
    
    if (isLoading) {
        button.disabled = true;
        buttonText.classList.add('hidden');
        buttonLoading.classList.remove('hidden');
    } else {
        button.disabled = false;
        buttonText.classList.remove('hidden');
        buttonLoading.classList.add('hidden');
    }
}

function resetPayButton() {
    setPayButtonLoading(false);
}

// Refresh transactions
async function refreshTransactions() {
    try {
        const response = await fetch('/user/api/wallet/transactions');
        const data = await response.json();
        
        if (response.ok) {
            window.location.reload();
        }
    } catch (error) {
        showErrorToast('Failed to refresh transactions');
    }
}

// Main payment function with enhanced error handling
async function processPayment() {
    const amountInput = document.getElementById('amountInput');
    const amount = parseFloat(amountInput.value);
    
    if (!amount || isNaN(amount) || amount < 10) {
        showErrorToast('Please enter a valid amount (minimum ₹10)');
        return;
    }
    
    // Store for retry
    lastPaymentAttempt = { amount };
    
    try {
        setPayButtonLoading(true);
        
        console.log('Creating order for ₹' + amount);
        
        // Step 1: Create order on server
        const orderResponse = await fetch('/user/api/wallet/create-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ amount: amount })
        });
        
        // Check if response is JSON
        const contentType = orderResponse.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await orderResponse.text();
            console.error('Non-JSON response:', text.substring(0, 200));
            throw new Error('Server returned unexpected response. Please try again.');
        }
        
        const orderData = await orderResponse.json();
        console.log('Order response:', orderData);
        
        if (!orderResponse.ok || !orderData.success) {
            throw new Error(orderData.error || 'Failed to create payment order');
        }
        
        console.log('Opening Razorpay checkout with order:', orderData.orderId);
        
        // Step 2: Open Razorpay checkout
        const options = {
            key: RAZORPAY_KEY,
            amount: orderData.amount,
            currency: orderData.currency || 'INR',
            name: 'Wallet Recharge',
            description: `Add ₹${amount} to wallet`,
            order_id: orderData.orderId,
            handler: async function(response) {
                console.log('Payment completed:', response);
                setPayButtonLoading(true);
                
                try {
                    // Step 3: Verify payment on server
                    const verifyResponse = await fetch('/user/api/wallet/process-payment', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_signature: response.razorpay_signature,
                            amount: amount
                        })
                    });
                    
                    console.log('Verify response status:', verifyResponse.status);
                    
                    // Check if response is JSON
                    const verifyContentType = verifyResponse.headers.get('content-type');
                    if (!verifyContentType || !verifyContentType.includes('application/json')) {
                        const text = await verifyResponse.text();
                        console.error('Non-JSON verify response:', text.substring(0, 200));
                        throw new Error('Payment verification failed. Please contact support.');
                    }
                    
                    const verifyData = await verifyResponse.json();
                    console.log('Verify data:', verifyData);
                    
                    if (verifyResponse.ok && verifyData.success) {
                        // Success
                     closeModal();
showPaymentSuccessModal(
    verifyData.message || 'Payment successful! Funds added to wallet.'
);

                        
                    } else {
                        // Payment verification failed
                        const errorMsg = verifyData.error || 'Payment verification failed';
                        console.error('Payment verification failed:', errorMsg);
                        
                        // Show payment failed modal with detailed message
                        showPaymentFailedModal(errorMsg);
                    }
                    
                } catch (error) {
                    console.error('Verification error:', error);
                    
                    // Show payment failed modal
                    showPaymentFailedModal(error.message || 'Payment processing failed. Please try again.');
                    
                    resetPayButton();
                }
            },
            prefill: {
                name: '<%= user.name || "Customer" %>',
                email: '<%= user.email || "customer@example.com" %>',
                contact: '<%= user.phone || "9876543210" %>'
            },
            theme: {
                color: '#d4af37' // Gold color
            },
            modal: {
                ondismiss: function() {
                    console.log('Payment cancelled by user');
                    showErrorToast('Payment cancelled. You can try again.');
                    resetPayButton();
                }
            },
            // Add error handler for Razorpay
            
        };
        
        
        console.log('Razorpay options:', options);
        
        // Check if Razorpay is available
        if (typeof Razorpay === 'undefined') {
            throw new Error('Payment gateway not available. Please refresh the page.');
        }
        
     const rzp = new Razorpay(options);

// ✅ HANDLE PAYMENT FAILURE (THIS IS IMPORTANT)
rzp.on('payment.failed', function (response) {
    console.error('❌ Razorpay payment failed:', response);

    let msg = 'Payment failed. Please try again.';
    if (response.error && response.error.description) {
        msg = response.error.description;
    }

    showPaymentFailedModal(msg);
    resetPayButton();
});

// ✅ OPEN RAZORPAY
rzp.open();

        
    } catch (error) {
        console.error('Payment error:', error);
        console.error('Error stack:', error.stack);
        
        // Show payment failed modal instead of toast
        showPaymentFailedModal(error.message || 'Payment failed. Please try again.');
        
        resetPayButton();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('Wallet page loaded');
    console.log('Razorpay available:', typeof Razorpay !== 'undefined');
    
    // Focus amount input when modal opens
    document.getElementById('amountInput').addEventListener('focus', function() {
        this.select();
    });
    
    // Allow Enter key to trigger payment
    document.getElementById('amountInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            processPayment();
        }
    });
    
    // Close failed modal on outside click
    document.getElementById('paymentFailedModal').addEventListener('click', function(e) {
        if (e.target.id === 'paymentFailedModal') {
            closeFailedModal();
        }
    });
    
    // Check if there's a payment failure in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('payment_failed')) {
        showPaymentFailedModal(urlParams.get('message') || 'Payment failed. Please try again.');
    }
});
