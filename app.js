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

// DOM Elements
const authScreen = document.getElementById('auth-screen'); 
const dashboardScreen = document.getElementById('dashboard-screen'); 
const mainScreen = document.getElementById('main-screen');
const txModal = document.getElementById('tx-modal'); 
const settingsModal = document.getElementById('settings-modal'); 
const notiModal = document.getElementById('noti-modal');
const viewProfileModal = document.getElementById('view-profile-modal');

// State Variables
let currentUser = null; 
let currentGroupId = null; 
let currentGroupData = null; 
let userRole = 'member'; 
let isManager = false; let txType = "";

let unsubUser = null; let unsubGroup = null; let unsubCampaigns = null; 
let unsubTx = null; let unsubNoti = null; let unsubAnno = null;

// Pagination Arrays & Vars
let cachedTransactions = []; 
let approvedTransactions = []; let currentTxPage = 1; const TX_PER_PAGE = 5; 
let pendingMembersArr = []; let pendingTxArr = []; let currentPendingPage = 1; const PENDING_PER_PAGE = 5;
let groupAnnouncements = []; let currentAnnoPage = 1; const ANNO_PER_PAGE = 5;
let currentlyOpenMember = null; let cachedGroupMembersArray = []; let searchMemberQuery = ""; let currentMemberPage = 1; const MEMBERS_PER_PAGE = 10;

const FB_EMOJIS = { '👍': { text: 'Thích', color: '#056BF0' }, '❤️': { text: 'Yêu thích', color: '#F33E58' }, '🥰': { text: 'Thương', color: '#F7B125' }, '😂': { text: 'Haha', color: '#F7B125' }, '😮': { text: 'Wow', color: '#F7B125' }, '😢': { text: 'Buồn', color: '#F7B125' }, '😡': { text: 'Phẫn nộ', color: '#E9710F' } };

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

async function sendNotification(targetPhone, title, body, groupId) {
    if (!targetPhone) return;
    try { await addDoc(collection(db, "users", targetPhone, "notifications"), { title, body, groupId, read: false, createdAt: serverTimestamp() }); } catch (e) { console.error(e); }
}

document.getElementById('btn-notifications').addEventListener('click', () => { notiModal.classList.remove('hidden'); });
document.getElementById('btn-close-noti').addEventListener('click', () => { notiModal.classList.add('hidden'); });
window.markNotiRead = async (notiId, groupId) => { 
    try { await updateDoc(doc(db, "users", currentUser.phone, "notifications", notiId), { read: true }); notiModal.classList.add('hidden'); if (groupId && currentGroupId !== groupId) window.enterGroup(groupId); } 
    catch (e) { console.error(e); } 
};

// POPUP TO RỘNG
window.customPrompt = function(title, description, placeholder) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-prompt-modal');
        const area = document.getElementById('prompt-textarea');
        document.getElementById('prompt-title').innerText = title;
        document.getElementById('prompt-desc').innerText = description;
        area.placeholder = placeholder; area.value = '';
        modal.classList.remove('hidden'); area.focus();

        const btnSubmit = document.getElementById('btn-prompt-submit');
        const btnCancel = document.getElementById('btn-prompt-cancel');
        const cleanup = () => { modal.classList.add('hidden'); btnSubmit.onclick = null; btnCancel.onclick = null; }
        btnSubmit.onclick = () => { const val = area.value.trim(); cleanup(); resolve(val); };
        btnCancel.onclick = () => { cleanup(); resolve(null); };
    });
}

// ================= XÁC THỰC =================
document.getElementById('link-to-register').addEventListener('click', () => { document.getElementById('login-form').classList.add('hidden'); document.getElementById('register-form').classList.remove('hidden'); document.getElementById('auth-title').innerText = "Đăng ký tài khoản"; });
document.getElementById('link-to-login').addEventListener('click', () => { document.getElementById('register-form').classList.add('hidden'); document.getElementById('login-form').classList.remove('hidden'); document.getElementById('auth-title').innerText = "Đăng nhập"; });
document.getElementById('btn-register-submit').addEventListener('click', async () => { const name = document.getElementById('reg-name').value.trim(); const phone = document.getElementById('reg-phone').value.trim(); const address = document.getElementById('reg-address').value.trim(); const password = document.getElementById('reg-password').value.trim(); if (!name || phone.length < 9 || password.length < 8) return alert("Nhập đủ thông tin (Mật khẩu > 8 ký tự)!"); try { const userRef = doc(db, "users", phone); if ((await getDoc(userRef)).exists()) return alert("SĐT đã ký!"); await setDoc(userRef, { name, phone, address, password, avatar: "", createdAt: serverTimestamp() }); alert("Đăng ký thành công!"); document.getElementById('link-to-login').click(); } catch (e) { alert("Lỗi: " + e.message); } });
document.getElementById('btn-login-submit').addEventListener('click', async () => { const phone = document.getElementById('login-phone').value.trim(); const password = document.getElementById('login-password').value.trim(); if (!phone || !password) return alert("Nhập SĐT và mật khẩu!"); try { const snap = await getDoc(doc(db, "users", phone)); if (!snap.exists() || snap.data().password !== password) return alert("Sai SĐT hoặc mật khẩu!"); loginSuccess(phone); } catch (e) { alert("Lỗi: " + e.message); } });
window.addEventListener('DOMContentLoaded', () => { const savedPhone = localStorage.getItem('userPhone'); if (savedPhone) loginSuccess(savedPhone); });

