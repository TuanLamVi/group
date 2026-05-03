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

const authScreen = document.getElementById('auth-screen'); const dashboardScreen = document.getElementById('dashboard-screen'); const mainScreen = document.getElementById('main-screen');
const txModal = document.getElementById('tx-modal'); const settingsModal = document.getElementById('settings-modal'); const notiModal = document.getElementById('noti-modal');
const viewProfileModal = document.getElementById('view-profile-modal');

let currentUser = null; let currentGroupId = null; let currentGroupData = null; let txType = ""; let userRole = 'member'; let isManager = false;   
let unsubUser = null; let unsubGroup = null; let unsubCampaigns = null; let unsubTx = null; let unsubNoti = null;

let cachedTransactions = []; 
let approvedTransactions = []; // Chứa danh sách đã duyệt để phân trang
let currentTxPage = 1;
const TX_PER_PAGE = 5; // Số giao dịch mỗi trang

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
window.markNotiRead = async (notiId, groupId) => { try { await updateDoc(doc(db, "users", currentUser.phone, "notifications", notiId), { read: true }); notiModal.classList.add('hidden'); if (groupId && currentGroupId !== groupId) window.enterGroup(groupId); } catch (e) { console.error(e); } };

window.customPrompt = function(title, placeholder) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-prompt-modal'); const inputField = document.getElementById('prompt-input');
        document.getElementById('prompt-title').innerText = title; inputField.placeholder = placeholder; inputField.value = ''; modal.classList.remove('hidden'); inputField.focus();
        const btnSubmit = document.getElementById('btn-prompt-submit'); const btnCancel = document.getElementById('btn-prompt-cancel');
        const cleanup = () => { modal.classList.add('hidden'); btnSubmit.onclick = null; btnCancel.onclick = null; }
        btnSubmit.onclick = () => { const val = inputField.value.trim(); cleanup(); resolve(val); };
        btnCancel.onclick = () => { cleanup(); resolve(null); };
    });
}

// ================= 1. XÁC THỰC =================
document.getElementById('link-to-register').addEventListener('click', () => { document.getElementById('login-form').classList.add('hidden'); document.getElementById('register-form').classList.remove('hidden'); document.getElementById('auth-title').innerText = "Đăng ký tài khoản"; });
document.getElementById('link-to-login').addEventListener('click', () => { document.getElementById('register-form').classList.add('hidden'); document.getElementById('login-form').classList.remove('hidden'); document.getElementById('auth-title').innerText = "Đăng nhập"; });
document.getElementById('btn-register-submit').addEventListener('click', async () => { const name = document.getElementById('reg-name').value.trim(); const phone = document.getElementById('reg-phone').value.trim(); const address = document.getElementById('reg-address').value.trim(); const password = document.getElementById('reg-password').value.trim(); if (!name || phone.length < 9 || password.length < 8) return alert("Nhập đầy đủ thông tin (Mật khẩu > 8 ký tự)!"); try { const userRef = doc(db, "users", phone); if ((await getDoc(userRef)).exists()) return alert("SĐT đã được đăng ký!"); await setDoc(userRef, { name, phone, address, password, avatar: "", createdAt: serverTimestamp() }); alert("Đăng ký thành công!"); document.getElementById('link-to-login').click(); } catch (e) { alert("Lỗi: " + e.message); } });
document.getElementById('btn-login-submit').addEventListener('click', async () => { const phone = document.getElementById('login-phone').value.trim(); const password = document.getElementById('login-password').value.trim(); if (!phone || !password) return alert("Nhập SĐT và mật khẩu!"); try { const snap = await getDoc(doc(db, "users", phone)); if (!snap.exists() || snap.data().password !== password) return alert("Sai SĐT hoặc mật khẩu!"); loginSuccess(phone); } catch (e) { alert("Lỗi: " + e.message); } });

window.addEventListener('DOMContentLoaded', () => { const savedPhone = localStorage.getItem('userPhone'); if (savedPhone) loginSuccess(savedPhone); });

