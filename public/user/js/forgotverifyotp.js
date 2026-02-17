 const inputs = document.querySelectorAll('.code-input');
    const timerEl = document.getElementById('timer');
    const resendBtn = document.getElementById('resendBtn');
    const resendText = document.getElementById('resendText');
    let timeLeft = 600;

    // Auto focus flow
    inputs.forEach((input, i) => {
      input.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, "");
        if (e.target.value && i < 5) inputs[i + 1].focus();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === "Backspace" && !input.value && i > 0)
          inputs[i - 1].focus();
      });
    });

    // Timer
    function startTimer() {
      clearInterval(window.otpTimer);
      timeLeft = 600;
      timerEl.textContent = "10:00";
      resendBtn.disabled = true;
      resendBtn.classList.remove("enabled");
      resendText.textContent = "Resend in 600s";

      window.otpTimer = setInterval(() => {
        timeLeft--;
        let m = String(Math.floor(timeLeft / 60)).padStart(2, "0");
        let s = String(timeLeft % 60).padStart(2, "0");
        timerEl.textContent = `${m}:${s}`;
        resendText.textContent = `Resend in ${timeLeft}s`;

        if (timeLeft <= 0) {
          clearInterval(window.otpTimer);
          timerEl.textContent = "Expired";
          resendText.innerHTML = "<span>Resend Now</span>";
          resendBtn.disabled = false;
          resendBtn.classList.add("enabled");
        }
      }, 1000);
    }
    startTimer();

    // Submit OTP
    document.getElementById("otpForm").addEventListener("submit", async (e) => {
      e.preventDefault();

      const otp = [...inputs].map(i => i.value).join("");

      if (otp.length !== 6) {
        alert("Please enter full 6-digit code");
        return;
      }

      try {
       // change the fetch in the page served by loadForgetVerifyOtpPage
const res = await fetch("/user/verify-forgot-otp", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ otp })
});

        const data = await res.json();

        if (data.success) {
          window.location.href = "/user/reset-password";
        } else {
          alert(data.message || "Invalid OTP");
          inputs.forEach(i => i.value = "");
          inputs[0].focus();
        }
      } catch {
        alert("Network error, try again.");
      }
    });

    // Resend OTP
    resendBtn.addEventListener("click", async () => {
      if (!resendBtn.classList.contains("enabled")) return;

      try {
       const res = await fetch("/user/resend-forgot-otp", { method: "POST", credentials: "include" });


        const data = await res.json();
        alert(data.message || "New OTP sent!");
        startTimer();
      } catch {
        alert("Failed to resend OTP");
      }
    });