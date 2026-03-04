import { initializeApp } from 'firebase/app';
import {
    getFirestore,
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    query,
    orderBy,
} from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

// ============================================
// Firebase Configuration
// Uses env vars locally, falls back to hardcoded values for GitHub Pages
// Note: Firebase client-side keys are NOT secrets — Security Rules protect data
// ============================================
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
let app;
let db;
let auth;
let firebaseInitialized = false;

try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    firebaseInitialized = !firebaseConfig.apiKey.startsWith('YOUR_');
} catch (error) {
    console.warn('Firebase initialization failed:', error.message);
}

export { firebaseInitialized, auth, signInWithEmailAndPassword, signOut, onAuthStateChanged };

// ============================================
// Default Student Data Shape
// ============================================
export const STATUSES = ['Draft', 'Submitted', 'Flagged', 'Document', 'Admitted', 'Rejected'];

export const AGENTS = [
    { value: 'agent1', label: 'Agent 1' },
    { value: 'agent2', label: 'Agent 2' },
    { value: 'agent3', label: 'Agent 3' },
    { value: 'agent4', label: 'Agent 4' },
    { value: 'agent5', label: 'Agent 5' },
];

export const defaultStudentData = {
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phone: '',
    // Personal Information
    dateOfBirth: '',
    nationality: '',
    passportNumber: '',
    passportExpiryDate: '',
    // Academic Information
    ieltsScore: '',
    toeflScore: '',
    greScore: '',
    undergraduateUniversity: '',
    graduationYear: '',
    // Undergraduate Section
    undergradCourse: '',
    undergradCgpa: '',
    // Postgraduate Section
    postgradCourse: '',
    postgradYear: '',
    postgradCgpa: '',
    postgradUniversity: '',
    // Language Section
    germanLevel: '',
    // Application Tracking
    applicationId: '',
    intakeSemester: '',
    applicationDeadline: '',
    // Given Email
    givenEmail: '',
    givenEmailPassword: '',
    // University & Course
    targetUniversity: '',
    targetCourse: '',
    uniPortalLink: '',
    uniUsername: '',
    uniPassword: '',
    // Status & Notes
    status: 'Draft',
    notes: '',
    // Agent Assignment
    assignedAgent: '',
    // Flag System
    isFlagged: false,
    flagReason: '',
    flaggedBy: '',
    // Payment Status
    paid: false,
    // Documents & Custom
    documents: {},
    customFields: [],
    createdAt: null,
    updatedAt: null,
};

// ============================================
// Document Slots Configuration
// ============================================
export const DOCUMENT_SLOTS = [
    { key: 'sop', label: 'Statement of Purpose (SOP)' },
    { key: 'cv', label: 'Curriculum Vitae (CV)' },
    { key: 'coverLetter', label: 'Cover Letter' },
    { key: 'cert10', label: '10th Certificate' },
    { key: 'cert12', label: '12th Certificate' },
    { key: 'degree', label: 'Degree Certificate' },
    { key: 'pg', label: 'PG Certificate' },
    { key: 'otherCerts', label: 'Other Certificates' },
    { key: 'workExp1', label: 'Work Experience 1' },
    { key: 'workExp2', label: 'Work Experience 2' },
    { key: 'workExp3', label: 'Work Experience 3' },
];

// ============================================
// Firestore CRUD Helpers
// ============================================

/** Fetch all students ordered by creation date */
export async function getStudents() {
    if (!firebaseInitialized) return [];
    const q = query(collection(db, 'students'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Fetch a single student by ID */
export async function getStudent(id) {
    if (!firebaseInitialized) return null;
    const snap = await getDoc(doc(db, 'students', id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
}

/** Create a new student document */
export async function addStudent(data = {}) {
    if (!firebaseInitialized) {
        // Return a mock ID for demo mode
        return `demo-${Date.now()}`;
    }
    const now = new Date().toISOString();
    const docRef = await addDoc(collection(db, 'students'), {
        ...defaultStudentData,
        ...data,
        createdAt: now,
        updatedAt: now,
    });
    return docRef.id;
}

/** Update a student document (partial update) */
export async function updateStudent(id, data) {
    if (!firebaseInitialized) throw new Error('Firebase not configured');
    await updateDoc(doc(db, 'students', id), {
        ...data,
        updatedAt: new Date().toISOString(),
    });
}

/** Delete a student document */
export async function deleteStudent(id) {
    if (!firebaseInitialized) throw new Error('Firebase not configured');
    await deleteDoc(doc(db, 'students', id));
}


