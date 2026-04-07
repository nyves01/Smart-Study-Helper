// ─────────────────────────────────────────────
//  auth.js  —  Authentication handling
// ─────────────────────────────────────────────

// ── DOM elements ──────────────────────────────
const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

// ── Tab switching ─────────────────────────────
loginTab.addEventListener('click', () => {
  loginTab.classList.add('active');
  registerTab.classList.remove('active');
  loginForm.classList.add('active');
  registerForm.classList.remove('active');
  clearErrors();
});

registerTab.addEventListener('click', () => {
  registerTab.classList.add('active');
  loginTab.classList.remove('active');
  registerForm.classList.add('active');
  loginForm.classList.remove('active');
  clearErrors();
});

// ── Form validation helpers ───────────────────
function clearErrors() {
  document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
}

function showError(elementId, message) {
  document.getElementById(elementId).textContent = message;
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// ── Login form handler ────────────────────────
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();

  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  let hasErrors = false;

  if (!username) {
    showError('loginUsernameError', 'Username or email is required');
    hasErrors = true;
  }

  if (!password) {
    showError('loginPasswordError', 'Password is required');
    hasErrors = true;
  }

  if (hasErrors) return;

  try {
    const response = await fetch(withApiBase('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (response.ok) {
      // Redirect to main app
      window.location.href = withApiBase('/');
    } else {
      showError('loginError', data.error || 'Login failed');
    }
  } catch (error) {
    showError('loginError', 'Network error. Please try again.');
  }
});

// ── Register form handler ─────────────────────
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();

  const username = document.getElementById('registerUsername').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;
  const confirmPassword = document.getElementById('registerConfirmPassword').value;

  let hasErrors = false;

  if (username.length < 3) {
    showError('registerUsernameError', 'Username must be at least 3 characters');
    hasErrors = true;
  }

  if (!validateEmail(email)) {
    showError('registerEmailError', 'Please enter a valid email address');
    hasErrors = true;
  }

  if (password.length < 6) {
    showError('registerPasswordError', 'Password must be at least 6 characters');
    hasErrors = true;
  }

  if (password !== confirmPassword) {
    showError('registerConfirmPasswordError', 'Passwords do not match');
    hasErrors = true;
  }

  if (hasErrors) return;

  try {
    const response = await fetch(withApiBase('/api/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, email, password })
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (response.ok) {
      // Auto-login after successful registration
      window.location.href = withApiBase('/');
    } else {
      showError('registerError', data.error || 'Registration failed');
    }
  } catch (error) {
    showError('registerError', 'Network error. Please try again.');
  }
});