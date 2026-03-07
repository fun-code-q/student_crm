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

// ============================================
// Default Agents Configuration
// ============================================
const DEFAULT_AGENT_COUNT = 5;
const AGENT_COUNT_KEY = 'agent_count';

/** Get the number of agents (stored in localStorage) */
export function getAgentCount() {
    try {
        const stored = localStorage.getItem(AGENT_COUNT_KEY);
        return stored ? parseInt(stored, 10) : DEFAULT_AGENT_COUNT;
    } catch {
        return DEFAULT_AGENT_COUNT;
    }
}

/** Save the number of agents to localStorage */
export function saveAgentCount(count) {
    try {
        localStorage.setItem(AGENT_COUNT_KEY, count.toString());
    } catch (error) {
        console.error('Failed to save agent count:', error);
    }
}

/** Get all agent values based on current count */
export function getAllAgentValues() {
    const count = getAgentCount();
    const values = [];
    for (let i = 1; i <= count; i++) {
        values.push({ value: `agent${i}`, label: `Agent ${i}` });
    }
    return values;
}

export const AGENTS = getAllAgentValues();

// ============================================
// Custom Agent Names (localStorage)
// ============================================
const CUSTOM_AGENTS_KEY = 'custom_agent_names';

/** Get default agents */
export function getDefaultAgents() {
    return getAllAgentValues();
}

/** Get custom agent names from localStorage */
export function getCustomAgentNames() {
    try {
        const stored = localStorage.getItem(CUSTOM_AGENTS_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
}

/** Save custom agent names to localStorage */
export function saveCustomAgentNames(names) {
    try {
        localStorage.setItem(CUSTOM_AGENTS_KEY, JSON.stringify(names));
    } catch (error) {
        console.error('Failed to save custom agent names:', error);
    }
}

/** Get agents with custom names applied */
export function getAgents() {
    const customNames = getCustomAgentNames();
    const agentValues = getAllAgentValues();
    return agentValues.map(agent => ({
        ...agent,
        label: customNames[agent.value] || agent.label
    }));
}

export const PURPOSE_OPTIONS = [
    'Masters',
    'Bachelors',
    'Ausbildung',
    'FSJ',
    'Aupair',
    'Language Visa',
    'Work',
    'Thesis',
    'Other'
];

export const defaultStudentData = {
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phone: '',
    purpose: '',
    purposeOther: '',
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
    undergradDegrees: [], // Array of { degree, institution, year }
    // Postgraduate Section
    postgradCourse: '',
    postgradYear: '',
    postgradCgpa: '',
    postgradUniversity: '',
    postgradDegrees: [], // Array of { degree, institution, year }
    // Custom Academic Sections
    customAcademicSections: [], // Array of { id, title, details }
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


