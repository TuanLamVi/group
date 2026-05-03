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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const authScreen = document.getElementById('auth-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const mainScreen = document.getElementById('main-screen');
const txModal = document.getElementById('tx-modal');
const settingsModal = document.getElementById('settings-modal');

let currentUser = null; let currentGroupId = null; let currentGroupData = null; let txType = ""; let userRole = 'member'; let isManager = false;   
let unsubUser = null; let unsubGroup = null; let unsubCampaigns = null; let unsubTx = null;

// BỘ ĐỆM CACHE DANH BẠ
const userCache = {};
async function getUsersData(phoneArray) {
    const result = {};
    for (const phone of phoneArray) {
        if (userCache[phone]) { result[phone] = userCache[phone]; } 
        else {
            const snap = await getDoc(doc(db, "users", phone));
            if (snap.exists()) { userCache[phone] = snap.data(); result[phone] = snap.data(); } 
            else { result[phone] = { name: "Thành viên ẩn", phone: phone, address: "Không có thông tin" }; }
        }
    }
    return result;
}

// ================= HÀM POPUP CUSTOM =================
window.customPrompt = function(title, placeholder) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-prompt-modal');
        const inputField = document.getElementById('prompt-input');
        document.getElementById('prompt-title').innerText = title;
        inputField.placeholder = placeholder;
        inputField.value = '';
        modal.classList.remove('hidden');
        inputField.focus();

        const btnSubmit = document.getElementById('btn-prompt-submit');
        const btnCancel = document.getElementById('btn-prompt-cancel');

        const cleanup = () => {
            modal.classList.add('hidden');
            btnSubmit.onclick = null; btnCancel.onclick = null;
        }

        btnSubmit.onclick = () => { const val = inputField.value.trim(); cleanup(); resolve(val); };
        btnCancel.onclick = () => { cleanup(); resolve(null); };
    });
}

// ================= 1. XÁC THỰC (ĐÃ CHUẨN HÓA SĐT) =================
document.getElementById('link-to-register').addEventListener('click', () => { document.getElementById('login-form').classList.add('hidden'); document.getElementById('register-form').classList.remove('hidden'); document.getElementById('auth-title').innerText = "Đăng ký tài khoản"; });
document.getElementById('link-to-login').addEventListener('click', () => { document.getElementById('register-form').classList.add('hidden'); document.getElementById('login-form').classList.remove('hidden'); document.getElementById('auth-title').innerText = "Đăng nhập"; });

// HÀM ĐĂNG KÝ
document.getElementById('btn-register-submit').addEventListener('click', async () => {
    const name = document.getElementById('reg-name').value.trim(); 
    let rawPhone = document.getElementById('reg-phone').value.trim(); 
    const address = document.getElementById('reg-address').value.trim(); 
    const password = document.getElementById('reg-password').value.trim();
    
    // Xóa khoảng trắng và chuyển +84 thành 0
    let phone = rawPhone.replace(/\s+/g, '').replace(/^(?:\+84|84)/, '0');

    // Kiểm tra định dạng (VN: 10 số đầu 0) HOẶC (Quốc tế: Đầu + và có 8-15 số)
    const phoneRegex = /^(0\d{9}|\+[1-9]\d{7,14})$/; 
    if (!phoneRegex.test(phone)) return alert("SĐT không hợp lệ! Vui lòng nhập số VN (VD: 09...) hoặc số Quốc tế (VD: +123...)");
    if (!name || password.length < 8) return alert("Vui lòng nhập Họ tên và Mật khẩu (> 8 ký tự)!");

    try {
        const userRef = doc(db, "users", phone);
        if ((await getDoc(userRef)).exists()) return alert("Số điện thoại này đã được đăng ký!");
        await setDoc(userRef, { name, phone, address, password, avatar: "", createdAt: serverTimestamp() });
        alert("Đăng ký thành công!"); document.getElementById('link-to-login').click();
    } catch (e) { alert("Lỗi: " + e.message); }
});

