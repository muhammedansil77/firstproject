let itiAddPrimary = null;
let itiAddAlternate = null;
let itiEditPrimary = null;
let itiEditAlternate = null;

/* =========================================================
   ADD ADDRESS MODAL
========================================================= */
function openAddModal() {
  const modal = document.getElementById('addModal');
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Initialize primary phone input
  const phoneInput = document.getElementById('phoneInput');
  if (phoneInput && window.intlTelInput) {
    if (itiAddPrimary) itiAddPrimary.destroy();
    itiAddPrimary = window.intlTelInput(phoneInput, {
      initialCountry: 'in',
      preferredCountries: ['in', 'us', 'gb', 'ae'],
      separateDialCode: true,
      utilsScript: 'https://cdn.jsdelivr.net/npm/intl-tel-input@19.2.16/build/js/utils.js'
    });
  }

  // Initialize alternate phone input
  const alternatePhoneInput = document.getElementById('alternatePhoneInput');
  if (alternatePhoneInput && window.intlTelInput) {
    if (itiAddAlternate) itiAddAlternate.destroy();
    itiAddAlternate = window.intlTelInput(alternatePhoneInput, {
      initialCountry: 'in',
      preferredCountries: ['in', 'us', 'gb', 'ae'],
      separateDialCode: true,
      utilsScript: 'https://cdn.jsdelivr.net/npm/intl-tel-input@19.2.16/build/js/utils.js'
    });
  }
}

function closeAddModal() {
  const modal = document.getElementById('addModal');
  modal.classList.add('hidden');
  document.body.style.overflow = 'auto';
}

