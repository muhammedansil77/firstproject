document.addEventListener('DOMContentLoaded', function() {
 
  document.querySelectorAll('.password-toggle').forEach(button => {
    button.addEventListener('click', function() {
      const targetId = this.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;

    
      const icon = this.querySelector('i');
      if (input.type === 'password') {
        input.type = 'text';
        if (icon) {
          icon.classList.remove('bi-eye');
          icon.classList.add('bi-eye-slash');
        }
      } else {
        input.type = 'password';
        if (icon) {
          icon.classList.remove('bi-eye-slash');
          icon.classList.add('bi-eye');
        }
      }
    });
  });

 
  const passwordInput = document.getElementById('password');
  const strengthBars = Array.from(document.querySelectorAll('.strength-bar'));
  const strengthText = document.getElementById('strengthText');

  if (passwordInput) {
    passwordInput.addEventListener('input', function() {
      const password = this.value || '';
      const strength = calculatePasswordStrength(password);

      
      strengthBars.forEach((bar, i) => {
        if (i < strength.score) {
          bar.classList.add('active');
          bar.style.backgroundColor = getStrengthColor(strength.score);
        } else {
          bar.classList.remove('active');
          bar.style.backgroundColor = '';
        }
      });

      if (strengthText) {
        strengthText.textContent = strength.message;
        strengthText.style.color = getStrengthColor(strength.score);
      }
    });
  }

 
 
  const form = document.getElementById('signupForm');
  if (form) {
    form.addEventListener('submit', function(e) {

      clearErrors();

      if (!validateForm()) {
        e.preventDefault();
        return;
      }

    
      const submitBtn = this.querySelector('button[type="submit"], #createAccountBtn');
      if (submitBtn) {
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoader = submitBtn.querySelector('.btn-loader');

        if (btnText) btnText.classList.add('d-none');
        if (btnLoader) btnLoader.classList.remove('d-none');

        submitBtn.disabled = true;
      }
    });
  }



  window.closeModal = function() {
    const modalEl = document.getElementById('successModal');
    if (!modalEl) return;
    
    try {
     
      const bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
      bsModal.hide();
    } catch (e) {
    
      modalEl.classList.add('d-none');
    }
  
    window.location.href = '/user/login';
  };

 
  function clearErrors() {
    const ids = ['fullNameError','emailError','passwordError','confirmPasswordError','termsError','serverMessage'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    });

    
    document.querySelectorAll('.invalid-feedback').forEach(el => {
      el.textContent = '';
    });
  }
});


function calculatePasswordStrength(password) {
  let score = 0;
  let message = 'Password strength';

  if (!password) return { score: 0, message };

 
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;


  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  
  if (score <= 1) score = 1;
  score = Math.min(4, score);

  const messages = ['Very weak','Weak','Fair','Good','Strong'];
  return { score, message: messages[score] || messages[0] };
}

function getStrengthColor(score) {
  const colors = [
    '#ef4444',
    '#f97316', 
    '#eab308', 
    '#84cc16',
    '#10b981' 
  ];
  return colors[score] || colors[0];
}

function validateForm() {
  let isValid = true;

  const fullName = document.getElementById('fullName');
  if (!fullName || fullName.value.trim().length < 2) {
    const el = document.getElementById('fullNameError');
    if (el) el.textContent = 'Full name must be at least 2 characters';
    isValid = false;
  }


  const email = document.getElementById('email');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email.value.trim())) {
    const el = document.getElementById('emailError');
    if (el) el.textContent = 'Please enter a valid email address';
    isValid = false;
  }


  const password = document.getElementById('password');
  if (!password || password.value.length < 8) {
    const el = document.getElementById('passwordError');
    if (el) el.textContent = 'Password must be at least 8 characters';
    isValid = false;
  }


  const confirmPassword = document.getElementById('confirmPassword');
  if (!confirmPassword || password.value !== confirmPassword.value) {
    const el = document.getElementById('confirmPasswordError');
    if (el) el.textContent = 'Passwords do not match';
    isValid = false;
  }


  const terms = document.getElementById('terms');
  if (!terms || !terms.checked) {
    const el = document.getElementById('termsError');
    if (el) el.textContent = 'You must agree to the terms and conditions';
    isValid = false;
  }

  return isValid;
}
// Validate referral code format
document.getElementById('referralCode')?.addEventListener('blur', function() {
  const code = this.value.trim().toUpperCase();
  const errorElement = document.getElementById('referralCodeError') || 
                       document.createElement('div');
  
  if (!this.value.trim()) return; // Empty is allowed
  
  // Basic validation: 6-20 characters, alphanumeric
  if (code.length < 6 || code.length > 20) {
    errorElement.className = 'text-warning small mt-1';
    errorElement.textContent = 'Referral code should be 6-20 characters';
    if (!document.getElementById('referralCodeError')) {
      errorElement.id = 'referralCodeError';
      this.parentNode.appendChild(errorElement);
    }
  } else if (!/^[A-Z0-9]+$/.test(code)) {
    errorElement.className = 'text-warning small mt-1';
    errorElement.textContent = 'Referral code should contain only letters and numbers';
    if (!document.getElementById('referralCodeError')) {
      errorElement.id = 'referralCodeError';
      this.parentNode.appendChild(errorElement);
    }
  } else {
    // Remove error if exists
    const existingError = document.getElementById('referralCodeError');
    if (existingError) {
      existingError.remove();
    }
  }
});
