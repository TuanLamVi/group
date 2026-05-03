// firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// DÁN CONFIG BẠN COPY TỪ FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyBpoi3xuIIiOQXMohVLOITlf0DX9JKbs-4",
  authDomain: "grouppublic-583ac.firebaseapp.com",
  projectId: "grouppublic-583ac"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
