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
const authScreen = document.getElementById('auth-screen'); const dashboardScreen = document.getElementById('dashboard-screen'); const mainScreen = document.getElementById('main-screen');
const txModal = document.getElementById('tx-modal'); const settingsModal = document.getElementById('settings-modal'); const notiModal = document.getElementById('noti-modal');
const viewProfileModal = document.getElementById('view-profile-modal'); const annoModal = document.getElementById('anno-modal'); const viewAnnoModal = document.getElementById('view-anno-modal');

// State Variables
let currentUser = null; let currentGroupId = null; let currentGroupData = null; let userRole = 'member'; let isManager = false; let txType = "";
let unsubUser = null; let unsubGroup = null; let unsubCampaigns = null; let unsubTx = null; let unsubNoti = null; let unsubAnno = null;

// Pagination
let cachedTransactions = []; let approvedTransactions = []; let currentTxPage = 1; const TX_PER_PAGE = 5; 
let pendingMembersArr = []; let pendingTxArr = []; let currentPendingPage = 1; const PENDING_PER_PAGE = 5;
let groupAnnouncements = []; let currentAnnoPage = 1; const ANNO_PER_PAGE = 5; let currentOpenAnnoId = null;
let currentlyOpenMember = null; let cachedGroupMembersArray = []; let searchMemberQuery = ""; let currentMemberPage = 1; const MEMBERS_PER_PAGE = 10;

const FB_EMOJIS = { '👍': { text: 'Thích', color: '#056BF0' }, '❤️': { text: 'Yêu thích', color: '#F33E58' }, '🥰': { text: 'Thương', color: '#F7B125' }, '😂': { text: 'Haha', color: '#F7B125' }, '😮': { text: 'Wow', color: '#F7B125' }, '😢': { text: 'Buồn', color: '#F7B125' }, '😡': { text: 'Phẫn nộ', color: '#E9710F' } };
const userCache = {};

async function getUsersData(phoneArray) {
    const result = {};
    for (const phone of phoneArray) {
        if (userCache[phone]) { result[phone] = userCache[phone]; } 
        else { const snap = await getDoc(doc(db, "users", phone)); if (snap.exists()) { userCache[phone] = snap.data(); result[phone] = snap.data(); } else { result[phone] = { name: "Thành viên ẩn", phone: phone, address: "Không có thông tin" }; } }
    } return result;
}

async function sendNotification(targetPhone, title, body, groupId) {
    if (!targetPhone) return;
    try { await addDoc(collection(db, "users", targetPhone, "notifications"), { title, body, groupId, read: false, createdAt: serverTimestamp() }); } catch (e) { console.error(e); }
}

document.getElementById('btn-notifications').addEventListener('click', () => { notiModal.classList.remove('hidden'); });
document.getElementById('btn-close-noti').addEventListener('click', () => { notiModal.classList.add('hidden'); });
window.markNotiRead = async (notiId, groupId) => { try { await updateDoc(doc(db, "users", currentUser.phone, "notifications", notiId), { read: true }); notiModal.classList.add('hidden'); if (groupId && currentGroupId !== groupId) window.enterGroup(groupId); } catch (e) { console.error(e); } };

window.customPrompt = function(title, description, placeholder) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-prompt-modal'); const area = document.getElementById('prompt-textarea');
        document.getElementById('prompt-title').innerText = title; document.getElementById('prompt-desc').innerText = description;
        area.placeholder = placeholder; area.value = ''; modal.classList.remove('hidden'); area.focus();
        const btnSubmit = document.getElementById('btn-prompt-submit'); const btnCancel = document.getElementById('btn-prompt-cancel');
        const cleanup = () => { modal.classList.add('hidden'); btnSubmit.onclick = null; btnCancel.onclick = null; }
        btnSubmit.onclick = () => { const val = area.value.trim(); cleanup(); resolve(val); };
        btnCancel.onclick = () => { cleanup(); resolve(null); };
    });
}

// ================= XÁC THỰC =================
document.getElementById('link-to-register').addEventListener('click', () => { document.getElementById('login-form').classList.add('hidden'); document.getElementById('register-form').classList.remove('hidden'); document.getElementById('auth-title').innerText = "Đăng ký tài khoản"; });
document.getElementById('link-to-login').addEventListener('click', () => { document.getElementById('register-form').classList.add('hidden'); document.getElementById('login-form').classList.remove('hidden'); document.getElementById('auth-title').innerText = "Đăng nhập"; });
document.getElementById('btn-register-submit').addEventListener('click', async () => { const name = document.getElementById('reg-name').value.trim(); const phone = document.getElementById('reg-phone').value.trim(); const address = document.getElementById('reg-address').value.trim(); const password = document.getElementById('reg-password').value.trim(); if (!name || phone.length < 9 || password.length < 8) return alert("Nhập đủ thông tin!"); try { const userRef = doc(db, "users", phone); if ((await getDoc(userRef)).exists()) return alert("SĐT đã ký!"); await setDoc(userRef, { name, phone, address, password, avatar: "", createdAt: serverTimestamp() }); alert("Đăng ký thành công!"); document.getElementById('link-to-login').click(); } catch (e) { alert("Lỗi: " + e.message); } });
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

