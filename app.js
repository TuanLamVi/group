import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, onSnapshot, runTransaction, updateDoc, increment, serverTimestamp, query, where, orderBy, deleteDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBpoi3xuIIiOQXMohVLOITlf0DX9JKbs-4",
    authDomain: "grouppublic-583ac.firebaseapp.com",
    projectId: "grouppublic-583ac",
    storageBucket: "grouppublic-583ac.firebasestorage.app",
    messagingSenderId: "70167414260",
    appId: "1:70167414260:web:8d3111a010959a38a965a1"
};

const app = initializeApp(firebaseConfig); const db = getFirestore(app);
const authScreen = document.getElementById('auth-screen'); const dashboardScreen = document.getElementById('dashboard-screen'); const mainScreen = document.getElementById('main-screen'); const settingsModal = document.getElementById('settings-modal');

let currentUser = null; let currentGroupId = null; let currentGroupData = null; let userRole = 'member'; let isManager = false; let unsubUser, unsubGroup, unsubCampaigns, unsubTx;
let currentlyOpenMember = null; let cachedGroupMembersArray = []; let searchQuery = ""; let currentPage = 1; const ITEMS_PER_PAGE = 10;

const userCache = {};
async function getUsersData(phoneArray) {
    const result = {}; for (const phone of phoneArray) {
        if (userCache[phone]) result[phone] = userCache[phone];
        else { const snap = await getDoc(doc(db, "users", phone)); if (snap.exists()) { userCache[phone] = snap.data(); result[phone] = snap.data(); } else result[phone] = { name: "Ẩn danh", phone, address: "N/A" }; }
    } return result;
}

window.customPrompt = (title, placeholder) => new Promise(res => {
    const m = document.getElementById('custom-prompt-modal'); const i = document.getElementById('prompt-input');
    document.getElementById('prompt-title').innerText = title; i.placeholder = placeholder; i.value = ''; m.classList.remove('hidden'); i.focus();
    document.getElementById('btn-prompt-submit').onclick = () => { m.classList.add('hidden'); res(i.value.trim()); };
    document.getElementById('btn-prompt-cancel').onclick = () => { m.classList.add('hidden'); res(null); };
});

const normalizePhone = p => p.trim().replace(/\s+/g, '').replace(/^(?:\+84|84)/, '0');
const phoneRegex = /^(0\d{9}|\+[1-9]\d{7,14})$/;

document.getElementById('link-to-register').onclick = () => { document.getElementById('login-form').classList.add('hidden'); document.getElementById('register-form').classList.remove('hidden'); document.getElementById('auth-title').innerText = "Đăng ký"; };
document.getElementById('link-to-login').onclick = () => { document.getElementById('register-form').classList.add('hidden'); document.getElementById('login-form').classList.remove('hidden'); document.getElementById('auth-title').innerText = "Đăng nhập"; };
document.getElementById('link-forgot-pwd').onclick = () => document.getElementById('forgot-password-modal').classList.remove('hidden');
document.getElementById('btn-cancel-forgot').onclick = () => document.getElementById('forgot-password-modal').classList.add('hidden');

document.getElementById('btn-register-submit').onclick = async () => {
    const name = document.getElementById('reg-name').value.trim(); let phone = normalizePhone(document.getElementById('reg-phone').value);
    const address = document.getElementById('reg-address').value.trim(); const password = document.getElementById('reg-password').value.trim(); const pin = document.getElementById('reg-pin').value.trim();
    if (!phoneRegex.test(phone)) return alert("SĐT không hợp lệ!"); if (!name || password.length < 8 || pin.length !== 4) return alert("Nhập đủ thông tin!");
    try { if ((await getDoc(doc(db, "users", phone))).exists()) return alert("SĐT đã dùng!"); await setDoc(doc(db, "users", phone), { name, phone, address, password, pin, avatar: "", createdAt: serverTimestamp() }); alert("Xong!"); document.getElementById('link-to-login').click(); } catch (e) { alert(e.message); }
};

document.getElementById('btn-login-submit').onclick = async () => {
    let phone = normalizePhone(document.getElementById('login-phone').value); const password = document.getElementById('login-password').value.trim();
    if (!phoneRegex.test(phone)) return alert("SĐT sai!");
    try { const snap = await getDoc(doc(db, "users", phone)); if (!snap.exists() || snap.data().password !== password) return alert("Sai SĐT/Mật khẩu!"); loginSuccess(phone); } catch (e) { alert(e.message); }
};

