// 1. Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 2. Cấu hình từ dự án của bạn
const firebaseConfig = {
    apiKey: "AIzaSyBpoi3xuIIiOQXMohVLOITlf0DX9JKbs-4",
    authDomain: "grouppublic-583ac.firebaseapp.com",
    projectId: "grouppublic-583ac",
    storageBucket: "grouppublic-583ac.firebasestorage.app",
    messagingSenderId: "70167414260",
    appId: "1:70167414260:web:8d3111a010959a38a965a1"
};

// 3. Khởi tạo
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 4. Các biến DOM (Giao diện)
const loginScreen = document.getElementById('login-screen');
const mainScreen = document.getElementById('main-screen');
const phoneInput = document.getElementById('phone-input');
const loginBtn = document.getElementById('login-btn');

const btnIncome = document.getElementById('btn-income');
const btnExpense = document.getElementById('btn-expense');

// Biến lưu trữ người dùng hiện tại (Giả lập)
let currentUser = null;

// 5. Logic Giả lập Đăng nhập
loginBtn.addEventListener('click', () => {
    const phone = phoneInput.value.trim();
    if (phone.length < 9) {
        alert("Vui lòng nhập số điện thoại hợp lệ!");
        return;
    }
    
    // Lưu tạm thông tin user
    currentUser = { phone: phone, name: "User " + phone.slice(-3) };
    
    // Đổi giao diện
    loginScreen.classList.add('hidden');
    mainScreen.classList.remove('hidden');
    
    console.log("Đã đăng nhập với số:", currentUser.phone);
    // TODO: Viết hàm lấy dữ liệu nhóm từ Firestore ở đây
});

// 6. Logic Nút Thu/Chi (Chuẩn bị sẵn)
btnIncome.addEventListener('click', () => {
    const amount = prompt("Nhập số tiền THU:");
    if(amount && !isNaN(amount)) {
        console.log("Đang chuẩn bị thu:", amount);
        // TODO: Viết lệnh gửi lên Firestore
    }
});

btnExpense.addEventListener('click', () => {
    const amount = prompt("Nhập số tiền CHI:");
    if(amount && !isNaN(amount)) {
        console.log("Đang chuẩn bị chi:", amount);
        // TODO: Viết lệnh gửi lên Firestore
    }
});
