
const paymentTemplates = {
  upi: `
    <label class="block text-gray-300 mb-2">UPI ID</label>
    <input 
      type="text" 
      name="payment_details[upi_id]"
      placeholder="username@upi"
      class="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg py-3 px-4 text-white placeholder-gray-500 focus:border-[#d4af37] focus:outline-none transition-all"
      pattern="^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+$"
      required
    >
    <p class="text-gray-400 text-xs mt-2">Enter your UPI ID (e.g., username@okhdfcbank)</p>
  `,
  
  bank_transfer: `
    <div class="space-y-4">
      <div>
        <label class="block text-gray-300 mb-2">Account Holder Name</label>
        <input 
          type="text" 
          name="payment_details[account_holder]"
          placeholder="Full name as per bank"
          class="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg py-3 px-4 text-white placeholder-gray-500 focus:border-[#d4af37] focus:outline-none transition-all"
          required
        >
      </div>
      
      <div>
        <label class="block text-gray-300 mb-2">Account Number</label>
        <input 
          type="text" 
          name="payment_details[account_number]"
          placeholder="Bank account number"
          class="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg py-3 px-4 text-white placeholder-gray-500 focus:border-[#d4af37] focus:outline-none transition-all"
          pattern="^[0-9]{9,18}$"
          required
        >
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-gray-300 mb-2">IFSC Code</label>
          <input 
            type="text" 
            name="payment_details[ifsc_code]"
            placeholder="e.g., HDFC0001234"
            class="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg py-3 px-4 text-white placeholder-gray-500 focus:border-[#d4af37] focus:outline-none transition-all"
            pattern="^[A-Z]{4}0[A-Z0-9]{6}$"
            required
          >
        </div>
        
        <div>
          <label class="block text-gray-300 mb-2">Bank Name</label>
          <input 
            type="text" 
            name="payment_details[bank_name]"
            placeholder="e.g., HDFC Bank"
            class="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg py-3 px-4 text-white placeholder-gray-500 focus:border-[#d4af37] focus:outline-none transition-all"
            required
          >
        </div>
      </div>
    </div>
  `,
  
  paytm: `
    <label class="block text-gray-300 mb-2">Paytm Number</label>
    <input 
      type="tel" 
      name="payment_details[paytm]"
      placeholder="Registered Paytm mobile number"
      class="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg py-3 px-4 text-white placeholder-gray-500 focus:border-[#d4af37] focus:outline-none transition-all"
      pattern="^[0-9]{10}$"
      required
    >
    <p class="text-gray-400 text-xs mt-2">Enter your 10-digit Paytm registered mobile number</p>
  `,
  
  phonepe: `
    <label class="block text-gray-300 mb-2">PhonePe UPI ID or Number</label>
    <input 
      type="text" 
      name="payment_details[phonepe]"
      placeholder="username@ybl or mobile number"
      class="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg py-3 px-4 text-white placeholder-gray-500 focus:border-[#d4af37] focus:outline-none transition-all"
      required
    >
    <p class="text-gray-400 text-xs mt-2">Enter your PhonePe UPI ID or registered mobile number</p>
  `,
  
  gpay: `
    <label class="block text-gray-300 mb-2">Google Pay UPI ID</label>
    <input 
      type="text" 
      name="payment_details[gpay]"
      placeholder="username@okhdfcbank"
      class="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg py-3 px-4 text-white placeholder-gray-500 focus:border-[#d4af37] focus:outline-none transition-all"
      pattern="^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+$"
      required
    >
    <p class="text-gray-400 text-xs mt-2">Enter your Google Pay UPI ID</p>
  `
};


function setMaxAmount() {
  const maxAmount = <%= stats.availableBalance %>;
  document.getElementById('amount').value = maxAmount;
  document.getElementById('amount').max = maxAmount;
}


document.querySelectorAll('input[name="payment_method"]').forEach(radio => {
  radio.addEventListener('change', function() {
    const container = document.getElementById('paymentDetailsContainer');
    const method = this.value;
    
    if (paymentTemplates[method]) {
      container.innerHTML = paymentTemplates[method];
    } else {
      container.innerHTML = '<p class="text-gray-400">Please select a payment method</p>';
    }
  });
});

// Initialize with first payment method if available
const firstMethod = document.querySelector('input[name="payment_method"]:checked');
if (firstMethod) {
  firstMethod.dispatchEvent(new Event('change'));
}

// Form submission
document.getElementById('withdrawalForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const formData = new FormData(this);
  const data = Object.fromEntries(formData);
  
  // Convert nested payment_details object
  const paymentDetails = {};
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('payment_details[')) {
      const nestedKey = key.match(/\[(.*?)\]/)[1];
      paymentDetails[nestedKey] = value;
    }
  }
  
  const withdrawalData = {
    amount: parseInt(data.amount),
    payment_method: data.payment_method,
    payment_details: paymentDetails
  };
  
  try {
    const response = await fetch('/user/withdraw/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(withdrawalData)
    });
    
    const result = await response.json();
    
    if (result.success) {
      Swal.fire({
        title: 'Success!',
        text: result.message,
        icon: 'success',
        confirmButtonColor: '#d4af37',
        confirmButtonText: 'OK'
      }).then(() => {
        window.location.reload();
      });
    } else {
      Swal.fire({
        title: 'Error!',
        text: result.message,
        icon: 'error',
        confirmButtonColor: '#d4af37'
      });
    }
  } catch (error) {
    console.error('Withdrawal error:', error);
    Swal.fire({
      title: 'Error!',
      text: 'Failed to process withdrawal request',
      icon: 'error',
      confirmButtonColor: '#d4af37'
    });
  }
});

// Cancel withdrawal
async function cancelWithdrawal(withdrawalId) {
  const result = await Swal.fire({
    title: 'Cancel Withdrawal?',
    text: 'Are you sure you want to cancel this withdrawal request?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d4af37',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Yes, cancel it!'
  });
  
  if (result.isConfirmed) {
    try {
      const response = await fetch(`/user/withdraw/${withdrawalId}/cancel`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        Swal.fire({
          title: 'Cancelled!',
          text: data.message,
          icon: 'success',
          confirmButtonColor: '#d4af37'
        }).then(() => {
          window.location.reload();
        });
      } else {
        Swal.fire({
          title: 'Error!',
          text: data.message,
          icon: 'error',
          confirmButtonColor: '#d4af37'
        });
      }
    } catch (error) {
      console.error('Cancel error:', error);
      Swal.fire({
        title: 'Error!',
        text: 'Failed to cancel withdrawal',
        icon: 'error',
        confirmButtonColor: '#d4af37'
      });
    }
  }
}

// View rejection reason
function viewReason(reason) {
  Swal.fire({
    title: 'Rejection Reason',
    text: reason || 'No reason provided',
    icon: 'info',
    confirmButtonColor: '#d4af37'
  });
}

// Load more withdrawals
function loadMoreWithdrawals() {
  window.location.href = '/user/withdraw/history';
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  // Set max attribute on amount input
  const amountInput = document.getElementById('amount');
  if (amountInput) {
    amountInput.max = <%= stats.availableBalance %>;
  }
  
  // Validate amount on input
  amountInput.addEventListener('input', function() {
    const max = <%= stats.availableBalance %>;
    const value = parseInt(this.value);
    
    if (value > max) {
      this.value = max;
    }
    
    if (value < 100) {
      this.value = 100;
    }
  });
});