 // Toast Notification System
    function showToast(message, type = 'info', duration = 4000) {
      const container = document.getElementById('toastContainer');
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      
      // Icon SVG based on type
      let iconSVG = '';
      let title = '';
      
      if (type === 'success') {
        title = 'Success';
        iconSVG = `
          <svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        `;
      } else if (type === 'error') {
        title = 'Error';
        iconSVG = `
          <svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        `;
      } else {
        title = 'Info';
        iconSVG = `
          <svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        `;
      }
      
      toast.innerHTML = `
        ${iconSVG}
        <div class="toast-content">
          <div class="toast-title">${title}</div>
          <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      `;
      
      container.appendChild(toast);
      
      // Auto remove after duration
      setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => {
          if (toast.parentElement) {
            toast.remove();
          }
        }, 300);
      }, duration);
    }

    // Configuration
    const TIMER_DURATION = 60; // seconds
    let timeLeft = TIMER_DURATION;
    let timerInterval = null;

    // Elements
    const inputs = document.querySelectorAll('.code-input');
    const timerEl = document.getElementById('timer');
    const resendBtn = document.getElementById('resendBtn');
    const resendText = document.getElementById('resendText');
    const otpForm = document.getElementById('otpForm');
    const verifyBtn = document.getElementById('verifyBtn');
    const btnText = verifyBtn.querySelector('.btn-text');

    // Auto-focus & navigation
    inputs.forEach((input, index) => {
      // Only allow numbers
      input.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
        
        // Auto-move to next input
        if (e.target.value && index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
      });

      // Handle backspace
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && index > 0) {
          inputs[index - 1].focus();
        }
      });

      // Handle paste
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '');
        
        for (let i = 0; i < pastedData.length && index + i < inputs.length; i++) {
          inputs[index + i].value = pastedData[i];
        }
        
        // Focus last filled input or next empty one
        const lastIndex = Math.min(index + pastedData.length, inputs.length - 1);
        inputs[lastIndex].focus();
      });
    });

    // Focus first input on load
    inputs[0].focus();

    // Timer function
    function formatTime(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function updateTimer() {
      timerEl.textContent = formatTime(timeLeft);
      resendText.textContent = `Resend code in ${timeLeft}s`;
    }

    function startTimer() {
      clearInterval(timerInterval);
      timeLeft = TIMER_DURATION;
      updateTimer();
      
      // Disable resend button
      resendBtn.classList.remove('enabled');
      resendBtn.disabled = true;

      timerInterval = setInterval(() => {
        timeLeft--;
        
        if (timeLeft > 0) {
          updateTimer();
        } else {
          // Timer expired
          clearInterval(timerInterval);
          timerEl.textContent = "Expired";
          timerEl.classList.add('expired');
          resendText.textContent = "Resend Code Now";
          
          // Enable resend button
          resendBtn.classList.add('enabled');
          resendBtn.disabled = false;
        }
      }, 1000);
    }

    // Start timer on page load
    startTimer();

    // Submit OTP
    otpForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const otp = Array.from(inputs).map(i => i.value).join('');

      if (otp.length !== 6) {
        showToast("Please enter the complete 6-digit code", "error");
        return;
      }

      if (timeLeft <= 0) {
        showToast("OTP has expired. Please request a new code.", "error");
        return;
      }

      // 🔄 Show loading state
      verifyBtn.classList.add('loading');
      verifyBtn.disabled = true;
      btnText.innerHTML = `<span class="spinner"></span> Verifying...`;

      try {
        // Simulate API call (replace with actual fetch)
        const res = await fetch('/user/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ otp })
        });

        const data = await res.json();

        if (data.success) {
          showToast("Verification successful! Redirecting...", "success");
          setTimeout(() => {
            window.location.href = data.redirect || "/user/dashboard";
          }, 1500);
        } else {
          showToast(data.message || "Invalid OTP. Please try again.", "error");
          inputs.forEach(i => i.value = '');
          inputs[0].focus();
        }
      } catch (err) {
        console.error(err);
        showToast("Network error. Please check your connection.", "error");
      } finally {
        // 🔁 Restore button state
        verifyBtn.classList.remove('loading');
        verifyBtn.disabled = false;
        btnText.textContent = "Verify Account";
      }
    });

    // Resend OTP with loading state
    resendBtn.addEventListener('click', async () => {
      if (!resendBtn.classList.contains('enabled') || resendBtn.classList.contains('loading')) {
        return; // Prevent click before timer expires or during loading
      }

      // 🔄 Show loading state for resend button
      resendBtn.classList.add('loading');
      resendBtn.disabled = true;
      resendText.innerHTML = `<span class="spinner spinner-sm"></span> Sending...`;

      try {
        // Simulate API call (replace with actual fetch)
        const res = await fetch('/user/resend-otp', { 
          method: 'POST',
          credentials: 'include'
        });
        
        const data = await res.json();
        
        if (data.success) {
          showToast(data.message || "New OTP sent to your email!", "success");
          
          // Clear inputs
          inputs.forEach(i => i.value = '');
          inputs[0].focus();
          
          // Restart timer
          timerEl.classList.remove('expired');
          startTimer();
        } else {
          showToast(data.message || "Failed to resend OTP", "error");
        }
      } catch (err) {
        console.error(err);
        showToast("Failed to resend OTP. Please try again.", "error");
      } finally {
        // 🔁 Restore resend button state
        resendBtn.classList.remove('loading');
        resendBtn.disabled = false;
        
        if (timeLeft <= 0) {
          resendBtn.classList.add('enabled');
          resendText.textContent = "Resend Code Now";
        } else {
          resendText.textContent = `Resend code in ${timeLeft}s`;
        }
      }
    });

    // Optional: Display actual email (if available from previous page)
    function displayUserEmail() {
      const urlParams = new URLSearchParams(window.location.search);
      const email = urlParams.get('email') || localStorage.getItem('userEmail') || 'example@email.com';
      document.getElementById('emailDisplay').textContent = email;
    }

    // Call on page load
    displayUserEmail();