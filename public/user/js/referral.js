// Copy referral code
function copyReferralCode() {
  const codeElement = document.getElementById('referralCodeDisplay');
  if (!codeElement) {
    console.error('Referral code element not found');
    showNotification('Referral code not found', 'error');
    return;
  }
  
  const code = codeElement.textContent.trim();
  
  if (!code || code === 'GENERATING...') {
    showNotification('Referral code is not ready yet', 'warning');
    return;
  }
  
  navigator.clipboard.writeText(code)
    .then(() => {
      showNotification('Referral code copied!', 'success');
    })
    .catch(err => {
      console.error('Copy failed:', err);
      copyToClipboardFallback(code);
    });
}

// Copy referral link
function copyReferralLink() {
  const linkElement = document.getElementById('referralLink');
  if (!linkElement) {
    console.error('Referral link element not found');
    showNotification('Referral link not found', 'error');
    return;
  }
  
  const link = linkElement.textContent.trim();
  
  if (!link || link === '#') {
    showNotification('Referral link is not ready yet', 'warning');
    return;
  }
  
  navigator.clipboard.writeText(link)
    .then(() => {
      showNotification('Link copied!', 'success');
    })
    .catch(err => {
      console.error('Copy failed:', err);
      copyToClipboardFallback(link);
    });
}

// Fallback clipboard method for older browsers
function copyToClipboardFallback(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    const successful = document.execCommand('copy');
    if (successful) {
      showNotification('Copied to clipboard!', 'success');
    } else {
      showNotification('Failed to copy. Please copy manually.', 'error');
    }
  } catch (err) {
    console.error('Fallback copy error:', err);
    showNotification('Failed to copy. Please copy manually.', 'error');
  } finally {
    document.body.removeChild(textArea);
  }
}

// Share via WhatsApp
function shareViaWhatsApp() {
  const codeElement = document.getElementById('referralCodeDisplay');
  const linkElement = document.getElementById('referralLink');
  
  if (!codeElement || !linkElement) {
    showNotification('Referral information not ready', 'error');
    return;
  }
  
  const code = codeElement.textContent.trim();
  const link = linkElement.textContent.trim();
  
  if (!code || code === 'GENERATING...' || !link || link === '#') {
    showNotification('Referral information is not ready yet', 'warning');
    return;
  }
  
  const text = `Join me on ${document.title}! Use my referral code: ${code} to get ₹100 bonus on signup. Sign up here: ${link}`;
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

// Share via Email
function shareViaEmail() {
  const codeElement = document.getElementById('referralCodeDisplay');
  const linkElement = document.getElementById('referralLink');
  const userName = document.body.getAttribute('data-user-name') || 'User';
  
  if (!codeElement || !linkElement) {
    showNotification('Referral information not ready', 'error');
    return;
  }
  
  const code = codeElement.textContent.trim();
  const link = linkElement.textContent.trim();
  
  if (!code || code === 'GENERATING...' || !link || link === '#') {
    showNotification('Referral information is not ready yet', 'warning');
    return;
  }
  
  const subject = `Join me on ${document.title}!`;
  const body = `Hi!\n\nJoin me on ${document.title} and get ₹100 bonus when you sign up using my referral code: ${code}\n\nSign up here: ${link}\n\nBest regards,\n${userName}`;
  const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = url;
}

// Share via SMS
function shareViaSMS() {
  const codeElement = document.getElementById('referralCodeDisplay');
  const linkElement = document.getElementById('referralLink');
  
  if (!codeElement || !linkElement) {
    showNotification('Referral information not ready', 'error');
    return;
  }
  
  const code = codeElement.textContent.trim();
  const link = linkElement.textContent.trim();
  
  if (!code || code === 'GENERATING...' || !link || link === '#') {
    showNotification('Referral information is not ready yet', 'warning');
    return;
  }
  
  const text = `Join ${document.title}! Use code: ${code} for ₹100 bonus. Sign up: ${link}`;
  const url = `sms:?&body=${encodeURIComponent(text)}`;
  window.location.href = url;
}

// Remind friend
function remindFriend(email) {
  if (!email) {
    console.error('No email provided');
    showNotification('No email address found', 'error');
    return;
  }
  
  if (confirm(`Send reminder email to ${email}?`)) {
    // Adjust the API endpoint based on your routes
    fetch('/user/referrals/remind', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: email })
    })
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      if (data.success) {
        showNotification('Reminder sent!', 'success');
      } else {
        showNotification(data.message || 'Failed to send reminder', 'error');
      }
    })
    .catch(err => {
      console.error('Reminder error:', err);
      showNotification('Error sending reminder', 'error');
    });
  }
}

// Show notification
function showNotification(message, type = 'info') {
  // Remove any existing notifications
  const existingNotifications = document.querySelectorAll('.custom-notification');
  existingNotifications.forEach(notif => {
    if (notif.parentNode) {
      notif.parentNode.removeChild(notif);
    }
  });
  
  const notification = document.createElement('div');
  notification.className = `custom-notification fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transform transition-all duration-300 ${
    type === 'success' ? 'bg-green-900/90 border border-green-700' :
    type === 'error' ? 'bg-red-900/90 border border-red-700' :
    type === 'warning' ? 'bg-yellow-900/90 border border-yellow-700' :
    'bg-blue-900/90 border border-blue-700'
  }`;
  
  const icons = {
    success: 'M5 13l4 4L19 7',
    error: 'M6 18L18 6M6 6l12 12',
    warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.694-.833-2.464 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z',
    info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
  };
  
  const colors = {
    success: 'text-green-400',
    error: 'text-red-400',
    warning: 'text-yellow-400',
    info: 'text-blue-400'
  };
  
  notification.innerHTML = `
    <div class="flex items-center gap-3">
      <svg class="w-5 h-5 ${colors[type]}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${icons[type]}"/>
      </svg>
      <span class="text-white">${message}</span>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.style.transform = 'translateY(0)';
    notification.style.opacity = '1';
  }, 10);
  
  // Remove after 5 seconds
  setTimeout(() => {
    notification.style.transform = 'translateX(100%)';
    notification.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 5000);
}

// Add CSS for notification
const style = document.createElement('style');
style.textContent = `
  .custom-notification {
    transform: translateX(100%);
    opacity: 0;
    animation: slideIn 0.3s ease-out forwards;
  }
  
  @keyframes slideIn {
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);