// ================= TƯƠNG TÁC FACEBOOK (DÙNG CHUNG) =================
function renderInteractionsHTML(docId, data, isAnno = false) {
    const reactions = data.reactions || {}; const comments = data.comments || [];
    let totalReacts = Object.keys(reactions).length; let uniqueEmojis = [...new Set(Object.values(reactions))].slice(0, 3).join('');
    let statsHtml = '';
    if (totalReacts > 0 || comments.length > 0) { 
        statsHtml = `<div class="tx-stats"><div class="tx-stats-left">${totalReacts > 0 ? `${uniqueEmojis} ${totalReacts}` : ''}</div>${comments.length > 0 ? `<div class="tx-stats-right" onclick="window.toggleComments('${docId}')">${comments.length} bình luận</div>` : '<div></div>'}</div>`; 
    }
    const myReaction = reactions[currentUser.phone]; let btnText = '👍 Thích'; let btnColor = '#65676B';
    if (myReaction && FB_EMOJIS[myReaction]) { btnText = `${myReaction} ${FB_EMOJIS[myReaction].text}`; btnColor = FB_EMOJIS[myReaction].color; }
    
    const reactFunc = isAnno ? 'reactToAnno' : 'reactToTx';
    const cmtFunc = isAnno ? 'submitAnnoComment' : 'submitTxComment';

    let popoverHtml = `<div class="reaction-popover">`; Object.keys(FB_EMOJIS).forEach(emj => { popoverHtml += `<span class="react-icon" onclick="event.stopPropagation(); window.${reactFunc}('${docId}', '${emj}')">${emj}</span>`; }); popoverHtml += `</div>`;
    let commentsHtml = comments.map(c => `<div class="comment-item"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=random&color=fff" class="comment-avatar"><div class="comment-bubble"><b>${c.name}</b><span>${c.text}</span></div></div>`).join('');
    
    return `
    <div class="tx-interactions">${statsHtml}<div class="tx-actions"><div class="like-wrapper"><button class="action-btn-fb" style="color: ${btnColor};" onclick="window.${reactFunc}('${docId}', '${myReaction ? myReaction : '👍'}')">${btnText}</button>${popoverHtml}</div><button class="action-btn-fb" onclick="window.toggleComments('${docId}')">💬 Bình luận</button></div></div>
    <div id="comments-${docId}" class="tx-comments-section hidden">${commentsHtml}<div class="comment-input-area"><input type="text" id="input-cmt-${docId}" placeholder="Viết bình luận..." onkeypress="if(event.key==='Enter') window.${cmtFunc}('${docId}')"><button onclick="window.${cmtFunc}('${docId}')">Gửi</button></div></div>
    `;
}
window.toggleComments = (id) => { const el = document.getElementById(`comments-${id}`); if(el) el.classList.toggle('hidden'); };

// ================= BẢNG TIN (ANNOUNCEMENTS) KIỂU BÀI BÁO =================
function isAnnoRead(id) { const readList = JSON.parse(localStorage.getItem(`readAnnos_${currentUser.phone}`) || '[]'); return readList.includes(id); }
function markAnnoRead(id) { const readList = JSON.parse(localStorage.getItem(`readAnnos_${currentUser.phone}`) || '[]'); if (!readList.includes(id)) { readList.push(id); localStorage.setItem(`readAnnos_${currentUser.phone}`, JSON.stringify(readList)); } }

document.getElementById('btn-open-anno-modal').addEventListener('click', () => { 
    document.getElementById('anno-id').value = ''; document.getElementById('anno-title-input').value = ''; document.getElementById('anno-content-input').value = '';
    document.getElementById('anno-modal-title').innerText = "📢 Đăng Bản Tin";
    annoModal.classList.remove('hidden'); 
});
document.getElementById('btn-cancel-anno').addEventListener('click', () => annoModal.classList.add('hidden'));

document.getElementById('btn-submit-anno').addEventListener('click', async () => {
    const title = document.getElementById('anno-title-input').value.trim(); const content = document.getElementById('anno-content-input').value.trim(); const id = document.getElementById('anno-id').value;
    if(!title || !content) return alert("Vui lòng nhập đủ Tiêu đề và Nội dung!");
    try {
        if(id) { 
            await updateDoc(doc(db, "groups", currentGroupId, "announcements", id), { title, content }); 
        } else { 
            const newAnnoRef = await addDoc(collection(db, "groups", currentGroupId, "announcements"), { title, content, createdBy: currentUser.name, creatorPhone: currentUser.phone, reactions: {}, comments: [], createdAt: serverTimestamp() }); 
            // Cập nhật ID tin mới nhất vào nhóm để báo đỏ ngoài màn hình chính
            await updateDoc(doc(db, "groups", currentGroupId), { lastAnnoId: newAnnoRef.id });
        }
        annoModal.classList.add('hidden'); viewAnnoModal.classList.add('hidden'); currentOpenAnnoId = null;
    } catch(e) { alert("Lỗi: " + e.message); }
});

window.editAnno = (id, title, content) => {
    document.getElementById('anno-id').value = id; document.getElementById('anno-title-input').value = title; document.getElementById('anno-content-input').value = content;
    document.getElementById('anno-modal-title').innerText = "✏️ Sửa Bản Tin";
    annoModal.classList.remove('hidden');
};
window.deleteAnno = async (id) => { if(confirm("Xóa bài viết này?")) { await deleteDoc(doc(db, "groups", currentGroupId, "announcements", id)); viewAnnoModal.classList.add('hidden'); currentOpenAnnoId = null;} };

window.reactToAnno = async (id, emoji) => { try { const ref = doc(db, "groups", currentGroupId, "announcements", id); const data = (await getDoc(ref)).data(); const reactions = data.reactions || {}; if (reactions[currentUser.phone] === emoji) delete reactions[currentUser.phone]; else reactions[currentUser.phone] = emoji; await updateDoc(ref, { reactions }); } catch(e){} };
window.submitAnnoComment = async (id) => { const inp = document.getElementById(`input-cmt-${id}`); const txt = inp.value.trim(); if(!txt) return; try { await updateDoc(doc(db, "groups", currentGroupId, "announcements", id), { comments: arrayUnion({ phone: currentUser.phone, name: currentUser.name, text: txt, time: Date.now() }) }); inp.value = ''; } catch(e){} };

window.openAnnoDetail = (id) => { markAnnoRead(id); renderAnnouncements(); currentOpenAnnoId = id; renderAnnoModalContent(); viewAnnoModal.classList.remove('hidden'); };
document.getElementById('btn-close-view-anno').addEventListener('click', () => { viewAnnoModal.classList.add('hidden'); currentOpenAnnoId = null; });

