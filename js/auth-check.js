// ─────────────────────────────────────────────
//  auth-check.js  —  Check authentication on app load
// ─────────────────────────────────────────────

// Check if user is authenticated when the app loads
async function checkAuth() {
  try {
    const response = await fetch(withApiBase('/api/auth/me'), {
      credentials: 'include'
    });

    if (response.ok) {
      const data = await response.json();
      // User is authenticated, store user info globally
      window.currentUser = data.user;
      return true;
    } else {
      // User not authenticated, redirect to login
      window.location.href = withApiBase('/login.html');
      return false;
    }
  } catch (error) {
    // Network error, redirect to login
    window.location.href = withApiBase('/login.html');
    return false;
  }
}

// Initialize auth check
checkAuth();