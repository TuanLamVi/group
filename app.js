import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, collection, addDoc, onSnapshot, runTransaction, updateDoc, increment, serverTimestamp, query, where, orderBy, deleteDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const mainScreen = document.getElementById('main-screen');
const txModal = document.getElementById('tx-modal');

let currentUser = null;
let currentGroupId = null; 
let txType = ""; 

// [THAY ĐỔI 1]: Bỏ biến isOwner, thay bằng 2 biến này để quản lý Phó nhóm
let userRole = 'member'; // 'owner', 'deputy', hoặc 'member'
let isManager = false;   // Gom chung quyền (Trưởng hoặc Phó đều được duyệt)

let unsubGroup = null;
let unsubCampaigns = null;
let unsubTx = null;

// ================= 1. LUỒNG ĐĂNG NHẬP & ĐĂNG XUẤT =================

// 1.1 Kiểm tra tự động đăng nhập ngay khi mở trang
window.addEventListener('DOMContentLoaded', () => {
    const savedPhone = localStorage.getItem('userPhone'); // Kiểm tra bộ nhớ trình duyệt
    if (savedPhone) {
        // Nếu có dữ liệu, tự động đăng nhập
        currentUser = { phone: savedPhone };
        document.getElementById('display-user-phone').innerText = savedPhone;
        
        loginScreen.classList.add('hidden');
        dashboardScreen.classList.remove('hidden');
        loadUserGroups(); 
    }
});

// 1.2 Xử lý khi bấm nút Đăng nhập
document.getElementById('login-btn').addEventListener('click', () => {
    const phone = document.getElementById('phone-input').value.trim();
    if (phone.length < 9) return alert("Nhập số điện thoại hợp lệ!");
    
    currentUser = { phone };
    document.getElementById('display-user-phone').innerText = phone;
    
    // LƯU SỐ ĐIỆN THOẠI VÀO BỘ NHỚ TRÌNH DUYỆT
    localStorage.setItem('userPhone', phone);
    
    loginScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    loadUserGroups(); 
});

// 1.3 Xử lý Đăng xuất
document.getElementById('btn-logout').addEventListener('click', () => {
    if (!confirm("Bạn có chắc muốn đăng xuất?")) return;

    // Xóa dữ liệu trong bộ nhớ trình duyệt
    localStorage.removeItem('userPhone');
    currentUser = null;
    currentGroupId = null;

    // Tắt các lắng nghe dữ liệu để đỡ tốn tài nguyên
    if(unsubGroup) unsubGroup();
    if(unsubCampaigns) unsubCampaigns();
    if(unsubTx) unsubTx();

    // Reset giao diện
    document.getElementById('phone-input').value = '';
    dashboardScreen.classList.add('hidden');
    mainScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
});

// ================= 2. QUẢN LÝ DANH SÁCH NHÓM (DASHBOARD) =================
function loadUserGroups() {
    const q = query(collection(db, "groups"), where("members", "array-contains", currentUser.phone));
    
    onSnapshot(q, (snapshot) => {
        const list = document.getElementById('group-list');
        list.innerHTML = '';
        
        if(snapshot.empty) {
            list.innerHTML = '<p style="text-align:center; color:gray;">Bạn chưa tham gia nhóm nào.</p>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            
            // [THAY ĐỔI 2]: Xác định vai trò để gắn Badge màu sắc ngoài Dashboard
            let roleHtml = '';
            if (data.ownerId === currentUser.phone) {
                roleHtml = '<span class="role-badge role-owner">👑 Trưởng nhóm</span>';
            } else if (data.deputies && data.deputies.includes(currentUser.phone)) {
                roleHtml = '<span class="role-badge role-deputy">⭐ Phó nhóm</span>';
            } else {
                roleHtml = '<span class="role-badge role-member">👥 Thành viên</span>';
            }
            
            list.innerHTML += `
                <div class="group-item-card" onclick="window.enterGroup('${docSnap.id}')">
                    <div class="group-item-name">${data.name}</div>
                    ${roleHtml}
                    <div class="group-item-balance">Số dư: <b>${(data.balance || 0).toLocaleString()} ₫</b></div>
                </div>
            `;
        });
    });
}

// Tạo nhóm mới tự động
document.getElementById('btn-create-group').addEventListener('click', async () => {
    const groupName = prompt("Nhập tên nhóm mới:");
    if (!groupName) return;

    try {
        await addDoc(collection(db, "groups"), {
            name: groupName,
            ownerId: currentUser.phone,
            deputies: [], // [THAY ĐỔI 3]: Tự động tạo mảng deputies (Phó nhóm) trống
            members: [currentUser.phone],
            balance: 0,
            createdAt: serverTimestamp()
        });
        alert("Tạo nhóm thành công!");
    } catch (error) { alert("Lỗi: " + error.message); }
});

// Chuyển từ Dashboard vào Chi tiết Nhóm
window.enterGroup = (groupId) => {
    currentGroupId = groupId;
    dashboardScreen.classList.add('hidden');
    mainScreen.classList.remove('hidden');
    initRealtimeListeners(); 
};

