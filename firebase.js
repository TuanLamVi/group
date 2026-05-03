// 1. Import core của Firebase qua đường link CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";

// 2. Lấy thêm Firestore (Database) từ link CDN
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 3. Lấy thêm Auth (Xác thực) từ link CDN
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Cấu hình Firebase của bạn (giữ nguyên)
const firebaseConfig = {
  apiKey: "AIzaSyBpoi3xuIIiOQXMohVLOITlf0DX9JKbs-4",
  authDomain: "grouppublic-583ac.firebaseapp.com",
  projectId: "grouppublic-583ac",
  storageBucket: "grouppublic-583ac.firebasestorage.app",
  messagingSenderId: "70167414260",
  appId: "1:70167414260:web:8d3111a010959a38a965a1"
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);

// Khởi tạo các dịch vụ và xuất (export) để dùng ở nơi khác
export const db = getFirestore(app); 
export const auth = getAuth(app);
