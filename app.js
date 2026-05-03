import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, collection, addDoc, onSnapshot, runTransaction, updateDoc, increment, serverTimestamp, query, where, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
const mainScreen = document.getElementById('main-screen');
const phoneInput = document.getElementById('phone-input');
const txModal = document.getElementById('tx-modal');

let currentUser = null;
let currentGroupId = "demo_group_01"; 
let txType = ""; 
let isOwner = false; // Phân quyền

// 1. ĐĂNG NHẬP
document.getElementById('login-btn').addEventListener('click', () => {
    const phone = phoneInput.value.trim();
    if (phone.length < 9) return alert("Nhập số điện thoại hợp lệ!");
    currentUser = { phone, name: "User " + phone.slice(-3) };
    
    loginScreen.classList.add('hidden');
    mainScreen.classList.remove('hidden');
    
    initRealtimeListeners(); 
});

// 2. LẮNG NGHE DỮ LIỆU
function initRealtimeListeners() {
    // 2.1 Lắng nghe thông tin Nhóm & Quyền
    onSnapshot(doc(db, "groups", currentGroupId), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('group-name').innerText = data.name;
            document.getElementById('balance').innerText = (data.balance || 0).toLocaleString();
            
            // Xác định quyền
            isOwner = (data.ownerId === currentUser.phone);
            document.getElementById('user-role').innerText = isOwner ? "👑 Trưởng nhóm" : "👥 Thành viên";
            
            // Ẩn/hiện nút theo quyền
            if (isOwner) {
                document.getElementById('btn-create-campaign').classList.remove('hidden');
                document.getElementById('btn-add-member').classList.remove('hidden');
                document.getElementById('btn-income').innerText = "➕ Thu tiền";
                document.getElementById('btn-expense').innerText = "➖ Chi tiền";
            } else {
                document.getElementById('btn-create-campaign').classList.add('hidden');
                document.getElementById('btn-add-member').classList.add('hidden');
                document.getElementById('btn-income').innerText = "➕ Đề xuất Thu";
                document.getElementById('btn-expense').innerText = "➖ Đề xuất Chi";
            }

            // Hiển thị danh sách thành viên
            const membersArray = data.members || [];
            document.getElementById('member-list').innerText = membersArray.join(" • ");
            
        }
    });

    // 2.2 Lắng nghe Sự Kiện
    onSnapshot(collection(db, "groups", currentGroupId, "campaigns"), (snapshot) => {
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
                        ${isOwner ? `<button class="btn-close-campaign" onclick="window.closeCampaign('${docSnap.id}', '${data.name}')">Tất toán</button>` : ''}
                    </div>`;
                txSelect.innerHTML += `<option value="${docSnap.id}">${data.name}</option>`;
            }
        });
    });

    // 2.3 Lắng nghe Giao dịch & Đề xuất
    const txQuery = query(collection(db, "groups", currentGroupId, "transactions"), orderBy("createdAt", "desc"));
    onSnapshot(txQuery, (snapshot) => {
        const pendingList = document.getElementById('pending-list');
        const txList = document.getElementById('transaction-list');
        const pendingSection = document.getElementById('pending-section');
        
        pendingList.innerHTML = '';
        txList.innerHTML = '';
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
                        ${isOwner ? `
                        <div class="pending-actions">
                            <button class="btn-approve" onclick="window.reviewTx('${docSnap.id}', true)">Duyệt</button>
                            <button class="btn-reject" onclick="window.reviewTx('${docSnap.id}', false)">Hủy</button>
                        </div>` : '<span style="font-size: 12px; color: gray;">Đang chờ duyệt...</span>'}
                    </li>`;
            } else if (data.status === 'approved') {
                txList.innerHTML += `
                    <li class="transaction-item">
                        <div class="tx-info">
                            <span class="tx-desc">${data.description} ${data.campaignId ? '(Sự kiện)' : ''}</span>
                            <span style="font-size: 12px; color: gray;">Bởi: ${data.createdBy}</span>
                        </div>
                        <strong style="color: ${color}">${symbol}${data.amount.toLocaleString()} ₫</strong>
                    </li>`;
            }
        });

        if (hasPending) pendingSection.classList.remove('hidden');
        else pendingSection.classList.add('hidden');
    });
}