function renderAnnoModalContent() {
    if (!currentOpenAnnoId) return;
    const anno = groupAnnouncements.find(a => a.id === currentOpenAnnoId);
    if (!anno) { viewAnnoModal.classList.add('hidden'); currentOpenAnnoId = null; return; }
    
    const time = anno.createdAt ? anno.createdAt.toDate().toLocaleString('vi-VN') : 'Vừa xong';
    const isAuthorOrManager = (isManager || anno.creatorPhone === currentUser.phone);
    const actionHtml = isAuthorOrManager ? `<div style="display:flex; gap:15px; margin-top:10px;"><span style="cursor:pointer; color:#0EA5E9; font-size:14px; font-weight:bold;" onclick="window.editAnno('${anno.id}', \`${anno.title}\`, \`${anno.content}\`)">✏️ Sửa</span><span style="cursor:pointer; color:#EF4444; font-size:14px; font-weight:bold;" onclick="window.deleteAnno('${anno.id}')">🗑️ Xóa</span></div>` : '';
    const interactHtml = renderInteractionsHTML(anno.id, anno, true);
    
    document.getElementById('view-anno-container').innerHTML = `<div class="anno-full-view"><div class="anno-full-title">${anno.title}</div><div class="anno-meta" style="margin-bottom: 15px;">Đăng bởi: <b>${anno.createdBy || 'Quản trị viên'}</b> • ${time}</div><div class="anno-full-body">${anno.content}</div>${actionHtml}</div>${interactHtml}`;
    document.getElementById(`comments-${anno.id}`).classList.remove('hidden');
}

function renderAnnouncements() {
    const div = document.getElementById('announcement-list');
    const totalPages = Math.ceil(groupAnnouncements.length / ANNO_PER_PAGE) || 1;
    document.getElementById('anno-page-info').innerText = `${currentAnnoPage}/${totalPages}`; document.getElementById('anno-pagination').style.display = totalPages > 1 ? 'flex' : 'none';
    const paginated = groupAnnouncements.slice((currentAnnoPage-1)*ANNO_PER_PAGE, currentAnnoPage*ANNO_PER_PAGE);
    div.innerHTML = paginated.length === 0 ? '<p style="text-align:center; color:gray; font-size:13px; padding:10px;">Chưa có thông báo nào từ ban quản trị.</p>' : '';
    
    paginated.forEach(a => {
        const time = a.createdAt ? a.createdAt.toDate().toLocaleString('vi-VN') : 'Vừa xong';
        const badgeNew = !isAnnoRead(a.id) ? `<span class="badge-new">NEW</span>` : '';
        div.innerHTML += `<div class="anno-item-compact" onclick="window.openAnnoDetail('${a.id}')">${badgeNew}<div class="anno-title">${a.title}</div><div class="anno-preview">${a.content}</div><div class="anno-meta">Đăng bởi: <b>${a.createdBy || 'Quản trị'}</b> • ${time}</div></div>`;
    });
}
document.getElementById('btn-anno-prev').addEventListener('click', () => { if(currentAnnoPage > 1) { currentAnnoPage--; renderAnnouncements(); }});
document.getElementById('btn-anno-next').addEventListener('click', () => { if(currentAnnoPage < Math.ceil(groupAnnouncements.length/ANNO_PER_PAGE)) { currentAnnoPage++; renderAnnouncements(); }});

// ================= QUẢN LÝ NHÓM & LISTENERS CHÍNH =================
function loadUserGroups(phone) { 
    onSnapshot(query(collection(db, "groups"), where("members", "array-contains", phone)), (snapshot) => { 
        const list = document.getElementById('group-list'); list.innerHTML = ''; 
        if(snapshot.empty) return list.innerHTML = '<p style="text-align:center; color:gray;">Chưa tham gia nhóm nào.</p>';
        const readList = JSON.parse(localStorage.getItem(`readAnnos_${phone}`) || '[]');
        
        snapshot.forEach((docSnap) => { 
            const data = docSnap.data(); 
            let roleHtml = (data.ownerId === phone) ? '<span class="role-badge role-owner">👑 Trưởng nhóm</span>' : (data.deputies && data.deputies.includes(phone)) ? '<span class="role-badge role-deputy">⭐ Phó nhóm</span>' : '<span class="role-badge role-member">👥 Thành viên</span>'; 
            let badgeNewHtml = (data.lastAnnoId && !readList.includes(data.lastAnnoId)) ? `<span class="group-badge-new">🔴 Tin mới</span>` : '';
            list.innerHTML += `<div class="group-item-card" onclick="window.enterGroup('${docSnap.id}')">${badgeNewHtml}<div class="group-item-name">${data.name}</div>${roleHtml}<div class="group-item-balance">Số dư: <b>${(data.balance || 0).toLocaleString()} ₫</b></div></div>`; 
        }); 
    }); 
}
document.getElementById('btn-create-group').addEventListener('click', async () => { const name = await window.customPrompt("Tạo Nhóm", "", "Tên nhóm..."); if (!name) return; await addDoc(collection(db, "groups"), { name, ownerId: currentUser.phone, deputies: [], members: [currentUser.phone], pendingInvites: [], balance: 0, createdAt: serverTimestamp() }); });
window.enterGroup = (groupId) => { currentGroupId = groupId; dashboardScreen.classList.add('hidden'); mainScreen.classList.remove('hidden'); initRealtimeListeners(); };
document.getElementById('btn-back-dashboard').addEventListener('click', () => { if(unsubGroup) unsubGroup(); if(unsubCampaigns) unsubCampaigns(); if(unsubTx) unsubTx(); if(unsubAnno) unsubAnno(); currentGroupId = null; currentGroupData = null; mainScreen.classList.add('hidden'); dashboardScreen.classList.remove('hidden'); });

