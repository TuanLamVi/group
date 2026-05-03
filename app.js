import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser = null;

// ===== LOGIN =====
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
    name,
    balance: 0
  });

  loadGroups();
}
window.createGroup = createGroup;

// ===== LOAD NHÓM =====
async function loadGroups() {
  const container = document.getElementById("groups");
  container.innerHTML = "";

  const snapshot = await getDocs(collection(db, "groups"));

  snapshot.forEach(docSnap => {
    const group = docSnap.data();
    const id = docSnap.id;

    const div = document.createElement("div");
    div.style.border = "1px solid #ccc";
    div.style.padding = "10px";
    div.style.marginTop = "10px";

    div.innerHTML = `
      <h3>${group.name}</h3>
      <p>💰 ${group.balance} VND</p>

      <button onclick="addMoney('${id}', ${group.balance})">+ Thu</button>
      <button onclick="spendMoney('${id}', ${group.balance})">- Chi</button>
      <button onclick="viewHistory('${id}')">📜 Lịch sử</button>
    `;

    container.appendChild(div);
  });
}

// ===== THU =====
async function addMoney(id, balance) {
  const amount = parseInt(prompt("Nhập tiền thu:"));
  if (!amount) return;

  await updateDoc(doc(db, "groups", id), {
    balance: balance + amount
  });

  await addDoc(collection(db, "transactions"), {
    groupId: id,
    type: "income",
    amount,
    time: new Date()
  });

  loadGroups();
}
window.addMoney = addMoney;

// ===== CHI =====
async function spendMoney(id, balance) {
  const amount = parseInt(prompt("Nhập tiền chi:"));
  if (!amount) return;

  await updateDoc(doc(db, "groups", id), {
    balance: balance - amount
  });

  await addDoc(collection(db, "transactions"), {
    groupId: id,
    type: "expense",
    amount,
    time: new Date()
  });

  loadGroups();
}
window.spendMoney = spendMoney;

// ===== LỊCH SỬ =====
async function viewHistory(groupId) {
  const snapshot = await getDocs(collection(db, "transactions"));

  let text = "📜 Lịch sử:\n\n";

  snapshot.forEach(doc => {
    const t = doc.data();
    if (t.groupId === groupId) {
      text += `${t.type === "income" ? "+ Thu" : "- Chi"}: ${t.amount} VND\n`;
    }
  });

  alert(text || "Chưa có dữ liệu");
}
window.viewHistory = viewHistory;