function loginSuccess(phone) {
    localStorage.setItem('userPhone', phone); authScreen.classList.add('hidden'); dashboardScreen.classList.remove('hidden');
    if(unsubUser) unsubUser();
    unsubUser = onSnapshot(doc(db, "users", phone), (docSnap) => { if(docSnap.exists()) { currentUser = docSnap.data(); userCache[currentUser.phone] = currentUser; document.getElementById('user-avatar').src = currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=random&color=fff`; document.getElementById('user-name-display').innerText = currentUser.name; document.getElementById('user-phone-display').innerText = currentUser.phone; } });
    if(unsubNoti) unsubNoti();
    unsubNoti = onSnapshot(query(collection(db, "users", phone, "notifications"), orderBy("createdAt", "desc")), (snapshot) => {
        const notiList = document.getElementById('noti-list'); const notiBadge = document.getElementById('noti-badge'); notiList.innerHTML = ''; let unreadCount = 0;
        snapshot.forEach(docSnap => { const data = docSnap.data(); if (!data.read) unreadCount++; const unreadClass = data.read ? '' : 'unread'; const timeString = data.createdAt ? data.createdAt.toDate().toLocaleString('vi-VN') : 'Vừa xong'; notiList.innerHTML += `<div class="noti-item ${unreadClass}" onclick="window.markNotiRead('${docSnap.id}', '${data.groupId || ''}')"><div class="noti-title">${data.title}</div><div class="noti-body">${data.body}</div><div class="noti-time">${timeString}</div></div>`; });
        if (unreadCount > 0) { notiBadge.innerText = unreadCount > 9 ? '9+' : unreadCount; notiBadge.classList.remove('hidden'); } else { notiBadge.classList.add('hidden'); }
    });
    loadUserGroups(phone); 
}

document.getElementById('btn-logout').addEventListener('click', () => { if (!confirm("Đăng xuất?")) return; localStorage.removeItem('userPhone'); currentUser = null; currentGroupId = null; if(unsubUser) unsubUser(); if(unsubGroup) unsubGroup(); if(unsubAnno) unsubAnno(); if(unsubNoti) unsubNoti(); if(unsubTx) unsubTx(); if(unsubCampaigns) unsubCampaigns(); dashboardScreen.classList.add('hidden'); mainScreen.classList.add('hidden'); authScreen.classList.remove('hidden'); });

// ================= NHÓM & BẢNG TIN =================
function loadUserGroups(phone) {
    onSnapshot(query(collection(db, "groups"), where("members", "array-contains", phone)), (snapshot) => {
        const list = document.getElementById('group-list'); list.innerHTML = '';
        if(snapshot.empty) return list.innerHTML = '<p style="text-align:center; color:gray;">Chưa tham gia nhóm nào.</p>';
        snapshot.forEach((docSnap) => {
            const data = docSnap.data(); let roleHtml = (data.ownerId === phone) ? '<span class="role-badge role-owner">👑 Trưởng nhóm</span>' : (data.deputies && data.deputies.includes(phone)) ? '<span class="role-badge role-deputy">⭐ Phó nhóm</span>' : '<span class="role-badge role-member">👥 Thành viên</span>';
            list.innerHTML += `<div class="group-item-card" onclick="window.enterGroup('${docSnap.id}')"><div class="group-item-name">${data.name}</div>${roleHtml}<div class="group-item-balance">Số dư: <b>${(data.balance || 0).toLocaleString()} ₫</b></div></div>`;
        });
    });
}

document.getElementById('btn-create-group').addEventListener('click', async () => { const name = await window.customPrompt("Tạo Nhóm", "Tạo cộng đồng của bạn", "Tên nhóm..."); if (!name) return; await addDoc(collection(db, "groups"), { name, ownerId: currentUser.phone, deputies: [], members: [currentUser.phone], pendingInvites: [], balance: 0, createdAt: serverTimestamp() }); });
window.enterGroup = (groupId) => { currentGroupId = groupId; dashboardScreen.classList.add('hidden'); mainScreen.classList.remove('hidden'); initRealtimeListeners(); };

document.getElementById('btn-back-dashboard').addEventListener('click', () => { if(unsubGroup) unsubGroup(); if(unsubCampaigns) unsubCampaigns(); if(unsubTx) unsubTx(); if(unsubAnno) unsubAnno(); currentGroupId = null; currentGroupData = null; mainScreen.classList.add('hidden'); dashboardScreen.classList.remove('hidden'); });

// Cài đặt Profile & Quyền quản trị
document.getElementById('btn-edit-profile').addEventListener('click', () => { window.openSettings(currentUser.phone); });
document.getElementById('btn-cancel-settings').addEventListener('click', () => settingsModal.classList.add('hidden'));
window.openSettings = async (targetPhone) => {
    const isSelf = (targetPhone === currentUser.phone); const targetUser = userCache[targetPhone] || { name: "", address: "", avatar: "" };
    document.getElementById('edit-profile-name').value = targetUser.name; document.getElementById('edit-profile-address').value = targetUser.address || ""; document.getElementById('edit-profile-avatar').value = targetUser.avatar || "";
    document.getElementById('edit-profile-name').disabled = !isSelf; document.getElementById('edit-profile-address').disabled = !isSelf; document.getElementById('edit-profile-avatar').disabled = !isSelf;
    const btnSubmitProfile = document.getElementById('btn-submit-profile');
    if (isSelf) btnSubmitProfile.classList.remove('hidden'); else btnSubmitProfile.classList.add('hidden');
    const adminSection = document.getElementById('settings-section-admin'); const adminActions = document.getElementById('admin-actions-container');
    adminSection.classList.add('hidden'); adminActions.innerHTML = '';
    if (currentGroupId && currentGroupData && userRole === 'owner' && !isSelf) {
        const isDeputy = currentGroupData.deputies && currentGroupData.deputies.includes(targetPhone); adminSection.classList.remove('hidden');
        adminActions.innerHTML = `<button class="btn-sm ${isDeputy ? 'btn-secondary' : 'btn-success'} btn-3d" onclick="window.toggleDeputy('${targetPhone}', ${isDeputy}); document.getElementById('settings-modal').classList.add('hidden');" style="flex:1;">${isDeputy ? '📉 Giáng cấp' : '📈 Lên phó'}</button><button class="btn-sm btn-danger btn-3d" onclick="window.removeMember('${targetPhone}'); document.getElementById('settings-modal').classList.add('hidden');" style="flex:1;">❌ Xóa TV</button>`;
    }
    settingsModal.classList.remove('hidden');
};
document.getElementById('btn-submit-profile').addEventListener('click', async () => { const newName = document.getElementById('edit-profile-name').value.trim(); const newAddress = document.getElementById('edit-profile-address').value.trim(); const newAvatar = document.getElementById('edit-profile-avatar').value.trim(); if(!newName) return alert("Tên không được để trống!"); try { await updateDoc(doc(db, "users", currentUser.phone), { name: newName, address: newAddress, avatar: newAvatar }); userCache[currentUser.phone] = { ...currentUser, name: newName, address: newAddress, avatar: newAvatar }; settingsModal.classList.add('hidden'); alert("Đã lưu!"); } catch(e) { alert("Lỗi: " + e.message); } });

// Bảng tin Thông báo
document.getElementById('btn-create-announcement').addEventListener('click', async () => {
    const title = await window.customPrompt("Tiêu đề thông báo", "Ví dụ: Lịch trình tour ngày mai", "Nhập tiêu đề..."); if (!title) return;
    const content = await window.customPrompt("Nội dung chi tiết", "Viết đầy đủ thông tin hoặc phân công công việc", "Nhập nội dung..."); if (!content) return;
    await addDoc(collection(db, "groups", currentGroupId, "announcements"), { title, content, createdBy: currentUser.name, createdAt: serverTimestamp() });
});
function renderAnnouncements() {
    const div = document.getElementById('announcement-list');
    const totalPages = Math.ceil(groupAnnouncements.length / ANNO_PER_PAGE) || 1;
    document.getElementById('anno-page-info').innerText = `${currentAnnoPage}/${totalPages}`;
    document.getElementById('anno-pagination').style.display = totalPages > 1 ? 'flex' : 'none';
    const paginated = groupAnnouncements.slice((currentAnnoPage-1)*ANNO_PER_PAGE, currentAnnoPage*ANNO_PER_PAGE);
    div.innerHTML = paginated.length === 0 ? '<p style="text-align:center; color:gray; font-size:13px; padding:10px;">Chưa có thông báo nào từ ban quản trị.</p>' : '';
    paginated.forEach(a => { const time = a.createdAt ? a.createdAt.toDate().toLocaleString('vi-VN') : 'Vừa xong'; div.innerHTML += `<div class="anno-item"><div class="anno-title">${a.title}</div><div class="anno-body">${a.content}</div><div class="anno-meta">Đăng bởi: <b>${a.createdBy}</b> • ${time}</div></div>`; });
}
document.getElementById('btn-anno-prev').addEventListener('click', () => { if(currentAnnoPage > 1) { currentAnnoPage--; renderAnnouncements(); }});
document.getElementById('btn-anno-next').addEventListener('click', () => { if(currentAnnoPage < Math.ceil(groupAnnouncements.length/ANNO_PER_PAGE)) { currentAnnoPage++; renderAnnouncements(); }});

// ================= BẢNG TIN CHỜ DUYỆT (UNIFIED) =================
async function renderUnifiedPendingList() {
    const sec = document.getElementById('unified-pending-section'); const listDiv = document.getElementById('unified-pending-list');
    let all = [...pendingMembersArr, ...pendingTxArr];
    if (all.length === 0) { sec.classList.add('hidden'); return; }
    sec.classList.remove('hidden');
    const totalPages = Math.ceil(all.length / PENDING_PER_PAGE) || 1;
    document.getElementById('pending-page-info').innerText = `${currentPendingPage}/${totalPages}`;
    document.getElementById('pending-pagination').style.display = totalPages > 1 ? 'flex' : 'none';
    const paginated = all.slice((currentPendingPage-1)*PENDING_PER_PAGE, currentPendingPage*PENDING_PER_PAGE);
    listDiv.innerHTML = '';
    const phones = []; paginated.forEach(i => { if(i.type==='member_invite'){ phones.push(i.data.phone); phones.push(i.data.proposedBy); }});
    const uData = await getUsersData(phones);
    paginated.forEach(i => {
        if (i.type === 'member_invite') {
            const p = i.data.phone; const inv = i.data.proposedBy; const info = uData[p]; const infoInv = uData[inv];
            const avt = `https://ui-avatars.com/api/?name=${encodeURIComponent(info.name)}&background=random&color=fff`;
            listDiv.innerHTML += `<div class="pending-item" style="display:flex; justify-content:space-between; align-items:center; padding:12px; margin-bottom:10px; background:#FFFBEB; border-left: 4px solid #F59E0B; border-radius:12px;"><div style="display:flex; align-items:center; gap:10px;"><img src="${avt}" style="width:36px; height:36px; border-radius:50%;"><div><div style="font-size:11px; font-weight:bold; color:#D97706;">MỜI THÀNH VIÊN</div><div style="font-size:15px; font-weight:bold;">${info.name}</div><div style="font-size:12px; color:gray;">Bởi: ${infoInv.name}</div></div></div><div style="display:flex; gap:5px; flex-direction:column;">${isManager ? `<button class="btn-sm btn-secondary" onclick="window.viewUserProfile('${p}', '${infoInv.name}')">Hồ sơ</button><button class="btn-sm btn-success" onclick="window.approveMember('${p}', '${inv}', true)">Duyệt</button><button class="btn-sm btn-danger" onclick="window.approveMember('${p}', '${inv}', false)">Hủy</button>` : ''}</div></div>`;
        } else {
            const d = i.data; const color = d.type === 'income' ? '#10B981' : '#EF4444';
            listDiv.innerHTML += `<div class="pending-item" style="padding:12px; margin-bottom:10px; background:#FEF2F2; border-left: 4px solid #EF4444; border-radius:12px;"><div style="display:flex; justify-content:space-between; align-items:center;"><div><div style="font-size:11px; font-weight:bold; color:#DC2626;">ĐỀ XUẤT ${d.type==='income'?'THU':'CHI'}</div><strong>${d.createdByName}</strong><br><span style="font-size:13px;">${d.description}</span>: <b style="color:${color}; font-size:16px;">${d.type==='income'?'+':'-'}${d.amount.toLocaleString()}đ</b></div>${isManager ? `<div style="display:flex; flex-direction:column; gap:5px;"><button class="btn-sm btn-success" onclick="window.reviewTx('${d.id}', true)">Duyệt</button><button class="btn-sm btn-danger" onclick="window.reviewTx('${d.id}', false)">Hủy</button></div>` : ''}</div></div>`;
        }
    });
}
document.getElementById('btn-pending-prev').addEventListener('click', () => { if(currentPendingPage>1){ currentPendingPage--; renderUnifiedPendingList(); }});
document.getElementById('btn-pending-next').addEventListener('click', () => { if(currentPendingPage < Math.ceil((pendingMembersArr.length + pendingTxArr.length)/PENDING_PER_PAGE)){ currentPendingPage++; renderUnifiedPendingList(); }});

