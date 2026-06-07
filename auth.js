document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    
    if (showRegister) {
        showRegister.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.classList.remove('active');
            registerForm.classList.add('active');
        });
    }
    
    if (showLogin) {
        showLogin.addEventListener('click', (e) => {
            e.preventDefault();
            registerForm.classList.remove('active');
            loginForm.classList.add('active');
        });
    }
    
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;
            if (!email || !password) {
                showToast('Please fill all fields', true);
                return;
            }
            const result = await loginUser(email, password);
            if (result.success) {
                showToast('Login successful!');
                setTimeout(() => {
                    if (result.role === 'admin') window.location.href = 'admin.html';
                    else window.location.href = 'dashboard.html';
                }, 1000);
            } else {
                showToast(result.error, true);
            }
        });
    }
    
    if (registerBtn) {
        registerBtn.addEventListener('click', async () => {
            const name = document.getElementById('regName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value;
            const confirm = document.getElementById('regConfirmPassword').value;
            if (!name || !email || !password) {
                showToast('Please fill all fields', true);
                return;
            }
            if (password !== confirm) {
                showToast('Passwords do not match', true);
                return;
            }
            if (password.length < 6) {
                showToast('Password must be at least 6 characters', true);
                return;
            }
            const result = await registerUser(name, email, password);
            if (result.success) {
                showToast('Registration successful! Please login.');
                registerForm.classList.remove('active');
                loginForm.classList.add('active');
                document.getElementById('regName').value = '';
                document.getElementById('regEmail').value = '';
                document.getElementById('regPassword').value = '';
                document.getElementById('regConfirmPassword').value = '';
            } else {
                showToast(result.error, true);
            }
        });
    }
    
    auth.onAuthStateChanged(async (user) => {
        if (user && (window.location.pathname === '/' || window.location.pathname === '/index.html')) {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.data()?.role === 'admin') window.location.href = 'admin.html';
            else window.location.href = 'dashboard.html';
        }
    });
});