/* =========================================================
   EDIT ADDRESS MODAL
========================================================= */
function openEditModal(address) {
  console.log("Opening edit modal with:", address);
  
  const modal = document.getElementById('editModal');
  if (!modal) {
    console.error("editModal not found!");
    return;
  }
  
  const form = document.getElementById('editForm');
  if (!form) {
    console.error("editForm not found!");
    return;
  }

  // Set form action
  form.action = `/user/address/edit/${address._id}`;

  // Set form values
  const fields = [
    { id: 'e_fullName', value: address.fullName || '' },
    { id: 'e_addressLine1', value: address.addressLine1 || '' },
    { id: 'e_addressLine2', value: address.addressLine2 || '' },
    { id: 'e_city', value: address.city || '' },
    { id: 'e_state', value: address.state || '' },
    { id: 'e_postalCode', value: address.postalCode || '' },
    { id: 'e_country', value: address.country || '' },
   
  ];

  fields.forEach(field => {
    const element = document.getElementById(field.id);
    if (element) {
      element.value = field.value;
    }
  });

  // Set checkbox
  const isDefaultCheckbox = document.getElementById('e_isDefault');
  if (isDefaultCheckbox) {
    isDefaultCheckbox.checked = address.isDefault || false;
  }

  // Set address type
  const typeRadios = document.querySelectorAll('#editForm input[name="addressType"]');
  typeRadios.forEach(radio => {
    radio.checked = (radio.value === address.addressType);
  });

  // Initialize primary phone input
  const phoneInput = document.getElementById('e_phone');
  if (phoneInput && window.intlTelInput) {
    if (itiEditPrimary) itiEditPrimary.destroy();
    itiEditPrimary = window.intlTelInput(phoneInput, {
      initialCountry: 'in',
      preferredCountries: ['in', 'us', 'gb', 'ae'],
      separateDialCode: true,
      utilsScript: 'https://cdn.jsdelivr.net/npm/intl-tel-input@19.2.16/build/js/utils.js'
    });
    if (address.phone) {
      itiEditPrimary.setNumber(address.phone);
    }
  }

  // Initialize alternate phone input
  const alternatePhoneInput = document.getElementById('e_alternatePhone');
  if (alternatePhoneInput && window.intlTelInput) {
    if (itiEditAlternate) itiEditAlternate.destroy();
    itiEditAlternate = window.intlTelInput(alternatePhoneInput, {
      initialCountry: 'in',
      preferredCountries: ['in', 'us', 'gb', 'ae'],
      separateDialCode: true,
      utilsScript: 'https://cdn.jsdelivr.net/npm/intl-tel-input@19.2.16/build/js/utils.js'
    });
   if (address.alternatePhone) {
  const alt = address.alternatePhone.toString().trim();

  itiEditAlternate.setNumber(
    alt.startsWith('+') ? alt : `+91${alt}`
  );
}

  }

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeEditModal() {
  const modal = document.getElementById('editModal');
  modal.classList.add('hidden');
  document.body.style.overflow = 'auto';
}

/* =========================================================
   VALIDATION FUNCTIONS
========================================================= */
function showToast(icon, message) {
  const toast = document.createElement('div');
  toast.className = `fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 ${
    icon === 'success' ? 'bg-green-600 text-white' :
    icon === 'error' ? 'bg-red-600 text-white' :
    icon === 'warning' ? 'bg-yellow-600 text-white' :
    'bg-blue-600 text-white'
  }`;
  toast.innerHTML = `
    <div class="flex items-center">
      <span class="mr-2">${icon === 'success' ? '✓' : icon === 'error' ? '✗' : '⚠'}</span>
      <span>${message}</span>
    </div>
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

function validateFullName(name) {
  const nameRegex = /^[a-zA-Z\s]+$/;
  if (!nameRegex.test(name)) {
    showToast('error', 'Name should contain only letters and spaces');
    return false;
  }
  return true;
}

function validateCity(city) {
  const cityRegex = /^[a-zA-Z\s]+$/;
  if (!cityRegex.test(city)) {
    showToast('error', 'City should contain only letters and spaces');
    return false;
  }
  return true;
}

function validatePostalCode(postalCode) {
  const postalCodeRegex = /^\d{5}$/;
  if (!postalCodeRegex.test(postalCode)) {
    showToast('error', 'Postal code must be exactly 5 digits');
    return false;
  }
  return true;
}

function validateState(state) {
  const stateRegex = /^[a-zA-Z\s]+$/;
  if (!stateRegex.test(state)) {
    showToast('error', 'State should contain only letters and spaces');
    return false;
  }
  return true;
}

function validatePhoneNumbers(iti1, iti2) {
  // Validate primary phone
  if (!iti1) {
    showToast('error', 'Primary phone number is required');
    return false;
  }

  if (!iti1.isValidNumber()) {
    showToast('error', 'Please enter a valid primary phone number');
    return false;
  }

  // Get formatted phone numbers
  const formattedPhone1 = iti1.getNumber();

  // Validate alternate phone if provided
  if (iti2 && iti2.getNumber()) {
    if (!iti2.isValidNumber()) {
      showToast('error', 'Please enter a valid alternate phone number');
      return false;
    }

    const formattedPhone2 = iti2.getNumber();
    
    // Check if phones are the same
    if (formattedPhone1 === formattedPhone2) {
      showToast('error', 'Primary and alternate phone numbers cannot be the same');
      return false;
    }
  }

  return true;
}
document.addEventListener("DOMContentLoaded", function () {
  const params = new URLSearchParams(window.location.search);
  const editId = params.get("edit");

  if (!editId) return;
  if (!window.ADDRESSES || !Array.isArray(window.ADDRESSES)) return;

  const address = window.ADDRESSES.find(a => a._id === editId);

  if (address) {
    // Small delay ensures intlTelInput + DOM are ready
    setTimeout(() => {
      openEditModal(address);
    }, 100);

    // Optional: clean URL after opening modal
    history.replaceState({}, "", "/user/address");
  }
});

/* =========================================================
   FORM SUBMIT VALIDATION (ADD + EDIT) - FIXED
========================================================= */
document.addEventListener('submit', function (e) {
  // ADD ADDRESS FORM
  if (e.target.matches('#addModal form')) {
    e.preventDefault();
    
    // Get form data
    const fullName = e.target.fullName.value.trim();
    const city = e.target.city.value.trim();
    const postalCode = e.target.postalCode.value.trim();
    const state = e.target.state.value.trim();
    
    // Validate all fields
    if (!validateFullName(fullName)) return;
    if (!validateCity(city)) return;
    if (!validatePostalCode(postalCode)) return;
    if (!validateState(state)) return;
    
    // Validate phone numbers
    if (!validatePhoneNumbers(itiAddPrimary, itiAddAlternate)) return;
    
    // Set formatted phone numbers
    e.target.phone.value = itiAddPrimary.getNumber();
    
    const alternatePhoneInput = document.getElementById('alternatePhoneInput');
    if (alternatePhoneInput && alternatePhoneInput.value.trim() && itiAddAlternate && itiAddAlternate.isValidNumber()) {
      e.target.alternatePhone.value = itiAddAlternate.getNumber();
    }
    
    // Submit the form
    showToast('success', 'Address added successfully');
    setTimeout(() => {
      e.target.submit();
    }, 1000);
  }

  // EDIT ADDRESS FORM
  if (e.target.matches('#editForm')) {
    e.preventDefault();
    
    // Get form data
    const fullName = e.target.fullName.value.trim();
    const city = e.target.city.value.trim();
    const postalCode = e.target.postalCode.value.trim();
    const state = e.target.state.value.trim();
    
    // Validate all fields
    if (!validateFullName(fullName)) return;
    if (!validateCity(city)) return;
    if (!validatePostalCode(postalCode)) return;
    if (!validateState(state)) return;
    
    // Validate phone numbers
    if (!validatePhoneNumbers(itiEditPrimary, itiEditAlternate)) return;
    
    // Set formatted phone numbers
    e.target.phone.value = itiEditPrimary.getNumber();
    
    const alternatePhoneInput = document.getElementById('e_alternatePhone');
    if (alternatePhoneInput && alternatePhoneInput.value.trim() && itiEditAlternate && itiEditAlternate.isValidNumber()) {
      e.target.alternatePhone.value = itiEditAlternate.getNumber();
    }
    
    // Submit the form
    showToast('success', 'Address updated successfully');
    setTimeout(() => {
      e.target.submit();
    }, 1000);
  }
});


document.addEventListener('DOMContentLoaded', function() {

 const inputs = document.querySelectorAll(
  'input[name="fullName"], input[name="city"], input[name="postalCode"], select[name="state"]'
);

  
  inputs.forEach(input => {
    // Add input event for postal code to allow only numbers
    if (input.name === 'postalCode') {
      input.addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9]/g, '');
        if (this.value.length > 5) {
          this.value = this.value.slice(0, 5);
        }
      });
    }
    
    // Add input event for name, city, state to allow only letters and spaces
  if (['fullName', 'city'].includes(input.name)) {

      input.addEventListener('input', function() {
        this.value = this.value.replace(/[^a-zA-Z\s]/g, '');
      });
    }
    
    // Add blur validation
    input.addEventListener('blur', function() {
      const value = this.value.trim();
      
      switch(this.name) {
        case 'fullName':
        case 'city':
        case 'state':
          if (value && !/^[a-zA-Z\s]+$/.test(value)) {
            showToast('error', `${this.getAttribute('placeholder') || this.name} should contain only letters and spaces`);
          }
          break;
          
        case 'postalCode':
          if (value && !/^\d{5}$/.test(value)) {
            showToast('error', 'Postal code must be exactly 5 digits');
          }
          break;
      }
    });
  });

  // Real-time validation for phone number comparison
  const phoneInputs = document.querySelectorAll('input[name="phone"], input[name="alternatePhone"]');
  
  phoneInputs.forEach(input => {
    input.addEventListener('input', function() {
      setTimeout(() => {
        const phone1 = document.querySelector('input[name="phone"]')?.value.trim();
        const phone2 = document.querySelector('input[name="alternatePhone"]')?.value.trim();
        
        if (phone1 && phone2 && phone1 === phone2) {
          showToast('error', 'Primary and alternate phone numbers cannot be the same');
        }
      }, 100);
    });
  });
});

/* =========================================================
   ADDRESS CARD DROPDOWN MENU
========================================================= */
function toggleAddressMenu(addressId) {
  const menu = document.getElementById(`menu-${addressId}`);
  const isVisible = !menu.classList.contains('hidden');

  document.querySelectorAll('[id^="menu-"]').forEach(m => {
    m.classList.add('hidden');
  });

  if (!isVisible) {
    menu.classList.remove('hidden');
  }
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('[id^="menu-"]') &&
      !e.target.closest('[onclick*="toggleAddressMenu"]')) {
    document.querySelectorAll('[id^="menu-"]').forEach(menu => {
      menu.classList.add('hidden');
    });
  }
});

/* =========================================================
   DELETE CONFIRMATION
========================================================= */
/* =========================================================
   DELETE CONFIRMATION WITH SWEETALERT2
========================================================= */
function confirmDelete(event) {
  event.preventDefault(); // Prevent immediate form submission
  
  const form = event.target.closest('form');
  if (!form) return;
  
  Swal.fire({
    title: 'Delete Address?',
    text: "Are you sure you want to delete this address? This action cannot be undone.",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Yes, delete it!',
    cancelButtonText: 'Cancel',
    background: '#0b0b0b',
    color: '#ffffff',
    iconColor: '#d4af37',
    customClass: {
      confirmButton: 'px-6 py-3 rounded-lg font-semibold',
      cancelButton: 'px-6 py-3 rounded-lg font-semibold'
    }
  }).then((result) => {
    if (result.isConfirmed) {
      // Show success message
      Swal.fire({
        title: 'Deleted!',
        text: 'Address has been deleted.',
        icon: 'success',
        background: '#0b0b0b',
        color: '#ffffff',
        iconColor: '#10b981',
        timer: 1500,
        showConfirmButton: false
      });
      
      // Submit the form after confirmation
      setTimeout(() => {
        form.submit();
      }, 1500);
    }
  });
}
/* =========================================================
   ESC KEY HANDLING
========================================================= */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAddModal();
    closeEditModal();
  }
});