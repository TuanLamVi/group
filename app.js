import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, collection, addDoc, onSnapshot, runTransaction, updateDoc, increment, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
const txCampaignSelect = document.getElementById('tx-campaign-select');

// Trạng thái ứng dụng
let currentUser = null;
let currentGroupId = "demo_group_01"; // ID nhóm giả lập để test
let txType = ""; // 'income' hoặc 'expense'

// 1. XỬ LÝ ĐĂNG NHẬP
document.getElementById('login-btn').addEventListener('click', () => {
    const phone = phoneInput.value.trim();
    if (phone.length < 9) return alert("Nhập số điện thoại hợp lệ!");
    currentUser = { phone, name: "User " + phone.slice(-3) };
    
    loginScreen.classList.add('hidden');
    mainScreen.classList.remove('hidden');
    
    initRealtimeListeners(); // Bắt đầu lắng nghe dữ liệu khi đăng nhập xong
});

// 2. LẮNG NGHE DỮ LIỆU REAL-TIME TỪ FIREBASE
function initRealtimeListeners() {
    // Lắng nghe thông tin quỹ chung
    onSnapshot(doc(db, "groups", currentGroupId), (docSnap) => {
        if (docSnap.exists()) {
            document.getElementById('group-name').innerText = docSnap.data().name || "Nhóm chưa đặt tên";
            document.getElementById('balance').innerText = (docSnap.data().balance || 0).toLocaleString();
        } else {
            document.getElementById('group-name').innerText = "Nhóm chưa tồn tại (Cần tạo trên Firebase)";
        }
    });

    // Lắng nghe các Sự Kiện đang chạy (active)
    onSnapshot(collection(db, "groups", currentGroupId, "campaigns"), (snapshot) => {
        const campaignList = document.getElementById('campaign-list');
        campaignList.innerHTML = '';
        txCampaignSelect.innerHTML = '<option value="">-- Quỹ chung của nhóm --</option>'; // Reset dropdown

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.status === 'active') {
                // Thêm vào danh sách hiển thị
                campaignList.innerHTML += `
                    <div class="campaign-card">
                        <div class="campaign-header">
                            <span>🏕️ ${data.name}</span>
                            <span class="campaign-balance">${data.balance.toLocaleString()} ₫</span>
                        </div>
                        <button class="btn-close-campaign" onclick="window.closeCampaign('${docSnap.id}', '${data.name}')">Tất toán về quỹ chung</button>
                    </div>
                `;
                // Thêm vào dropdown chọn nguồn tiền
                txCampaignSelect.innerHTML += `<option value="${docSnap.id}">Sự kiện: ${data.name}</option>`;
            }
        });
    });
}

// 3. TẠO SỰ KIỆN MỚI
document.getElementById('btn-create-campaign').addEventListener('click', async () => {
    const name = prompt("Nhập tên sự kiện mới (VD: Tour sinh thái Quỳ Châu, Giao lưu văn hóa...):");
    if (!name) return;

    try {
        await addDoc(collection(db, "groups", currentGroupId, "campaigns"), {
            name: name,
            status: "active",
            balance: 0,
            createdAt: serverTimestamp()
        });
        alert("Tạo sự kiện thành công!");
    } catch (error) {
        alert("Lỗi tạo sự kiện: " + error.message);
    }
});

// 4. HIỂN THỊ MODAL THU / CHI
document.getElementById('btn-income').addEventListener('click', () => {
    txType = "income";
    document.getElementById('tx-modal-title').innerText = "Thêm Khoản Thu";
    txModal.classList.remove('hidden');
});

document.getElementById('btn-expense').addEventListener('click', () => {
    txType = "expense";
    document.getElementById('tx-modal-title').innerText = "Thêm Khoản Chi";
    txModal.classList.remove('hidden');
});

document.getElementById('btn-cancel-tx').addEventListener('click', () => {
    txModal.classList.add('hidden');
});

// 5. XỬ LÝ LƯU GIAO DỊCH (THU / CHI)
document.getElementById('btn-submit-tx').addEventListener('click', async () => {
    let amount = parseInt(document.getElementById('tx-amount').value);
    const desc = document.getElementById('tx-desc').value;
    const campaignId = txCampaignSelect.value;

    if (!amount || amount <= 0 || !desc) return alert("Vui lòng nhập đầy đủ số tiền và mô tả!");
    
    // Nếu là chi tiền, số tiền cập nhật vào quỹ sẽ mang dấu âm
    const changeAmount = txType === "expense" ? -amount : amount;

    try {
        if (campaignId) {
            // Cập nhật vào quỹ sự kiện
            const campaignRef = doc(db, "groups", currentGroupId, "campaigns", campaignId);
            await updateDoc(campaignRef, { balance: increment(changeAmount) });
        } else {
            // Cập nhật vào quỹ chung
            const groupRef = doc(db, "groups", currentGroupId);
            await updateDoc(groupRef, { balance: increment(changeAmount) });
        }

        // Lưu lịch sử giao dịch
        await addDoc(collection(db, "groups", currentGroupId, "transactions"), {
            type: txType,
            amount: amount,
            description: desc,
            campaignId: campaignId || null,
            createdBy: currentUser.phone,
            createdAt: serverTimestamp()
        });

        // Đóng modal và reset form
        txModal.classList.add('hidden');
        document.getElementById('tx-amount').value = '';
        document.getElementById('tx-desc').value = '';

    } catch (error) {
        alert("Có lỗi xảy ra: " + error.message);
    }
});

// 6. LOGIC TẤT TOÁN SỰ KIỆN VỀ QUỸ CHUNG (Dùng global window để gọi từ HTML)
window.closeCampaign = async (campaignId, campaignName) => {
    if (!confirm(`Bạn có chắc muốn tất toán sự kiện "${campaignName}"? Số dư sẽ được dồn vào quỹ chung.`)) return;

    const groupRef = doc(db, "groups", currentGroupId);
    const campaignRef = doc(db, "groups", currentGroupId, "campaigns", campaignId);

    try {
        await runTransaction(db, async (transaction) => {
            const groupDoc = await transaction.get(groupRef);
            const campaignDoc = await transaction.get(campaignRef);

            if (!groupDoc.exists() || !campaignDoc.exists()) throw "Dữ liệu không tồn tại!";
            if (campaignDoc.data().status === "closed") throw "Sự kiện đã tất toán!";

            const campaignBalance = campaignDoc.data().balance;
            const newGroupBalance = (groupDoc.data().balance || 0) + campaignBalance;

            // Chuyển tiền từ Sự kiện sang Nhóm
            transaction.update(groupRef, { balance: newGroupBalance });
            transaction.update(campaignRef, { balance: 0, status: "closed" });

            // Lưu 1 bản ghi vào lịch sử quỹ chung
            const txRef = doc(collection(db, "groups", currentGroupId, "transactions"));
            transaction.set(txRef, {
                type: campaignBalance >= 0 ? "income" : "expense",
                amount: Math.abs(campaignBalance),
                description: `Tất toán sự kiện: ${campaignName}`,
                campaignId: null,
                createdBy: "HỆ THỐNG",
                createdAt: serverTimestamp()
            });
        });
        alert("Tất toán thành công!");
    } catch (error) {
        alert("Lỗi tất toán: " + error);
    }
};