document.getElementById('btn-edit-group-name').addEventListener('click', async () => {
    const newName = await window.customPrompt("Sửa tên nhóm", "Nhập tên mới cho nhóm của bạn", currentGroupData.name);
    if (newName && newName !== currentGroupData.name) {
        await updateDoc(doc(db, "groups", currentGroupId), { name: newName });
        sendNotification(currentGroupData.ownerId, "Đổi tên nhóm", `${currentUser.name} đã đổi tên nhóm thành: ${newName}`, currentGroupId);
    }
});

// ================= CÀI ĐẶT THÀNH VIÊN & NHƯỜNG CHỨC =================
document.getElementById('btn-edit-profile').addEventListener('click', () => { window.openSettings(currentUser.phone); });
document.getElementById('btn-cancel-settings').addEventListener('click', () => settingsModal.classList.add('hidden'));

window.proposeOwnership = async (targetPhone) => {
    if (!confirm(`Bạn muốn nhường chức Trưởng nhóm cho ${targetPhone}? Họ phải Đồng ý thì quyền mới được chuyển giao.`)) return;
    await updateDoc(doc(db, "groups", currentGroupId), { pendingOwner: targetPhone });
    sendNotification(targetPhone, "👑 Đề xuất Trưởng nhóm", `${currentUser.name} muốn nhường chức Trưởng nhóm cho bạn. Vui lòng vào nhóm để xác nhận.`, currentGroupId);
    document.getElementById('settings-modal').classList.add('hidden'); alert("Đã gửi lời mời nhường chức!");
};

window.handleOwnership = async (isAccept) => {
    const groupRef = doc(db, "groups", currentGroupId); const oldOwner = currentGroupData.ownerId;
    if (isAccept) {
        await updateDoc(groupRef, { ownerId: currentUser.phone, deputies: arrayRemove(currentUser.phone), pendingOwner: null });
        sendNotification(oldOwner, "✅ Chuyển quyền thành công", `${currentUser.name} đã đồng ý làm Trưởng nhóm mới.`, currentGroupId);
        alert("Bạn đã trở thành Trưởng nhóm!");
    } else {
        await updateDoc(groupRef, { pendingOwner: null });
        sendNotification(oldOwner, "❌ Từ chối nhận quyền", `${currentUser.name} đã từ chối nhận chức Trưởng nhóm.`, currentGroupId);
    }
};

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
        adminActions.innerHTML = `
            <div style="display:flex; gap:10px;">
                <button class="btn-sm ${isDeputy ? 'btn-secondary' : 'btn-success'} btn-3d" onclick="window.toggleDeputy('${targetPhone}', ${isDeputy}); document.getElementById('settings-modal').classList.add('hidden');" style="flex:1;">${isDeputy ? '📉 Giáng cấp' : '📈 Lên phó'}</button>
                <button class="btn-sm btn-danger btn-3d" onclick="window.removeMember('${targetPhone}'); document.getElementById('settings-modal').classList.add('hidden');" style="flex:1;">❌ Xóa TV</button>
            </div>
            <button class="btn-sm btn-primary btn-3d" onclick="window.proposeOwnership('${targetPhone}')" style="width:100%; margin-top:10px;">👑 Nhường chức Trưởng nhóm</button>
        `;
    }
    settingsModal.classList.remove('hidden');
};
document.getElementById('btn-submit-profile').addEventListener('click', async () => { const newName = document.getElementById('edit-profile-name').value.trim(); const newAddress = document.getElementById('edit-profile-address').value.trim(); const newAvatar = document.getElementById('edit-profile-avatar').value.trim(); if(!newName) return alert("Tên không để trống!"); try { await updateDoc(doc(db, "users", currentUser.phone), { name: newName, address: newAddress, avatar: newAvatar }); userCache[currentUser.phone] = { ...currentUser, name: newName, address: newAddress, avatar: newAvatar }; settingsModal.classList.add('hidden'); alert("Đã lưu!"); } catch(e){} });