// 3. MỞ MODAL THU/CHI
document.getElementById('btn-income').addEventListener('click', () => { txType = "income"; txModal.classList.remove('hidden'); });
document.getElementById('btn-expense').addEventListener('click', () => { txType = "expense"; txModal.classList.remove('hidden'); });
document.getElementById('btn-cancel-tx').addEventListener('click', () => txModal.classList.add('hidden'));

// 4. LƯU GIAO DỊCH (Trưởng nhóm -> Approved | Thành viên -> Pending)
document.getElementById('btn-submit-tx').addEventListener('click', async () => {
    let amount = parseInt(document.getElementById('tx-amount').value);
    const desc = document.getElementById('tx-desc').value;
    const campaignId = document.getElementById('tx-campaign-select').value;

    if (!amount || amount <= 0 || !desc) return alert("Vui lòng nhập đầy đủ!");
    
    const changeAmount = txType === "expense" ? -amount : amount;
    const txStatus = isOwner ? "approved" : "pending"; // QUAN TRỌNG

    try {
        // Nếu là trưởng nhóm, cập nhật tiền luôn
        if (isOwner) {
            const targetRef = campaignId ? doc(db, "groups", currentGroupId, "campaigns", campaignId) : doc(db, "groups", currentGroupId);
            await updateDoc(targetRef, { balance: increment(changeAmount) });
        }

        // Lưu bản ghi giao dịch (với trạng thái tương ứng)
        await addDoc(collection(db, "groups", currentGroupId, "transactions"), {
            type: txType,
            amount: amount,
            description: desc,
            campaignId: campaignId || null,
            createdBy: currentUser.phone,
            status: txStatus, 
            createdAt: serverTimestamp()
        });

        txModal.classList.add('hidden');
        document.getElementById('tx-amount').value = '';
        document.getElementById('tx-desc').value = '';

        if (!isOwner) alert("Đã gửi đề xuất cho Trưởng nhóm duyệt!");

    } catch (error) { alert("Lỗi: " + error.message); }
});

// 5. TRƯỞNG NHÓM DUYỆT / HỦY ĐỀ XUẤT
window.reviewTx = async (txId, isApprove) => {
    const txRef = doc(db, "groups", currentGroupId, "transactions", txId);
    
    try {
        if (!isApprove) {
            if(confirm("Bạn có chắc muốn hủy đề xuất này?")) await deleteDoc(txRef);
            return;
        }

        // Nếu duyệt, chạy Transaction để an toàn cập nhật số dư
        await runTransaction(db, async (transaction) => {
            const txDoc = await transaction.get(txRef);
            if (!txDoc.exists() || txDoc.data().status !== 'pending') throw "Giao dịch không hợp lệ!";
            
            const data = txDoc.data();
            const changeAmount = data.type === "expense" ? -data.amount : data.amount;
            const targetRef = data.campaignId ? doc(db, "groups", currentGroupId, "campaigns", data.campaignId) : doc(db, "groups", currentGroupId);

            // Cập nhật số dư
            transaction.update(targetRef, { balance: increment(changeAmount) });
            // Đổi trạng thái thành approved
            transaction.update(txRef, { status: "approved" });
        });
        alert("Đã duyệt thành công!");
    } catch (error) { alert("Lỗi duyệt: " + error); }
};

// 6. THÊM THÀNH VIÊN
document.getElementById('btn-add-member').addEventListener('click', async () => {
    const newPhone = prompt("Nhập số điện thoại thành viên mới:");
    if (newPhone && newPhone.length >= 9) {
        const groupRef = doc(db, "groups", currentGroupId);
        await updateDoc(groupRef, {
            members: firebase.firestore.FieldValue.arrayUnion(newPhone)
        });
    }
});

// GIỮ LẠI HÀM TẤT TOÁN (closeCampaign)
window.closeCampaign = async (campaignId, campaignName) => {
    /* Code cũ giữ nguyên */
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
