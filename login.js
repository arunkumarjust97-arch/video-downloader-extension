// ==========================================================================
// Modern Redesigned Login Page - Interactive Controller Logic
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const htmlElement = document.documentElement;
    const authCard = document.getElementById('auth-card');
    const authForm = document.getElementById('auth-form');
    const tabLogin = document.getElementById('tab-login');
    const tabSignup = document.getElementById('tab-signup');
    const switchModeLink = document.getElementById('switch-mode-link');
    const cardTitle = document.getElementById('card-title');
    const cardSubtitle = document.getElementById('card-subtitle');
    const submitBtn = document.getElementById('submit-btn');
    const submitBtnText = document.getElementById('submit-btn-text');
    const dividerText = document.getElementById('divider-text');
    const footerText = document.getElementById('footer-text');
    const passwordInput = document.getElementById('password');
    const passwordToggleBtn = document.getElementById('password-toggle-btn');
    const eyeIcon = document.getElementById('eye-icon');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const themeIcon = document.getElementById('theme-icon');
    const themeToggleText = document.getElementById('theme-toggle-text');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const toastContainer = document.getElementById('toast-container');
    const socialButtons = document.querySelectorAll('.social-btn');

    let currentMode = 'login'; // 'login' | 'signup'

    // ==========================================================================
    // Theme Management (Dark / Light Mode)
    // ==========================================================================
    const savedTheme = localStorage.getItem('app-theme') || 'dark';
    setTheme(savedTheme);

    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = htmlElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        showToast(`Switched to ${newTheme} mode`, 'success');
    });

    function setTheme(theme) {
        htmlElement.setAttribute('data-theme', theme);
        localStorage.setItem('app-theme', theme);
        
        if (theme === 'light') {
            themeToggleText.textContent = 'Light';
            // Sun Icon
            themeIcon.innerHTML = `
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            `;
        } else {
            themeToggleText.textContent = 'Dark';
            // Moon Icon
            themeIcon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
        }
    }

    // ==========================================================================
    // Mode Switching (Login ⟷ Sign Up)
    // ==========================================================================
    function setAuthMode(mode) {
        currentMode = mode;
        if (mode === 'signup') {
            authCard.classList.add('mode-signup');
            tabLogin.classList.remove('active');
            tabSignup.classList.add('active');
            cardTitle.textContent = 'Create Account';
            cardSubtitle.textContent = 'Sign up to get started with your new account';
            submitBtnText.textContent = 'SIGN UP';
            dividerText.textContent = 'Or Sign Up Using';
            footerText.textContent = 'Already have an account?';
            switchModeLink.textContent = 'SIGN IN';
        } else {
            authCard.classList.remove('mode-signup');
            tabSignup.classList.remove('active');
            tabLogin.classList.add('active');
            cardTitle.textContent = 'Login';
            cardSubtitle.textContent = 'Enter your credentials to access your account';
            submitBtnText.textContent = 'LOGIN';
            dividerText.textContent = 'Or Sign Up Using';
            footerText.textContent = "Don't have an account?";
            switchModeLink.textContent = 'SIGN UP';
        }
    }

    tabLogin.addEventListener('click', () => setAuthMode('login'));
    tabSignup.addEventListener('click', () => setAuthMode('signup'));
    switchModeLink.addEventListener('click', (e) => {
        e.preventDefault();
        setAuthMode(currentMode === 'login' ? 'signup' : 'login');
    });

    // ==========================================================================
    // Password Visibility Toggle
    // ==========================================================================
    let passwordVisible = false;
    passwordToggleBtn.addEventListener('click', () => {
        passwordVisible = !passwordVisible;
        passwordInput.type = passwordVisible ? 'text' : 'password';
        
        if (passwordVisible) {
            // Eye off icon
            eyeIcon.innerHTML = `
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
            `;
            passwordToggleBtn.setAttribute('aria-label', 'Hide password');
        } else {
            // Eye icon
            eyeIcon.innerHTML = `
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            `;
            passwordToggleBtn.setAttribute('aria-label', 'Show password');
        }
    });

    // ==========================================================================
    // Form Validation & Submission Simulation
    // ==========================================================================
    authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();

        if (!username) {
            showToast('Please enter your username', 'error');
            document.getElementById('username').focus();
            return;
        }

        if (!password) {
            showToast('Please enter your password', 'error');
            document.getElementById('password').focus();
            return;
        }

        if (currentMode === 'signup') {
            const confirmPass = document.getElementById('confirm-password').value.trim();
            if (password !== confirmPass) {
                showToast('Passwords do not match', 'error');
                document.getElementById('confirm-password').focus();
                return;
            }
        }

        // Simulate Authenticating state
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        setTimeout(() => {
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;

            if (currentMode === 'login') {
                showToast(`Welcome back, ${username}! Login successful.`, 'success');
            } else {
                showToast(`Account created successfully for ${username}!`, 'success');
                setAuthMode('login');
            }
        }, 1200);
    });

    // ==========================================================================
    // Forgot Password Handler
    // ==========================================================================
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            if (username) {
                showToast(`Password reset link sent to ${username}`, 'success');
            } else {
                showToast('Please enter your username or email above first', 'error');
                document.getElementById('username').focus();
            }
        });
    }

    // ==========================================================================
    // Social Login Interaction Simulation
    // ==========================================================================
    socialButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const provider = this.getAttribute('title') || 'Social Provider';
            showToast(`Connecting via ${provider.replace('Sign in with ', '')}...`, 'success');
        });
    });

    // ==========================================================================
    // Toast Notification Utility
    // ==========================================================================
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const iconSvg = type === 'success' ? `
            <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        ` : `
            <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
        `;

        toast.innerHTML = `
            ${iconSvg}
            <span>${message}</span>
        `;

        toastContainer.appendChild(toast);

        // Slide in
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto remove after 3.2s
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3200);
    }
});