// ================= BẢNG YÊU CẦU XỬ LÝ (THÊM YÊU CẦU NHƯỜNG CHỨC) =================
async function renderUnifiedPendingList() {
    const sec = document.getElementById('unified-pending-section'); const listDiv = document.getElementById('unified-pending-list');
    let all = [...pendingMembersArr, ...pendingTxArr];
    if (all.length === 0) { sec.classList.add('hidden'); return; }
    sec.classList.remove('hidden');
    const totalPages = Math.ceil(all.length / PENDING_PER_PAGE) || 1; document.getElementById('pending-page-info').innerText = `${currentPendingPage}/${totalPages}`; document.getElementById('pending-pagination').style.display = totalPages > 1 ? 'flex' : 'none';
    const paginated = all.slice((currentPendingPage-1)*PENDING_PER_PAGE, currentPendingPage*PENDING_PER_PAGE); listDiv.innerHTML = '';
    
    const phones = []; paginated.forEach(i => { 
        if(i.type==='member_invite'){ phones.push(i.data.phone); phones.push(i.data.proposedBy); }
        if(i.type==='ownership_transfer'){ phones.push(i.data.from); }
    });
    const uData = await getUsersData(phones);
    
    paginated.forEach(i => {
        if (i.type === 'member_invite') {
            const p = i.data.phone; const inv = i.data.proposedBy; const info = uData[p]; const infoInv = uData[inv]; const avt = `https://ui-avatars.com/api/?name=${encodeURIComponent(info.name)}&background=random&color=fff`;
            let pAction = isManager ? `<button class="btn-sm btn-secondary btn-3d" onclick="window.viewUserProfile('${p}', '${infoInv.name}')">Hồ sơ</button><button class="btn-sm btn-success btn-3d" onclick="window.approveMember('${p}', '${inv}', true)">Duyệt</button><button class="btn-sm btn-danger btn-3d" onclick="window.approveMember('${p}', '${inv}', false)">Hủy</button>` : `<span style="font-size:12px; color:gray;">Chờ duyệt...</span>`;
            listDiv.innerHTML += `<div class="pending-item" style="display:flex; justify-content:space-between; align-items:center; padding:12px; margin-bottom:10px; background:#FFFBEB; border-radius:12px;"><div style="display:flex; align-items:center; gap:10px;"><img src="${avt}" style="width:36px; height:36px; border-radius:50%;"><div><div style="font-size:11px; font-weight:bold; color:#D97706;">MỜI THÀNH VIÊN</div><div style="font-size:15px; font-weight:bold;">${info.name}</div><div style="font-size:12px; color:gray;">Bởi: ${infoInv.name}</div></div></div><div style="display:flex; gap:5px; flex-direction:column;">${pAction}</div></div>`;
        } else if (i.type === 'ownership_transfer') {
            const oldOwnerInfo = uData[i.data.from];
            listDiv.innerHTML += `<div class="pending-item" style="display:flex; justify-content:space-between; align-items:center; padding:12px; margin-bottom:10px; background:#EFF6FF; border-left: 4px solid #3B82F6; border-radius:12px;"><div style="display:flex; align-items:center; gap:10px;"><div style="font-size:30px;">👑</div><div><div style="font-size:11px; font-weight:bold; color:#2563EB;">NHƯỜNG QUYỀN TRƯỞNG NHÓM</div><div style="font-size:14px; font-weight:bold;">${oldOwnerInfo.name} muốn trao quyền cho bạn</div></div></div><div style="display:flex; gap:5px; flex-direction:column;"><button class="btn-sm btn-success btn-3d" onclick="window.handleOwnership(true)">Nhận chức</button><button class="btn-sm btn-danger btn-3d" onclick="window.handleOwnership(false)">Từ chối</button></div></div>`;
        } else {
            const d = i.data; const color = d.type === 'income' ? '#10B981' : '#EF4444';
            listDiv.innerHTML += `<div class="pending-item" style="padding:12px; margin-bottom:10px; background:#FEF2F2; border-left: 4px solid #EF4444; border-radius:12px;"><div style="display:flex; justify-content:space-between; align-items:center;"><div><div style="font-size:11px; font-weight:bold; color:#DC2626;">ĐỀ XUẤT ${d.type==='income'?'THU':'CHI'}</div><strong>${d.createdByName}</strong><br><span style="font-size:13px;">${d.description}</span>: <b style="color:${color}; font-size:16px;">${d.type==='income'?'+':'-'}${d.amount.toLocaleString()}đ</b></div>${isManager ? `<div style="display:flex; flex-direction:column; gap:5px;"><button class="btn-sm btn-success btn-3d" onclick="window.reviewTx('${d.id}', true)">Duyệt</button><button class="btn-sm btn-danger btn-3d" onclick="window.reviewTx('${d.id}', false)">Hủy</button></div>` : ''}</div></div>`;
        }
    });
}
document.getElementById('btn-pending-prev').addEventListener('click', () => { if(currentPendingPage>1){ currentPendingPage--; renderUnifiedPendingList(); }});
document.getElementById('btn-pending-next').addEventListener('click', () => { if(currentPendingPage < Math.ceil((pendingMembersArr.length + pendingTxArr.length)/PENDING_PER_PAGE)){ currentPendingPage++; renderUnifiedPendingList(); }});