function loginSuccess(phone) {
    localStorage.setItem('userPhone', phone); authScreen.classList.add('hidden'); dashboardScreen.classList.remove('hidden');
    unsubUser = onSnapshot(doc(db, "users", phone), snap => { if (snap.exists()) { currentUser = snap.data(); userCache[phone] = currentUser; document.getElementById('user-avatar').src = currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=random&color=fff`; document.getElementById('user-name-display').innerText = currentUser.name; document.getElementById('user-phone-display').innerText = currentUser.phone; } });
    loadUserGroups(phone);
}

function loadUserGroups(phone) { onSnapshot(query(collection(db, "groups"), where("members", "array-contains", phone)), snap => { const list = document.getElementById('group-list'); list.innerHTML = ''; snap.forEach(d => { const g = d.data(); list.innerHTML += `<div class="group-item-card" onclick="window.enterGroup('${d.id}')"><b>${g.name}</b><br>Số dư: ${g.balance.toLocaleString()}₫</div>`; }); }); }

window.enterGroup = id => { currentGroupId = id; dashboardScreen.classList.add('hidden'); mainScreen.classList.remove('hidden'); initRealtime(); };
document.getElementById('btn-back-dashboard').onclick = () => { if(unsubGroup) unsubGroup(); mainScreen.classList.add('hidden'); dashboardScreen.classList.remove('hidden'); };

function initRealtime() {
    unsubGroup = onSnapshot(doc(db, "groups", currentGroupId), async snap => {
        if (!snap.exists()) return; currentGroupData = snap.data(); if (!currentGroupData.members.includes(currentUser.phone)) return location.reload();
        document.getElementById('group-name').innerText = currentGroupData.name; document.getElementById('balance').innerText = currentGroupData.balance.toLocaleString();
        userRole = (currentGroupData.ownerId === currentUser.phone) ? 'owner' : (currentGroupData.deputies.includes(currentUser.phone) ? 'deputy' : 'member');
        isManager = userRole !== 'member'; document.getElementById('user-role').innerText = userRole;
        const membersDataRaw = await getUsersData(currentGroupData.members); cachedGroupMembersArray = currentGroupData.members.map(p => ({ phone: p, ...membersDataRaw[p] })); renderMemberList();
    });
}

function renderMemberList() {
    const list = document.getElementById('member-list'); let filtered = cachedGroupMembersArray.filter(u => u.phone.includes(searchQuery) || u.name.toLowerCase().includes(searchQuery));
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1; document.getElementById('page-info').innerText = `${currentPage}/${totalPages}`;
    const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    list.innerHTML = ''; paginated.forEach(u => {
        const isOpen = currentlyOpenMember === u.phone ? 'open' : '';
        let adminBtns = (userRole === 'owner' && u.phone !== currentUser.phone) ? `<button class="btn-sm btn-secondary" onclick="window.openSettings('${u.phone}')">⚙️ Cài đặt</button>` : (u.phone === currentUser.phone ? `<button class="btn-sm btn-secondary" onclick="window.openSettings('${u.phone}')">⚙️ Tôi</button>` : '');
        list.innerHTML += `<div class="member-item"><div class="member-summary" onclick="window.toggleMemberDetails('${u.phone}')"><b>${u.name}</b> <span>▼</span></div><div id="details-${u.phone}" class="member-details ${isOpen}"><p>SĐT: ${u.phone}</p><p>Đ/C: ${u.address}</p><div class="contact-actions"><a href="tel:${u.phone}" class="btn-call">📞 Gọi</a><a href="https://zalo.me/${u.phone}" target="_blank" class="btn-zalo">💬 Zalo</a></div>${adminBtns}</div></div>`;
    });
}

window.toggleMemberDetails = p => { if (currentlyOpenMember && currentlyOpenMember !== p) document.getElementById(`details-${currentlyOpenMember}`)?.classList.remove('open'); const el = document.getElementById(`details-${p}`); el.classList.toggle('open'); currentlyOpenMember = el.classList.contains('open') ? p : null; };
document.getElementById('search-member-input').oninput = e => { searchQuery = e.target.value.toLowerCase(); currentPage = 1; renderMemberList(); };
document.getElementById('btn-prev-page').onclick = () => { if(currentPage > 1) { currentPage--; renderMemberList(); } };
document.getElementById('btn-next-page').onclick = () => { currentPage++; renderMemberList(); };

window.openSettings = async p => {
    const isSelf = p === currentUser.phone; const u = userCache[p];
    document.getElementById('edit-profile-name').value = u.name; document.getElementById('edit-profile-address').value = u.address; document.getElementById('edit-profile-name').disabled = !isSelf;
    const adminSect = document.getElementById('settings-section-admin'); adminSect.classList.add('hidden');
    if (userRole === 'owner' && !isSelf) {
        adminSect.classList.remove('hidden'); const isDep = currentGroupData.deputies.includes(p);
        document.getElementById('admin-actions-container').innerHTML = `<button class="btn-sm btn-success" onclick="window.setRole('${p}', ${isDep})">${isDep ? 'Giáng cấp' : 'Lên phó'}</button><button class="btn-sm btn-danger" onclick="window.kick('${p}')">Xóa</button>`;
    } settingsModal.classList.remove('hidden');
};

document.getElementById('btn-submit-forgot').onclick = async () => {
    let phone = normalizePhone(document.getElementById('forgot-phone').value); const pin = document.getElementById('forgot-pin').value; const pass = document.getElementById('forgot-new-password').value;
    try { const snap = await getDoc(doc(db, "users", phone)); if (snap.exists() && snap.data().pin === pin) { await updateDoc(doc(db, "users", phone), { password: pass }); alert("Xong!"); location.reload(); } else alert("Sai PIN!"); } catch(e) { alert(e.message); }
};

window.setRole = async (p, isDep) => { await updateDoc(doc(db, "groups", currentGroupId), { deputies: isDep ? arrayRemove(p) : arrayUnion(p) }); settingsModal.classList.add('hidden'); };
window.kick = async p => { if(confirm("Xóa?")) await updateDoc(doc(db, "groups", currentGroupId), { members: arrayRemove(p), deputies: arrayRemove(p) }); settingsModal.classList.add('hidden'); };
document.getElementById('btn-cancel-settings').onclick = () => settingsModal.classList.add('hidden');
document.getElementById('btn-logout').onclick = () => { localStorage.clear(); location.reload(); };
window.onload = () => { const p = localStorage.getItem('userPhone'); if(p) loginSuccess(p); };
