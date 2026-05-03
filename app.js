import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ===== LOGIN GIẢ LẬP =====
let currentUser = null;

function login() {
  const phone = document.getElementById("phone").value;
  if (!phone) return alert("Nhập số điện thoại!");

  currentUser = { id: phone };
  alert("Xin chào " + phone);

  loadGroups();
}

window.login = login;

// ===== TẠO NHÓM =====
async function createGroup() {
  if (!currentUser) return alert("Đăng nhập trước!");

  const name = prompt("Tên nhóm:");
  if (!name) return;

  await addDoc(collection(db, "groups"), {
    name: name,
    balance: 0,
    createdAt: new Date()
  });

  alert("Đã tạo nhóm!");
  loadGroups();
}

window.createGroup = createGroup;

// ===== LOAD DANH SÁCH NHÓM =====
async function loadGroups() {
  const container = document.getElementById("groups");
  container.innerHTML = "";

  const snapshot = await getDocs(collection(db, "groups"));

  snapshot.forEach(doc => {
    const group = doc.data();

    const div = document.createElement("div");
    div.style.background = "white";
    div.style.padding = "10px";
    div.style.marginBottom = "10px";
    div.style.borderRadius = "10px";

    div.innerHTML = `
      <h3>${group.name}</h3>
      <p>Số dư: ${group.balance.toLocaleString()} VND</p>
    `;

    container.appendChild(div);
  });
}
