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

// DOM
const authScreen = document.getElementById('auth-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const mainScreen = document.getElementById('main-screen');
const txModal = document.getElementById('tx-modal');
const profileModal = document.getElementById('profile-modal');

let currentUser = null; // Lưu object {phone, name, avatar}
let currentGroupId = null; 
let txType = ""; 
let userRole = 'member'; 
let isManager = false;   

let unsubUser = null;
let unsubGroup = null;
let unsubCampaigns = null;
let unsubTx = null;

// ================= 1. HỆ THỐNG XÁC THỰC (ĐĂNG KÝ / ĐĂNG NHẬP) =================
// Chuyển đổi tab Đăng nhập/Đăng ký
document.getElementById('link-to-register').addEventListener('click', () => {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
    document.getElementById('auth-title').innerText = "Đăng ký tài khoản";
});

document.getElementById('link-to-login').addEventListener('click', () => {
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('auth-title').innerText = "Đăng nhập";
});

// Đăng ký
document.getElementById('btn-register-submit').addEventListener('click', async () => {
    const name = document.getElementById('reg-name').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const password = document.getElementById('reg-password').value.trim();

    if (!name || phone.length < 9 || password.length < 8) {
        return alert("Vui lòng nhập đầy đủ Họ tên, SĐT hợp lệ và Mật khẩu từ 8 ký tự trở lên!");
    }

    try {
        const userRef = doc(db, "users", phone);
        const snap = await getDoc(userRef);
        if (snap.exists()) return alert("Số điện thoại này đã được đăng ký!");

        // Lưu user mới vào Firestore
        await setDoc(userRef, { name, phone, password, avatar: "", createdAt: serverTimestamp() });
        alert("Đăng ký thành công! Vui lòng đăng nhập.");
        document.getElementById('link-to-login').click();
    } catch (e) { alert("Lỗi: " + e.message); }
});

// Đăng nhập
document.getElementById('btn-login-submit').addEventListener('click', async () => {
    const phone = document.getElementById('login-phone').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!phone || !password) return alert("Vui lòng nhập SĐT và mật khẩu!");

    try {
        const userRef = doc(db, "users", phone);
        const snap = await getDoc(userRef);
        
        if (!snap.exists() || snap.data().password !== password) {
            return alert("Sai số điện thoại hoặc mật khẩu!");
        }

        loginSuccess(phone);
    } catch (e) { alert("Lỗi: " + e.message); }
});

// Tự động đăng nhập
window.addEventListener('DOMContentLoaded', () => {
    const savedPhone = localStorage.getItem('userPhone'); 
    if (savedPhone) loginSuccess(savedPhone);
});

