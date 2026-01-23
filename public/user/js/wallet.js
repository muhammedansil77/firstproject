
const RAZORPAY_KEY = 'rzp_test_Rnzlor5sRgTtD2';


let lastPaymentAttempt = null;


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

  
    window.location.reload();
}


function showPaymentFailedModal(message) {
    const modal = document.getElementById('paymentFailedModal');
    const messageEl = document.getElementById('failedMessage');

    if (!modal || !messageEl) {
        console.error(' Failed modal elements not found');
        return;
    }

    messageEl.textContent =
        message || 'We encountered an issue processing your payment. Please try again.';

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';

    console.log('Failed modal opened');
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


function setAmount(amount) {
    document.getElementById('amountInput').value = amount;
}


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


async function processPayment() {
    const amountInput = document.getElementById('amountInput');
    const amount = parseFloat(amountInput.value);
    
    if (!amount || isNaN(amount) || amount < 10) {
        showErrorToast('Please enter a valid amount (minimum ₹10)');
        return;
    }
    

    lastPaymentAttempt = { amount };
    
    try {
        setPayButtonLoading(true);
        
        console.log('Creating order for ₹' + amount);
        
    
        const orderResponse = await fetch('/user/api/wallet/create-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ amount: amount })
        });
        
      
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
                    
                  
                    const verifyContentType = verifyResponse.headers.get('content-type');
                    if (!verifyContentType || !verifyContentType.includes('application/json')) {
                        const text = await verifyResponse.text();
                        console.error('Non-JSON verify response:', text.substring(0, 200));
                        throw new Error('Payment verification failed. Please contact support.');
                    }
                    
                    const verifyData = await verifyResponse.json();
                    console.log('Verify data:', verifyData);
                    
                    if (verifyResponse.ok && verifyData.success) {
                      
                     closeModal();
showPaymentSuccessModal(
    verifyData.message || 'Payment successful! Funds added to wallet.'
);

                        
                    } else {
                       
                        const errorMsg = verifyData.error || 'Payment verification failed';
                        console.error('Payment verification failed:', errorMsg);
                        
                       
                        showPaymentFailedModal(errorMsg);
                    }
                    
                } catch (error) {
                    console.error('Verification error:', error);
                    
                   
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
                color: '#d4af37'
            },
            modal: {
                ondismiss: function() {
                    console.log('Payment cancelled by user');
                    showErrorToast('Payment cancelled. You can try again.');
                    resetPayButton();
                }
            },
          
            
        };
        
        
        console.log('Razorpay options:', options);
        
        
        if (typeof Razorpay === 'undefined') {
            throw new Error('Payment gateway not available. Please refresh the page.');
        }
        
     const rzp = new Razorpay(options);


rzp.on('payment.failed', function (response) {
    console.error(' Razorpay payment failed:', response);

    let msg = 'Payment failed. Please try again.';
    if (response.error && response.error.description) {
        msg = response.error.description;
    }

    showPaymentFailedModal(msg);
    resetPayButton();
});


rzp.open();

        
    } catch (error) {
        console.error('Payment error:', error);
        console.error('Error stack:', error.stack);
        
  
        showPaymentFailedModal(error.message || 'Payment failed. Please try again.');
        
        resetPayButton();
    }
}


document.addEventListener('DOMContentLoaded', function() {
    console.log('Wallet page loaded');
    console.log('Razorpay available:', typeof Razorpay !== 'undefined');
    
    
    document.getElementById('amountInput').addEventListener('focus', function() {
        this.select();
    });
    
   
    document.getElementById('amountInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            processPayment();
        }
    });
    
   
    document.getElementById('paymentFailedModal').addEventListener('click', function(e) {
        if (e.target.id === 'paymentFailedModal') {
            closeFailedModal();
        }
    });
    
  
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('payment_failed')) {
        showPaymentFailedModal(urlParams.get('message') || 'Payment failed. Please try again.');
    }
});
