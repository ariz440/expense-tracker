let currentChart = null;
let currentFilter = { startDate: null, endDate: null, category: 'all' };

// Boy and Girl Avatars - 100% Guaranteed Working
const BOY_AVATAR = 'https://cdn-icons-png.flaticon.com/512/1995/1995572.png';
const GIRL_AVATAR = 'https://cdn-icons-png.flaticon.com/512/1995/1995574.png';

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();
    
    if (userData?.role === 'admin') {
        window.location.href = 'admin.html';
        return;
    }
    
    document.getElementById('userName').textContent = userData?.name || 'User';
    document.getElementById('userEmail').textContent = user.email;
    document.getElementById('welcomeName').textContent = userData?.name || 'User';
    document.getElementById('profileName').textContent = userData?.name || 'User';
    document.getElementById('profileEmail').textContent = user.email;
    
    if (userData?.createdAt?.toDate) {
        document.getElementById('profileMemberSince').textContent = userData.createdAt.toDate().toLocaleDateString();
    }
    
    // Load saved avatar
    if (userData?.photoURL) {
        updateAvatar(userData.photoURL);
    } else {
        updateAvatar(GIRL_AVATAR);
    }
    
    await loadExpenses();
});

function updateAvatar(url) {
    // Profile page avatar
    const profileAvatar = document.getElementById('profileAvatar');
    if (profileAvatar) {
        profileAvatar.src = url;
        profileAvatar.style.display = 'block';
        const parent = profileAvatar.parentElement;
        const icon = parent?.querySelector('i');
        if (icon) icon.style.display = 'none';
    }
    
    // Sidebar avatar
    const sidebarAvatar = document.getElementById('sidebarAvatar');
    if (sidebarAvatar) {
        sidebarAvatar.innerHTML = `<img src="${url}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;">`;
    }
}

// Boy avatar button
document.getElementById('boyPhotoBtn')?.addEventListener('click', async () => {
    const user = auth.currentUser;
    await db.collection('users').doc(user.uid).update({ photoURL: BOY_AVATAR });
    updateAvatar(BOY_AVATAR);
    showToast('Boy avatar set! 👦');
});

// Girl avatar button
document.getElementById('girlPhotoBtn')?.addEventListener('click', async () => {
    const user = auth.currentUser;
    await db.collection('users').doc(user.uid).update({ photoURL: GIRL_AVATAR });
    updateAvatar(GIRL_AVATAR);
    showToast('Girl avatar set! 👧');
});

async function loadExpenses() {
    const user = auth.currentUser;
    let query = db.collection('expenses').where('userId', '==', user.uid);
    
    if (currentFilter.startDate) {
        query = query.where('timestamp', '>=', new Date(currentFilter.startDate));
    }
    if (currentFilter.endDate) {
        const end = new Date(currentFilter.endDate);
        end.setHours(23, 59, 59);
        query = query.where('timestamp', '<=', end);
    }
    
    const snapshot = await query.orderBy('timestamp', 'desc').get();
    let expenses = [];
    snapshot.forEach(doc => expenses.push({ id: doc.id, ...doc.data() }));
    
    if (currentFilter.category !== 'all') {
        expenses = expenses.filter(e => e.category === currentFilter.category);
    }
    
    displayExpenses(expenses);
    updateStats(expenses);
    document.getElementById('profileTotalSpent').innerHTML = `₹${expenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}`;
}

function displayExpenses(expenses) {
    const container = document.getElementById('expensesList');
    if (!container) return;
    
    if (expenses.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-receipt"></i><p>No expenses yet. Add your first expense!</p></div>';
        return;
    }
    
    const categoryIcons = { Food: '🍔', Transport: '🚗', Shopping: '🛍️', Bills: '💡', Entertainment: '🎬', Health: '💊', Other: '📌' };
    
    container.innerHTML = expenses.map(exp => `
        <div class="expense-item">
            <div class="expense-info">
                <div class="expense-category">${categoryIcons[exp.category] || '📌'}</div>
                <div class="expense-details">
                    <h4>${escapeHtml(exp.name)}</h4>
                    <p>${exp.category} • ${formatDate(exp.timestamp)}</p>
                </div>
            </div>
            <div class="expense-amount">₹${exp.amount.toLocaleString()}</div>
            <button class="delete-expense" onclick="deleteSingleExpense('${exp.id}')"><i class="fas fa-trash"></i></button>
        </div>
    `).join('');
}

function updateStats(expenses) {
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    document.getElementById('sidebarTotal').innerHTML = total.toLocaleString();
    document.getElementById('totalExpensesCount').innerHTML = expenses.length;
    
    const monthTotal = expenses.filter(e => {
        const d = e.timestamp?.toDate ? e.timestamp.toDate() : new Date(e.timestamp);
        return d.getMonth() === new Date().getMonth();
    }).reduce((s, e) => s + e.amount, 0);
    
    document.getElementById('monthlyTotal').innerHTML = `₹${monthTotal.toLocaleString()}`;
}