function loginSuccess(phone) {
    localStorage.setItem('userPhone', phone);
    authScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    
    // Lắng nghe thay đổi profile của user hiện tại
    if(unsubUser) unsubUser();
    unsubUser = onSnapshot(doc(db, "users", phone), (docSnap) => {
        if(docSnap.exists()) {
            currentUser = docSnap.data();
            // Xử lý ảnh đại diện mặc định
            const avatarUrl = currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=random&color=fff`;
            document.getElementById('user-avatar').src = avatarUrl;
            document.getElementById('user-name-display').innerText = currentUser.name;
            document.getElementById('user-phone-display').innerText = currentUser.phone;
        }
    });

    loadUserGroups(phone); 
}

// Đăng xuất
document.getElementById('btn-logout').addEventListener('click', () => {
    if (!confirm("Đăng xuất?")) return;
    localStorage.removeItem('userPhone');
    currentUser = null; currentGroupId = null;
    if(unsubUser) unsubUser(); if(unsubGroup) unsubGroup(); if(unsubCampaigns) unsubCampaigns(); if(unsubTx) unsubTx();
    
    document.getElementById('login-phone').value = ''; document.getElementById('login-password').value = '';
    dashboardScreen.classList.add('hidden'); mainScreen.classList.add('hidden'); authScreen.classList.remove('hidden');
});

// ================= 2. CẬP NHẬT PROFILE =================
document.getElementById('btn-edit-profile').addEventListener('click', () => {
    document.getElementById('edit-profile-name').value = currentUser.name;
    document.getElementById('edit-profile-avatar').value = currentUser.avatar || "";
    profileModal.classList.remove('hidden');
});

document.getElementById('btn-cancel-profile').addEventListener('click', () => profileModal.classList.add('hidden'));

document.getElementById('btn-submit-profile').addEventListener('click', async () => {
    const newName = document.getElementById('edit-profile-name').value.trim();
    const newAvatar = document.getElementById('edit-profile-avatar').value.trim();
    if(!newName) return alert("Tên không được để trống!");
    
    try {
        await updateDoc(doc(db, "users", currentUser.phone), { name: newName, avatar: newAvatar });
        profileModal.classList.add('hidden');
        alert("Cập nhật thành công!");
    } catch(e) { alert("Lỗi: " + e.message); }
});

// ================= 3. QUẢN LÝ NHÓM & CHI TIẾT NHÓM =================
function loadUserGroups(phone) {
    const q = query(collection(db, "groups"), where("members", "array-contains", phone));
    onSnapshot(q, (snapshot) => {
        const list = document.getElementById('group-list');
        list.innerHTML = '';
        if(snapshot.empty) return list.innerHTML = '<p style="text-align:center; color:gray;">Bạn chưa tham gia nhóm nào.</p>';

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            let roleHtml = '';
            if (data.ownerId === phone) roleHtml = '<span class="role-badge role-owner">👑 Trưởng nhóm</span>';
            else if (data.deputies && data.deputies.includes(phone)) roleHtml = '<span class="role-badge role-deputy">⭐ Phó nhóm</span>';
            else roleHtml = '<span class="role-badge role-member">👥 Thành viên</span>';
            
            list.innerHTML += `
                <div class="group-item-card" onclick="window.enterGroup('${docSnap.id}')">
                    <div class="group-item-name">${data.name}</div>
                    ${roleHtml}
                    <div class="group-item-balance">Số dư: <b>${(data.balance || 0).toLocaleString()} ₫</b></div>
                </div>`;
        });
    });
}

document.getElementById('btn-create-group').addEventListener('click', async () => {
    const groupName = prompt("Nhập tên nhóm mới:");
    if (!groupName) return;
    try {
        await addDoc(collection(db, "groups"), {
            name: groupName, ownerId: currentUser.phone, deputies: [], members: [currentUser.phone], pendingMembers: [], // Thêm mảng chờ duyệt
            balance: 0, createdAt: serverTimestamp()
        });
        alert("Tạo nhóm thành công!");
    } catch (e) { alert("Lỗi: " + e.message); }
});

window.enterGroup = (groupId) => {
    currentGroupId = groupId;
    dashboardScreen.classList.add('hidden'); mainScreen.classList.remove('hidden');
    initRealtimeListeners(); 
};

document.getElementById('btn-back-dashboard').addEventListener('click', () => {
    if(unsubGroup) unsubGroup(); if(unsubCampaigns) unsubCampaigns(); if(unsubTx) unsubTx();
    currentGroupId = null; mainScreen.classList.add('hidden'); dashboardScreen.classList.remove('hidden');
});

function initRealtimeListeners() {
    unsubGroup = onSnapshot(doc(db, "groups", currentGroupId), async (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();

        if (!data.members.includes(currentUser.phone)) {
            alert("Bạn đã bị xóa khỏi nhóm!");
            document.getElementById('btn-back-dashboard').click(); return;
        }

        document.getElementById('group-name').innerText = data.name;
        document.getElementById('balance').innerText = (data.balance || 0).toLocaleString();
        
        if (data.ownerId === currentUser.phone) { userRole = 'owner'; document.getElementById('user-role').innerHTML = '<span class="role-badge role-owner">👑 Trưởng nhóm</span>'; } 
        else if (data.deputies && data.deputies.includes(currentUser.phone)) { userRole = 'deputy'; document.getElementById('user-role').innerHTML = '<span class="role-badge role-deputy">⭐ Phó nhóm</span>'; } 
        else { userRole = 'member'; document.getElementById('user-role').innerHTML = '<span class="role-badge role-member">👥 Thành viên</span>'; }

        isManager = (userRole === 'owner' || userRole === 'deputy');
        
        document.getElementById('btn-create-campaign').classList.toggle('hidden', !isManager);
        document.getElementById('btn-income').innerText = isManager ? "➕ Thu tiền" : "➕ Đề xuất Thu";
        document.getElementById('btn-expense').innerText = isManager ? "➖ Chi tiền" : "➖ Đề xuất Chi";

        // HIỂN THỊ DANH SÁCH THÀNH VIÊN
        const memberListDiv = document.getElementById('member-list');
        memberListDiv.innerHTML = '';
        data.members.forEach(memberPhone => {
            let badge = (memberPhone === data.ownerId) ? '<span class="role-badge role-owner" style="font-size:10px;">👑 Trưởng</span>' : (data.deputies && data.deputies.includes(memberPhone)) ? '<span class="role-badge role-deputy" style="font-size:10px;">⭐ Phó</span>' : '<span class="role-badge role-member" style="font-size:10px;">👥 TV</span>';
            
            let actionHtml = '';
            if (userRole === 'owner' && memberPhone !== data.ownerId) {
                let isDep = data.deputies && data.deputies.includes(memberPhone);
                actionHtml = `<div style="display:flex; gap:5px;"><button class="btn-sm ${isDep ? 'btn-secondary' : 'btn-success'}" onclick="window.toggleDeputy('${memberPhone}', ${isDep})" style="padding:4px; font-size:11px;">${isDep ? 'Giáng cấp' : 'Lên phó'}</button><button class="btn-sm btn-danger" onclick="window.removeMember('${memberPhone}')" style="padding:4px; font-size:11px;">Xóa</button></div>`;
            }
            memberListDiv.innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 0; border-bottom: 1px solid #eee;"><div><b>${memberPhone}</b> ${badge}</div>${actionHtml}</div>`;
        });

        // HIỂN THỊ DANH SÁCH ĐỀ XUẤT THÀNH VIÊN (Chỉ Manager thấy, hoặc hiển thị trạng thái cho member)
        const pendingMembersDiv = document.getElementById('pending-members-list');
        const pendingSection = document.getElementById('pending-members-section');
        pendingMembersDiv.innerHTML = '';
        
        if (data.pendingMembers && data.pendingMembers.length > 0) {
            pendingSection.classList.remove('hidden');
            data.pendingMembers.forEach(pPhone => {
                let pAction = isManager ? `<button class="btn-sm btn-success" onclick="window.approveMember('${pPhone}', true)" style="padding:4px; font-size:11px;">Duyệt</button> <button class="btn-sm btn-danger" onclick="window.approveMember('${pPhone}', false)" style="padding:4px; font-size:11px;">Từ chối</button>` : `<span style="font-size:12px; color:gray;">Đang chờ duyệt...</span>`;
                pendingMembersDiv.innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 0; border-bottom: 1px solid #eee;"><span>SĐT: <b>${pPhone}</b></span> <div>${pAction}</div></div>`;
            });
        } else {
            pendingSection.classList.add('hidden');
        }
    });

    /* Lắng nghe Chiến dịch và Lịch sử Giao dịch (Giữ nguyên như các phiên bản trước) */
    unsubCampaigns = onSnapshot(collection(db, "groups", currentGroupId, "campaigns"), (snapshot) => {
        const campaignList = document.getElementById('campaign-list'); const txSelect = document.getElementById('tx-campaign-select');
        campaignList.innerHTML = ''; txSelect.innerHTML = '<option value="">-- Quỹ chung --</option>';
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.status === 'active') {
                campaignList.innerHTML += `<div class="campaign-card"><div class="campaign-header"><span>🏕️ ${data.name}</span><span class="campaign-balance">${data.balance.toLocaleString()} ₫</span></div>${isManager ? `<button class="btn-close-campaign" onclick="window.closeCampaign('${docSnap.id}', '${data.name}')">Tất toán</button>` : ''}</div>`;
                txSelect.innerHTML += `<option value="${docSnap.id}">${data.name}</option>`;
            }
        });
    });

    const txQuery = query(collection(db, "groups", currentGroupId, "transactions"), orderBy("createdAt", "desc"));
    unsubTx = onSnapshot(txQuery, (snapshot) => {
        const pendingList = document.getElementById('pending-list'); const txList = document.getElementById('transaction-list'); const pendingSection = document.getElementById('pending-section');
        pendingList.innerHTML = ''; txList.innerHTML = ''; let hasPending = false;
        snapshot.forEach((docSnap) => {
            const data = docSnap.data(); const symbol = data.type === 'income' ? '+' : '-'; const color = data.type === 'income' ? 'green' : 'red';
            if (data.status === 'pending') {
                hasPending = true;
                pendingList.innerHTML += `<li class="transaction-item pending-item"><div><strong>${data.createdBy}</strong> đề xuất ${data.type === 'income' ? 'THU' : 'CHI'}<br><span>${data.description}</span>: <b style="color:${color}">${symbol}${data.amount.toLocaleString()}đ</b></div>${isManager ? `<div class="pending-actions"><button class="btn-approve" onclick="window.reviewTx('${docSnap.id}', true)">Duyệt</button><button class="btn-reject" onclick="window.reviewTx('${docSnap.id}', false)">Hủy</button></div>` : '<span style="font-size: 12px; color: gray;">Chờ duyệt...</span>'}</li>`;
            } else if (data.status === 'approved') {
                txList.innerHTML += `<li class="transaction-item"><div class="tx-info"><span class="tx-desc">${data.description}</span><span style="font-size: 12px; color: gray;">Bởi: ${data.createdBy}</span></div><strong style="color: ${color}">${symbol}${data.amount.toLocaleString()} ₫</strong></li>`;
            }
        });
        pendingSection.classList.toggle('hidden', !hasPending);
    });
}