// Nút Quay lại
document.getElementById('btn-back-dashboard').addEventListener('click', () => {
    if(unsubGroup) unsubGroup();
    if(unsubCampaigns) unsubCampaigns();
    if(unsubTx) unsubTx();
    currentGroupId = null;
    mainScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
});

// ================= 3. CHI TIẾT NHÓM =================
function initRealtimeListeners() {
    // 3.1 Lắng nghe Nhóm
    unsubGroup = onSnapshot(doc(db, "groups", currentGroupId), (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        document.getElementById('group-name').innerText = data.name;
        document.getElementById('balance').innerText = (data.balance || 0).toLocaleString();
        
        // [THAY ĐỔI 4]: Hiển thị chức vụ trong Chi tiết nhóm
        if (data.ownerId === currentUser.phone) {
            userRole = 'owner';
            document.getElementById('user-role').innerHTML = '<span class="role-badge role-owner">👑 Trưởng nhóm</span>';
        } else if (data.deputies && data.deputies.includes(currentUser.phone)) {
            userRole = 'deputy';
            document.getElementById('user-role').innerHTML = '<span class="role-badge role-deputy">⭐ Phó nhóm</span>';
        } else {
            userRole = 'member';
            document.getElementById('user-role').innerHTML = '<span class="role-badge role-member">👥 Thành viên</span>';
        }

        // isManager = Trưởng nhóm HOẶC Phó nhóm
        isManager = (userRole === 'owner' || userRole === 'deputy');
        
        // Cấp quyền UI dựa trên chức vụ
        document.getElementById('btn-create-campaign').classList.toggle('hidden', !isManager);
        document.getElementById('btn-add-member').classList.toggle('hidden', userRole !== 'owner'); // Chỉ Owner mới được thêm người
        
        document.getElementById('btn-income').innerText = isManager ? "➕ Thu tiền" : "➕ Đề xuất Thu";
        document.getElementById('btn-expense').innerText = isManager ? "➖ Chi tiền" : "➖ Đề xuất Chi";

        document.getElementById('member-list').innerText = (data.members || []).join(" • ");
    });

    // 3.2 Lắng nghe Sự Kiện
    unsubCampaigns = onSnapshot(collection(db, "groups", currentGroupId, "campaigns"), (snapshot) => {
        const campaignList = document.getElementById('campaign-list');
        const txSelect = document.getElementById('tx-campaign-select');
        campaignList.innerHTML = '';
        txSelect.innerHTML = '<option value="">-- Quỹ chung --</option>';

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.status === 'active') {
                campaignList.innerHTML += `
                    <div class="campaign-card">
                        <div class="campaign-header">
                            <span>🏕️ ${data.name}</span>
                            <span class="campaign-balance">${data.balance.toLocaleString()} ₫</span>
                        </div>
                        ${isManager ? `<button class="btn-close-campaign" onclick="window.closeCampaign('${docSnap.id}', '${data.name}')">Tất toán</button>` : ''}
                    </div>`;
                txSelect.innerHTML += `<option value="${docSnap.id}">${data.name}</option>`;
            }
        });
    });

    // 3.3 Lắng nghe Giao dịch
    const txQuery = query(collection(db, "groups", currentGroupId, "transactions"), orderBy("createdAt", "desc"));
    unsubTx = onSnapshot(txQuery, (snapshot) => {
        const pendingList = document.getElementById('pending-list');
        const txList = document.getElementById('transaction-list');
        const pendingSection = document.getElementById('pending-section');
        
        pendingList.innerHTML = ''; txList.innerHTML = '';
        let hasPending = false;

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const symbol = data.type === 'income' ? '+' : '-';
            const color = data.type === 'income' ? 'green' : 'red';

            if (data.status === 'pending') {
                hasPending = true;
                pendingList.innerHTML += `
                    <li class="transaction-item pending-item">
                        <div>
                            <strong>${data.createdBy}</strong> đề xuất ${data.type === 'income' ? 'THU' : 'CHI'}<br>
                            <span>${data.description}</span>: <b style="color:${color}">${symbol}${data.amount.toLocaleString()}đ</b>
                        </div>
                        ${isManager ? ` <!-- [THAY ĐỔI 5]: isManager được quyền duyệt -->
                        <div class="pending-actions">
                            <button class="btn-approve" onclick="window.reviewTx('${docSnap.id}', true)">Duyệt</button>
                            <button class="btn-reject" onclick="window.reviewTx('${docSnap.id}', false)">Hủy</button>
                        </div>` : '<span style="font-size: 12px; color: gray;">Chờ duyệt...</span>'}
                    </li>`;
            } else if (data.status === 'approved') {
                txList.innerHTML += `
                    <li class="transaction-item">
                        <div class="tx-info">
                            <span class="tx-desc">${data.description}</span>
                            <span style="font-size: 12px; color: gray;">Bởi: ${data.createdBy}</span>
                        </div>
                        <strong style="color: ${color}">${symbol}${data.amount.toLocaleString()} ₫</strong>
                    </li>`;
            }
        });
        pendingSection.classList.toggle('hidden', !hasPending);
    });
}