// HÀM ĐĂNG NHẬP
document.getElementById('btn-login-submit').addEventListener('click', async () => {
    let rawPhone = document.getElementById('login-phone').value.trim(); 
    const password = document.getElementById('login-password').value.trim();
    
    let phone = rawPhone.replace(/\s+/g, '').replace(/^(?:\+84|84)/, '0');
    
    const phoneRegex = /^(0\d{9}|\+[1-9]\d{7,14})$/; 
    if (!phoneRegex.test(phone)) return alert("Số điện thoại không hợp lệ!");
    if (!password) return alert("Vui lòng nhập mật khẩu!");
    
    try {
        const snap = await getDoc(doc(db, "users", phone));
        if (!snap.exists() || snap.data().password !== password) return alert("Sai SĐT hoặc mật khẩu!");
        loginSuccess(phone);
    } catch (e) { alert("Lỗi: " + e.message); }
});

window.addEventListener('DOMContentLoaded', () => { const savedPhone = localStorage.getItem('userPhone'); if (savedPhone) loginSuccess(savedPhone); });

function loginSuccess(phone) {
    localStorage.setItem('userPhone', phone);
    authScreen.classList.add('hidden'); dashboardScreen.classList.remove('hidden');
    if(unsubUser) unsubUser();
    unsubUser = onSnapshot(doc(db, "users", phone), (docSnap) => {
        if(docSnap.exists()) {
            currentUser = docSnap.data(); userCache[currentUser.phone] = currentUser;
            document.getElementById('user-avatar').src = currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=random&color=fff`;
            document.getElementById('user-name-display').innerText = currentUser.name; document.getElementById('user-phone-display').innerText = currentUser.phone;
        }
    });
    loadUserGroups(phone); 
}

document.getElementById('btn-logout').addEventListener('click', () => {
    if (!confirm("Đăng xuất khỏi thiết bị này?")) return;
    localStorage.removeItem('userPhone'); currentUser = null; currentGroupId = null;
    if(unsubUser) unsubUser(); if(unsubGroup) unsubGroup(); if(unsubCampaigns) unsubCampaigns(); if(unsubTx) unsubTx();
    document.getElementById('login-phone').value = ''; document.getElementById('login-password').value = '';
    dashboardScreen.classList.add('hidden'); mainScreen.classList.add('hidden'); authScreen.classList.remove('hidden');
});

// ================= 2. QUẢN LÝ NHÓM =================
function loadUserGroups(phone) {
    const q = query(collection(db, "groups"), where("members", "array-contains", phone));
    onSnapshot(q, (snapshot) => {
        const list = document.getElementById('group-list'); list.innerHTML = '';
        if(snapshot.empty) return list.innerHTML = '<p style="text-align:center; color:gray;">Bạn chưa tham gia nhóm nào.</p>';
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            let roleHtml = (data.ownerId === phone) ? '<span class="role-badge role-owner">👑 Trưởng nhóm</span>' : (data.deputies && data.deputies.includes(phone)) ? '<span class="role-badge role-deputy">⭐ Phó nhóm</span>' : '<span class="role-badge role-member">👥 Thành viên</span>';
            list.innerHTML += `<div class="group-item-card" onclick="window.enterGroup('${docSnap.id}')"><div class="group-item-name">${data.name}</div>${roleHtml}<div class="group-item-balance">Số dư: <b>${(data.balance || 0).toLocaleString()} ₫</b></div></div>`;
        });
    });
}

document.getElementById('btn-create-group').addEventListener('click', async () => {
    const groupName = await window.customPrompt("Tạo Nhóm Mới", "Nhập tên nhóm..."); 
    if (!groupName) return;
    try { await addDoc(collection(db, "groups"), { name: groupName, ownerId: currentUser.phone, deputies: [], members: [currentUser.phone], pendingMembers: [], balance: 0, createdAt: serverTimestamp() }); } catch (e) { alert("Lỗi: " + e.message); }
});

window.enterGroup = (groupId) => {
    currentGroupId = groupId; dashboardScreen.classList.add('hidden'); mainScreen.classList.remove('hidden'); initRealtimeListeners(); 
};

document.getElementById('btn-back-dashboard').addEventListener('click', () => {
    if(unsubGroup) unsubGroup(); if(unsubCampaigns) unsubCampaigns(); if(unsubTx) unsubTx();
    currentGroupId = null; currentGroupData = null; mainScreen.classList.add('hidden'); dashboardScreen.classList.remove('hidden');
});

// ================= 3. MODAL CÀI ĐẶT =================
document.getElementById('btn-edit-profile').addEventListener('click', () => { window.openSettings(currentUser.phone); });
document.getElementById('btn-cancel-settings').addEventListener('click', () => settingsModal.classList.add('hidden'));

window.openSettings = async (targetPhone) => {
    const isSelf = (targetPhone === currentUser.phone);
    const targetUser = userCache[targetPhone] || { name: "", address: "", avatar: "" };

    document.getElementById('edit-profile-name').value = targetUser.name;
    document.getElementById('edit-profile-address').value = targetUser.address || "";
    document.getElementById('edit-profile-avatar').value = targetUser.avatar || "";
    document.getElementById('edit-profile-name').disabled = !isSelf;
    document.getElementById('edit-profile-address').disabled = !isSelf;
    document.getElementById('edit-profile-avatar').disabled = !isSelf;
    
    const btnSubmitProfile = document.getElementById('btn-submit-profile');
    if (isSelf) btnSubmitProfile.classList.remove('hidden'); else btnSubmitProfile.classList.add('hidden');

    const adminSection = document.getElementById('settings-section-admin'); const adminActions = document.getElementById('admin-actions-container');
    adminSection.classList.add('hidden'); adminActions.innerHTML = '';
    if (currentGroupId && currentGroupData && userRole === 'owner' && !isSelf) {
        const isDeputy = currentGroupData.deputies && currentGroupData.deputies.includes(targetPhone);
        adminSection.classList.remove('hidden');
        adminActions.innerHTML = `<button class="btn-sm ${isDeputy ? 'btn-secondary' : 'btn-success'} btn-3d" onclick="window.toggleDeputy('${targetPhone}', ${isDeputy}); document.getElementById('settings-modal').classList.add('hidden');" style="flex:1; padding:10px;">${isDeputy ? '📉 Giáng cấp' : '📈 Lên phó'}</button><button class="btn-sm btn-danger btn-3d" onclick="window.removeMember('${targetPhone}'); document.getElementById('settings-modal').classList.add('hidden');" style="flex:1; padding:10px;">❌ Xóa TV</button>`;
    }
    settingsModal.classList.remove('hidden');
};

document.getElementById('btn-submit-profile').addEventListener('click', async () => {
    const newName = document.getElementById('edit-profile-name').value.trim(); const newAddress = document.getElementById('edit-profile-address').value.trim(); const newAvatar = document.getElementById('edit-profile-avatar').value.trim();
    if(!newName) return alert("Tên không được để trống!");
    try { await updateDoc(doc(db, "users", currentUser.phone), { name: newName, address: newAddress, avatar: newAvatar }); userCache[currentUser.phone] = { ...currentUser, name: newName, address: newAddress, avatar: newAvatar }; settingsModal.classList.add('hidden'); alert("Đã lưu!"); } catch(e) { alert("Lỗi: " + e.message); }
});

// ================= 4. CHI TIẾT NHÓM & DANH BẠ =================
let currentlyOpenMember = null;
let cachedGroupMembersArray = [];
let searchQuery = "";
let currentPage = 1;
const ITEMS_PER_PAGE = 10;

window.toggleMemberDetails = (phone) => {
    if (currentlyOpenMember && currentlyOpenMember !== phone) {
        const oldEl = document.getElementById(`details-${currentlyOpenMember}`);
        if(oldEl) oldEl.classList.remove('open');
    }
    const newEl = document.getElementById(`details-${phone}`);
    if(newEl) {
        newEl.classList.toggle('open');
        if(newEl.classList.contains('open')) currentlyOpenMember = phone;
        else currentlyOpenMember = null;
    }
};

document.getElementById('search-member-input').addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    currentPage = 1; 
    renderMemberList();
});

document.getElementById('btn-prev-page').addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderMemberList(); } });
document.getElementById('btn-next-page').addEventListener('click', () => { currentPage++; renderMemberList(); });

function renderMemberList() {
    const memberListDiv = document.getElementById('member-list');
    let filtered = cachedGroupMembersArray.filter(u => u.phone.includes(searchQuery) || u.name.toLowerCase().includes(searchQuery));
    
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    document.getElementById('page-info').innerText = `${currentPage}/${totalPages}`;
    document.getElementById('btn-prev-page').disabled = (currentPage === 1);
    document.getElementById('btn-next-page').disabled = (currentPage === totalPages);

    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginated = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);

    memberListDiv.innerHTML = '';
    if(paginated.length === 0) { memberListDiv.innerHTML = '<p style="text-align:center; padding:10px; color:gray;">Không tìm thấy ai.</p>'; return; }

    paginated.forEach(uInfo => {
        const memberPhone = uInfo.phone;
        const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(uInfo.name)}&background=random&color=fff`;
        let badge = (memberPhone === currentGroupData.ownerId) ? '<span class="role-badge role-owner" style="margin:0;">👑 Trưởng</span>' : (currentGroupData.deputies && currentGroupData.deputies.includes(memberPhone)) ? '<span class="role-badge role-deputy" style="margin:0;">⭐ Phó</span>' : '<span class="role-badge role-member" style="margin:0;">👥 TV</span>';
        let settingsBtnHtml = (userRole === 'owner' || memberPhone === currentUser.phone) ? `<button class="btn-sm btn-secondary btn-3d" onclick="window.openSettings('${memberPhone}')" style="width: 100%; margin-top: 10px;">⚙️ Cài đặt</button>` : '';
        let isOpenClass = (memberPhone === currentlyOpenMember) ? 'open' : '';

        memberListDiv.innerHTML += `
            <div class="member-item">
                <div class="member-summary" onclick="window.toggleMemberDetails('${memberPhone}')">
                    <div style="display:flex; align-items:center; gap: 10px;">
                        <img src="${uInfo.avatar || defaultAvatar}" class="avatar-img" style="width:35px; height:35px; border:1px solid #ccc;">
                        <b>${uInfo.name}</b>
                    </div>
                    <div style="display:flex; align-items:center; gap: 5px;">${badge} <span style="color:gray; font-size:12px;">▼</span></div>
                </div>
                <div id="details-${memberPhone}" class="member-details ${isOpenClass}">
                    <p style="margin-bottom: 5px;">📞 <b>Điện thoại:</b> ${memberPhone}</p>
                    <p style="margin-bottom: 5px;">🏠 <b>Địa chỉ:</b> ${uInfo.address || 'Chưa cập nhật'}</p>
                    <div class="contact-actions">
                        <a href="tel:${memberPhone}" class="btn-call">📞 Gọi</a>
                        <a href="https://zalo.me/${memberPhone}" target="_blank" class="btn-zalo">💬 Zalo</a>
                    </div>
                    ${settingsBtnHtml}
                </div>
            </div>`;
    });
}

function initRealtimeListeners() {
    unsubGroup = onSnapshot(doc(db, "groups", currentGroupId), async (docSnap) => {
        if (!docSnap.exists()) return;
        currentGroupData = docSnap.data(); 
        if (!currentGroupData.members.includes(currentUser.phone)) { alert("Bạn đã bị xóa khỏi nhóm!"); document.getElementById('btn-back-dashboard').click(); return; }

        document.getElementById('group-name').innerText = currentGroupData.name; document.getElementById('balance').innerText = (currentGroupData.balance || 0).toLocaleString();
        if (currentGroupData.ownerId === currentUser.phone) { userRole = 'owner'; document.getElementById('user-role').innerHTML = '<span class="role-badge role-owner">👑 Trưởng nhóm</span>'; } else if (currentGroupData.deputies && currentGroupData.deputies.includes(currentUser.phone)) { userRole = 'deputy'; document.getElementById('user-role').innerHTML = '<span class="role-badge role-deputy">⭐ Phó nhóm</span>'; } else { userRole = 'member'; document.getElementById('user-role').innerHTML = '<span class="role-badge role-member">👥 Thành viên</span>'; }
        
        isManager = (userRole === 'owner' || userRole === 'deputy');
        document.getElementById('btn-create-campaign').classList.toggle('hidden', !isManager);
        document.getElementById('btn-income').innerText = isManager ? "➕ Thu tiền" : "➕ Đề xuất Thu"; document.getElementById('btn-expense').innerText = isManager ? "➖ Chi tiền" : "➖ Đề xuất Chi";

        const membersDataRaw = await getUsersData(currentGroupData.members);
        cachedGroupMembersArray = currentGroupData.members.map(phone => { return { phone: phone, ...membersDataRaw[phone] }; });
        renderMemberList();

        const pendingMembersDiv = document.getElementById('pending-members-list'); const pendingSection = document.getElementById('pending-members-section');
        if (currentGroupData.pendingMembers && currentGroupData.pendingMembers.length > 0) {
            pendingSection.classList.remove('hidden'); const pendingData = await getUsersData(currentGroupData.pendingMembers); pendingMembersDiv.innerHTML = '';
            currentGroupData.pendingMembers.forEach(pPhone => {
                const puInfo = pendingData[pPhone]; const defaultAvt = `https://ui-avatars.com/api/?name=${encodeURIComponent(puInfo.name)}&background=random&color=fff`;
                let pAction = isManager ? `<button class="btn-sm btn-success btn-3d" onclick="window.approveMember('${pPhone}', true)">Duyệt</button> <button class="btn-sm btn-danger btn-3d" onclick="window.approveMember('${pPhone}', false)">Từ chối</button>` : `<span style="font-size:12px; color:gray;">Chờ duyệt...</span>`;
                pendingMembersDiv.innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 0; border-bottom: 1px solid #eee;"><div style="display:flex; align-items:center; gap: 8px;"><img src="${puInfo.avatar || defaultAvt}" style="width:28px; height:28px; border-radius:50%;"><div><div style="font-size:14px; font-weight:bold;">${puInfo.name}</div><div style="font-size:11px; color:gray;">${pPhone}</div></div></div><div style="display:flex; gap:5px;">${pAction}</div></div>`;
            });
        } else { pendingSection.classList.add('hidden'); }
    });

    unsubCampaigns = onSnapshot(collection(db, "groups", currentGroupId, "campaigns"), (snapshot) => { const campaignList = document.getElementById('campaign-list'); const txSelect = document.getElementById('tx-campaign-select'); campaignList.innerHTML = ''; txSelect.innerHTML = '<option value="">-- Quỹ chung --</option>'; snapshot.forEach((docSnap) => { const data = docSnap.data(); if (data.status === 'active') { campaignList.innerHTML += `<div class="campaign-card"><div class="campaign-header"><span>🏕️ ${data.name}</span><span class="campaign-balance">${data.balance.toLocaleString()} ₫</span></div>${isManager ? `<button class="btn-close-campaign" onclick="window.closeCampaign('${docSnap.id}', '${data.name}')">Tất toán</button>` : ''}</div>`; txSelect.innerHTML += `<option value="${docSnap.id}">${data.name}</option>`; } }); });
    const txQuery = query(collection(db, "groups", currentGroupId, "transactions"), orderBy("createdAt", "desc"));
    unsubTx = onSnapshot(txQuery, (snapshot) => { const pendingList = document.getElementById('pending-list'); const txList = document.getElementById('transaction-list'); const pendingSection = document.getElementById('pending-section'); pendingList.innerHTML = ''; txList.innerHTML = ''; let hasPending = false; snapshot.forEach((docSnap) => { const data = docSnap.data(); const symbol = data.type === 'income' ? '+' : '-'; const color = data.type === 'income' ? 'green' : 'red'; if (data.status === 'pending') { hasPending = true; pendingList.innerHTML += `<li class="transaction-item pending-item"><div><strong>${data.createdBy}</strong> đề xuất ${data.type === 'income' ? 'THU' : 'CHI'}<br><span>${data.description}</span>: <b style="color:${color}">${symbol}${data.amount.toLocaleString()}đ</b></div>${isManager ? `<div class="pending-actions"><button class="btn-approve btn-3d" onclick="window.reviewTx('${docSnap.id}', true)">Duyệt</button><button class="btn-reject btn-3d" onclick="window.reviewTx('${docSnap.id}', false)">Hủy</button></div>` : '<span style="font-size: 12px; color: gray;">Chờ duyệt...</span>'}</li>`; } else if (data.status === 'approved') { txList.innerHTML += `<li class="transaction-item"><div class="tx-info"><span class="tx-desc">${data.description}</span><span style="font-size: 12px; color: gray;">Bởi: ${data.createdBy}</span></div><strong style="color: ${color}">${symbol}${data.amount.toLocaleString()} ₫</strong></li>`; } }); pendingSection.classList.toggle('hidden', !hasPending); });
}

// ================= 5. THAO TÁC CƠ SỞ DỮ LIỆU CÒN LẠI =================
document.getElementById('btn-add-member').addEventListener('click', async () => { 
    let rawPhone = await window.customPrompt("Mời Thành Viên", "Nhập SĐT cần mời (VD: 09... hoặc +123...)..."); 
    if (!rawPhone) return; 
    let newPhone = rawPhone.trim().replace(/\s+/g, '').replace(/^(?:\+84|84)/, '0');
    const phoneRegex = /^(0\d{9}|\+[1-9]\d{7,14})$/;
    if (!phoneRegex.test(newPhone)) return alert("Số điện thoại không hợp lệ!");

    const userSnap = await getDoc(doc(db, "users", newPhone)); if(!userSnap.exists()) return alert("SĐT này chưa đăng ký tài khoản!"); 
    try { const groupRef = doc(db, "groups", currentGroupId); if (isManager) { await updateDoc(groupRef, { members: arrayUnion(newPhone), pendingMembers: arrayRemove(newPhone) }); alert("Đã thêm thành viên!"); } else { await updateDoc(groupRef, { pendingMembers: arrayUnion(newPhone) }); alert("Đã gửi đề xuất thêm thành viên!"); } } catch(e) { alert("Lỗi: " + e.message); } 
});

window.approveMember = async (phone, isApprove) => { try { if (isApprove) await updateDoc(doc(db, "groups", currentGroupId), { members: arrayUnion(phone), pendingMembers: arrayRemove(phone) }); else await updateDoc(doc(db, "groups", currentGroupId), { pendingMembers: arrayRemove(phone) }); } catch (e) { alert("Lỗi: " + e.message); } };
window.toggleDeputy = async (phone, isCurrentlyDeputy) => { if (userRole !== 'owner') return; try { await updateDoc(doc(db, "groups", currentGroupId), { deputies: isCurrentlyDeputy ? arrayRemove(phone) : arrayUnion(phone) }); } catch (e) { alert("Lỗi: "+e.message); } };
window.removeMember = async (phone) => { if (userRole !== 'owner') return; if (!confirm(`Xóa ${phone}?`)) return; try { await updateDoc(doc(db, "groups", currentGroupId), { members: arrayRemove(phone), deputies: arrayRemove(phone) }); } catch (e) { alert("Lỗi: "+e.message); } };

document.getElementById('btn-income').addEventListener('click', () => { txType = "income"; txModal.classList.remove('hidden'); }); document.getElementById('btn-expense').addEventListener('click', () => { txType = "expense"; txModal.classList.remove('hidden'); }); document.getElementById('btn-cancel-tx').addEventListener('click', () => txModal.classList.add('hidden'));
document.getElementById('btn-submit-tx').addEventListener('click', async () => { let amount = parseInt(document.getElementById('tx-amount').value); const desc = document.getElementById('tx-desc').value; const campaignId = document.getElementById('tx-campaign-select').value; if (!amount || amount <= 0 || !desc) return alert("Nhập đầy đủ!"); const changeAmount = txType === "expense" ? -amount : amount; const txStatus = isManager ? "approved" : "pending"; try { if (isManager) { const targetRef = campaignId ? doc(db, "groups", currentGroupId, "campaigns", campaignId) : doc(db, "groups", currentGroupId); await updateDoc(targetRef, { balance: increment(changeAmount) }); } await addDoc(collection(db, "groups", currentGroupId, "transactions"), { type: txType, amount: amount, description: desc, campaignId: campaignId || null, createdBy: currentUser.name, status: txStatus, createdAt: serverTimestamp() }); txModal.classList.add('hidden'); document.getElementById('tx-amount').value = ''; document.getElementById('tx-desc').value = ''; if (!isManager) alert("Đã gửi đề xuất duyệt!"); } catch (e) { alert("Lỗi: " + e.message); } });
window.reviewTx = async (txId, isApprove) => { const txRef = doc(db, "groups", currentGroupId, "transactions", txId); try { if (!isApprove) { if(confirm("Hủy đề xuất này?")) await deleteDoc(txRef); return; } await runTransaction(db, async (t) => { const txDoc = await t.get(txRef); if (!txDoc.exists() || txDoc.data().status !== 'pending') throw "Lỗi!"; const data = txDoc.data(); const changeAmount = data.type === "expense" ? -data.amount : data.amount; const targetRef = data.campaignId ? doc(db, "groups", currentGroupId, "campaigns", data.campaignId) : doc(db, "groups", currentGroupId); t.update(targetRef, { balance: increment(changeAmount) }); t.update(txRef, { status: "approved" }); }); } catch (e) { alert("Lỗi: " + e); } };
document.getElementById('btn-create-campaign').addEventListener('click', async () => { 
    const name = await window.customPrompt("Tạo Quỹ Sự Kiện", "Tên sự kiện mới..."); 
    if (!name) return; try { await addDoc(collection(db, "groups", currentGroupId, "campaigns"), { name: name, status: "active", balance: 0, createdAt: serverTimestamp() }); } catch (e) { alert("Lỗi: " + e.message); } 
});
window.closeCampaign = async (campaignId, campaignName) => { if (!confirm(`Tất toán "${campaignName}"?`)) return; const groupRef = doc(db, "groups", currentGroupId); const campaignRef = doc(db, "groups", currentGroupId, "campaigns", campaignId); try { await runTransaction(db, async (t) => { const gDoc = await t.get(groupRef); const cDoc = await t.get(campaignRef); const cBal = cDoc.data().balance; t.update(groupRef, { balance: (gDoc.data().balance || 0) + cBal }); t.update(campaignRef, { balance: 0, status: "closed" }); t.set(doc(collection(db, "groups", currentGroupId, "transactions")), { type: cBal >= 0 ? "income" : "expense", amount: Math.abs(cBal), description: `Tất toán: ${campaignName}`, campaignId: null, createdBy: "HỆ THỐNG", status: "approved", createdAt: serverTimestamp() }); }); } catch (e) { alert("Lỗi: " + e); } };
