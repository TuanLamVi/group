import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
let currentUser = null;

function login() {
  const phone = document.getElementById("phone").value;

  if (!phone) return alert("Nhập số điện thoại!");

  currentUser = { id: phone };
  alert("Xin chào " + phone);

  loadGroups();
}

function createGroup() {
  if (!currentUser) return alert("Đăng nhập trước!");

  const name = prompt("Tên nhóm:");
  if (!name) return;

  const group = {
    id: Date.now().toString(),
    name,
    members: [currentUser.id],
    balance: 0
  };

  localStorage.setItem(group.id, JSON.stringify(group));
  loadGroups();
}

function loadGroups() {
  const container = document.getElementById("groups");
  container.innerHTML = "";

  Object.keys(localStorage).forEach(key => {
    try {
      const group = JSON.parse(localStorage.getItem(key));

      if (group.members.includes(currentUser.id)) {
        const div = document.createElement("div");
        div.className = "group";

        div.innerHTML = `
          <h3>${group.name}</h3>
          <p class="balance">Số dư: ${group.balance.toLocaleString()} VND</p>
          <div class="actions">
            <button onclick="addMoney('${group.id}')">+ Thu</button>
            <button onclick="spendMoney('${group.id}')">- Chi</button>
          </div>
        `;

        container.appendChild(div);
      }
    } catch (e) {}
  });
}

function addMoney(id) {
  let group = JSON.parse(localStorage.getItem(id));
  const amount = parseInt(prompt("Nhập tiền thu:"));

  if (!amount) return;

  group.balance += amount;
  localStorage.setItem(id, JSON.stringify(group));

  loadGroups();
}

function spendMoney(id) {
  let group = JSON.parse(localStorage.getItem(id));
  const amount = parseInt(prompt("Nhập tiền chi:"));

  if (!amount) return;

  group.balance -= amount;
  localStorage.setItem(id, JSON.stringify(group));

  loadGroups();
}