window.deleteSingleExpense = async function(id) {
    if (confirm('Delete this expense?')) {
        await deleteExpense(id);
        showToast('Deleted!');
        await loadExpenses();
        if (document.getElementById('analyticsView')?.style.display !== 'none') updateAnalytics();
    }
};

document.getElementById('expenseForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('expenseName').value.trim();
    const amount = document.getElementById('expenseAmount').value;
    const category = document.getElementById('expenseCategory').value;
    
    if (!name || !amount) return showToast('Fill all fields', true);
    
    await addExpense(name, amount, category);
    showToast('Added!');
    document.getElementById('expenseForm').reset();
    await loadExpenses();
    if (document.getElementById('analyticsView')?.style.display !== 'none') updateAnalytics();
});

document.getElementById('clearAllBtn')?.addEventListener('click', async () => {
    if (confirm('Delete ALL expenses?')) {
        await deleteAllExpenses();
        showToast('All cleared!');
        await loadExpenses();
        if (document.getElementById('analyticsView')?.style.display !== 'none') updateAnalytics();
    }
});

document.getElementById('applyFilterBtn')?.addEventListener('click', () => {
    currentFilter = {
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value,
        category: document.getElementById('filterCategory').value
    };
    loadExpenses();
    showToast('Filter applied!');
});

document.getElementById('resetFilterBtn')?.addEventListener('click', () => {
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('filterCategory').value = 'all';
    currentFilter = { startDate: null, endDate: null, category: 'all' };
    loadExpenses();
    showToast('Filter reset!');
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await logoutUser();
    window.location.href = 'index.html';
});

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.getAttribute('data-page');
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        document.getElementById('dashboardView').style.display = page === 'dashboard' ? 'block' : 'none';
        document.getElementById('analyticsView').style.display = page === 'analytics' ? 'block' : 'none';
        document.getElementById('profileView').style.display = page === 'profile' ? 'block' : 'none';
        if (page === 'analytics') updateAnalytics();
    });
});

async function updateAnalytics() {
    const result = await getUserExpenses();
    if (!result.success || result.data.length === 0) {
        if (currentChart) currentChart.destroy();
        document.getElementById('categorySummary').innerHTML = '<div class="empty-state">No data</div>';
        return;
    }
    
    const summary = {};
    result.data.forEach(e => {
        if (!summary[e.category]) summary[e.category] = 0;
        summary[e.category] += e.amount;
    });
    
    if (currentChart) currentChart.destroy();
    currentChart = new Chart(document.getElementById('expenseChart'), {
        type: 'pie',
        data: {
            labels: Object.keys(summary),
            datasets: [{
                data: Object.values(summary),
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#66BB6A']
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
    
    const categoryIcons = { Food: '🍔', Transport: '🚗', Shopping: '🛍️', Bills: '💡', Entertainment: '🎬', Health: '💊', Other: '📌' };
    document.getElementById('categorySummary').innerHTML = Object.entries(summary).map(([cat, amt]) => 
        `<div class="summary-item"><span>${categoryIcons[cat]} ${cat}</span><strong>₹${amt.toLocaleString()}</strong></div>`
    ).join('');
}

document.getElementById('editNameBtn')?.addEventListener('click', async () => {
    const newName = prompt('Enter new name:', document.getElementById('profileName').textContent);
    if (newName) {
        await updateProfileName(newName);
        showToast('Name updated!');
        document.getElementById('profileName').textContent = newName;
        document.getElementById('userName').textContent = newName;
        document.getElementById('welcomeName').textContent = newName;
    }
});

const modal = document.getElementById('passwordModal');
document.getElementById('changePasswordBtn')?.addEventListener('click', () => {
    if (modal) modal.style.display = 'flex';
});

document.querySelectorAll('.close').forEach(btn => {
    btn.addEventListener('click', () => {
        if (modal) modal.style.display = 'none';
    });
});

document.getElementById('updatePasswordBtn')?.addEventListener('click', async () => {
    const current = document.getElementById('currentPassword').value;
    const newP = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmNewPassword').value;
    
    if (!current || !newP) return showToast('Fill all fields', true);
    if (newP !== confirm) return showToast('Passwords do not match', true);
    if (newP.length < 6) return showToast('Password must be 6+ characters', true);
    
    const result = await changePassword(current, newP);
    if (result.success) {
        showToast('Password changed!');
        if (modal) modal.style.display = 'none';
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmNewPassword').value = '';
    } else {
        showToast(result.error, true);
    }
});