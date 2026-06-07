let adminChart = null, adminCategoryChart = null;

auth.onAuthStateChanged(async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    if (!(await isAdmin())) { window.location.href = 'dashboard.html'; return; }
    const userDoc = await db.collection('users').doc(user.uid).get();
    document.getElementById('adminName').textContent = userDoc.data()?.name || 'Admin';
    document.getElementById('adminEmail').textContent = user.email;
    await loadDashboard();
    await loadUsers();
    await loadSystemStats();
});

async function loadDashboard() {
    const expenses = await getAllExpenses();
    if (!expenses.success) return;
    const stats = {};
    expenses.data.forEach(e => { if (!stats[e.category]) stats[e.category] = 0; stats[e.category] += e.amount; });
    if (adminChart) adminChart.destroy();
    adminChart = new Chart(document.getElementById('systemChart'), {
        type: 'bar', data: { labels: Object.keys(stats), datasets: [{ label: 'Expenses by Category (₹)', data: Object.values(stats), backgroundColor: '#667eea', borderRadius: 8 }] },
        options: { responsive: true }
    });
    const recent = expenses.data.slice(0, 10);
    document.getElementById('recentActivities').innerHTML = recent.length ? recent.map(a => `
        <div class="expense-item"><div class="expense-info"><div class="expense-category">${getCategoryIcon(a.category)}</div><div><h4>${escapeHtml(a.name)}</h4><p>${a.userName} • ${a.category} • ${formatDate(a.timestamp)}</p></div></div><div class="expense-amount">${formatCurrency(a.amount)}</div></div>
    `).join('') : '<div class="empty-state">No activities yet</div>';
}

async function loadUsers() {
    const users = await getAllUsers();
    if (!users.success) return;
    const expenses = await getAllExpenses();
    const userFilter = document.getElementById('adminFilterUser');
    if (userFilter) userFilter.innerHTML = '<option value="all">All Users</option>' + users.data.map(u => `<option value="${u.uid}">${escapeHtml(u.name)}</option>`).join('');
    document.getElementById('usersList').innerHTML = users.data.map(u => {
        const userExp = expenses.success ? expenses.data.filter(e => e.userId === u.uid) : [];
        const total = userExp.reduce((s, e) => s + e.amount, 0);
        return `<div class="user-card"><div class="user-card-info"><i class="fas fa-user-circle"></i><div><h4>${escapeHtml(u.name)}</h4><p>${u.email}</p><small>Joined: ${u.createdAt?.toDate().toLocaleDateString() || 'N/A'}</small></div></div><div class="user-card-stats"><div>📊 ${userExp.length} expenses</div><div>💰 ${formatCurrency(total)}</div></div><button class="btn-danger" onclick="viewUserDetails('${u.uid}')"><i class="fas fa-eye"></i> View</button></div>`;
    }).join('');
}

window.viewUserDetails = async function (userId) {
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const expenses = await getAllExpenses();
    const userExp = expenses.success ? expenses.data.filter(e => e.userId === userId) : [];
    const total = userExp.reduce((s, e) => s + e.amount, 0);
    document.getElementById('userDetails').innerHTML = `
        <div class="info-row"><label>Name:</label><span>${escapeHtml(userData?.name)}</span></div>
        <div class="info-row"><label>Email:</label><span>${userData?.email}</span></div>
        <div class="info-row"><label>Member Since:</label><span>${userData?.createdAt?.toDate().toLocaleDateString() || 'N/A'}</span></div>
        <div class="info-row"><label>Total Expenses:</label><span>${userExp.length}</span></div>
        <div class="info-row"><label>Total Amount:</label><span>${formatCurrency(total)}</span></div>
        <hr><h4>Recent Expenses</h4>${userExp.slice(0, 5).map(e => `<div class="expense-item" style="margin-top:8px;"><div>${e.name} - ${formatCurrency(e.amount)}</div><small>${e.category}</small></div>`).join('') || '<p>No expenses</p>'}
    `;
    document.getElementById('userModal').style.display = 'flex';
    document.getElementById('deleteUserBtn').onclick = () => deleteUserAccount(userId);
};

async function deleteUserAccount(userId) {
    if (confirm('Delete this user? All data will be lost!')) {
        await deleteUser(userId);
        showToast('User deleted!');
        document.getElementById('userModal').style.display = 'none';
        await loadUsers();
        await loadSystemStats();
    }
}

