// firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// DÁN CONFIG BẠN COPY TỪ FIREBASE
const firebaseConfig = {
  apiKey: "xxx",
  authDomain: "xxx",
  projectId: "xxx"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
