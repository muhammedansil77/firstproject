document.addEventListener('DOMContentLoaded', function() {
  // -------------------------
  // Password toggle (Bootstrap Icons)
  // -------------------------
  document.querySelectorAll('.password-toggle').forEach(button => {
    button.addEventListener('click', function() {
      const targetId = this.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;

      // find <i> inside the button (bootstrap icon)
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

  // -------------------------
  // Password strength checker
  // -------------------------
  const passwordInput = document.getElementById('password');
  const strengthBars = Array.from(document.querySelectorAll('.strength-bar'));
  const strengthText = document.getElementById('strengthText');

  if (passwordInput) {
    passwordInput.addEventListener('input', function() {
      const password = this.value || '';
      const strength = calculatePasswordStrength(password);

      // update bars: add active class for filled bars
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

  // -------------------------
  // Form validation + submit handling
  // -------------------------
  const form = document.getElementById('signupForm');
  if (form) {
    form.addEventListener('submit', function(e) {
      // clear previous errors
      clearErrors();

      if (!validateForm()) {
        e.preventDefault();
        return;
      }

      // show loading state and disable button
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

  // -------------------------
  // Close modal (Bootstrap-friendly)
  // -------------------------
  window.closeModal = function() {
    const modalEl = document.getElementById('successModal');
    if (!modalEl) return;
    // If bootstrap modal JS exists, use it
    try {
      // bootstrap 5
      const bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
      bsModal.hide();
    } catch (e) {
      // fallback
      modalEl.classList.add('d-none');
    }
    // redirect to login by default
    window.location.href = '/user/login';
  };

  // helper: clear inline errors and invalid-feedback containers
  function clearErrors() {
    const ids = ['fullNameError','emailError','passwordError','confirmPasswordError','termsError','serverMessage'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    });

    // clear any invalid-feedback elements
    document.querySelectorAll('.invalid-feedback').forEach(el => {
      el.textContent = '';
    });
  }
});

// ---------- Password strength util ----------
function calculatePasswordStrength(password) {
  let score = 0;
  let message = 'Password strength';

  if (!password) return { score: 0, message };

  // length
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;

  // complexity
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  // Normalize score to 0..4
  if (score <= 1) score = 1; // ensure 1 minimum if any condition met (optional)
  score = Math.min(4, score);

  const messages = ['Very weak','Weak','Fair','Good','Strong'];
  return { score, message: messages[score] || messages[0] };
}

function getStrengthColor(score) {
  const colors = [
    '#ef4444', // 0 / fallback
    '#f97316', // 1
    '#eab308', // 2
    '#84cc16', // 3
    '#10b981'  // 4
  ];
  return colors[score] || colors[0];
}

// ---------- Form validation ----------
function validateForm() {
  let isValid = true;

  // full name
  const fullName = document.getElementById('fullName');
  if (!fullName || fullName.value.trim().length < 2) {
    const el = document.getElementById('fullNameError');
    if (el) el.textContent = 'Full name must be at least 2 characters';
    isValid = false;
  }

  // email
  const email = document.getElementById('email');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email.value.trim())) {
    const el = document.getElementById('emailError');
    if (el) el.textContent = 'Please enter a valid email address';
    isValid = false;
  }

  // password
  const password = document.getElementById('password');
  if (!password || password.value.length < 8) {
    const el = document.getElementById('passwordError');
    if (el) el.textContent = 'Password must be at least 8 characters';
    isValid = false;
  }

  // confirm
  const confirmPassword = document.getElementById('confirmPassword');
  if (!confirmPassword || password.value !== confirmPassword.value) {
    const el = document.getElementById('confirmPasswordError');
    if (el) el.textContent = 'Passwords do not match';
    isValid = false;
  }

  // terms
  const terms = document.getElementById('terms');
  if (!terms || !terms.checked) {
    const el = document.getElementById('termsError');
    if (el) el.textContent = 'You must agree to the terms and conditions';
    isValid = false;
  }

  return isValid;
}