// ================= THÀNH VIÊN =================
window.toggleMemberDetails = (phone) => { if (currentlyOpenMember && currentlyOpenMember !== phone) { const oldEl = document.getElementById(`details-${currentlyOpenMember}`); if(oldEl) oldEl.classList.remove('open'); } const newEl = document.getElementById(`details-${phone}`); if(newEl) { newEl.classList.toggle('open'); if(newEl.classList.contains('open')) currentlyOpenMember = phone; else currentlyOpenMember = null; } };
document.getElementById('search-member-input').addEventListener('input', (e) => { searchMemberQuery = e.target.value.toLowerCase().trim(); currentMemberPage = 1; renderMemberList(); });
document.getElementById('btn-prev-page').addEventListener('click', () => { if (currentMemberPage > 1) { currentMemberPage--; renderMemberList(); } });
document.getElementById('btn-next-page').addEventListener('click', () => { currentMemberPage++; renderMemberList(); });

function renderMemberList() {
    const memberListDiv = document.getElementById('member-list');
    let filtered = cachedGroupMembersArray.filter(u => u.phone.includes(searchMemberQuery) || u.name.toLowerCase().includes(searchMemberQuery));
    const totalPages = Math.ceil(filtered.length / MEMBERS_PER_PAGE) || 1; if (currentMemberPage > totalPages) currentMemberPage = totalPages;
    document.getElementById('page-info').innerText = `${currentMemberPage}/${totalPages}`; document.getElementById('btn-prev-page').disabled = (currentMemberPage === 1); document.getElementById('btn-next-page').disabled = (currentMemberPage === totalPages);
    const startIdx = (currentMemberPage - 1) * MEMBERS_PER_PAGE; const paginated = filtered.slice(startIdx, startIdx + MEMBERS_PER_PAGE);
    memberListDiv.innerHTML = '';
    if(paginated.length === 0) { memberListDiv.innerHTML = '<p style="text-align:center; padding:10px; color:gray;">Không tìm thấy ai.</p>'; return; }

    paginated.forEach(uInfo => {
        const memberPhone = uInfo.phone; const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(uInfo.name)}&background=random&color=fff`;
        let badge = (memberPhone === currentGroupData.ownerId) ? '<span class="role-badge role-owner" style="margin:0;">👑 Trưởng</span>' : (currentGroupData.deputies && currentGroupData.deputies.includes(memberPhone)) ? '<span class="role-badge role-deputy" style="margin:0;">⭐ Phó</span>' : '<span class="role-badge role-member" style="margin:0;">👥 TV</span>';
        let settingsBtnHtml = (userRole === 'owner' || memberPhone === currentUser.phone) ? `<button class="btn-sm btn-secondary btn-3d" onclick="window.openSettings('${memberPhone}')" style="width: 100%; margin-top: 10px;">⚙️ Cài đặt</button>` : '';
        let isOpenClass = (memberPhone === currentlyOpenMember) ? 'open' : '';

        memberListDiv.innerHTML += `
            <div class="member-item">
                <div class="member-summary" onclick="window.toggleMemberDetails('${memberPhone}')">
                    <div style="display:flex; align-items:center; gap: 10px;"><img src="${uInfo.avatar || defaultAvatar}" class="avatar-img" style="width:35px; height:35px;"><b>${uInfo.name}</b></div>
                    <div style="display:flex; align-items:center; gap: 5px;">${badge} <span style="color:gray; font-size:12px;">▼</span></div>
                </div>
                <div id="details-${memberPhone}" class="member-details ${isOpenClass}">
                    <p style="margin-bottom: 5px;">📞 <b>SĐT:</b> ${memberPhone}</p>
                    <p style="margin-bottom: 5px;">🏠 <b>Địa chỉ:</b> ${uInfo.address || 'Chưa cập nhật'}</p>
                    <div class="contact-actions"><a href="tel:${memberPhone}" class="btn-call">📞 Gọi</a><a href="https://zalo.me/${memberPhone}" target="_blank" class="btn-zalo">💬 Zalo</a></div>
                    ${settingsBtnHtml}
                </div>
            </div>`;
    });
}

// ================= GIAO DỊCH, FB COMMENTS =================
window.toggleTxComments = (txId) => { const el = document.getElementById(`comments-${txId}`); if(el) el.classList.toggle('hidden'); };
window.reactToTx = async (txId, emoji) => { try { const txRef = doc(db, "groups", currentGroupId, "transactions", txId); const txDoc = await getDoc(txRef); if(!txDoc.exists()) return; const reactions = txDoc.data().reactions || {}; if (reactions[currentUser.phone] === emoji) delete reactions[currentUser.phone]; else reactions[currentUser.phone] = emoji; await updateDoc(txRef, { reactions }); } catch(e) { console.error(e); } };
window.submitComment = async (txId) => { const input = document.getElementById(`input-cmt-${txId}`); const text = input.value.trim(); if(!text) return; try { const txRef = doc(db, "groups", currentGroupId, "transactions", txId); await updateDoc(txRef, { comments: arrayUnion({ phone: currentUser.phone, name: currentUser.name, text: text, time: Date.now() }) }); input.value = ''; } catch(e) { console.error(e); } };

function renderTransaction(data, docId) {
    const symbol = data.type === 'income' ? '+' : '-'; const color = data.type === 'income' ? '#10B981' : '#EF4444'; 
    const reactions = data.reactions || {}; const comments = data.comments || [];
    let totalReacts = Object.keys(reactions).length; let uniqueEmojis = [...new Set(Object.values(reactions))].slice(0, 3).join('');
    let statsHtml = '';
    if (totalReacts > 0 || comments.length > 0) { statsHtml = `<div class="tx-stats"><div class="tx-stats-left">${totalReacts > 0 ? `${uniqueEmojis} ${totalReacts}` : ''}</div>${comments.length > 0 ? `<div class="tx-stats-right" onclick="window.toggleTxComments('${docId}')">${comments.length} bình luận</div>` : '<div></div>'}</div>`; }
    const myReaction = reactions[currentUser.phone]; let btnText = '👍 Thích'; let btnColor = '#65676B';
    if (myReaction && FB_EMOJIS[myReaction]) { btnText = `${myReaction} ${FB_EMOJIS[myReaction].text}`; btnColor = FB_EMOJIS[myReaction].color; }
    let popoverHtml = `<div class="reaction-popover">`; Object.keys(FB_EMOJIS).forEach(emj => { popoverHtml += `<span class="react-icon" onclick="event.stopPropagation(); window.reactToTx('${docId}', '${emj}')">${emj}</span>`; }); popoverHtml += `</div>`;
    let commentsHtml = comments.map(c => `<div class="comment-item"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=random&color=fff" class="comment-avatar"><div class="comment-bubble"><b>${c.name}</b><span>${c.text}</span></div></div>`).join('');
    return `
    <li class="transaction-item">
        <div class="tx-top"><div class="tx-info"><span class="tx-desc">${data.description}</span><span style="font-size: 12px; color: gray;">Bởi: ${data.createdByName}</span></div><strong style="color: ${color}; font-size: 18px;">${symbol}${data.amount.toLocaleString()} ₫</strong></div>
        <div class="tx-interactions">${statsHtml}<div class="tx-actions"><div class="like-wrapper"><button class="action-btn-fb" style="color: ${btnColor};" onclick="window.reactToTx('${docId}', '${myReaction ? myReaction : '👍'}')">${btnText}</button>${popoverHtml}</div><button class="action-btn-fb" onclick="window.toggleTxComments('${docId}')">💬 Bình luận</button></div></div>
        <div id="comments-${docId}" class="tx-comments-section hidden">${commentsHtml}<div class="comment-input-area"><input type="text" id="input-cmt-${docId}" placeholder="Viết bình luận..." onkeypress="if(event.key==='Enter') window.submitComment('${docId}')"><button onclick="window.submitComment('${docId}')">Gửi</button></div></div>
    </li>`;
}

function renderPaginatedTransactions() {
    const txList = document.getElementById('transaction-list');
    const totalPages = Math.ceil(approvedTransactions.length / TX_PER_PAGE) || 1;
    if (currentTxPage > totalPages) currentTxPage = totalPages;
    document.getElementById('tx-page-info').innerText = `${currentTxPage}/${totalPages}`;
    document.getElementById('btn-tx-prev-page').disabled = (currentTxPage === 1); document.getElementById('btn-tx-next-page').disabled = (currentTxPage === totalPages);
    const startIdx = (currentTxPage - 1) * TX_PER_PAGE; const paginated = approvedTransactions.slice(startIdx, startIdx + TX_PER_PAGE);
    txList.innerHTML = '';
    if (paginated.length === 0) { txList.innerHTML = '<p style="text-align:center; color:gray; padding:10px;">Chưa có giao dịch chính thức nào.</p>'; return; }
    paginated.forEach(tx => { txList.innerHTML += renderTransaction(tx, tx.id); });
}
document.getElementById('btn-tx-prev-page').addEventListener('click', () => { if (currentTxPage > 1) { currentTxPage--; renderPaginatedTransactions(); } });
document.getElementById('btn-tx-next-page').addEventListener('click', () => { currentTxPage++; renderPaginatedTransactions(); });

// ================= REALTIME LISTENERS CỐT LÕI =================
function initRealtimeListeners() {
    unsubGroup = onSnapshot(doc(db, "groups", currentGroupId), async (snap) => {
        if (!snap.exists()) return; currentGroupData = snap.data();
        if (!currentGroupData.members.includes(currentUser.phone)) { alert("Bạn đã bị xóa khỏi nhóm!"); document.getElementById('btn-back-dashboard').click(); return; }
        document.getElementById('group-name').innerText = currentGroupData.name; document.getElementById('balance').innerText = (currentGroupData.balance || 0).toLocaleString();
        userRole = (currentGroupData.ownerId === currentUser.phone) ? 'owner' : (currentGroupData.deputies && currentGroupData.deputies.includes(currentUser.phone)) ? 'deputy' : 'member';
        document.getElementById('user-role').innerHTML = `<span class="role-badge role-${userRole}">${userRole==='owner'?'Trưởng':userRole==='deputy'?'Phó':'Thành viên'}</span>`;
        isManager = (userRole === 'owner' || userRole === 'deputy');
        document.getElementById('btn-create-announcement').classList.toggle('hidden', !isManager);
        document.getElementById('btn-create-campaign').classList.toggle('hidden', !isManager);
        
        const mData = await getUsersData(currentGroupData.members);
        cachedGroupMembersArray = currentGroupData.members.map(p => ({ phone:p, ...mData[p] })); renderMemberList();
        pendingMembersArr = (currentGroupData.pendingInvites || []).map(inv => ({ type: 'member_invite', data: inv })); renderUnifiedPendingList();
    });

    if(unsubAnno) unsubAnno();
    unsubAnno = onSnapshot(query(collection(db, "groups", currentGroupId, "announcements"), orderBy("createdAt", "desc")), (snap) => {
        groupAnnouncements = []; snap.forEach(d => groupAnnouncements.push(d.data())); renderAnnouncements();
    });

    unsubCampaigns = onSnapshot(collection(db, "groups", currentGroupId, "campaigns"), (snap) => { const list = document.getElementById('campaign-list'); const sel = document.getElementById('tx-campaign-select'); list.innerHTML = ''; sel.innerHTML = '<option value="">-- Quỹ chung --</option>'; snap.forEach(d => { if(d.data().status==='active'){ list.innerHTML += `<div class="campaign-card"><div class="campaign-header"><span>🏕️ ${d.data().name}</span><span class="campaign-balance">${d.data().balance.toLocaleString()}đ</span></div>${isManager?`<button class="btn-close-campaign" onclick="window.closeCampaign('${d.id}','${d.data().name}')">Tất toán</button>`:''}</div>`; sel.innerHTML += `<option value="${d.id}">${d.data().name}</option>`; }}); });
    
    unsubTx = onSnapshot(query(collection(db, "groups", currentGroupId, "transactions"), orderBy("createdAt", "desc")), (snap) => {
        approvedTransactions = []; pendingTxArr = []; cachedTransactions = [];
        snap.forEach(d => { 
            cachedTransactions.push({id:d.id, ...d.data()});
            if(d.data().status==='pending') pendingTxArr.push({type:'transaction', data:{id:d.id, ...d.data()}}); 
            else approvedTransactions.push({id:d.id, ...d.data()}); 
        });
        renderPaginatedTransactions(); renderUnifiedPendingList();
        if (!document.getElementById('filter-modal').classList.contains('hidden')) { applyFilter(); }
    });
}

// ================= KIỂM DUYỆT & LỌC CÒN LẠI =================
window.viewUserProfile = async (phone, inviterName) => { const dataObj = await getUsersData([phone]); const user = dataObj[phone]; document.getElementById('view-profile-avatar').src = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random&color=fff`; document.getElementById('view-profile-name').innerText = user.name; document.getElementById('view-profile-phone').innerText = user.phone; document.getElementById('view-profile-address').innerText = user.address || 'Chưa cập nhật'; document.getElementById('view-profile-inviter').innerText = inviterName; viewProfileModal.classList.remove('hidden'); };
document.getElementById('btn-close-view-profile').addEventListener('click', () => viewProfileModal.classList.add('hidden'));

document.getElementById('btn-add-member').addEventListener('click', async () => { const newPhone = await window.customPrompt("Mời Thành Viên", "Nhập chính xác SĐT", "SĐT cần mời..."); if (!newPhone || newPhone.length < 9) return; const userSnap = await getDoc(doc(db, "users", newPhone)); if(!userSnap.exists()) return alert("SĐT này chưa đăng ký app!"); try { const groupRef = doc(db, "groups", currentGroupId); const groupData = (await getDoc(groupRef)).data(); const currentInvites = groupData.pendingInvites || []; const newInvites = currentInvites.filter(inv => inv.phone !== newPhone); if (isManager) { await updateDoc(groupRef, { members: arrayUnion(newPhone), pendingInvites: newInvites }); sendNotification(newPhone, "Bạn đã được thêm vào nhóm", `Quản trị viên vừa thêm bạn vào nhóm ${groupData.name}`, currentGroupId); } else { newInvites.push({ phone: newPhone, proposedBy: currentUser.phone }); await updateDoc(groupRef, { pendingInvites: newInvites }); alert("Đã gửi đề xuất thêm thành viên!"); const managers = [groupData.ownerId, ...(groupData.deputies || [])]; managers.forEach(mgr => sendNotification(mgr, "Đề xuất thành viên", `${currentUser.name} mời SĐT ${newPhone} vào nhóm.`, currentGroupId)); } } catch(e) { alert("Lỗi: " + e.message); } });

window.approveMember = async (phone, inviterPhone, isApprove) => {
    const invites = (currentGroupData.pendingInvites || []).filter(i => i.phone !== phone);
    if (isApprove) {
        await updateDoc(doc(db, "groups", currentGroupId), { members: arrayUnion(phone), pendingInvites: invites });
        sendNotification(phone, "Đã vào nhóm", `Bạn đã được duyệt vào nhóm ${currentGroupData.name}`, currentGroupId);
    } else {
        const reason = await window.customPrompt("Từ chối thành viên", `Gửi phản hồi cho người mời`, "Nhập lý do tại đây...");
        if (reason === null) return;
        await updateDoc(doc(db, "groups", currentGroupId), { pendingInvites: invites });
        sendNotification(inviterPhone, "Đề xuất bị từ chối", `Người bạn mời (${phone}) bị từ chối. Lý do: ${reason}`, currentGroupId);
    }
};

window.reviewTx = async (txId, isApprove) => {
    const txRef = doc(db, "groups", currentGroupId, "transactions", txId); const txData = (await getDoc(txRef)).data();
    if (isApprove) {
        await runTransaction(db, async (t) => {
            const change = txData.type === "expense" ? -txData.amount : txData.amount;
            const target = txData.campaignId ? doc(db, "groups", currentGroupId, "campaigns", txData.campaignId) : doc(db, "groups", currentGroupId);
            t.update(target, { balance: increment(change) }); t.update(txRef, { status: "approved" });
        });
        sendNotification(txData.creatorPhone, "Đề xuất được duyệt", `Khoản ${txData.description} đã được duyệt!`, currentGroupId);
    } else {
        const reason = await window.customPrompt("Từ chối giao dịch", `Gửi phản hồi cho ${txData.createdByName}`, "Nhập lý do tại đây...");
        if (reason === null) return;
        await deleteDoc(txRef);
        sendNotification(txData.creatorPhone, "Đề xuất bị từ chối", `Khoản ${txData.description} (${txData.amount.toLocaleString()}đ) bị từ chối. Lý do: ${reason}`, currentGroupId);
    }
};

document.getElementById('btn-open-filter').addEventListener('click', () => { const memberSelect = document.getElementById('filter-member'); memberSelect.innerHTML = '<option value="all">Mọi thành viên</option>'; cachedGroupMembersArray.forEach(u => { memberSelect.innerHTML += `<option value="${u.phone}">${u.name} (${u.phone})</option>`; }); document.getElementById('filter-type').value = 'all'; document.getElementById('filter-member').value = 'all'; document.getElementById('filter-modal').classList.remove('hidden'); applyFilter(); });
document.getElementById('btn-close-filter').addEventListener('click', () => { document.getElementById('filter-modal').classList.add('hidden'); }); document.getElementById('filter-type').addEventListener('change', applyFilter); document.getElementById('filter-member').addEventListener('change', applyFilter);
function applyFilter() { const type = document.getElementById('filter-type').value; const memberPhone = document.getElementById('filter-member').value; let filtered = cachedTransactions.filter(tx => tx.status === 'approved'); if (type !== 'all') filtered = filtered.filter(tx => tx.type === type); if (memberPhone !== 'all') filtered = filtered.filter(tx => tx.creatorPhone === memberPhone); const resultsList = document.getElementById('filter-results-list'); resultsList.innerHTML = ''; let totalAmount = 0; if (filtered.length === 0) { resultsList.innerHTML = '<p style="text-align:center; color:gray; padding:10px;">Không có giao dịch phù hợp.</p>'; } else { filtered.forEach(tx => { const symbol = tx.type === 'income' ? '+' : '-'; const color = tx.type === 'income' ? '#10B981' : '#EF4444'; if (type === 'all') totalAmount += (tx.type === 'income' ? tx.amount : -tx.amount); else totalAmount += tx.amount; resultsList.innerHTML += `<li class="transaction-item"><div class="tx-top"><div class="tx-info"><span class="tx-desc">${tx.description}</span><span style="font-size: 12px; color: gray;">Bởi: ${tx.createdByName}</span></div><strong style="color: ${color};">${symbol}${tx.amount.toLocaleString()} ₫</strong></div></li>`; }); } const totalEl = document.getElementById('filter-total-amount'); totalEl.innerText = Math.abs(totalAmount).toLocaleString(); if (type === 'all') totalEl.style.color = totalAmount >= 0 ? '#10B981' : '#EF4444'; else if (type === 'income') totalEl.style.color = '#10B981'; else totalEl.style.color = '#EF4444'; }

window.toggleDeputy = async (phone, isCurrentlyDeputy) => { if (userRole !== 'owner') return; try { await updateDoc(doc(db, "groups", currentGroupId), { deputies: isCurrentlyDeputy ? arrayRemove(phone) : arrayUnion(phone) }); sendNotification(phone, "Quyền hạn", `Bạn vừa được ${isCurrentlyDeputy?'giáng cấp':'lên Phó nhóm'} trong nhóm ${currentGroupData.name}`, currentGroupId); } catch (e) { alert("Lỗi: "+e.message); } };
window.removeMember = async (phone) => { if (userRole !== 'owner') return; if (!confirm(`Xóa ${phone}?`)) return; try { await updateDoc(doc(db, "groups", currentGroupId), { members: arrayRemove(phone), deputies: arrayRemove(phone) }); sendNotification(phone, "Bị xóa khỏi nhóm", `Bạn bị xóa khỏi ${currentGroupData.name}`, null); } catch (e) { alert("Lỗi: "+e.message); } };
document.getElementById('btn-income').addEventListener('click', () => { txType = "income"; txModal.classList.remove('hidden'); }); document.getElementById('btn-expense').addEventListener('click', () => { txType = "expense"; txModal.classList.remove('hidden'); }); document.getElementById('btn-cancel-tx').addEventListener('click', () => txModal.classList.add('hidden'));
document.getElementById('btn-submit-tx').addEventListener('click', async () => { let amount = parseInt(document.getElementById('tx-amount').value); const desc = document.getElementById('tx-desc').value; const campaignId = document.getElementById('tx-campaign-select').value; if (!amount || amount <= 0 || !desc) return alert("Nhập đầy đủ!"); const changeAmount = txType === "expense" ? -amount : amount; const txStatus = isManager ? "approved" : "pending"; try { if (isManager) { const targetRef = campaignId ? doc(db, "groups", currentGroupId, "campaigns", campaignId) : doc(db, "groups", currentGroupId); await updateDoc(targetRef, { balance: increment(changeAmount) }); } await addDoc(collection(db, "groups", currentGroupId, "transactions"), { type: txType, amount: amount, description: desc, campaignId: campaignId || null, creatorPhone: currentUser.phone, createdByName: currentUser.name, status: txStatus, reactions: {}, comments: [], createdAt: serverTimestamp() }); txModal.classList.add('hidden'); document.getElementById('tx-amount').value = ''; document.getElementById('tx-desc').value = ''; if (!isManager) { alert("Đã gửi đề xuất duyệt!"); const managers = [currentGroupData.ownerId, ...(currentGroupData.deputies || [])]; managers.forEach(mgr => sendNotification(mgr, "Đề xuất giao dịch", `${currentUser.name} đề xuất ${txType==='income'?'THU':'CHI'} ${amount.toLocaleString()}đ`, currentGroupId)); } } catch (e) { alert("Lỗi: " + e.message); } });
document.getElementById('btn-create-campaign').addEventListener('click', async () => { const name = await window.customPrompt("Tạo Quỹ Sự Kiện", "Ví dụ: Phượt cuối năm", "Tên sự kiện mới..."); if (!name) return; try { await addDoc(collection(db, "groups", currentGroupId, "campaigns"), { name: name, status: "active", balance: 0, createdAt: serverTimestamp() }); } catch (e) { alert("Lỗi: " + e.message); } });
window.closeCampaign = async (campaignId, campaignName) => { if (!confirm(`Tất toán "${campaignName}"?`)) return; const groupRef = doc(db, "groups", currentGroupId); const campaignRef = doc(db, "groups", currentGroupId, "campaigns", campaignId); try { await runTransaction(db, async (t) => { const gDoc = await t.get(groupRef); const cDoc = await t.get(campaignRef); const cBal = cDoc.data().balance; t.update(groupRef, { balance: (gDoc.data().balance || 0) + cBal }); t.update(campaignRef, { balance: 0, status: "closed" }); t.set(doc(collection(db, "groups", currentGroupId, "transactions")), { type: cBal >= 0 ? "income" : "expense", amount: Math.abs(cBal), description: `Tất toán: ${campaignName}`, campaignId: null, creatorPhone: "system", createdByName: "HỆ THỐNG", status: "approved", createdAt: serverTimestamp() }); }); } catch (e) { alert("Lỗi: " + e); } };