// ================= 4. CÁC THAO TÁC THÀNH VIÊN VÀ QUỸ =================

// Mời/Đề xuất thành viên mới
document.getElementById('btn-add-member').addEventListener('click', async () => {
    const newPhone = prompt("Nhập số điện thoại cần mời:");
    if (!newPhone || newPhone.length < 9) return;
    
    // Kiểm tra xem SĐT đó đã đăng ký tài khoản trên app chưa
    const userRef = doc(db, "users", newPhone);
    const userSnap = await getDoc(userRef);
    if(!userSnap.exists()) return alert("Số điện thoại này chưa đăng ký tài khoản trên hệ thống!");

    try {
        const groupRef = doc(db, "groups", currentGroupId);
        if (isManager) {
            // Quản lý thì cho vào thẳng nhóm
            await updateDoc(groupRef, { members: arrayUnion(newPhone), pendingMembers: arrayRemove(newPhone) });
            alert("Đã thêm thành viên thành công!");
        } else {
            // Thành viên thường thì đưa vào danh sách chờ duyệt
            await updateDoc(groupRef, { pendingMembers: arrayUnion(newPhone) });
            alert("Đã gửi đề xuất thêm thành viên. Vui lòng chờ quản lý duyệt!");
        }
    } catch(e) { alert("Lỗi: " + e.message); }
});

