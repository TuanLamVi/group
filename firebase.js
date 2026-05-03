// firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

export { db };
