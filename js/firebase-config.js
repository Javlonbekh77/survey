import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBnwxhjg82ru2lW7CPhULgxboRiFt_XtZA",
  authDomain: "survey-4b364.firebaseapp.com",
  projectId: "survey-4b364",
  storageBucket: "survey-4b364.firebasestorage.app",
  messagingSenderId: "476946531007",
  appId: "1:476946531007:web:6efa5bfee927965ebdbc0a",
  measurementId: "G-BXF7E97EPW"
};

let app;
let db;
let auth;
let storage;
let isMock = false;

try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
    console.log("✅ Firebase initialized");
} catch (error) {
    console.error("❌ Firebase error, switching to mock mode:", error);
    isMock = true;
}

// Mock Data for "Basic" fallback
const mockData = {
    tests: [
        { id: 'mock1', title: 'Temperament Tahlili', description: 'O\'z xarakteringizni aniqlang', timeLimit: 30, questions: [
            { text: 'Tez-tez kayfiyatingiz o\'zgaradimi?', type: 'weighted', options: [{text: 'Ha', points: 10}, {text: 'Yo\'q', points: 0}] }
        ]},
        { id: 'mock2', title: 'Kasbga Yo\'naltirish', description: 'Qaysi soha sizga mos?', timeLimit: 45, questions: [
            { text: 'Texnika bilan ishlashni yoqtirasizmi?', type: 'weighted', options: [{text: 'Juda ham', points: 10}, {text: 'Yo\'q', points: 0}] }
        ]}
    ],
    groups: [
        { id: 'g1', name: 'PI-101', direction: 'Dasturlash', course: 1, tyutor: 'Jasur Sodiqov', students: [{name: 'Azizov Ali', completedTests: []}] }
    ]
};

export { db, auth, storage, app, isMock, mockData };