function loginSuccess(phone) {
    localStorage.setItem('userPhone', phone); authScreen.classList.add('hidden'); dashboardScreen.classList.remove('hidden');
    if(unsubUser) unsubUser();
    unsubUser = onSnapshot(doc(db, "users", phone), (docSnap) => {
        if(docSnap.exists()) {
            currentUser = docSnap.data(); userCache[currentUser.phone] = currentUser;
            document.getElementById('user-avatar').src = currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=random&color=fff`;
            document.getElementById('user-name-display').innerText = currentUser.name; document.getElementById('user-phone-display').innerText = currentUser.phone;
        }
    });
    if(unsubNoti) unsubNoti();
    unsubNoti = onSnapshot(query(collection(db, "users", phone, "notifications"), orderBy("createdAt", "desc")), (snapshot) => {
        const notiList = document.getElementById('noti-list'); const notiBadge = document.getElementById('noti-badge');
        notiList.innerHTML = ''; let unreadCount = 0;
        if (snapshot.empty) { notiList.innerHTML = '<p style="text-align:center; color:gray; padding: 20px;">Chưa có thông báo.</p>'; } 
        else {
            snapshot.forEach(docSnap => {
                const data = docSnap.data(); if (!data.read) unreadCount++;
                const unreadClass = data.read ? '' : 'unread'; const timeString = data.createdAt ? data.createdAt.toDate().toLocaleString('vi-VN') : 'Vừa xong';
                notiList.innerHTML += `<div class="noti-item ${unreadClass}" onclick="window.markNotiRead('${docSnap.id}', '${data.groupId || ''}')"><div class="noti-title">${data.title}</div><div class="noti-body">${data.body}</div><div class="noti-time">${timeString}</div></div>`;
            });
        }
        if (unreadCount > 0) { notiBadge.innerText = unreadCount > 9 ? '9+' : unreadCount; notiBadge.classList.remove('hidden'); } else { notiBadge.classList.add('hidden'); }
    });
    loadUserGroups(phone); 
}

document.getElementById('btn-logout').addEventListener('click', () => { if (!confirm("Đăng xuất?")) return; localStorage.removeItem('userPhone'); currentUser = null; currentGroupId = null; if(unsubUser) unsubUser(); if(unsubGroup) unsubGroup(); if(unsubCampaigns) unsubCampaigns(); if(unsubTx) unsubTx(); if(unsubNoti) unsubNoti(); document.getElementById('login-phone').value = ''; document.getElementById('login-password').value = ''; dashboardScreen.classList.add('hidden'); mainScreen.classList.add('hidden'); authScreen.classList.remove('hidden'); });

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

document.getElementById('btn-create-group').addEventListener('click', async () => { const groupName = await window.customPrompt("Tạo Nhóm", "Tên nhóm..."); if (!groupName) return; try { await addDoc(collection(db, "groups"), { name: groupName, ownerId: currentUser.phone, deputies: [], members: [currentUser.phone], pendingInvites: [], balance: 0, createdAt: serverTimestamp() }); } catch (e) { alert("Lỗi: " + e.message); } });
window.enterGroup = (groupId) => { currentGroupId = groupId; dashboardScreen.classList.add('hidden'); mainScreen.classList.remove('hidden'); initRealtimeListeners(); };
document.getElementById('btn-back-dashboard').addEventListener('click', () => { if(unsubGroup) unsubGroup(); if(unsubCampaigns) unsubCampaigns(); if(unsubTx) unsubTx(); currentGroupId = null; currentGroupData = null; mainScreen.classList.add('hidden'); dashboardScreen.classList.remove('hidden'); });
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

// ================= 3. RENDER DANH BẠ =================
let currentlyOpenMember = null; let cachedGroupMembersArray = []; let searchMemberQuery = ""; let currentMemberPage = 1; const MEMBERS_PER_PAGE = 10;
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

// ================= 4. GIAO DỊCH, PHÂN TRANG & BÌNH LUẬN =================
const FB_EMOJIS = { '👍': { text: 'Thích', color: '#056BF0' }, '❤️': { text: 'Yêu thích', color: '#F33E58' }, '🥰': { text: 'Thương', color: '#F7B125' }, '😂': { text: 'Haha', color: '#F7B125' }, '😮': { text: 'Wow', color: '#F7B125' }, '😢': { text: 'Buồn', color: '#F7B125' }, '😡': { text: 'Phẫn nộ', color: '#E9710F' } };

window.toggleTxComments = (txId) => { const el = document.getElementById(`comments-${txId}`); if(el) el.classList.toggle('hidden'); };
window.reactToTx = async (txId, emoji) => { try { const txRef = doc(db, "groups", currentGroupId, "transactions", txId); const txDoc = await getDoc(txRef); if(!txDoc.exists()) return; const reactions = txDoc.data().reactions || {}; if (reactions[currentUser.phone] === emoji) delete reactions[currentUser.phone]; else reactions[currentUser.phone] = emoji; await updateDoc(txRef, { reactions }); } catch(e) { console.error(e); } };
window.submitComment = async (txId) => { const input = document.getElementById(`input-cmt-${txId}`); const text = input.value.trim(); if(!text) return; try { const txRef = doc(db, "groups", currentGroupId, "transactions", txId); await updateDoc(txRef, { comments: arrayUnion({ phone: currentUser.phone, name: currentUser.name, text: text, time: Date.now() }) }); input.value = ''; } catch(e) { console.error(e); } };

function renderTransaction(data, docId, isPending) {
    const symbol = data.type === 'income' ? '+' : '-'; const color = data.type === 'income' ? '#10B981' : '#EF4444'; 
    const reactions = data.reactions || {}; const comments = data.comments || [];
    
    let totalReacts = Object.keys(reactions).length; let uniqueEmojis = [...new Set(Object.values(reactions))].slice(0, 3).join('');
    let statsHtml = '';
    if (totalReacts > 0 || comments.length > 0) { statsHtml = `<div class="tx-stats"><div class="tx-stats-left">${totalReacts > 0 ? `${uniqueEmojis} ${totalReacts}` : ''}</div>${comments.length > 0 ? `<div class="tx-stats-right" onclick="window.toggleTxComments('${docId}')">${comments.length} bình luận</div>` : '<div></div>'}</div>`; }

    const myReaction = reactions[currentUser.phone]; let btnText = '👍 Thích'; let btnColor = '#65676B';
    if (myReaction && FB_EMOJIS[myReaction]) { btnText = `${myReaction} ${FB_EMOJIS[myReaction].text}`; btnColor = FB_EMOJIS[myReaction].color; }

    let popoverHtml = `<div class="reaction-popover">`; Object.keys(FB_EMOJIS).forEach(emj => { popoverHtml += `<span class="react-icon" onclick="event.stopPropagation(); window.reactToTx('${docId}', '${emj}')">${emj}</span>`; }); popoverHtml += `</div>`;
    let commentsHtml = comments.map(c => `<div class="comment-item"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=random&color=fff" class="comment-avatar"><div class="comment-bubble"><b>${c.name}</b><span>${c.text}</span></div></div>`).join('');

    if (isPending) {
        return `<li class="transaction-item pending-item"><div class="tx-top"><div><strong>${data.createdByName}</strong> đề xuất ${data.type === 'income' ? 'THU' : 'CHI'}<br><span>${data.description}</span>: <b style="color:${color}">${symbol}${data.amount.toLocaleString()}đ</b></div>${isManager ? `<div class="pending-actions"><button class="btn-approve btn-3d" onclick="window.reviewTx('${docId}', true)">Duyệt</button><button class="btn-reject btn-3d" onclick="window.reviewTx('${docId}', false)">Hủy</button></div>` : '<span style="font-size: 12px; color: gray;">Chờ...</span>'}</div></li>`;
    } else {
        return `
        <li class="transaction-item">
            <div class="tx-top"><div class="tx-info"><span class="tx-desc">${data.description}</span><span style="font-size: 12px; color: gray;">Bởi: ${data.createdByName}</span></div><strong style="color: ${color}; font-size: 18px;">${symbol}${data.amount.toLocaleString()} ₫</strong></div>
            <div class="tx-interactions">${statsHtml}<div class="tx-actions"><div class="like-wrapper"><button class="action-btn-fb" style="color: ${btnColor};" onclick="window.reactToTx('${docId}', '${myReaction ? myReaction : '👍'}')">${btnText}</button>${popoverHtml}</div><button class="action-btn-fb" onclick="window.toggleTxComments('${docId}')">💬 Bình luận</button></div></div>
            <div id="comments-${docId}" class="tx-comments-section hidden">${commentsHtml}<div class="comment-input-area"><input type="text" id="input-cmt-${docId}" placeholder="Viết bình luận..." onkeypress="if(event.key==='Enter') window.submitComment('${docId}')"><button onclick="window.submitComment('${docId}')">Gửi</button></div></div>
        </li>`;
    }
}

// Logic phân trang lịch sử quỹ
function renderPaginatedTransactions() {
    const txList = document.getElementById('transaction-list');
    const totalPages = Math.ceil(approvedTransactions.length / TX_PER_PAGE) || 1;
    if (currentTxPage > totalPages) currentTxPage = totalPages;
    document.getElementById('tx-page-info').innerText = `${currentTxPage}/${totalPages}`;
    document.getElementById('btn-tx-prev-page').disabled = (currentTxPage === 1);
    document.getElementById('btn-tx-next-page').disabled = (currentTxPage === totalPages);

    const startIdx = (currentTxPage - 1) * TX_PER_PAGE;
    const paginated = approvedTransactions.slice(startIdx, startIdx + TX_PER_PAGE);

    txList.innerHTML = '';
    if (paginated.length === 0) { txList.innerHTML = '<p style="text-align:center; color:gray; padding:10px;">Chưa có giao dịch.</p>'; return; }
    paginated.forEach(tx => { txList.innerHTML += renderTransaction(tx, tx.id, false); });
}

document.getElementById('btn-tx-prev-page').addEventListener('click', () => { if (currentTxPage > 1) { currentTxPage--; renderPaginatedTransactions(); } });
document.getElementById('btn-tx-next-page').addEventListener('click', () => { currentTxPage++; renderPaginatedTransactions(); });

function initRealtimeListeners() {
    unsubGroup = onSnapshot(doc(db, "groups", currentGroupId), async (docSnap) => {
        if (!docSnap.exists()) return; currentGroupData = docSnap.data(); 
        if (!currentGroupData.members.includes(currentUser.phone)) { alert("Bạn đã bị xóa khỏi nhóm!"); document.getElementById('btn-back-dashboard').click(); return; }

        document.getElementById('group-name').innerText = currentGroupData.name; document.getElementById('balance').innerText = (currentGroupData.balance || 0).toLocaleString();
        if (currentGroupData.ownerId === currentUser.phone) { userRole = 'owner'; document.getElementById('user-role').innerHTML = '<span class="role-badge role-owner">👑 Trưởng nhóm</span>'; } else if (currentGroupData.deputies && currentGroupData.deputies.includes(currentUser.phone)) { userRole = 'deputy'; document.getElementById('user-role').innerHTML = '<span class="role-badge role-deputy">⭐ Phó nhóm</span>'; } else { userRole = 'member'; document.getElementById('user-role').innerHTML = '<span class="role-badge role-member">👥 Thành viên</span>'; }
        isManager = (userRole === 'owner' || userRole === 'deputy');
        document.getElementById('btn-create-campaign').classList.toggle('hidden', !isManager);
        
        const membersDataRaw = await getUsersData(currentGroupData.members);
        cachedGroupMembersArray = currentGroupData.members.map(phone => { return { phone: phone, ...membersDataRaw[phone] }; });
        renderMemberList();

        const pendingMembersDiv = document.getElementById('pending-members-list'); const pendingSection = document.getElementById('pending-members-section');
        const pendingInvites = currentGroupData.pendingInvites || [];
        if (pendingInvites.length > 0) {
            pendingSection.classList.remove('hidden'); pendingMembersDiv.innerHTML = '';
            for (const invite of pendingInvites) {
                const pPhone = invite.phone; const inviterPhone = invite.proposedBy;
                const puInfoArray = await getUsersData([pPhone, inviterPhone]); const puInfo = puInfoArray[pPhone]; const inviterInfo = puInfoArray[inviterPhone];
                const defaultAvt = `https://ui-avatars.com/api/?name=${encodeURIComponent(puInfo.name)}&background=random&color=fff`;
                let pAction = isManager ? `<button class="btn-sm btn-secondary btn-3d" onclick="window.viewUserProfile('${pPhone}', '${inviterInfo.name}')" style="padding:4px 8px;">👀 Xem</button><button class="btn-sm btn-success btn-3d" onclick="window.approveMember('${pPhone}', '${inviterPhone}', true)" style="padding:4px 8px;">Duyệt</button> <button class="btn-sm btn-danger btn-3d" onclick="window.approveMember('${pPhone}', '${inviterPhone}', false)" style="padding:4px 8px;">Từ chối</button>` : `<span style="font-size:12px; color:gray;">Chờ duyệt...</span>`;
                pendingMembersDiv.innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; padding: 12px 0; border-bottom: 1px solid #eee;"><div style="display:flex; align-items:center; gap: 10px;"><img src="${puInfo.avatar || defaultAvt}" style="width:36px; height:36px; border-radius:50%;"><div><div style="font-size:15px; font-weight:bold;">${puInfo.name}</div><div style="font-size:12px; color:gray;">Bởi: ${inviterInfo.name}</div></div></div><div style="display:flex; gap:5px;">${pAction}</div></div>`;
            }
        } else { pendingSection.classList.add('hidden'); }
    });

    unsubCampaigns = onSnapshot(collection(db, "groups", currentGroupId, "campaigns"), (snapshot) => { const campaignList = document.getElementById('campaign-list'); const txSelect = document.getElementById('tx-campaign-select'); campaignList.innerHTML = ''; txSelect.innerHTML = '<option value="">-- Quỹ chung --</option>'; snapshot.forEach((docSnap) => { const data = docSnap.data(); if (data.status === 'active') { campaignList.innerHTML += `<div class="campaign-card"><div class="campaign-header"><span>🏕️ ${data.name}</span><span class="campaign-balance">${data.balance.toLocaleString()} ₫</span></div>${isManager ? `<button class="btn-close-campaign" onclick="window.closeCampaign('${docSnap.id}', '${data.name}')">Tất toán</button>` : ''}</div>`; txSelect.innerHTML += `<option value="${docSnap.id}">${data.name}</option>`; } }); });
    
    const txQuery = query(collection(db, "groups", currentGroupId, "transactions"), orderBy("createdAt", "desc"));
    unsubTx = onSnapshot(txQuery, (snapshot) => { 
        const pendingList = document.getElementById('pending-list'); const pendingSection = document.getElementById('pending-section'); 
        pendingList.innerHTML = ''; let hasPending = false; cachedTransactions = []; approvedTransactions = [];

        snapshot.forEach((docSnap) => { 
            const data = docSnap.data(); cachedTransactions.push({ id: docSnap.id, ...data });
            if (data.status === 'pending') { hasPending = true; pendingList.innerHTML += renderTransaction(data, docSnap.id, true); } 
            else if (data.status === 'approved') { approvedTransactions.push({ id: docSnap.id, ...data }); } 
        }); 
        pendingSection.classList.toggle('hidden', !hasPending); 
        
        // Gọi hàm phân trang vẽ ra màn hình
        renderPaginatedTransactions();

        if (!document.getElementById('filter-modal').classList.contains('hidden')) { applyFilter(); }
    });
}

// ================= 5. KIỂM DUYỆT & THAO TÁC CƠ SỞ DỮ LIỆU CÒN LẠI =================
window.viewUserProfile = async (phone, inviterName) => { const dataObj = await getUsersData([phone]); const user = dataObj[phone]; document.getElementById('view-profile-avatar').src = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random&color=fff`; document.getElementById('view-profile-name').innerText = user.name; document.getElementById('view-profile-phone').innerText = user.phone; document.getElementById('view-profile-address').innerText = user.address || 'Chưa cập nhật'; document.getElementById('view-profile-inviter').innerText = inviterName; viewProfileModal.classList.remove('hidden'); };
document.getElementById('btn-close-view-profile').addEventListener('click', () => viewProfileModal.classList.add('hidden'));

document.getElementById('btn-add-member').addEventListener('click', async () => { const newPhone = await window.customPrompt("Mời Thành Viên", "Nhập SĐT cần mời..."); if (!newPhone || newPhone.length < 9) return; const userSnap = await getDoc(doc(db, "users", newPhone)); if(!userSnap.exists()) return alert("SĐT này chưa đăng ký app!"); try { const groupRef = doc(db, "groups", currentGroupId); const groupData = (await getDoc(groupRef)).data(); const currentInvites = groupData.pendingInvites || []; const newInvites = currentInvites.filter(inv => inv.phone !== newPhone); if (isManager) { await updateDoc(groupRef, { members: arrayUnion(newPhone), pendingInvites: newInvites }); sendNotification(newPhone, "Bạn đã được thêm vào nhóm", `Quản trị viên vừa thêm bạn vào nhóm ${groupData.name}`, currentGroupId); } else { newInvites.push({ phone: newPhone, proposedBy: currentUser.phone }); await updateDoc(groupRef, { pendingInvites: newInvites }); alert("Đã gửi đề xuất thêm thành viên!"); const managers = [groupData.ownerId, ...(groupData.deputies || [])]; managers.forEach(mgr => sendNotification(mgr, "Đề xuất thành viên", `${currentUser.name} mời SĐT ${newPhone} vào nhóm.`, currentGroupId)); } } catch(e) { alert("Lỗi: " + e.message); } });
window.approveMember = async (phone, inviterPhone, isApprove) => { try { const groupRef = doc(db, "groups", currentGroupId); const groupData = (await getDoc(groupRef)).data(); const currentInvites = groupData.pendingInvites || []; const newInvites = currentInvites.filter(inv => inv.phone !== phone); if (isApprove) { await updateDoc(groupRef, { members: arrayUnion(phone), pendingInvites: newInvites }); sendNotification(phone, "Được duyệt vào nhóm", `Bạn đã được tham gia nhóm ${groupData.name}`, currentGroupId); sendNotification(inviterPhone, "Đề xuất thành công", `Trưởng nhóm đã duyệt (${phone}) vào nhóm.`, currentGroupId); } else { const reason = await window.customPrompt("Từ chối thành viên", "Nhập lý do..."); if (reason === null) return; await updateDoc(groupRef, { pendingInvites: newInvites }); sendNotification(inviterPhone, "Đề xuất bị từ chối", `Mời ${phone} bị từ chối. Lý do: ${reason || 'Không rõ'}`, currentGroupId); } } catch (e) { alert("Lỗi: " + e.message); } };

document.getElementById('btn-open-filter').addEventListener('click', () => { const memberSelect = document.getElementById('filter-member'); memberSelect.innerHTML = '<option value="all">Mọi thành viên</option>'; cachedGroupMembersArray.forEach(u => { memberSelect.innerHTML += `<option value="${u.phone}">${u.name} (${u.phone})</option>`; }); document.getElementById('filter-type').value = 'all'; document.getElementById('filter-member').value = 'all'; document.getElementById('filter-modal').classList.remove('hidden'); applyFilter(); });
document.getElementById('btn-close-filter').addEventListener('click', () => { document.getElementById('filter-modal').classList.add('hidden'); }); document.getElementById('filter-type').addEventListener('change', applyFilter); document.getElementById('filter-member').addEventListener('change', applyFilter);
function applyFilter() { const type = document.getElementById('filter-type').value; const memberPhone = document.getElementById('filter-member').value; let filtered = cachedTransactions.filter(tx => tx.status === 'approved'); if (type !== 'all') filtered = filtered.filter(tx => tx.type === type); if (memberPhone !== 'all') filtered = filtered.filter(tx => tx.creatorPhone === memberPhone); const resultsList = document.getElementById('filter-results-list'); resultsList.innerHTML = ''; let totalAmount = 0; if (filtered.length === 0) { resultsList.innerHTML = '<p style="text-align:center; color:gray; padding:10px;">Không có giao dịch phù hợp.</p>'; } else { filtered.forEach(tx => { const symbol = tx.type === 'income' ? '+' : '-'; const color = tx.type === 'income' ? '#10B981' : '#EF4444'; if (type === 'all') totalAmount += (tx.type === 'income' ? tx.amount : -tx.amount); else totalAmount += tx.amount; resultsList.innerHTML += `<li class="transaction-item"><div class="tx-top"><div class="tx-info"><span class="tx-desc">${tx.description}</span><span style="font-size: 12px; color: gray;">Bởi: ${tx.createdByName}</span></div><strong style="color: ${color};">${symbol}${tx.amount.toLocaleString()} ₫</strong></div></li>`; }); } const totalEl = document.getElementById('filter-total-amount'); totalEl.innerText = Math.abs(totalAmount).toLocaleString(); if (type === 'all') totalEl.style.color = totalAmount >= 0 ? '#10B981' : '#EF4444'; else if (type === 'income') totalEl.style.color = '#10B981'; else totalEl.style.color = '#EF4444'; }

window.toggleDeputy = async (phone, isCurrentlyDeputy) => { if (userRole !== 'owner') return; try { await updateDoc(doc(db, "groups", currentGroupId), { deputies: isCurrentlyDeputy ? arrayRemove(phone) : arrayUnion(phone) }); sendNotification(phone, "Quyền hạn", `Bạn vừa được ${isCurrentlyDeputy?'giáng cấp':'lên Phó nhóm'} trong nhóm ${currentGroupData.name}`, currentGroupId); } catch (e) { alert("Lỗi: "+e.message); } };
window.removeMember = async (phone) => { if (userRole !== 'owner') return; if (!confirm(`Xóa ${phone}?`)) return; try { await updateDoc(doc(db, "groups", currentGroupId), { members: arrayRemove(phone), deputies: arrayRemove(phone) }); sendNotification(phone, "Bị xóa khỏi nhóm", `Bạn bị xóa khỏi ${currentGroupData.name}`, null); } catch (e) { alert("Lỗi: "+e.message); } };
document.getElementById('btn-income').addEventListener('click', () => { txType = "income"; txModal.classList.remove('hidden'); }); document.getElementById('btn-expense').addEventListener('click', () => { txType = "expense"; txModal.classList.remove('hidden'); }); document.getElementById('btn-cancel-tx').addEventListener('click', () => txModal.classList.add('hidden'));
document.getElementById('btn-submit-tx').addEventListener('click', async () => { let amount = parseInt(document.getElementById('tx-amount').value); const desc = document.getElementById('tx-desc').value; const campaignId = document.getElementById('tx-campaign-select').value; if (!amount || amount <= 0 || !desc) return alert("Nhập đầy đủ!"); const changeAmount = txType === "expense" ? -amount : amount; const txStatus = isManager ? "approved" : "pending"; try { if (isManager) { const targetRef = campaignId ? doc(db, "groups", currentGroupId, "campaigns", campaignId) : doc(db, "groups", currentGroupId); await updateDoc(targetRef, { balance: increment(changeAmount) }); } await addDoc(collection(db, "groups", currentGroupId, "transactions"), { type: txType, amount: amount, description: desc, campaignId: campaignId || null, creatorPhone: currentUser.phone, createdByName: currentUser.name, status: txStatus, reactions: {}, comments: [], createdAt: serverTimestamp() }); txModal.classList.add('hidden'); document.getElementById('tx-amount').value = ''; document.getElementById('tx-desc').value = ''; if (!isManager) { alert("Đã gửi đề xuất duyệt!"); const managers = [currentGroupData.ownerId, ...(currentGroupData.deputies || [])]; managers.forEach(mgr => sendNotification(mgr, "Đề xuất giao dịch", `${currentUser.name} đề xuất ${txType==='income'?'THU':'CHI'} ${amount.toLocaleString()}đ`, currentGroupId)); } } catch (e) { alert("Lỗi: " + e.message); } });
window.reviewTx = async (txId, isApprove) => { const txRef = doc(db, "groups", currentGroupId, "transactions", txId); try { const txSnap = await getDoc(txRef); if (!txSnap.exists()) return; const txData = txSnap.data(); if (!isApprove) { if(confirm("Hủy đề xuất này?")) { await deleteDoc(txRef); sendNotification(txData.creatorPhone, "Đề xuất bị từ chối", `Đề xuất ${txData.type==='income'?'THU':'CHI'} ${txData.amount.toLocaleString()}đ bị từ chối.`, currentGroupId); } return; } await runTransaction(db, async (t) => { const txDoc = await t.get(txRef); if (!txDoc.exists() || txDoc.data().status !== 'pending') throw "Lỗi!"; const data = txDoc.data(); const changeAmount = data.type === "expense" ? -data.amount : data.amount; const targetRef = data.campaignId ? doc(db, "groups", currentGroupId, "campaigns", data.campaignId) : doc(db, "groups", currentGroupId); t.update(targetRef, { balance: increment(changeAmount) }); t.update(txRef, { status: "approved" }); }); sendNotification(txData.creatorPhone, "Đề xuất được duyệt", `Đề xuất ${txData.type==='income'?'THU':'CHI'} ${txData.amount.toLocaleString()}đ đã được duyệt!`, currentGroupId); } catch (e) { alert("Lỗi: " + e); } };
document.getElementById('btn-create-campaign').addEventListener('click', async () => { const name = await window.customPrompt("Tạo Quỹ Sự Kiện", "Tên sự kiện mới..."); if (!name) return; try { await addDoc(collection(db, "groups", currentGroupId, "campaigns"), { name: name, status: "active", balance: 0, createdAt: serverTimestamp() }); } catch (e) { alert("Lỗi: " + e.message); } });
window.closeCampaign = async (campaignId, campaignName) => { if (!confirm(`Tất toán "${campaignName}"?`)) return; const groupRef = doc(db, "groups", currentGroupId); const campaignRef = doc(db, "groups", currentGroupId, "campaigns", campaignId); try { await runTransaction(db, async (t) => { const gDoc = await t.get(groupRef); const cDoc = await t.get(campaignRef); const cBal = cDoc.data().balance; t.update(groupRef, { balance: (gDoc.data().balance || 0) + cBal }); t.update(campaignRef, { balance: 0, status: "closed" }); t.set(doc(collection(db, "groups", currentGroupId, "transactions")), { type: cBal >= 0 ? "income" : "expense", amount: Math.abs(cBal), description: `Tất toán: ${campaignName}`, campaignId: null, creatorPhone: "system", createdByName: "HỆ THỐNG", status: "approved", createdAt: serverTimestamp() }); }); } catch (e) { alert("Lỗi: " + e); } };
