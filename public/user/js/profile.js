document.addEventListener("DOMContentLoaded", () => {


  let otpMode = false;
  let otpTimer = null;
  let timeLeft = 60;


  function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `
      px-4 py-3 rounded-lg shadow-lg text-sm font-medium
      transition-all duration-500 ease-in-out
      opacity-0 translate-y-2
      ${type === "success"
        ? "bg-green-600 text-white"
        : type === "error"
        ? "bg-red-600 text-white"
        : "bg-gray-800 text-white"}
    `;

    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.remove("opacity-0", "translate-y-2");
    });

    setTimeout(() => {
      toast.classList.add("opacity-0", "translate-y-2");
      setTimeout(() => toast.remove(), 500);
    }, 4000);
  }


function startOtpTimer() {
  clearInterval(otpTimer);
  timeLeft = 60;

  const timerSpan = document.getElementById("timer");
  const resendBtn = document.getElementById("resendOtpBtn");

  resendBtn.disabled = true;
  timerSpan.textContent = timeLeft;

  otpTimer = setInterval(() => {
    timeLeft--;
    timerSpan.textContent = timeLeft;

    if (timeLeft <= 0) {
      clearInterval(otpTimer);
      resendBtn.disabled = false;

      document.getElementById("otpTimer").textContent =
        "Didn’t receive the OTP?";
    }
  }, 1000);
}



  window.openEditProfileModal = () => {
    document.getElementById("editProfileModal")?.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  };

  window.closeEditProfileModal = () => {
    document.getElementById("editProfileModal")?.classList.add("hidden");
    document.body.style.overflow = "auto";
  };

  window.openChangeEmailModal = () => {
    otpMode = false;
    clearInterval(otpTimer);

    document.getElementById("newEmail").value = "";
    document.getElementById("emailOtp").value = "";
    document.getElementById("otpSection").classList.add("hidden");
    document.getElementById("emailSubmitBtn").textContent = "Send Verification";

    document.getElementById("changeEmailModal")?.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  };

  window.closeChangeEmailModal = () => {
    document.getElementById("changeEmailModal")?.classList.add("hidden");
    document.body.style.overflow = "auto";
  };

  window.openChangePasswordModal = () => {
    document.getElementById("changePasswordForm")?.reset();
    document.getElementById("changePasswordModal")?.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  };

  window.closeChangePasswordModal = () => {
    document.getElementById("changePasswordModal")?.classList.add("hidden");
    document.body.style.overflow = "auto";
  };


  window.resendOtp = async () => {
    const newEmail = document.getElementById("newEmail").value;

    const res = await fetch("/user/profile/email/resend-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail })
    });

    const result = await res.json();

    if (!result.success) {
      return showToast(result.message || "Failed to resend OTP", "error");
    }

    showToast("OTP resent successfully");
    startOtpTimer();
  };


  document.getElementById("editProfileForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = Object.fromEntries(new FormData(e.target).entries());

    const res = await fetch("/user/profile/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (!result.success) {
      return showToast(result.message || "Update failed", "error");
    }

    showToast("Profile updated successfully");
    window.closeEditProfileModal();
    location.reload();
  });


  document.getElementById("changeEmailForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = Object.fromEntries(new FormData(e.target).entries());

    const url = otpMode
      ? "/user/profile/email/verify-change"
      : "/user/profile/email/initiate-change";

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (!result.success) {
      return showToast(result.message || "Error", "error");
    }

    if (!otpMode) {
      otpMode = true;
      document.getElementById("otpSection").classList.remove("hidden");
      document.getElementById("emailSubmitBtn").textContent = "Verify OTP";
      showToast("OTP sent to email");

      setTimeout(startOtpTimer, 100);
      return;
    }

    showToast("Email updated successfully");
    window.closeChangeEmailModal();
    otpMode = false;
  });


  document.getElementById("changePasswordForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = Object.fromEntries(new FormData(e.target).entries());

    if (data.newPassword !== data.confirmPassword) {
      return showToast("Passwords do not match", "error");
    }

    const res = await fetch("/user/profile/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword
      })
    });

    const result = await res.json();

    if (!result.success) {
      return showToast(result.message || "Password change failed", "error");
    }

    showToast("Password changed successfully");
    window.closeChangePasswordModal();
  });


  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      window.closeEditProfileModal();
      window.closeChangeEmailModal();
      window.closeChangePasswordModal();
    }
  });

  document.querySelectorAll('[id$="Modal"]').forEach(modal => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        window.closeEditProfileModal();
        window.closeChangeEmailModal();
        window.closeChangePasswordModal();
      }
    });
  });

});
