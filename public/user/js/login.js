    function createParticles() {
            const particlesContainer = document.getElementById('particles');
            const particleCount = 15;
            
            for (let i = 0; i < particleCount; i++) {
                const particle = document.createElement('div');
                particle.classList.add('particle');
                
                // Random size and position
                const size = Math.random() * 60 + 20;
                particle.style.width = `${size}px`;
                particle.style.height = `${size}px`;
                particle.style.left = `${Math.random() * 100}vw`;
                particle.style.top = `${Math.random() * 100}vh`;
                
                // Random animation
                const duration = Math.random() * 20 + 10;
                const delay = Math.random() * 5;
                particle.style.animation = `float ${duration}s ease-in-out ${delay}s infinite`;
                
                particlesContainer.appendChild(particle);
            }
        }

        // Toggle password visibility
        function togglePassword() {
            const passwordInput = document.getElementById('password');
            const toggleBtn = document.querySelector('.toggle-password');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                toggleBtn.textContent = '🙈';
            } else {
                passwordInput.type = 'password';
                toggleBtn.textContent = '👁';
            }
        }

        // Handle URL parameters for messages
        const urlParams = new URLSearchParams(window.location.search);
        const success = urlParams.get('success');
        const error = urlParams.get('error');
        const alertEl = document.getElementById('alert');

        function showAlert(message, type) {
            alertEl.textContent = decodeURIComponent(message);
            alertEl.className = `alert alert-${type}`;
            alertEl.style.display = 'block';
            
            // Auto hide success messages after 5 seconds
            if (type === 'success') {
                setTimeout(() => {
                    alertEl.style.display = 'none';
                }, 5000);
            }
        }

        if (success) {
            showAlert(success, 'success');
        }

        if (error) {
            showAlert(error, 'error');
        }

        // Form submission handling
        document.getElementById('loginForm').addEventListener('submit', function(e) {
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value.trim();
            const submitBtn = document.getElementById('submitBtn');
            const btnText = document.getElementById('btnText');
            const btnSpinner = document.getElementById('btnSpinner');
            
            // Basic validation
            if (!email || !password) {
                e.preventDefault();
                showAlert('Please fill in all required fields', 'error');
                return false;
            }
            
            // Email validation if it's an email
            if (email.includes('@')) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    e.preventDefault();
                    showAlert('Please enter a valid email address', 'error');
                    return false;
                }
            }
            
            // Show loading state
            submitBtn.disabled = true;
            btnText.textContent = 'Signing in...';
            btnSpinner.style.display = 'inline-block';
            
            // Reset button after timeout (in case form submission fails)
            setTimeout(() => {
                submitBtn.disabled = false;
                btnText.textContent = 'Sign In';
                btnSpinner.style.display = 'none';
            }, 3000);
            
            return true;
        });

        // Add input focus effects
        const inputs = document.querySelectorAll('.form-control');
        inputs.forEach(input => {
            input.addEventListener('focus', function() {
                this.style.background = 'rgba(255, 255, 255, 0.1)';
            });
            
            input.addEventListener('blur', function() {
                this.style.background = 'rgba(255, 255, 255, 0.05)';
            });
        });

        // Clear alert when user starts typing
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                if (alertEl.style.display === 'block') {
                    alertEl.style.display = 'none';
                }
            });
        });

        // Initialize particles on load
        window.addEventListener('load', createParticles);