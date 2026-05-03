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
async function login() {
  const phone = document.getElementById("phone").value;
  if (!phone) return alert("Nhập số điện thoại!");

  currentUser = phone;
  alert("Xin chào " + phone);

  loadGroups();
}
window.login = login;

// ===== TẠO NHÓM =====
async function createGroup() {
  const name = prompt("Tên nhóm:");
  if (!name) return;

  await addDoc(collection(db, "groups"), {
    name,
    owner: currentUser,
    members: [currentUser],
    balance: 0,
    createdAt: new Date()
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

    if (!group.members.includes(currentUser)) return;

    const isOwner = group.owner === currentUser;

    const div = document.createElement("div");
div.className = "card";
    div.style.border = "1px solid #ccc";
    div.style.marginTop = "10px";
    div.style.padding = "10px";

   div.innerHTML = `
  <h3>${group.name}</h3>
  <p class="balance">💰 ${group.balance.toLocaleString()} VND</p>
  <p>👑 ${group.owner}</p>

  <button class="btn-add" onclick="addMoney('${id}', ${group.balance})">+ Thu</button>
  <button class="btn-sub" onclick="spendMoney('${id}', ${group.balance})">- Chi</button>
  
  ${isOwner ? `<button class="btn-member" onclick="addMember('${id}')">+ Thành viên</button>` : ""}

  <button class="btn-history" onclick="viewHistory('${id}')">📜 Lịch sử</button>
`;

    container.appendChild(div);
  });
}

// ===== THÊM THÀNH VIÊN (CHỈ OWNER) =====
async function addMember(groupId) {
  const phone = prompt("Nhập SĐT thành viên:");
  if (!phone) return;

  const snapshot = await getDocs(collection(db, "groups"));

  snapshot.forEach(async docSnap => {
    if (docSnap.id === groupId) {
      const group = docSnap.data();

      if (group.owner !== currentUser) {
        alert("Chỉ chủ nhóm mới thêm được!");
        return;
      }

      if (group.members.includes(phone)) {
        alert("Đã có trong nhóm!");
        return;
      }

      const newMembers = [...group.members, phone];

      await updateDoc(doc(db, "groups", groupId), {
        members: newMembers
      });

      alert("Đã thêm thành viên!");
      loadGroups();
    }
  });
}
window.addMember = addMember;

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
    createdBy: currentUser,
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
    createdBy: currentUser,
    time: new Date()
  });

  loadGroups();
}
window.spendMoney = spendMoney;

// ===== LỊCH SỬ (CÓ THỜI GIAN) =====
async function viewHistory(groupId) {
  const snapshot = await getDocs(collection(db, "transactions"));

  let text = "📜 Lịch sử:\n\n";

  snapshot.forEach(doc => {
    const t = doc.data();

    if (t.groupId === groupId) {
      const date = new Date(t.time.seconds * 1000).toLocaleString();

      text += `${t.type === "income" ? "+ Thu" : "- Chi"}: ${t.amount} VND\n`;
      text += `👤 ${t.createdBy}\n🕒 ${date}\n\n`;
    }
  });

  alert(text || "Chưa có dữ liệu");
}
window.viewHistory = viewHistory;