// Duyệt / Từ chối đề xuất thành viên (Dành cho Quản lý)
window.approveMember = async (phone, isApprove) => {
    const groupRef = doc(db, "groups", currentGroupId);
    try {
        if (isApprove) {
            await updateDoc(groupRef, { members: arrayUnion(phone), pendingMembers: arrayRemove(phone) });
        } else {
            await updateDoc(groupRef, { pendingMembers: arrayRemove(phone) });
        }
    } catch (e) { alert("Lỗi: " + e.message); }
};

// Các hàm thao tác cũ giữ nguyên
window.toggleDeputy = async (phone, isCurrentlyDeputy) => { if (userRole !== 'owner') return; try { await updateDoc(doc(db, "groups", currentGroupId), { deputies: isCurrentlyDeputy ? arrayRemove(phone) : arrayUnion(phone) }); } catch (e) { alert("Lỗi: "+e.message); } };
window.removeMember = async (phone) => { if (userRole !== 'owner') return; if (!confirm(`Xóa ${phone}?`)) return; try { await updateDoc(doc(db, "groups", currentGroupId), { members: arrayRemove(phone), deputies: arrayRemove(phone) }); } catch (e) { alert("Lỗi: "+e.message); } };

document.getElementById('btn-income').addEventListener('click', () => { txType = "income"; txModal.classList.remove('hidden'); });
document.getElementById('btn-expense').addEventListener('click', () => { txType = "expense"; txModal.classList.remove('hidden'); });
document.getElementById('btn-cancel-tx').addEventListener('click', () => txModal.classList.add('hidden'));