// ================= THÀNH VIÊN & LỊCH SỬ QUỸ =================
window.toggleMemberDetails = (phone) => { if (currentlyOpenMember && currentlyOpenMember !== phone) { const oldEl = document.getElementById(`details-${currentlyOpenMember}`); if(oldEl) oldEl.classList.remove('open'); } const newEl = document.getElementById(`details-${phone}`); if(newEl) { newEl.classList.toggle('open'); if(newEl.classList.contains('open')) currentlyOpenMember = phone; else currentlyOpenMember = null; } };
document.getElementById('search-member-input').addEventListener('input', (e) => { searchMemberQuery = e.target.value.toLowerCase().trim(); currentMemberPage = 1; renderMemberList(); });
document.getElementById('btn-prev-page').addEventListener('click', () => { if (currentMemberPage > 1) { currentMemberPage--; renderMemberList(); } }); document.getElementById('btn-next-page').addEventListener('click', () => { currentMemberPage++; renderMemberList(); });
function renderMemberList() {
    const memberListDiv = document.getElementById('member-list'); let filtered = cachedGroupMembersArray.filter(u => u.phone.includes(searchMemberQuery) || u.name.toLowerCase().includes(searchMemberQuery));
    const totalPages = Math.ceil(filtered.length / MEMBERS_PER_PAGE) || 1; if (currentMemberPage > totalPages) currentMemberPage = totalPages;
    document.getElementById('page-info').innerText = `${currentMemberPage}/${totalPages}`; document.getElementById('btn-prev-page').disabled = (currentMemberPage === 1); document.getElementById('btn-next-page').disabled = (currentMemberPage === totalPages);
    const startIdx = (currentMemberPage - 1) * MEMBERS_PER_PAGE; const paginated = filtered.slice(startIdx, startIdx + MEMBERS_PER_PAGE); memberListDiv.innerHTML = '';
    if(paginated.length === 0) { memberListDiv.innerHTML = '<p style="text-align:center; padding:10px; color:gray;">Không tìm thấy ai.</p>'; return; }
    paginated.forEach(uInfo => {
        const memberPhone = uInfo.phone; const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(uInfo.name)}&background=random&color=fff`;
        let badge = (memberPhone === currentGroupData.ownerId) ? '<span class="role-badge role-owner" style="margin:0;">👑 Trưởng</span>' : (currentGroupData.deputies && currentGroupData.deputies.includes(memberPhone)) ? '<span class="role-badge role-deputy" style="margin:0;">⭐ Phó</span>' : '<span class="role-badge role-member" style="margin:0;">👥 TV</span>';
        let settingsBtnHtml = (userRole === 'owner' || memberPhone === currentUser.phone) ? `<button class="btn-sm btn-secondary btn-3d" onclick="window.openSettings('${memberPhone}')" style="width: 100%; margin-top: 10px;">⚙️ Cài đặt</button>` : '';
        let isOpenClass = (memberPhone === currentlyOpenMember) ? 'open' : '';
        memberListDiv.innerHTML += `<div class="member-item"><div class="member-summary" onclick="window.toggleMemberDetails('${memberPhone}')"><div style="display:flex; align-items:center; gap: 10px;"><img src="${uInfo.avatar || defaultAvatar}" class="avatar-img" style="width:35px; height:35px;"><b>${uInfo.name}</b></div><div style="display:flex; align-items:center; gap: 5px;">${badge} <span style="color:gray; font-size:12px;">▼</span></div></div><div id="details-${memberPhone}" class="member-details ${isOpenClass}"><p style="margin-bottom: 5px;">📞 <b>SĐT:</b> ${memberPhone}</p><p style="margin-bottom: 5px;">🏠 <b>Địa chỉ:</b> ${uInfo.address || 'Chưa cập nhật'}</p><div class="contact-actions"><a href="tel:${memberPhone}" class="btn-call">📞 Gọi ngay</a><a href="https://zalo.me/${memberPhone}" target="_blank" class="btn-zalo">💬 Chat Zalo</a></div>${settingsBtnHtml}</div></div>`;
    });
}

function renderPaginatedTransactions() {
    const txList = document.getElementById('transaction-list'); const totalPages = Math.ceil(approvedTransactions.length / TX_PER_PAGE) || 1;
    if (currentTxPage > totalPages) currentTxPage = totalPages; document.getElementById('tx-page-info').innerText = `${currentTxPage}/${totalPages}`;
    document.getElementById('btn-tx-prev-page').disabled = (currentTxPage === 1); document.getElementById('btn-tx-next-page').disabled = (currentTxPage === totalPages);
    const paginated = approvedTransactions.slice((currentTxPage - 1) * TX_PER_PAGE, currentTxPage * TX_PER_PAGE); txList.innerHTML = '';
    if (paginated.length === 0) { txList.innerHTML = '<p style="text-align:center; color:gray; padding:10px;">Chưa có giao dịch.</p>'; return; }
    paginated.forEach(tx => {
        const symbol = tx.type === 'income' ? '+' : '-'; const color = tx.type === 'income' ? '#10B981' : '#EF4444'; 
        const interactHtml = renderInteractionsHTML(tx.id, tx, false);
        txList.innerHTML += `<li class="transaction-item"><div class="tx-top"><div class="tx-info"><span class="tx-desc">${tx.description}</span><span style="font-size: 12px; color: gray;">Bởi: ${tx.createdByName}</span></div><strong style="color: ${color}; font-size: 18px;">${symbol}${tx.amount.toLocaleString()} ₫</strong></div>${interactHtml}</li>`;
    });
}
document.getElementById('btn-tx-prev-page').addEventListener('click', () => { if (currentTxPage > 1) { currentTxPage--; renderPaginatedTransactions(); } });
document.getElementById('btn-tx-next-page').addEventListener('click', () => { currentTxPage++; renderPaginatedTransactions(); });

// ================= LẮNG NGHE REALTIME CHÍNH =================
function initRealtimeListeners() {
    unsubGroup = onSnapshot(doc(db, "groups", currentGroupId), async (snap) => {
        if (!snap.exists()) return; currentGroupData = snap.data();
        if (!currentGroupData.members.includes(currentUser.phone)) { alert("Bạn đã bị xóa khỏi nhóm!"); document.getElementById('btn-back-dashboard').click(); return; }
        document.getElementById('group-name').innerText = currentGroupData.name; document.getElementById('balance').innerText = (currentGroupData.balance || 0).toLocaleString();
        userRole = (currentGroupData.ownerId === currentUser.phone) ? 'owner' : (currentGroupData.deputies && currentGroupData.deputies.includes(currentUser.phone)) ? 'deputy' : 'member';
        document.getElementById('user-role').innerHTML = `<span class="role-badge role-${userRole}">${userRole==='owner'?'Trưởng':userRole==='deputy'?'Phó':'Thành viên'}</span>`;
        isManager = (userRole === 'owner' || userRole === 'deputy');
        
        document.getElementById('btn-edit-group-name').classList.toggle('hidden', !isManager);
        document.getElementById('btn-open-anno-modal').classList.toggle('hidden', !isManager); 
        document.getElementById('btn-create-campaign').classList.toggle('hidden', !isManager);
        
        const mData = await getUsersData(currentGroupData.members); cachedGroupMembersArray = currentGroupData.members.map(p => ({ phone:p, ...mData[p] })); renderMemberList();
        
        pendingMembersArr = (currentGroupData.pendingInvites || []).map(inv => ({ type: 'member_invite', data: inv }));
        if (currentGroupData.pendingOwner === currentUser.phone) { pendingMembersArr.push({ type: 'ownership_transfer', data: { from: currentGroupData.ownerId } }); }
        renderUnifiedPendingList();
    });
    
    if(unsubAnno) unsubAnno(); 
    unsubAnno = onSnapshot(query(collection(db, "groups", currentGroupId, "announcements"), orderBy("createdAt", "desc")), (snap) => { 
        groupAnnouncements = []; snap.forEach(d => groupAnnouncements.push({id: d.id, ...d.data()})); 
        renderAnnouncements(); 
        if (currentOpenAnnoId) renderAnnoModalContent(); 
    });
    
    unsubCampaigns = onSnapshot(collection(db, "groups", currentGroupId, "campaigns"), (snap) => { const list = document.getElementById('campaign-list'); const sel = document.getElementById('tx-campaign-select'); list.innerHTML = ''; sel.innerHTML = '<option value="">-- Quỹ chung --</option>'; snap.forEach(d => { if(d.data().status==='active'){ list.innerHTML += `<div class="campaign-card"><div class="campaign-header"><span>🏕️ ${d.data().name}</span><span class="campaign-balance">${d.data().balance.toLocaleString()}đ</span></div>${isManager?`<button class="btn-close-campaign" onclick="window.closeCampaign('${d.id}','${d.data().name}')">Tất toán</button>`:''}</div>`; sel.innerHTML += `<option value="${d.id}">${d.data().name}</option>`; }}); });
    
    unsubTx = onSnapshot(query(collection(db, "groups", currentGroupId, "transactions"), orderBy("createdAt", "desc")), (snap) => {
        approvedTransactions = []; pendingTxArr = []; cachedTransactions = [];
        snap.forEach(d => { cachedTransactions.push({id:d.id, ...d.data()}); if(d.data().status==='pending') pendingTxArr.push({type:'transaction', data:{id:d.id, ...d.data()}}); else approvedTransactions.push({id:d.id, ...d.data()}); });
        renderPaginatedTransactions(); renderUnifiedPendingList(); if (!document.getElementById('filter-modal').classList.contains('hidden')) { applyFilter(); }
    });
}

// ================= CÁC THAO TÁC CÒN LẠI =================
window.viewUserProfile = async (phone, inviterName) => { const dataObj = await getUsersData([phone]); const user = dataObj[phone]; document.getElementById('view-profile-avatar').src = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random&color=fff`; document.getElementById('view-profile-name').innerText = user.name; document.getElementById('view-profile-phone').innerText = user.phone; document.getElementById('view-profile-address').innerText = user.address || 'Chưa cập nhật'; document.getElementById('view-profile-inviter').innerText = inviterName; viewProfileModal.classList.remove('hidden'); };
document.getElementById('btn-close-view-profile').addEventListener('click', () => viewProfileModal.classList.add('hidden'));

document.getElementById('btn-add-member').addEventListener('click', async () => { const newPhone = await window.customPrompt("Mời Thành Viên", "", "Nhập SĐT cần mời..."); if (!newPhone || newPhone.length < 9) return; const userSnap = await getDoc(doc(db, "users", newPhone)); if(!userSnap.exists()) return alert("SĐT này chưa đăng ký app!"); try { const groupRef = doc(db, "groups", currentGroupId); const groupData = (await getDoc(groupRef)).data(); const currentInvites = groupData.pendingInvites || []; const newInvites = currentInvites.filter(inv => inv.phone !== newPhone); if (isManager) { await updateDoc(groupRef, { members: arrayUnion(newPhone), pendingInvites: newInvites }); sendNotification(newPhone, "Bạn đã được thêm", `Vào nhóm ${groupData.name}`, currentGroupId); } else { newInvites.push({ phone: newPhone, proposedBy: currentUser.phone }); await updateDoc(groupRef, { pendingInvites: newInvites }); alert("Đã gửi đề xuất!"); const managers = [groupData.ownerId, ...(groupData.deputies || [])]; managers.forEach(mgr => sendNotification(mgr, "Đề xuất TV", `${currentUser.name} mời SĐT ${newPhone}`, currentGroupId)); } } catch(e){} });
window.approveMember = async (phone, invPhone, isApprove) => { const invites = (currentGroupData.pendingInvites || []).filter(i => i.phone !== phone); if (isApprove) { await updateDoc(doc(db, "groups", currentGroupId), { members: arrayUnion(phone), pendingInvites: invites }); sendNotification(phone, "Đã vào nhóm", `Bạn đã được duyệt vào nhóm`, currentGroupId); } else { const reason = await window.customPrompt("Từ chối thành viên", `Gửi phản hồi cho người mời`, "Nhập lý do tại đây..."); if (reason === null) return; await updateDoc(doc(db, "groups", currentGroupId), { pendingInvites: invites }); sendNotification(invPhone, "Đề xuất bị từ chối", `Người bạn mời (${phone}) bị từ chối. Lý do: ${reason}`, currentGroupId); } };

window.reviewTx = async (txId, isApprove) => { const txRef = doc(db, "groups", currentGroupId, "transactions", txId); const txData = (await getDoc(txRef)).data(); if (isApprove) { await runTransaction(db, async (t) => { const change = txData.type === "expense" ? -txData.amount : txData.amount; const target = txData.campaignId ? doc(db, "groups", currentGroupId, "campaigns", txData.campaignId) : doc(db, "groups", currentGroupId); t.update(target, { balance: increment(change) }); t.update(txRef, { status: "approved" }); }); sendNotification(txData.creatorPhone, "Đề xuất được duyệt", `Khoản ${txData.description} đã duyệt!`, currentGroupId); } else { const reason = await window.customPrompt("Từ chối giao dịch", `Gửi phản hồi cho ${txData.createdByName}`, "Nhập lý do tại đây..."); if (reason === null) return; await deleteDoc(txRef); sendNotification(txData.creatorPhone, "Đề xuất bị từ chối", `Khoản ${txData.description} bị từ chối. Lý do: ${reason}`, currentGroupId); } };

document.getElementById('btn-open-filter').addEventListener('click', () => { const memberSelect = document.getElementById('filter-member'); memberSelect.innerHTML = '<option value="all">Mọi thành viên</option>'; cachedGroupMembersArray.forEach(u => { memberSelect.innerHTML += `<option value="${u.phone}">${u.name} (${u.phone})</option>`; }); document.getElementById('filter-type').value = 'all'; document.getElementById('filter-member').value = 'all'; document.getElementById('filter-modal').classList.remove('hidden'); applyFilter(); });
document.getElementById('btn-close-filter').addEventListener('click', () => { document.getElementById('filter-modal').classList.add('hidden'); }); document.getElementById('filter-type').addEventListener('change', applyFilter); document.getElementById('filter-member').addEventListener('change', applyFilter);
function applyFilter() { const type = document.getElementById('filter-type').value; const memberPhone = document.getElementById('filter-member').value; let filtered = cachedTransactions.filter(tx => tx.status === 'approved'); if (type !== 'all') filtered = filtered.filter(tx => tx.type === type); if (memberPhone !== 'all') filtered = filtered.filter(tx => tx.creatorPhone === memberPhone); const resultsList = document.getElementById('filter-results-list'); resultsList.innerHTML = ''; let totalAmount = 0; if (filtered.length === 0) { resultsList.innerHTML = '<p style="text-align:center; color:gray; padding:10px;">Không có giao dịch phù hợp.</p>'; } else { filtered.forEach(tx => { const symbol = tx.type === 'income' ? '+' : '-'; const color = tx.type === 'income' ? '#10B981' : '#EF4444'; if (type === 'all') totalAmount += (tx.type === 'income' ? tx.amount : -tx.amount); else totalAmount += tx.amount; resultsList.innerHTML += `<li class="transaction-item"><div class="tx-top"><div class="tx-info"><span class="tx-desc">${tx.description}</span><span style="font-size: 12px; color: gray;">Bởi: ${tx.createdByName}</span></div><strong style="color: ${color};">${symbol}${tx.amount.toLocaleString()} ₫</strong></div></li>`; }); } const totalEl = document.getElementById('filter-total-amount'); totalEl.innerText = Math.abs(totalAmount).toLocaleString(); if (type === 'all') totalEl.style.color = totalAmount >= 0 ? '#10B981' : '#EF4444'; else if (type === 'income') totalEl.style.color = '#10B981'; else totalEl.style.color = '#EF4444'; }

window.toggleDeputy = async (phone, isCurrentlyDeputy) => { if (userRole !== 'owner') return; try { await updateDoc(doc(db, "groups", currentGroupId), { deputies: isCurrentlyDeputy ? arrayRemove(phone) : arrayUnion(phone) }); sendNotification(phone, "Quyền hạn", `Bạn vừa được ${isCurrentlyDeputy?'giáng cấp':'lên Phó nhóm'}`, currentGroupId); } catch (e){} };
window.removeMember = async (phone) => { if (userRole !== 'owner') return; if (!confirm(`Xóa ${phone}?`)) return; try { await updateDoc(doc(db, "groups", currentGroupId), { members: arrayRemove(phone), deputies: arrayRemove(phone) }); sendNotification(phone, "Bị xóa khỏi nhóm", `Bạn bị xóa khỏi ${currentGroupData.name}`, null); } catch (e){} };
document.getElementById('btn-income').addEventListener('click', () => { txType = "income"; txModal.classList.remove('hidden'); }); document.getElementById('btn-expense').addEventListener('click', () => { txType = "expense"; txModal.classList.remove('hidden'); }); document.getElementById('btn-cancel-tx').addEventListener('click', () => txModal.classList.add('hidden'));
document.getElementById('btn-submit-tx').addEventListener('click', async () => { let amount = parseInt(document.getElementById('tx-amount').value); const desc = document.getElementById('tx-desc').value; const campaignId = document.getElementById('tx-campaign-select').value; if (!amount || amount <= 0 || !desc) return alert("Nhập đầy đủ!"); const changeAmount = txType === "expense" ? -amount : amount; const txStatus = isManager ? "approved" : "pending"; try { if (isManager) { const targetRef = campaignId ? doc(db, "groups", currentGroupId, "campaigns", campaignId) : doc(db, "groups", currentGroupId); await updateDoc(targetRef, { balance: increment(changeAmount) }); } await addDoc(collection(db, "groups", currentGroupId, "transactions"), { type: txType, amount: amount, description: desc, campaignId: campaignId || null, creatorPhone: currentUser.phone, createdByName: currentUser.name, status: txStatus, reactions: {}, comments: [], createdAt: serverTimestamp() }); txModal.classList.add('hidden'); document.getElementById('tx-amount').value = ''; document.getElementById('tx-desc').value = ''; if (!isManager) { alert("Đã gửi đề xuất duyệt!"); const managers = [currentGroupData.ownerId, ...(currentGroupData.deputies || [])]; managers.forEach(mgr => sendNotification(mgr, "Đề xuất giao dịch", `${currentUser.name} đề xuất ${txType==='income'?'THU':'CHI'} ${amount.toLocaleString()}đ`, currentGroupId)); } } catch (e) { alert("Lỗi: " + e.message); } });
document.getElementById('btn-create-campaign').addEventListener('click', async () => { const name = await window.customPrompt("Tạo Quỹ Sự Kiện", "", "Tên sự kiện mới..."); if (!name) return; try { await addDoc(collection(db, "groups", currentGroupId, "campaigns"), { name: name, status: "active", balance: 0, createdAt: serverTimestamp() }); } catch (e){} });
window.closeCampaign = async (campaignId, campaignName) => { if (!confirm(`Tất toán "${campaignName}"?`)) return; const groupRef = doc(db, "groups", currentGroupId); const campaignRef = doc(db, "groups", currentGroupId, "campaigns", campaignId); try { await runTransaction(db, async (t) => { const gDoc = await t.get(groupRef); const cDoc = await t.get(campaignRef); const cBal = cDoc.data().balance; t.update(groupRef, { balance: (gDoc.data().balance || 0) + cBal }); t.update(campaignRef, { balance: 0, status: "closed" }); t.set(doc(collection(db, "groups", currentGroupId, "transactions")), { type: cBal >= 0 ? "income" : "expense", amount: Math.abs(cBal), description: `Tất toán: ${campaignName}`, campaignId: null, creatorPhone: "system", createdByName: "HỆ THỐNG", status: "approved", createdAt: serverTimestamp() }); }); } catch (e){} };