async function loadAllExpenses() {
    let result = await getAllExpenses();
    const start = document.getElementById('adminStartDate').value;
    const end = document.getElementById('adminEndDate').value;
    const userId = document.getElementById('adminFilterUser').value;
    const category = document.getElementById('adminFilterCategory').value;
    if (start || end || userId !== 'all' || category !== 'all') {
        let filtered = result.data;
        if (start) filtered = filtered.filter(e => e.timestamp?.toDate() >= new Date(start));
        if (end) { const e = new Date(end); e.setHours(23, 59, 59); filtered = filtered.filter(f => f.timestamp?.toDate() <= e); }
        if (userId !== 'all') filtered = filtered.filter(e => e.userId === userId);
        if (category !== 'all') filtered = filtered.filter(e => e.category === category);
        result.data = filtered;
    }
    document.getElementById('allExpensesList').innerHTML = result.data.length ? result.data.map(e => `
        <div class="expense-item"><div class="expense-info"><div class="expense-category">${getCategoryIcon(e.category)}</div><div><h4>${escapeHtml(e.name)}</h4><p>${e.userName} • ${e.category} • ${formatDate(e.timestamp)}</p></div></div><div class="expense-amount">${formatCurrency(e.amount)}</div><button class="delete-expense" onclick="adminDeleteExpense('${e.id}')"><i class="fas fa-trash"></i></button></div>
    `).join('') : '<div class="empty-state">No expenses found</div>';
}

window.adminDeleteExpense = async function (id) {
    if (confirm('Delete this expense?')) {
        await deleteExpense(id);
        showToast('Deleted!');
        await loadAllExpenses();
        await loadSystemStats();
        await loadDashboard();
    }
};

async function loadSystemStats() {
    const users = await getAllUsers();
    const expenses = await getAllExpenses();
    const totalUsers = users.success ? users.data.length : 0;
    const totalExp = expenses.success ? expenses.data.length : 0;
    const totalAmt = expenses.success ? expenses.data.reduce((s, e) => s + e.amount, 0) : 0;
    document.getElementById('totalUsers').textContent = totalUsers;
    document.getElementById('totalExpensesCount').textContent = totalExp;
    document.getElementById('systemTotal').textContent = totalAmt.toLocaleString();
    updateAdminAnalytics(expenses.data);
}

async function updateAdminAnalytics(expenses) {
    if (!expenses) { const e = await getAllExpenses(); expenses = e.data; }
    const catStats = {}, userStats = {};
    expenses.forEach(e => { catStats[e.category] = (catStats[e.category] || 0) + e.amount; if (!userStats[e.userId]) userStats[e.userId] = { name: e.userName, total: 0 }; userStats[e.userId].total += e.amount; });
    if (adminCategoryChart) adminCategoryChart.destroy();
    adminCategoryChart = new Chart(document.getElementById('adminCategoryChart'), { type: 'pie', data: { labels: Object.keys(catStats), datasets: [{ data: Object.values(catStats), backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#66BB6A'] }] }, options: { responsive: true } });
    const top = Object.entries(userStats).sort((a, b) => b[1].total - a[1].total).slice(0, 5);
    document.getElementById('topSpenders').innerHTML = top.map(([_, d]) => `<div class="expense-item"><div class="expense-info"><i class="fas fa-user-circle" style="font-size:32px;"></i><div><h4>${escapeHtml(d.name)}</h4><p>Total: ${formatCurrency(d.total)}</p></div></div></div>`).join('');
}

document.getElementById('exportUsersBtn')?.addEventListener('click', async () => {
    const users = await getAllUsers();
    if (!users.success) return;
    const expenses = await getAllExpenses();
    const csv = [['Name', 'Email', 'Joined', 'Expenses', 'Total Amount']];
    for (const u of users.data) {
        const userExp = expenses.success ? expenses.data.filter(e => e.userId === u.uid) : [];
        csv.push([u.name, u.email, u.createdAt?.toDate().toLocaleDateString() || 'N/A', userExp.length, userExp.reduce((s, e) => s + e.amount, 0)]);
    }
    downloadCSV(csv, 'users_export.csv');
    showToast('Exported!');
});

document.getElementById('exportExpensesBtn')?.addEventListener('click', async () => {
    const expenses = await getAllExpenses();
    if (!expenses.success) return;
    const csv = [['User', 'Expense', 'Amount', 'Category', 'Date']];
    expenses.data.forEach(e => csv.push([e.userName, e.name, e.amount, e.category, e.timestamp?.toDate().toLocaleDateString() || 'N/A']));
    downloadCSV(csv, 'expenses_export.csv');
    showToast('Exported!');
});

function downloadCSV(data, name) {
    const blob = new Blob([data.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

document.getElementById('adminApplyFilterBtn')?.addEventListener('click', loadAllExpenses);
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.getAttribute('data-page');
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`${page}View`).classList.add('active');
        if (page === 'expenses') loadAllExpenses();
        if (page === 'users') loadUsers();
        if (page === 'analytics') updateAdminAnalytics();
        if (page === 'overview') loadDashboard();
    });
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => { await logoutUser(); window.location.href = 'index.html'; });
document.querySelectorAll('.modal .close').forEach(btn => btn.addEventListener('click', () => document.querySelectorAll('.modal').forEach(m => m.style.display = 'none')));