document.getElementById('btn-submit-tx').addEventListener('click', async () => {
    let amount = parseInt(document.getElementById('tx-amount').value); const desc = document.getElementById('tx-desc').value; const campaignId = document.getElementById('tx-campaign-select').value;
    if (!amount || amount <= 0 || !desc) return alert("Vui lòng nhập đầy đủ!");
    const changeAmount = txType === "expense" ? -amount : amount; const txStatus = isManager ? "approved" : "pending"; 
    try {
        if (isManager) { const targetRef = campaignId ? doc(db, "groups", currentGroupId, "campaigns", campaignId) : doc(db, "groups", currentGroupId); await updateDoc(targetRef, { balance: increment(changeAmount) }); }
        await addDoc(collection(db, "groups", currentGroupId, "transactions"), { type: txType, amount: amount, description: desc, campaignId: campaignId || null, createdBy: currentUser.name, status: txStatus, createdAt: serverTimestamp() });
        txModal.classList.add('hidden'); document.getElementById('tx-amount').value = ''; document.getElementById('tx-desc').value = '';
        if (!isManager) alert("Đã gửi đề xuất duyệt!");
    } catch (e) { alert("Lỗi: " + e.message); }
});

window.reviewTx = async (txId, isApprove) => {
    const txRef = doc(db, "groups", currentGroupId, "transactions", txId);
    try {
        if (!isApprove) { if(confirm("Hủy đề xuất này?")) await deleteDoc(txRef); return; }
        await runTransaction(db, async (t) => {
            const txDoc = await t.get(txRef); if (!txDoc.exists() || txDoc.data().status !== 'pending') throw "Không hợp lệ!";
            const data = txDoc.data(); const changeAmount = data.type === "expense" ? -data.amount : data.amount;
            const targetRef = data.campaignId ? doc(db, "groups", currentGroupId, "campaigns", data.campaignId) : doc(db, "groups", currentGroupId);
            t.update(targetRef, { balance: increment(changeAmount) }); t.update(txRef, { status: "approved" });
        });
    } catch (e) { alert("Lỗi: " + e); }
};

document.getElementById('btn-create-campaign').addEventListener('click', async () => {
    const name = prompt("Tên sự kiện mới:"); if (!name) return;
    try { await addDoc(collection(db, "groups", currentGroupId, "campaigns"), { name: name, status: "active", balance: 0, createdAt: serverTimestamp() }); } catch (e) { alert("Lỗi: " + e.message); }
});

window.closeCampaign = async (campaignId, campaignName) => {
    if (!confirm(`Tất toán "${campaignName}"?`)) return;
    const groupRef = doc(db, "groups", currentGroupId); const campaignRef = doc(db, "groups", currentGroupId, "campaigns", campaignId);
    try {
        await runTransaction(db, async (t) => {
            const gDoc = await t.get(groupRef); const cDoc = await t.get(campaignRef); const cBal = cDoc.data().balance;
            t.update(groupRef, { balance: (gDoc.data().balance || 0) + cBal }); t.update(campaignRef, { balance: 0, status: "closed" });
            t.set(doc(collection(db, "groups", currentGroupId, "transactions")), { type: cBal >= 0 ? "income" : "expense", amount: Math.abs(cBal), description: `Tất toán: ${campaignName}`, campaignId: null, createdBy: "HỆ THỐNG", status: "approved", createdAt: serverTimestamp() });
        });
    } catch (e) { alert("Lỗi: " + e); }
};
