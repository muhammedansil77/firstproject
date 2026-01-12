  function openEditProfileModal() {
    console.log('Opening edit profile modal');
    
    // Fill form with current data
document.getElementById('editFullName')
document.getElementById('editPhone')

    
    const modal = document.getElementById('editProfileModal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeEditProfileModal() {
    const modal = document.getElementById('editProfileModal');
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
  }
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');

  toast.className = `
    px-4 py-3 rounded-lg shadow-lg text-sm font-medium
    transition-all duration-500 ease-in-out
    opacity-0 translate-y-2
    ${type === 'success' ? 'bg-green-600 text-white' :
      type === 'error' ? 'bg-red-600 text-white' :
      'bg-gray-800 text-white'}
  `;

  toast.textContent = message;
  container.appendChild(toast);

  // Animate IN
  requestAnimationFrame(() => {
    toast.classList.remove('opacity-0', 'translate-y-2');
  });

  // Animate OUT
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 500);
  }, 4000);
}



  // Change Email Modal Functions
  function openChangeEmailModal() {
    console.log('Opening change email modal');
    
    document.getElementById('newEmail').value = '';
    document.getElementById('emailOtp').value = '';
    document.getElementById('otpSection').classList.add('hidden');
    document.getElementById('emailSubmitBtn').textContent = 'Send Verification';
    
    const modal = document.getElementById('changeEmailModal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeChangeEmailModal() {
    const modal = document.getElementById('changeEmailModal');
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
  }

  // Change Password Modal Functions
  function openChangePasswordModal() {
    console.log('Opening change password modal');
    
    const form = document.getElementById('changePasswordForm');
    form.reset();
    
    const modal = document.getElementById('changePasswordModal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeChangePasswordModal() {
    const modal = document.getElementById('changePasswordModal');
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
  }

  // Close modals with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeEditProfileModal();
      closeChangeEmailModal();
      closeChangePasswordModal();
    }
  });

  // Form Submissions
  document.getElementById('editProfileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    try {
      const response = await fetch('/user/profile/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (result.success) {
       showToast('Profile updated successfully!', 'success');

        closeEditProfileModal();
        location.reload(); // Refresh to show updated data
      } else {
       showToast(result.message || 'Something went wrong', 'error');

      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to update profile. Please try again.');
    }
  });

  // Email Change Form
  let otpMode = false;

document.getElementById("changeEmailForm").addEventListener("submit", async e => {
  e.preventDefault();

  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());

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
  } else {
    showToast("Email updated successfully");
    document.querySelector("[data-profile-email]").textContent = result.email;
    document.getElementById("changeEmailModal").classList.add("hidden");
    otpMode = false;
  }
});

function showToast(msg, type = "success") {
  const t = document.createElement("div");
  t.className = `px-4 py-2 rounded text-white ${
    type === "success" ? "bg-green-600" : "bg-red-600"
  }`;
  t.textContent = msg;
  document.getElementById("toast-container").appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());

  // Frontend validation
  if (data.newPassword !== data.confirmPassword) {
    return showToast('Passwords do not match', 'error');
  }

  try {
    const response = await fetch('/user/profile/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword
      })
    });

    const result = await response.json();

    if (!result.success) {
      return showToast(result.message || 'Password change failed', 'error');
    }

    showToast('Password changed successfully', 'success');
    closeChangePasswordModal();
    e.target.reset();

  } catch (error) {
    console.error(error);
    showToast('Server error while changing password', 'error');
  }
});


  // Close modal when clicking outside
  document.querySelectorAll('[id$="Modal"]').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (modal.id === 'editProfileModal') closeEditProfileModal();
        if (modal.id === 'changeEmailModal') closeChangeEmailModal();
        if (modal.id === 'changePasswordModal') closeChangePasswordModal();
      }
    });
  });
function openImageUpload() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';

  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('profileImage', file); // ✅ must match multer

    try {
      const res = await fetch('/user/profile/upload-image', {
        method: 'POST',
        body: formData
      });

      const result = await res.json();

      if (!result.success) {
        return showToast(result.message || 'Image upload failed', 'error');
      }

      showToast('Profile picture updated successfully!', 'success');

      // Update image instantly without full reload
      const img = document.querySelector('img[alt="Profile"]');
      if (img) {
        img.src = result.profilePicture + '?t=' + Date.now();
      }

    } catch (err) {
      console.error(err);
      showToast('Error uploading image', 'error');
    }
  };

  input.click();
}

