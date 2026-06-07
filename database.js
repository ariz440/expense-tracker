// ============================================
// FIREBASE CONFIGURATION
// 🔥 TOMAR NIJER FIREBASE CONFIG EKHANE PASTE KORO
// ============================================

const firebaseConfig = {
    apiKey: "AIzaSyASmpBeoxIdOPUArAaMxdgwhRjNfXGwGTs",
    authDomain: "expense-tracker-pro-de9e8.firebaseapp.com",
    databaseURL: "https://expense-tracker-pro-de9e8-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "expense-tracker-pro-de9e8",
    storageBucket: "expense-tracker-pro-de9e8.firebasestorage.app",
    messagingSenderId: "54755628138",
    appId: "1:54755628138:web:96092727a4aed081ac2613"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================

async function registerUser(name, email, password) {
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection('users').doc(userCredential.user.uid).set({
            name: name,
            email: email,
            role: 'user',
            createdAt: new Date(),
            photoURL: null
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function loginUser(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const userDoc = await db.collection('users').doc(userCredential.user.uid).get();
        return {
            success: true,
            role: userDoc.data()?.role || 'user',
            name: userDoc.data()?.name
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function logoutUser() {
    try {
        await auth.signOut();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function changePassword(currentPassword, newPassword) {
    const user = auth.currentUser;
    try {
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
        await user.reauthenticateWithCredential(credential);
        await user.updatePassword(newPassword);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function updateProfileName(name) {
    const user = auth.currentUser;
    try {
        await db.collection('users').doc(user.uid).update({ name: name });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ============================================
// PROFILE PHOTO FUNCTIONS
// ============================================

async function uploadProfilePhoto(file) {
    const user = auth.currentUser;
    try {
        const ref = storage.ref().child(`profile_photos/${user.uid}`);
        await ref.put(file);
        const url = await ref.getDownloadURL();
        await db.collection('users').doc(user.uid).update({ photoURL: url });
        return { success: true, url: url };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ============================================
// EXPENSE FUNCTIONS - 🔥 IMPORTANT: userName automatically add hoy
// ============================================

async function addExpense(name, amount, category) {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'Not logged in' };

    try {
        // 🔥 User er nam read kore
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userName = userDoc.data()?.name || 'User';

        // 🔥 Expense er sathe userName save kore
        await db.collection('expenses').add({
            userId: user.uid,
            userName: userName,  // 🔥 ETA automatically add hoy
            name: name,
            amount: Number(amount),
            category: category,
            timestamp: new Date()
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function getUserExpenses() {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'Not logged in' };

    try {
        const snapshot = await db.collection('expenses')
            .where('userId', '==', user.uid)
            .orderBy('timestamp', 'desc')
            .get();

        const expenses = [];
        snapshot.forEach(doc => {
            expenses.push({ id: doc.id, ...doc.data() });
        });

        return { success: true, data: expenses };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function deleteExpense(id) {
    try {
        await db.collection('expenses').doc(id).delete();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function deleteAllExpenses() {
    const user = auth.currentUser;
    try {
        const snapshot = await db.collection('expenses').where('userId', '==', user.uid).get();
        const batch = db.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

async function isAdmin() {
    const user = auth.currentUser;
    if (!user) return false;
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        return userDoc.data()?.role === 'admin';
    } catch (error) {
        return false;
    }
}

async function getAllUsers() {
    if (!(await isAdmin())) return { success: false, error: 'Admin access required' };
    try {
        const snapshot = await db.collection('users').get();
        const users = [];
        snapshot.forEach(doc => users.push({ id: doc.id, ...doc.data() }));
        return { success: true, data: users };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function getAllExpenses() {
    if (!(await isAdmin())) return { success: false, error: 'Admin access required' };
    try {
        const snapshot = await db.collection('expenses').orderBy('timestamp', 'desc').get();
        const expenses = [];
        snapshot.forEach(doc => expenses.push({ id: doc.id, ...doc.data() }));
        return { success: true, data: expenses };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function deleteUser(userId) {
    if (!(await isAdmin())) return { success: false, error: 'Admin access required' };
    try {
        const expenses = await db.collection('expenses').where('userId', '==', userId).get();
        const batch = db.batch();
        expenses.forEach(doc => batch.delete(doc.ref));
        batch.delete(db.collection('users').doc(userId));
        await batch.commit();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}