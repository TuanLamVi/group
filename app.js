import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, onSnapshot, updateDoc, serverTimestamp, query, where, orderBy, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// [DÁN FIREBASE CONFIG CỦA BẠN VÀO ĐÂY]
const firebaseConfig = {
    apiKey: "AIzaSyBpoi3xuIIiOQXMohVLOITlf0DX9JKbs-4",
    authDomain: "grouppublic-583ac.firebaseapp.com",
    projectId: "grouppublic-583ac",
    storageBucket: "grouppublic-583ac.firebasestorage.app",
    messagingSenderId: "70167414260",
    appId: "1:70167414260:web:8d3111a010959a38a965a1"
};

const app = initializeApp(firebaseConfig); const db = getFirestore(app);
const authScreen = document.getElementById('auth-screen'); const dashboardScreen = document.getElementById('dashboard-screen'); const mainScreen = document.getElementById('main-screen');

let currentUser = null; let currentGroupId = null; let currentGroupData = null; let userRole = 'member';
let currentlyOpenMember = null; let cachedGroupMembersArray = []; let searchQuery = ""; let currentPage = 1; const ITEMS_PER_PAGE = 10;
const userCache = {};

// CHUẨN HÓA SĐT VÀ TÌM KIẾM
const normalizePhone = p => p.trim().replace(/\s+/g, '').replace(/^(?:\+84|84)/, '0');
const phoneRegex = /^(0\d{9}|\+[1-9]\d{7,14})$/;

// POPUP TÙY CHỈNH
window.customPrompt = (title, placeholder) => new Promise(res => {
    const m = document.getElementById('custom-prompt-modal'); const i = document.getElementById('prompt-input');
    document.getElementById('prompt-title').innerText = title; i.placeholder = placeholder; i.value = ''; m.classList.remove('hidden');
    document.getElementById('btn-prompt-submit').onclick = () => { m.classList.add('hidden'); res(i.value.trim()); };
    document.getElementById('btn-prompt-cancel').onclick = () => { m.classList.add('hidden'); res(null); };
});

// XỬ LÝ ĐĂNG KÝ (MÃ PIN 4 SỐ)
document.getElementById('btn-register-submit').onclick = async () => {
    const name = document.getElementById('reg-name').value.trim(); 
    let phone = normalizePhone(document.getElementById('reg-phone').value);
    const address = document.getElementById('reg-address').value.trim(); 
    const password = document.getElementById('reg-password').value.trim(); 
    const pin = document.getElementById('reg-pin').value.trim();
    
    if (!phoneRegex.test(phone)) return alert("SĐT không hợp lệ!");
    if (!name || password.length < 8 || pin.length !== 4) return alert("Nhập đủ: Tên, Mật khẩu (8 ký tự) và Mã PIN (4 số)!");

    try {
        if ((await getDoc(doc(db, "users", phone))).exists()) return alert("SĐT đã tồn tại!");
        await setDoc(doc(db, "users", phone), { name, phone, address, password, pin, avatar: "", createdAt: serverTimestamp() });
        alert("Thành công!"); location.reload();
    } catch (e) { alert(e.message); }
};

// ĐĂNG NHẬP
document.getElementById('btn-login-submit').onclick = async () => {
    let phone = normalizePhone(document.getElementById('login-phone').value); 
    const password = document.getElementById('login-password').value.trim();
    try {
        const snap = await getDoc(doc(db, "users", phone));
        if (snap.exists() && snap.data().password === password) loginSuccess(phone);
        else alert("Sai thông tin!");
    } catch (e) { alert(e.message); }
};

// QUÊN MẬT KHẨU (XÁC NHẬN QUA PIN)
document.getElementById('btn-submit-forgot').onclick = async () => {
    let phone = normalizePhone(document.getElementById('forgot-phone').value); 
    const pin = document.getElementById('forgot-pin').value; 
    const pass = document.getElementById('forgot-new-password').value;
    try {
        const snap = await getDoc(doc(db, "users", phone));
        if (snap.exists() && snap.data().pin === pin) {
            await updateDoc(doc(db, "users", phone), { password: pass });
            alert("Đã đổi!"); location.reload();
        } else alert("Thông tin sai!");
    } catch(e) { alert(e.message); }
};

function loginSuccess(phone) {
    localStorage.setItem('userPhone', phone); authScreen.classList.add('hidden'); dashboardScreen.classList.remove('hidden');
    onSnapshot(doc(db, "users", phone), snap => {
        if (snap.exists()) {
            currentUser = snap.data();
            document.getElementById('user-avatar').src = currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=random&color=fff`;
            document.getElementById('user-name-display').innerText = currentUser.name;
            document.getElementById('user-phone-display').innerText = currentUser.phone;
        }
    });
    loadGroups(phone);
}

function loadGroups(phone) {
    onSnapshot(query(collection(db, "groups"), where("members", "array-contains", phone)), snap => {
        const list = document.getElementById('group-list'); list.innerHTML = '';
        snap.forEach(d => {
            const g = d.data();
            list.innerHTML += `<div class="group-item-card card" onclick="window.enterGroup('${d.id}')"><b>${g.name}</b><br>Quỹ: ${g.balance.toLocaleString()}₫</div>`;
        });
    });
}

window.enterGroup = id => {
    currentGroupId = id; dashboardScreen.classList.add('hidden'); mainScreen.classList.remove('hidden');
    onSnapshot(doc(db, "groups", id), async snap => {
        if (!snap.exists()) return; currentGroupData = snap.data();
        document.getElementById('group-name').innerText = currentGroupData.name;
        document.getElementById('balance').innerText = currentGroupData.balance.toLocaleString();
        userRole = (currentGroupData.ownerId === currentUser.phone) ? 'owner' : 'member';
        document.getElementById('user-role').innerText = userRole;
        // Load members logic here...
    });
};

// RESET VÀ QUAY LẠI
document.getElementById('btn-logout').onclick = () => { localStorage.clear(); location.reload(); };
document.getElementById('btn-back-dashboard').onclick = () => { mainScreen.classList.add('hidden'); dashboardScreen.classList.remove('hidden'); };
window.onload = () => { const p = localStorage.getItem('userPhone'); if(p) loginSuccess(p); };