// Thêm thành viên
document.getElementById('btn-add-member').addEventListener('click', async () => {
    const newPhone = prompt("Nhập số điện thoại bạn bè để mời vào nhóm:");
    if (newPhone && newPhone.length >= 9) {
        try {
            await updateDoc(doc(db, "groups", currentGroupId), {
                members: arrayUnion(newPhone)
            });
            alert("Đã thêm thành viên!");
        } catch(e) { alert("Lỗi: " + e.message); }
    }
});

// Mở Modal Thu / Chi
document.getElementById('btn-income').addEventListener('click', () => { txType = "income"; txModal.classList.remove('hidden'); });
document.getElementById('btn-expense').addEventListener('click', () => { txType = "expense"; txModal.classList.remove('hidden'); });
document.getElementById('btn-cancel-tx').addEventListener('click', () => txModal.classList.add('hidden'));

// Lưu Thu/Chi
document.getElementById('btn-submit-tx').addEventListener('click', async () => {
    let amount = parseInt(document.getElementById('tx-amount').value);
    const desc = document.getElementById('tx-desc').value;
    const campaignId = document.getElementById('tx-campaign-select').value;
    if (!amount || amount <= 0 || !desc) return alert("Vui lòng nhập đầy đủ!");
    
    const changeAmount = txType === "expense" ? -amount : amount;
    
    // [THAY ĐỔI 6]: Nếu là isManager (Trưởng hoặc phó) thì approved luôn, còn lại thì pending
    const txStatus = isManager ? "approved" : "pending"; 

    try {
        if (isManager) {
            const targetRef = campaignId ? doc(db, "groups", currentGroupId, "campaigns", campaignId) : doc(db, "groups", currentGroupId);
            await updateDoc(targetRef, { balance: increment(changeAmount) });
        }
        await addDoc(collection(db, "groups", currentGroupId, "transactions"), {
            type: txType, amount: amount, description: desc, campaignId: campaignId || null,
            createdBy: currentUser.phone, status: txStatus, createdAt: serverTimestamp()
        });
        txModal.classList.add('hidden');
        document.getElementById('tx-amount').value = ''; document.getElementById('tx-desc').value = '';
        if (!isManager) alert("Đã gửi đề xuất duyệt!");
    } catch (error) { alert("Lỗi: " + error.message); }
});

// Duyệt Đề xuất
window.reviewTx = async (txId, isApprove) => {
    const txRef = doc(db, "groups", currentGroupId, "transactions", txId);
    try {
        if (!isApprove) { if(confirm("Hủy đề xuất này?")) await deleteDoc(txRef); return; }
        await runTransaction(db, async (t) => {
            const txDoc = await t.get(txRef);
            if (!txDoc.exists() || txDoc.data().status !== 'pending') throw "Giao dịch không hợp lệ!";
            const data = txDoc.data();
            const changeAmount = data.type === "expense" ? -data.amount : data.amount;
            const targetRef = data.campaignId ? doc(db, "groups", currentGroupId, "campaigns", data.campaignId) : doc(db, "groups", currentGroupId);
            t.update(targetRef, { balance: increment(changeAmount) });
            t.update(txRef, { status: "approved" });
        });
    } catch (error) { alert("Lỗi duyệt: " + error); }
};

// Tạo sự kiện
document.getElementById('btn-create-campaign').addEventListener('click', async () => {
    const name = prompt("Tên sự kiện mới:");
    if (!name) return;
    try {
        await addDoc(collection(db, "groups", currentGroupId, "campaigns"), {
            name: name, status: "active", balance: 0, createdAt: serverTimestamp()
        });
    } catch (error) { alert("Lỗi: " + error.message); }
});

// Tất toán sự kiện
window.closeCampaign = async (campaignId, campaignName) => {
    if (!confirm(`Tất toán sự kiện "${campaignName}"?`)) return;
    const groupRef = doc(db, "groups", currentGroupId);
    const campaignRef = doc(db, "groups", currentGroupId, "campaigns", campaignId);
    try {
        await runTransaction(db, async (t) => {
            const gDoc = await t.get(groupRef);
            const cDoc = await t.get(campaignRef);
            const cBal = cDoc.data().balance;
            t.update(groupRef, { balance: (gDoc.data().balance || 0) + cBal });
            t.update(campaignRef, { balance: 0, status: "closed" });
            t.set(doc(collection(db, "groups", currentGroupId, "transactions")), {
                type: cBal >= 0 ? "income" : "expense", amount: Math.abs(cBal),
                description: `Tất toán: ${campaignName}`, campaignId: null,
                createdBy: "HỆ THỐNG", status: "approved", createdAt: serverTimestamp()
            });
        });
    } catch (e) { alert("Lỗi: " + e); }
};
