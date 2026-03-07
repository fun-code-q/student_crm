import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import {
    ArrowLeft,
    Save,
    Plus,
    Trash2,
    ExternalLink,
    Shield,
    ChevronRight,
    Eye,
    EyeOff,
    Printer,
    Calendar,
    Globe,
    FileText,
    Hash,
    User,
    GraduationCap,
    Building2,
    Folder,
    StickyNote,
    History,
    Flag,
    Home,
    DollarSign,
    LogOut,
    Copy,
    ClipboardCheck,
} from 'lucide-react';
import {
    getStudent,
    addStudent,
    updateStudent,
    deleteStudent,
    firebaseInitialized,
    defaultStudentData,
    STATUSES,
    getAgents,
    PURPOSE_OPTIONS,
    DOCUMENT_SLOTS,
} from '../lib/firebase';
import DocumentVault from '../components/DocumentVault';
import CustomSelect from '../components/CustomSelect';
import DocumentPreview from '../components/DocumentPreview';
import ConfirmModal from '../components/ConfirmModal';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';

// Utility: safely format any date (Firestore Timestamp, ISO string, Date object)
function formatDate(val, options = {}) {
    if (!val) return null;
    let d;
    if (val?.seconds) {
        // Firestore Timestamp object
        d = new Date(val.seconds * 1000);
    } else if (val instanceof Date) {
        d = val;
    } else {
        d = new Date(val);
    }
    if (isNaN(d.getTime())) return null;
    if (options.dateOnly) return d.toLocaleDateString();
    return d.toLocaleString();
}

// Demo students for when Firebase isn't configured
const DEMO_STUDENTS = {
    'demo-1': {
        id: 'demo-1',
        firstName: 'Aarav',
        middleName: '',
        lastName: 'Sharma',
        email: 'aarav.sharma@email.com',
        phone: '+49 151 1234 5678',
        givenEmail: 'aarav.sharma@tu-munich.de',
        givenEmailPassword: '',
        targetUniversity: 'TU Munich',
        targetCourse: 'M.Sc. Computer Science',
        uniPortalLink: 'https://portal.tum.de',
        uniUsername: 'aarav.sharma',
        uniPassword: '',
        status: 'Submitted',
        notes: 'Student has strong academic background. SOP needs review.',
        documents: {},
        customFields: [
            { label: 'GPA', value: '3.8' },
            { label: 'IELTS Score', value: '7.5' },
        ],
        paid: false,
        createdAt: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days ago
    },
    'demo-2': {
        id: 'demo-2',
        firstName: 'Priya',
        middleName: 'K.',
        lastName: 'Patel',
        email: 'priya.patel@email.com',
        phone: '+49 176 9876 5432',
        givenEmail: '',
        givenEmailPassword: '',
        targetUniversity: 'RWTH Aachen',
        targetCourse: 'M.Sc. Mechanical Engineering',
        uniPortalLink: 'https://online.rwth-aachen.de',
        uniUsername: 'priya.patel',
        uniPassword: '',
        status: 'Admitted',
        notes: 'Admission confirmed. Visa process pending.',
        documents: {},
        customFields: [{ label: 'GPA', value: '3.6' }],
        paid: true,
        createdAt: new Date(Date.now() - 86400000 * 3).toISOString(), // 3 days ago
    },
    'demo-3': {
        id: 'demo-3',
        firstName: 'Rahul',
        middleName: '',
        lastName: 'Desai',
        email: 'rahul.desai@email.com',
        phone: '+49 172 5555 1234',
        givenEmail: '',
        givenEmailPassword: '',
        targetUniversity: 'University of Hamburg',
        targetCourse: 'M.Sc. Data Science',
        uniPortalLink: '',
        uniUsername: '',
        uniPassword: '',
        status: 'Draft',
        notes: 'Still collecting documents.',
        documents: {},
        customFields: [],
        paid: false,
        createdAt: new Date(Date.now() - 86400000 * 10).toISOString(), // 10 days ago
    },
    'demo-4': {
        id: 'demo-4',
        firstName: 'Ananya',
        middleName: '',
        lastName: 'Reddy',
        email: 'ananya.reddy@email.com',
        phone: '+49 157 4444 6789',
        givenEmail: '',
        givenEmailPassword: '',
        targetUniversity: 'TU Berlin',
        targetCourse: 'M.Sc. Electrical Engineering',
        uniPortalLink: 'https://moseskonto.tu-berlin.de',
        uniUsername: 'ananya.reddy',
        uniPassword: '',
        status: 'Rejected',
        notes: 'Application was rejected. Exploring alternate options.',
        documents: {},
        customFields: [{ label: 'IELTS Score', value: '6.5' }],
        paid: false,
        createdAt: new Date(Date.now() - 86400000 * 1).toISOString(), // 1 day ago
    },
};

export default function StudentProfile() {
    const { id } = useParams();
    const navigate = useNavigate(); // Added useNavigate
    const { logout } = useAuth();
    const [student, setStudent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [previewDoc, setPreviewDoc] = useState(null);
    const location = useLocation();
    const [activeTab, setActiveTab] = useState(location.state?.initialTab || 'personal');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const isNew = id === 'new';
    const debounceRef = useRef(null);

    // State for confirmation modals
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [pendingStatus, setPendingStatus] = useState(null);
    const [showAgentModal, setShowAgentModal] = useState(false);
    const [pendingAgent, setPendingAgent] = useState(null);
    const [activityHistory, setActivityHistory] = useState([]);

    // Handle initial tab from location state if provided after load
    useEffect(() => {
        if (location.state?.initialTab) {
            setActiveTab(location.state.initialTab);
        }
    }, [location.state?.initialTab]);

    // Field change handler
    function handleChange(field, value) {
        setStudent((prev) => ({ ...prev, [field]: value }));
    }

    // Centralized activity logger — saves to Firebase activityLog array
    const addActivityLog = useCallback(async (entry) => {
        if (!student) return;
        const logEntry = {
            ...entry,
            timestamp: new Date().toISOString(),
        };
        const currentLog = student.activityLog || [];
        const updatedLog = [...currentLog, logEntry];
        setStudent(prev => ({ ...prev, activityLog: updatedLog }));

        const realId = await ensureStudentExists();
        if (realId && firebaseInitialized) {
            try {
                await updateStudent(realId, { activityLog: updatedLog });
            } catch (err) {
                console.error('Failed to save activity log:', err);
            }
        }
    }, [id, student, firebaseInitialized]);

    // Handle status change with confirmation
    const handleStatusChangeRequest = useCallback((newStatus) => {
        setPendingStatus(newStatus);
        setShowStatusModal(true);
    }, []);

    const handleStatusConfirm = useCallback(async () => {
        if (!pendingStatus || !student) return;
        const oldStatus = student.status || 'Draft';
        if (oldStatus === pendingStatus) {
            setShowStatusModal(false);
            setPendingStatus(null);
            return;
        }

        // Log activity
        addActivityLog({
            action: 'status_changed',
            label: `Status changed from "${oldStatus}" to "${pendingStatus}"`,
            field: 'status',
            oldValue: oldStatus,
            newValue: pendingStatus,
        });

        // Update student state
        handleChange('status', pendingStatus);

        // Save to Firebase
        if (firebaseInitialized) {
            try {
                setSaving(true);
                await updateStudent(id, { status: pendingStatus });
            } catch (err) {
                console.error('Failed to save status:', err);
            } finally {
                setSaving(false);
            }
        }

        setShowStatusModal(false);
        setPendingStatus(null);
    }, [pendingStatus, student, id, addActivityLog]);

    // Handle agent change with confirmation
    const handleAgentChangeRequest = useCallback((newAgent) => {
        setPendingAgent(newAgent);
        setShowAgentModal(true);
    }, []);

    const handleAgentConfirm = useCallback(async () => {
        if (!pendingAgent || !student) return;
        const oldAgent = student.assignedAgent || '';
        if (oldAgent === pendingAgent) {
            setShowAgentModal(false);
            setPendingAgent(null);
            return;
        }
        const currentAgentObj = getAgents().find(a => a.value === student.assignedAgent);
        const newAgentObj = getAgents().find(a => a.value === pendingAgent);
        const oldAgentName = currentAgentObj ? currentAgentObj.label : 'Unassigned';
        const newAgentName = newAgentObj ? newAgentObj.label : 'Unassigned';

        // Log activity
        addActivityLog({
            action: 'agent_changed',
            label: `Agent changed from "${oldAgentName}" to "${newAgentName}"`,
            field: 'assignedAgent',
            oldValue: oldAgentName,
            newValue: newAgentName,
        });

        // Update student state
        handleChange('assignedAgent', pendingAgent);

        // Save to Firebase
        if (firebaseInitialized) {
            try {
                setSaving(true);
                await updateStudent(id, { assignedAgent: pendingAgent });
            } catch (err) {
                console.error('Failed to save agent:', err);
            } finally {
                setSaving(false);
            }
        }

        setShowAgentModal(false);
        setPendingAgent(null);
    }, [pendingAgent, student, id, addActivityLog]);

    // Tab configuration
    const tabs = [
        { id: 'personal', label: 'Personal Information', icon: User },
        { id: 'academic', label: 'Academic Details', icon: GraduationCap },
        { id: 'university', label: 'University & Application', icon: Building2 },
        { id: 'documents', label: 'Documents', icon: Folder },
        { id: 'notes', label: 'Notes', icon: StickyNote },
        { id: 'activity', label: 'Activity/History', icon: History },
    ];

    const studentName = student ? [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' ') || 'New Student' : '';

    // Update header title dynamically
    useEffect(() => {
        const titleEl = document.getElementById('header-title');
        if (!titleEl) return;

        const originalTitle = titleEl.innerText;

        if (studentName) {
            titleEl.innerText = studentName;
        }

        return () => {
            titleEl.innerText = 'Student CRM';
        };
    }, [studentName]);

    // Switch header logo to Home icon
    useEffect(() => {
        const defaultLogo = document.getElementById('header-logo-default');
        if (!defaultLogo) return;

        defaultLogo.style.display = 'none';

        return () => {
            defaultLogo.style.display = 'block';
        };
    }, []);

    // Load student
    useEffect(() => {
        async function load() {
            try {
                if (isNew) {
                    setStudent({ id: 'new', ...defaultStudentData });
                    setLoading(false);
                    return;
                }

                if (firebaseInitialized) {
                    const data = await getStudent(id);
                    setStudent(data || { id, ...defaultStudentData });
                } else {
                    setStudent(DEMO_STUDENTS[id] || { id, ...defaultStudentData });
                }
            } catch (err) {
                console.error('Failed to load student:', err);
                setStudent({ id, ...defaultStudentData });
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [id, isNew, firebaseInitialized]);

    // Internal helper to ensure the student exists in Firebase before updating
    // Returns the real ID (either existing or newly created)
    async function ensureStudentExists() {
        if (id !== 'new') return id;
        if (!student || !student.firstName.trim()) return null;

        try {
            setSaving(true);
            const initialLog = [{
                action: 'profile_created',
                label: 'Student profile created',
                timestamp: new Date().toISOString(),
            }];
            const newId = await addStudent({ ...student, activityLog: initialLog });
            // Update URL without refreshing
            window.history.replaceState(null, '', `#/students/${newId}`);
            // We can't easily change the 'id' from useParams without a navigation,
            // but for the current session we just return the newId.
            // Actually, better to navigate to trigger a clean reload with the new ID
            navigate(`/students/${newId}`, { replace: true, state: location.state });
            return newId;
        } catch (err) {
            console.error('Failed to create student:', err);
            return null;
        } finally {
            setSaving(false);
        }
    }

    // Auto-save on blur with activity logging
    const handleBlurSave = useCallback(
        async (field, value) => {
            if (!student) return;
            const oldValue = student[field];

            // If field is first name and it's being cleared on a new student, don't save
            if (id === 'new' && field === 'firstName' && !value.trim()) return;

            const realId = await ensureStudentExists();
            if (!realId || !firebaseInitialized) return;

            // Only log if value actually changed
            if (oldValue !== value && (oldValue || value)) {
                // We handle the log inside a separate call to avoid recursion or state issues
                // but since we are about to update, let's just do it manually here if it's a real student
                const logEntry = {
                    action: 'field_edited',
                    label: `Updated "${field}"`,
                    field: field,
                    oldValue: oldValue || '(empty)',
                    newValue: value || '(empty)',
                    timestamp: new Date().toISOString()
                };

                try {
                    setSaving(true);
                    await updateStudent(realId, {
                        [field]: value,
                        activityLog: [...(student.activityLog || []), logEntry]
                    });
                } catch (err) {
                    console.error('Auto-save failed:', err);
                } finally {
                    setSaving(false);
                }
            } else {
                try {
                    setSaving(true);
                    await updateStudent(realId, { [field]: value });
                } catch (err) {
                    console.error('Auto-save failed:', err);
                } finally {
                    setSaving(false);
                }
            }
        },
        [id, student, firebaseInitialized, ensureStudentExists]
    );

    // Debounced save for notes
    const handleNotesChange = useCallback(
        async (value) => {
            setStudent((prev) => ({ ...prev, notes: value }));
            clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(async () => {
                const realId = await ensureStudentExists();
                if (!realId || !firebaseInitialized) return;
                try {
                    setSaving(true);
                    await updateStudent(realId, { notes: value });
                } catch (err) {
                    console.error('Auto-save notes failed:', err);
                } finally {
                    setSaving(false);
                }
            }, 500);
        },
        [id, student, firebaseInitialized, ensureStudentExists]
    );

    // Print/Export handler — generates a 6+ page PDF-ready document
    function handlePrint() {
        if (!student) return;
        const name = [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' ') || 'Student';
        const created = formatDate(student.createdAt, { dateOnly: true }) || 'N/A';
        const docs = student.documents || {};
        const logs = student.activityLog || [];
        const agentObj = getAgents().find(a => a.value === student.assignedAgent);
        const agentName = agentObj ? agentObj.label : 'Unassigned';

        // Helper for rendering a field row
        const row = (label, value) => `<tr><td style="padding:6px 12px;font-weight:600;color:#555;width:200px;border-bottom:1px solid #eee">${label}</td><td style="padding:6px 12px;color:#222;border-bottom:1px solid #eee">${value || '—'}</td></tr>`;

        // Helper for section title
        const sectionTitle = (num, title) => `<h2 style="color:#2563eb;font-size:18px;margin:0 0 16px;padding-bottom:8px;border-bottom:2px solid #2563eb">${num}. ${title}</h2>`;

        // Page break style
        const pageBreak = 'page-break-before:always;';

        // Build activity log text
        const activityRows = logs
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .map(item => {
                let icon = '📝';
                switch (item.action) {
                    case 'profile_created': icon = '🆕'; break;
                    case 'field_edited': icon = '✏️'; break;
                    case 'status_changed': icon = '🔄'; break;
                    case 'agent_changed': icon = '👤'; break;
                    case 'document_added': icon = '📎'; break;
                    case 'document_removed': icon = '🗑️'; break;
                    case 'profile_flagged': icon = '🚩'; break;
                    case 'profile_unflagged': icon = '✅'; break;
                    case 'paid_changed': icon = '💰'; break;
                }
                let detail = item.label || item.action;
                if (item.oldValue && item.newValue) detail += ` (${item.oldValue} → ${item.newValue})`;
                const ts = formatDate(item.timestamp) || 'Unknown date';
                return `<tr><td style="padding:5px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;white-space:nowrap;color:#888;width:20px">${icon}</td><td style="padding:5px 10px;border-bottom:1px solid #f0f0f0;font-size:13px">${detail}</td><td style="padding:5px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#999;white-space:nowrap">${ts}</td></tr>`;
            }).join('');

        // Document slots display
        const docRows = DOCUMENT_SLOTS.map(({ key, label }) => {
            const doc = docs[key];
            const status = doc ? `✅ Linked — <a href="${doc.url}" style="color:#2563eb;word-break:break-all">${doc.url}</a>` : '<span style="color:#bbb">Not linked</span>';
            return row(label, status);
        }).join('');

        const html = `<!DOCTYPE html>
<html><head>
<title>${(student.firstName || 'Student').replace(/\s+/g, '')}_${(student.targetUniversity || 'University').replace(/\s+/g, '_')}</title>
<style>
    @page { size: A4; margin: 20mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; line-height: 1.5; margin: 0; padding: 0; }
    .page { page-break-after: always; padding: 0; min-height: 90vh; }
    .page:last-child { page-break-after: auto; }
    table { width: 100%; border-collapse: collapse; }
    .header { background: linear-gradient(135deg, #2563eb, #3b82f6); color: white; padding: 24px 28px; border-radius: 8px; margin-bottom: 24px; }
    .header h1 { margin: 0 0 4px; font-size: 22px; }
    .header p { margin: 0; opacity: 0.85; font-size: 13px; }
    .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .footer { text-align: center; font-size: 11px; color: #aaa; margin-top: 24px; padding-top: 12px; border-top: 1px solid #eee; }
    @media print {
        .page { page-break-after: always; }
        .page:last-child { page-break-after: auto; }
    }
</style>
</head><body>

<!-- PAGE 1: Personal Information -->
<div class="page">
    <div class="header">
        <h1>${name}</h1>
        <p>Student Profile Report • Created: ${created} • Status: ${student.status || 'Draft'} • Agent: ${agentName}</p>
    </div>
    ${sectionTitle(1, 'Personal Information')}
    <div class="card">
        <table>
            ${row('First Name', student.firstName)}
            ${row('Middle Name', student.middleName)}
            ${row('Last Name', student.lastName)}
            ${row('Email', student.email)}
            ${row('Phone', student.phone)}
            ${row('Date of Birth', student.dateOfBirth)}
            ${row('Status', student.status || 'Draft')}
            ${row('Assigned Agent', agentName)}
            ${row('Payment Status', student.paid ? '✅ Paid' : '❌ Unpaid')}
            ${row('Flagged', student.isFlagged ? `🚩 Yes — ${student.flagReason || 'No reason'}` : 'No')}
        </table>
    </div>
    <h3 style="color:#555;font-size:14px;margin:16px 0 8px">Purpose of Application</h3>
    <div class="card">
        <table>
            ${row('Purpose', student.purpose)}
            ${student.purpose === 'Other' ? row('Purpose (Other)', student.purposeOther) : ''}
        </table>
    </div>
    <h3 style="color:#555;font-size:14px;margin:16px 0 8px">Given Email Credentials</h3>
    <div class="card">
        <table>
            ${row('Given Email', student.givenEmail)}
            ${row('Given Email Password', student.givenEmailPassword ? '••••••••' : '—')}
        </table>
    </div>
    <div class="footer">Page 1 — Personal Information</div>
</div>

<!-- PAGE 2: Academic Details -->
<div class="page">
    ${sectionTitle(2, 'Academic Details')}
    <h3 style="color:#555;font-size:14px;margin:0 0 8px">Language & Test Scores</h3>
    <div class="card">
        <table>
            ${row('IELTS Score', student.ieltsScore)}
            ${row('TOEFL Score', student.toeflScore)}
            ${row('GRE Score', student.greScore)}
            ${row('German Language Level', student.germanLevel)}
        </table>
    </div>
    <h3 style="color:#555;font-size:14px;margin:16px 0 8px">10th Standard</h3>
    <div class="card">
        <table>
            ${row('Board', student.board10th)}
            ${row('Score / Percentage', student.score10th)}
            ${row('Year of Completion', student.year10th)}
        </table>
    </div>
    <h3 style="color:#555;font-size:14px;margin:16px 0 8px">12th Standard</h3>
    <div class="card">
        <table>
            ${row('Board', student.board12th)}
            ${row('Score / Percentage', student.score12th)}
            ${row('Year of Completion', student.year12th)}
        </table>
    </div>
    <h3 style="color:#555;font-size:14px;margin:16px 0 8px">Undergraduate</h3>
    <div class="card">
        <table>
            ${row('Course', student.undergradCourse)}
            ${row('CGPA', student.undergradCgpa)}
            ${row('Year of Completion', student.undergradYear)}
            ${row('University', student.undergradUniversity)}
        </table>
    </div>
    <h3 style="color:#555;font-size:14px;margin:16px 0 8px">Postgraduate (if any)</h3>
    <div class="card">
        <table>
            ${row('Course', student.postgradCourse)}
            ${row('CGPA', student.postgradCgpa)}
            ${row('Year of Completion', student.postgradYear)}
            ${row('University', student.postgradUniversity)}
        </table>
    </div>
    <div class="footer">Page 2 — Academic Details</div>
</div>

<!-- PAGE 3: University & Application -->
<div class="page">
    ${sectionTitle(3, 'University & Application')}
    <div class="card">
        <table>
            ${row('Application ID', student.applicationId)}
            ${row('Intake / Semester', student.intakeSemester)}
            ${row('Application Deadline', student.applicationDeadline)}
            ${row('Target University', student.targetUniversity)}
            ${row('Target Course', student.targetCourse)}
            ${row('University Portal Link', student.uniPortalLink ? `<a href="${student.uniPortalLink}" style="color:#2563eb">${student.uniPortalLink}</a>` : '—')}
            ${row('University Username', student.uniUsername)}
            ${row('University Password', student.uniPassword ? '••••••••' : '—')}
        </table>
    </div>
    <div class="footer">Page 3 — University & Application</div>
</div>

<!-- PAGE 4: Documents -->
<div class="page">
    ${sectionTitle(4, 'Documents')}
    <div class="card">
        <table>${docRows}</table>
    </div>
    <div class="footer">Page 4 — Documents</div>
</div>

<!-- PAGE 5: Notes -->
<div class="page">
    ${sectionTitle(5, 'Notes')}
    <div class="card">
        <p style="white-space:pre-wrap;font-size:14px;color:#333;min-height:200px">${student.notes || 'No notes recorded.'}</p>
    </div>
    <div class="footer">Page 5 — Notes</div>
</div>

<!-- PAGE 6+: Activity/History -->
<div class="page">
    ${sectionTitle(6, `Activity / History (${logs.length} entries)`)}
    ${logs.length === 0
                ? '<p style="color:#aaa;text-align:center;padding:40px">No activity recorded yet.</p>'
                : `<table style="font-size:13px">${activityRows}</table>`
            }
    <div class="footer">Page 6 — Activity / History • Generated on ${new Date().toLocaleString()}</div>
</div>

</body></html>`;

        const printWin = window.open('', '_blank', 'width=800,height=1000');
        printWin.document.write(html);
        printWin.document.close();
        printWin.focus();
        setTimeout(() => printWin.print(), 500);
    }


    const handleToggleFlag = useCallback(async () => {
        if (!student) return;
        const newFlagged = !student.isFlagged;
        const reason = newFlagged ? window.prompt('Enter reason for flagging (optional):') || '' : '';

        // Log activity
        addActivityLog({
            action: newFlagged ? 'profile_flagged' : 'profile_unflagged',
            label: newFlagged ? `Profile flagged${reason ? `: "${reason}"` : ''}` : 'Profile unflagged',
        });

        try {
            if (firebaseInitialized) {
                await updateStudent(id, {
                    isFlagged: newFlagged,
                    flagReason: reason,
                    flaggedBy: newFlagged ? 'Agent' : ''
                });
            }
            setStudent(prev => ({
                ...prev,
                isFlagged: newFlagged,
                flagReason: reason,
                flaggedBy: newFlagged ? 'Agent' : ''
            }));
        } catch (err) {
            console.error('Failed to toggle flag:', err);
        }
    }, [id, student, addActivityLog]);

    // Handle paid toggle
    const handleTogglePaid = useCallback(async () => {
        if (!student) return;
        const newPaid = !student.paid;

        // Log activity
        addActivityLog({
            action: 'paid_changed',
            label: newPaid ? 'Payment marked as Paid' : 'Payment marked as Unpaid',
        });

        try {
            if (firebaseInitialized) {
                await updateStudent(id, { paid: newPaid });
            }
            setStudent(prev => ({ ...prev, paid: newPaid }));
        } catch (err) {
            console.error('Failed to toggle paid status:', err);
        }
    }, [id, student, addActivityLog]);

    // Handle profile deletion
    const handleDeleteProfile = useCallback(async () => {
        try {
            if (firebaseInitialized) {
                await deleteStudent(id);
            }
            navigate('/', { replace: true });
        } catch (err) {
            console.error('Failed to delete student:', err);
            alert('Failed to delete student: ' + err.message);
        }
    }, [id, navigate, firebaseInitialized]);



    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (err) {
            console.error('Logout failed:', err);
        }
    };

    // Custom fields handlers
    function addCustomField() {
        const updated = [...(student.customFields || []), { label: '', value: '' }];
        setStudent((prev) => ({ ...prev, customFields: updated }));
        if (firebaseInitialized) updateStudent(id, { customFields: updated });
    }

    function updateCustomField(index, key, val) {
        const updated = [...(student.customFields || [])];
        updated[index] = { ...updated[index], [key]: val };
        setStudent((prev) => ({ ...prev, customFields: updated }));
    }

    function saveCustomFields() {
        if (firebaseInitialized) updateStudent(id, { customFields: student.customFields || [] });
    }

    function removeCustomField(index) {
        const updated = (student.customFields || []).filter((_, i) => i !== index);
        setStudent((prev) => ({ ...prev, customFields: updated }));
        if (firebaseInitialized) updateStudent(id, { customFields: updated });
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            </div>
        );
    }

    if (!student) {
        return (
            <div className="text-center py-16">
                <p className="text-neutral-500">Student not found.</p>
                <Link to="/" className="btn-primary mt-4 inline-flex">
                    Back to Dashboard
                </Link>
            </div>
        );
    }

    const statusIndex = STATUSES.indexOf(student.status || 'Draft');

    return (
        <div className="max-w-5xl mx-auto">
            {/* Header Logo Portal */}
            {document.getElementById('header-logo-portal') && createPortal(
                <Home size={18} className="text-white" />,
                document.getElementById('header-logo-portal')
            )}

            {/* Header Actions Portal */}
            {document.getElementById('header-actions') && createPortal(
                <>
                    {student.createdAt && (
                        <div className="flex items-center gap-2">
                            <div className="flex items-center text-xs text-neutral-500 bg-neutral-100 rounded-full px-3 py-1.5" title="Profile Created Date">
                                <Calendar size={12} className="mr-1.5" />
                                <span>{formatDate(student.createdAt, { dateOnly: true }) || 'Unknown'}</span>
                            </div>
                            <button
                                onClick={() => setActiveTab('notes')}
                                className={`p-1.5 rounded-full transition-colors ${activeTab === 'notes' ? 'bg-primary-100 text-primary-600' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'}`}
                                title="Go to Notes"
                            >
                                <StickyNote size={14} />
                            </button>
                            <button
                                onClick={() => setActiveTab('activity')}
                                className={`p-1.5 rounded-full transition-colors ${activeTab === 'activity' ? 'bg-primary-100 text-primary-600' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'}`}
                                title="Go to Activity"
                            >
                                <History size={14} />
                            </button>
                        </div>
                    )}

                    <div className="flex items-center bg-neutral-100 rounded-full px-3 py-1">
                        <span className="text-xs text-neutral-500 font-medium whitespace-nowrap hidden sm:inline-block mr-1">Agent:</span>
                        <select
                            value={student.assignedAgent || ''}
                            onChange={(e) => {
                                const newAgent = e.target.value;
                                handleAgentChangeRequest(newAgent);
                            }}
                            className="bg-transparent border-none text-xs font-semibold text-neutral-700 focus:ring-0 outline-none cursor-pointer appearance-none hover:text-primary-600 transition-colors"
                            title="Assigned Agent"
                        >
                            <option value="">Unassigned</option>
                            {getAgents().map(a => (
                                <option key={a.value} value={a.value}>{a.label}</option>
                            ))}
                        </select>
                    </div>

                    <select
                        value={student.status || 'Draft'}
                        onChange={(e) => {
                            const newStatus = e.target.value;
                            handleStatusChangeRequest(newStatus);
                        }}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-full border-none focus:ring-2 focus:ring-primary-300 outline-none cursor-pointer appearance-none ${student.status === 'Submitted' ? 'bg-primary-50 text-primary-700' :
                            student.status === 'Flagged' ? 'bg-red-100 text-red-700' :
                                student.status === 'Document Collection' ? 'bg-amber-100 text-amber-700' :
                                    student.status === 'Admitted' ? 'bg-green-50 text-green-700' :
                                        student.status === 'Rejected' ? 'bg-red-50 text-red-700' :
                                            'bg-neutral-100 text-neutral-600'
                            }`}
                        title="Application Status"
                    >
                        {STATUSES.map(s => (
                            <option key={s} value={s} className="bg-white text-neutral-800">{s}</option>
                        ))}
                    </select>

                    <button
                        onClick={handleTogglePaid}
                        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${student.paid ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-neutral-100 text-neutral-400 hover:text-green-600 hover:bg-green-50'
                            }`}
                        title={student.paid ? 'Payment Received' : 'Mark as Paid'}
                    >
                        <DollarSign size={14} />
                        <span className="text-xs font-semibold">Paid</span>
                    </button>

                    <button
                        onClick={handleToggleFlag}
                        className={`inline-flex items-center justify-center p-2 rounded-full transition-colors ${student.isFlagged ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-neutral-100 text-neutral-400 hover:text-red-400 hover:bg-red-50'
                            }`}
                        title={student.isFlagged ? (student.flagReason || 'Flagged') : 'Flag this student'}
                    >
                        <Flag size={16} fill={student.isFlagged ? 'currentColor' : 'none'} />
                    </button>

                    <button
                        onClick={handlePrint}
                        className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-none border hover:bg-neutral-50"
                        title="Print student profile"
                    >
                        <Printer size={14} />
                        Print
                    </button>

                    {/* Delete Button */}
                    <button
                        onClick={() => setShowDeleteModal(true)}
                        className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-none border bg-red-50 border-red-100 text-red-600 hover:bg-red-100"
                        title="Delete student profile"
                    >
                        <Trash2 size={14} />
                        Delete Profile
                    </button>

                    {/* Logout Button */}
                    <button
                        onClick={handleLogout}
                        className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-none border text-red-600 hover:bg-red-50 hover:border-red-200"
                        title="Sign Out"
                    >
                        <LogOut size={14} />
                        Logout
                    </button>
                </>
                ,
                document.getElementById('header-actions')
            )}

            {/* Saving indicator */}
            {
                saving && (
                    <div className="fixed top-4 right-4 bg-primary-600 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2 z-30 animate-fadeIn shadow-lg">
                        <Save size={12} />
                        Saving…
                    </div>
                )
            }

            {/* Tab Navigation */}
            <div className="card mb-6 animate-fadeIn">
                <div className="flex overflow-x-auto scrollbar-thin">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab.id
                                    ? 'border-primary-600 text-primary-600 bg-primary-50/50'
                                    : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
                                    }`}
                            >
                                <Icon size={16} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tab Content */}
            <div className="animate-fadeIn">
                {activeTab === 'personal' && (
                    <PersonalTab student={student} onChange={handleChange} onBlurSave={handleBlurSave} />
                )}
                {activeTab === 'academic' && (
                    <AcademicTab student={student} onChange={handleChange} onBlurSave={handleBlurSave} />
                )}
                {activeTab === 'university' && (
                    <UniversityTab student={student} onChange={handleChange} onBlurSave={handleBlurSave} onToggleFlag={handleToggleFlag} />
                )}
                {activeTab === 'documents' && (
                    <DocumentsTab student={student} setStudent={setStudent} />
                )}
                {activeTab === 'notes' && (
                    <NotesTab student={student} onNotesChange={handleNotesChange} />
                )}
                {activeTab === 'activity' && (
                    <ActivityTab student={student} activityHistory={activityHistory} onAgentChangeRequest={handleAgentChangeRequest} onChange={handleChange} onBlurSave={handleBlurSave} />
                )}
            </div>

            {/* Document Preview Modal */}
            {
                previewDoc && (
                    <DocumentPreview document={previewDoc} onClose={() => setPreviewDoc(null)} />
                )
            }

            {/* Delete Confirmation Modal */}
            {
                showDeleteModal && (
                    <ConfirmModal
                        isOpen={showDeleteModal}
                        onClose={() => setShowDeleteModal(false)}
                        onConfirm={handleDeleteProfile}
                        title="Delete Student Profile"
                        message="Are you sure you want to delete this student profile? This action cannot be undone."
                        confirmText="Delete"
                        cancelText="Cancel"
                        type="danger"
                    />
                )
            }

            {/* Status Change Confirmation Modal */}
            {
                showStatusModal && (
                    <ConfirmModal
                        isOpen={showStatusModal}
                        onClose={() => {
                            setShowStatusModal(false);
                            setPendingStatus(null);
                        }}
                        onConfirm={handleStatusConfirm}
                        title="Confirm Status Change"
                        message={`Are you sure you want to change the status from "${student?.status || 'Draft'}" to "${pendingStatus}"?`}
                        confirmText="Save"
                        cancelText="Cancel"
                        type="info"
                    />
                )
            }

            {/* Agent Change Confirmation Modal */}
            {
                showAgentModal && (
                    <ConfirmModal
                        isOpen={showAgentModal}
                        onClose={() => {
                            setShowAgentModal(false);
                            setPendingAgent(null);
                        }}
                        onConfirm={handleAgentConfirm}
                        title="Confirm Agent Change"
                        message={`Are you sure you want to change the assigned agent from "${getAgents().find(a => a.value === student?.assignedAgent)?.label || 'Unassigned'}" to "${getAgents().find(a => a.value === pendingAgent)?.label || 'Unassigned'}"?`}
                        confirmText="Save"
                        cancelText="Cancel"
                        type="info"
                    />
                )
            }
        </div >
    );
}

// =============== Reusable Field Component ===============
function Field({ label, value, onChange, onBlur, type = 'text', placeholder, required = false }) {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword && showPassword ? 'text' : type;

    return (
        <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                {label}
                {required && <span className="text-danger ml-0.5">*</span>}
            </label>
            <div className="relative">
                <input
                    type={inputType}
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={onBlur}
                    placeholder={placeholder || label}
                    className={`input-field pr-10 ${isPassword ? 'tracking-wider' : ''}`}
                    required={required}
                />
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                        title={showPassword ? 'Hide password' : 'Show password'}
                    >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                )}
            </div>
        </div>
    );
}

// =============== Tab Components ===============

// Personal Information Tab
function PersonalTab({ student, onChange, onBlurSave }) {
    return (
        <section className="card p-6 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Field label="First Name" value={student.firstName} onChange={(v) => onChange('firstName', v)} onBlur={() => onBlurSave('firstName', student.firstName)} required />
                <Field label="Middle Name (Optional)" value={student.middleName} onChange={(v) => onChange('middleName', v)} onBlur={() => onBlurSave('middleName', student.middleName)} />
                <Field label="Last Name" value={student.lastName} onChange={(v) => onChange('lastName', v)} onBlur={() => onBlurSave('lastName', student.lastName)} required />
                <Field label="Email" type="email" value={student.email} onChange={(v) => onChange('email', v)} onBlur={() => onBlurSave('email', student.email)} required />
                <Field label="Phone" type="tel" value={student.phone} onChange={(v) => onChange('phone', v)} onBlur={() => onBlurSave('phone', student.phone)} />
                <Field label="Date of Birth" type="date" value={student.dateOfBirth} onChange={(v) => onChange('dateOfBirth', v)} onBlur={() => onBlurSave('dateOfBirth', student.dateOfBirth)} />
                <div className="flex flex-col gap-1.5">
                    <label className="block text-xs font-medium text-neutral-500">Purpose</label>
                    <CustomSelect
                        value={student.purpose || ''}
                        onChange={(v) => onChange('purpose', v)}
                        options={PURPOSE_OPTIONS.map(opt => ({ value: opt, label: opt }))}
                        placeholder="Select Purpose"
                    />
                </div>
                {student.purpose === 'Other' && (
                    <Field
                        label="Specify Purpose"
                        value={student.purposeOther}
                        onChange={(v) => onChange('purposeOther', v)}
                        onBlur={() => onBlurSave('purposeOther', student.purposeOther)}
                        placeholder="Type what it is..."
                    />
                )}
            </div>

            <div className="mt-6 pt-6 border-t border-neutral-100">
                <h4 className="text-md font-semibold text-neutral-700 mb-4 flex items-center gap-2">
                    <Shield size={18} className="text-primary-600" />
                    Given Email Credentials
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Given Email" type="email" value={student.givenEmail} onChange={(v) => onChange('givenEmail', v)} onBlur={() => onBlurSave('givenEmail', student.givenEmail)} />
                    <Field label="Given Email Password" type="password" value={student.givenEmailPassword} onChange={(v) => onChange('givenEmailPassword', v)} onBlur={() => onBlurSave('givenEmailPassword', student.givenEmailPassword)} />
                </div>
            </div>
        </section>
    );
}

// Academic Details Tab
function AcademicTab({ student, onChange, onBlurSave }) {
    const germanLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Native'];

    // Initialize arrays if undefined
    const undergradDegrees = student.undergradDegrees || [];
    const postgradDegrees = student.postgradDegrees || [];
    const customAcademicSections = student.customAcademicSections || [];

    // Handler for adding a new undergraduate degree
    const addUndergradDegree = () => {
        const newDegrees = [...undergradDegrees, { degree: '', institution: '', year: '' }];
        onChange('undergradDegrees', newDegrees);
    };

    // Handler for updating an undergraduate degree
    const updateUndergradDegree = (index, field, value) => {
        const newDegrees = undergradDegrees.map((d, i) =>
            i === index ? { ...d, [field]: value } : d
        );
        onChange('undergradDegrees', newDegrees);
    };

    // Handler for removing an undergraduate degree
    const removeUndergradDegree = (index) => {
        const newDegrees = undergradDegrees.filter((_, i) => i !== index);
        onChange('undergradDegrees', newDegrees);
    };

    // Handler for adding a new postgraduate degree
    const addPostgradDegree = () => {
        const newDegrees = [...postgradDegrees, { degree: '', institution: '', year: '' }];
        onChange('postgradDegrees', newDegrees);
    };

    // Handler for updating a postgraduate degree
    const updatePostgradDegree = (index, field, value) => {
        const newDegrees = postgradDegrees.map((d, i) =>
            i === index ? { ...d, [field]: value } : d
        );
        onChange('postgradDegrees', newDegrees);
    };

    // Handler for removing a postgraduate degree
    const removePostgradDegree = (index) => {
        const newDegrees = postgradDegrees.filter((_, i) => i !== index);
        onChange('postgradDegrees', newDegrees);
    };

    // Handler for adding a custom academic section
    const addCustomSection = () => {
        const newSections = [...customAcademicSections, { id: Date.now(), title: '', details: '' }];
        onChange('customAcademicSections', newSections);
    };

    // Handler for updating a custom academic section
    const updateCustomSection = (index, field, value) => {
        const newSections = customAcademicSections.map((s, i) =>
            i === index ? { ...s, [field]: value } : s
        );
        onChange('customAcademicSections', newSections);
    };

    // Handler for removing a custom academic section
    const removeCustomSection = (index) => {
        const newSections = customAcademicSections.filter((_, i) => i !== index);
        onChange('customAcademicSections', newSections);
    };

    return (
        <section className="card p-6 animate-fadeIn">
            {/* Language Scores - All in one row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Field label="IELTS Score" value={student.ieltsScore} onChange={(v) => onChange('ieltsScore', v)} onBlur={() => onBlurSave('ieltsScore', student.ieltsScore)} placeholder="e.g., 7.5" />
                <Field label="TOEFL Score" value={student.toeflScore} onChange={(v) => onChange('toeflScore', v)} onBlur={() => onBlurSave('toeflScore', student.toeflScore)} placeholder="e.g., 100" />
                <Field label="GRE Score" value={student.greScore} onChange={(v) => onChange('greScore', v)} onBlur={() => onBlurSave('greScore', student.greScore)} placeholder="e.g., 320" />
                <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                        German Language Level
                    </label>
                    <select
                        value={student.germanLevel || ''}
                        onChange={(e) => onChange('germanLevel', e.target.value)}
                        onBlur={() => onBlurSave('germanLevel', student.germanLevel)}
                        className="input-field"
                    >
                        <option value="">Select Level</option>
                        {germanLevels.map(level => (
                            <option key={level} value={level}>{level}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Undergraduate Section */}
            <div className="mt-6 pt-6 border-t border-neutral-100">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-md font-semibold text-neutral-700 flex items-center gap-2">
                        <GraduationCap size={18} className="text-primary-600" />
                        Undergraduate
                    </h4>
                    <button
                        type="button"
                        onClick={addUndergradDegree}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 text-xs font-medium transition-colors"
                    >
                        <Plus size={14} />
                        Add Degree
                    </button>
                </div>

                {/* Primary Undergraduate Fields */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <Field label="Course" value={student.undergradCourse} onChange={(v) => onChange('undergradCourse', v)} onBlur={() => onBlurSave('undergradCourse', student.undergradCourse)} placeholder="e.g., B.Tech Computer Science" />
                    <Field label="University" value={student.undergradUniversity} onChange={(v) => onChange('undergradUniversity', v)} onBlur={() => onBlurSave('undergradUniversity', student.undergradUniversity)} placeholder="e.g., University of Delhi" />
                    <Field label="Year of Completion" value={student.undergradYear} onChange={(v) => onChange('undergradYear', v)} onBlur={() => onBlurSave('undergradYear', student.undergradYear)} placeholder="e.g., 2024" />
                    <Field label="CGPA" value={student.undergradCgpa} onChange={(v) => onChange('undergradCgpa', v)} onBlur={() => onBlurSave('undergradCgpa', student.undergradCgpa)} placeholder="e.g., 8.5" />
                </div>

                {/* Additional Undergraduate Degrees */}
                {undergradDegrees.map((ug, index) => (
                    <div key={index} className="mt-4 pt-4 border-t border-dashed border-neutral-200 animate-slideDown">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Additional Undergraduate Degree #{index + 2}</span>
                            <button
                                type="button"
                                onClick={() => removeUndergradDegree(index)}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-danger hover:bg-danger/10 text-xs font-medium transition-colors"
                            >
                                <Trash2 size={12} />
                                Remove
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Field
                                label="Course"
                                value={ug.degree}
                                onChange={(v) => updateUndergradDegree(index, 'degree', v)}
                                placeholder="e.g., B.Sc. Physics"
                            />
                            <Field
                                label="University"
                                value={ug.institution}
                                onChange={(v) => updateUndergradDegree(index, 'institution', v)}
                                placeholder="e.g., University of Mumbai"
                            />
                            <Field
                                label="Year"
                                value={ug.year}
                                onChange={(v) => updateUndergradDegree(index, 'year', v)}
                                placeholder="e.g., 2022"
                            />
                            <Field
                                label="CGPA/Score"
                                value={ug.score || ''}
                                onChange={(v) => updateUndergradDegree(index, 'score', v)}
                                placeholder="e.g., 9.0"
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* Postgraduate Section */}
            <div className="mt-6 pt-6 border-t border-neutral-100">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-md font-semibold text-neutral-700 flex items-center gap-2">
                        <GraduationCap size={18} className="text-primary-600" />
                        Previous Masters (if any)
                    </h4>
                    <button
                        type="button"
                        onClick={addPostgradDegree}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 text-xs font-medium transition-colors"
                    >
                        <Plus size={14} />
                        Add Masters
                    </button>
                </div>

                {/* Primary Postgraduate Fields */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <Field label="Course" value={student.postgradCourse} onChange={(v) => onChange('postgradCourse', v)} onBlur={() => onBlurSave('postgradCourse', student.postgradCourse)} placeholder="e.g., M.Sc. Data Science" />
                    <Field label="University" value={student.postgradUniversity} onChange={(v) => onChange('postgradUniversity', v)} onBlur={() => onBlurSave('postgradUniversity', student.postgradUniversity)} placeholder="e.g., TU Munich" />
                    <Field label="Year of Completion" value={student.postgradYear} onChange={(v) => onChange('postgradYear', v)} onBlur={() => onBlurSave('postgradYear', student.postgradYear)} placeholder="e.g., 2026" />
                    <Field label="CGPA" value={student.postgradCgpa} onChange={(v) => onChange('postgradCgpa', v)} onBlur={() => onBlurSave('postgradCgpa', student.postgradCgpa)} placeholder="e.g., 8.0" />
                </div>

                {/* Additional Postgraduate Degrees */}
                {postgradDegrees.map((pg, index) => (
                    <div key={index} className="mt-4 pt-4 border-t border-dashed border-neutral-200 animate-slideDown">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Additional Master's Degree #{index + 2}</span>
                            <button
                                type="button"
                                onClick={() => removePostgradDegree(index)}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-danger hover:bg-danger/10 text-xs font-medium transition-colors"
                            >
                                <Trash2 size={12} />
                                Remove
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Field
                                label="Course"
                                value={pg.degree}
                                onChange={(v) => updatePostgradDegree(index, 'degree', v)}
                                placeholder="e.g., M.Tech Computer Science"
                            />
                            <Field
                                label="University"
                                value={pg.institution}
                                onChange={(v) => updatePostgradDegree(index, 'institution', v)}
                                placeholder="e.g., IIT Delhi"
                            />
                            <Field
                                label="Year"
                                value={pg.year}
                                onChange={(v) => updatePostgradDegree(index, 'year', v)}
                                placeholder="e.g., 2024"
                            />
                            <Field
                                label="CGPA/Score"
                                value={pg.score || ''}
                                onChange={(v) => updatePostgradDegree(index, 'score', v)}
                                placeholder="e.g., 8.5"
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* Custom Academic Sections */}
            <div className="mt-6 pt-6 border-t border-neutral-100">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-md font-semibold text-neutral-700 flex items-center gap-2">
                        <GraduationCap size={18} className="text-primary-600" />
                        Additional Academic Information
                    </h4>
                    <button
                        type="button"
                        onClick={addCustomSection}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 text-xs font-medium transition-colors"
                    >
                        <Plus size={14} />
                        Add Section
                    </button>
                </div>

                <div className="space-y-6">
                    {customAcademicSections.map((section, index) => (
                        <div key={section.id} className="pt-4 border-t border-dashed border-neutral-200 animate-slideDown first:border-t-0 first:pt-0">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Additional Information #{index + 1}</span>
                                <button
                                    type="button"
                                    onClick={() => removeCustomSection(index)}
                                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-danger hover:bg-danger/10 text-xs font-medium transition-colors"
                                >
                                    <Trash2 size={12} />
                                    Remove
                                </button>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="block text-xs font-medium text-neutral-500">Section Title</label>
                                        <input
                                            type="text"
                                            value={section.title}
                                            onChange={(e) => updateCustomSection(index, 'title', e.target.value)}
                                            placeholder="e.g., PhD, Certificate Course, Internship"
                                            className="input-field"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="block text-xs font-medium text-neutral-500">Details</label>
                                    <textarea
                                        value={section.details}
                                        onChange={(e) => updateCustomSection(index, 'details', e.target.value)}
                                        placeholder="Enter additional details and descriptions..."
                                        rows={3}
                                        className="input-field resize-y min-h-[80px]"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {customAcademicSections.length === 0 && (
                    <div className="text-center py-6 bg-neutral-50 rounded-xl border border-dashed border-neutral-200">
                        <p className="text-sm text-neutral-400">Click the "+ Add Section" button to include more academic history</p>
                    </div>
                )}
            </div>

            {/* Language Section - moved to row above with IELTS/TOEFL */}
        </section>
    );
}

// University & Application Tab
function UniversityTab({ student, onChange, onBlurSave, onToggleFlag }) {
    const statusIndex = STATUSES.indexOf(student.status || 'Draft');

    return (
        <section className="card p-6 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Application ID" value={student.applicationId} onChange={(v) => onChange('applicationId', v)} onBlur={() => onBlurSave('applicationId', student.applicationId)} placeholder="e.g., APP-2026-001" />
                <Field label="Intake / Semester" value={student.intakeSemester} onChange={(v) => onChange('intakeSemester', v)} onBlur={() => onBlurSave('intakeSemester', student.intakeSemester)} placeholder="e.g., Winter 2026" />
                <Field label="Application Deadline" type="date" value={student.applicationDeadline} onChange={(v) => onChange('applicationDeadline', v)} onBlur={() => onBlurSave('applicationDeadline', student.applicationDeadline)} />
                <Field label="Target University" value={student.targetUniversity} onChange={(v) => onChange('targetUniversity', v)} onBlur={() => onBlurSave('targetUniversity', student.targetUniversity)} required />
                <Field label="Target Course" value={student.targetCourse} onChange={(v) => onChange('targetCourse', v)} onBlur={() => onBlurSave('targetCourse', student.targetCourse)} required />
                <Field label="University Portal Link" value={student.uniPortalLink} onChange={(v) => onChange('uniPortalLink', v)} onBlur={() => onBlurSave('uniPortalLink', student.uniPortalLink)} placeholder="https://portal.university.de" />
                <Field label="University Username" value={student.uniUsername} onChange={(v) => onChange('uniUsername', v)} onBlur={() => onBlurSave('uniUsername', student.uniUsername)} />
                <Field label="University Password" type="password" value={student.uniPassword} onChange={(v) => onChange('uniPassword', v)} onBlur={() => onBlurSave('uniPassword', student.uniPassword)} />
            </div>
        </section>
    );
}

// Documents Tab
function DocumentsTab({ student, setStudent }) {
    return (
        <section className="animate-fadeIn">
            <DocumentVault
                studentId={student.id}
                studentData={{ firstName: student.firstName, lastName: student.lastName }}
                documents={student.documents || {}}
                customSlots={student.customDocumentSlots || []}
                activityLog={student.activityLog || []}
                onUpdate={(docs) => setStudent((prev) => ({ ...prev, documents: docs }))}
                onCustomSlotsUpdate={(slots) => setStudent((prev) => ({ ...prev, customDocumentSlots: slots }))}
                onActivityUpdate={(log) => setStudent((prev) => ({ ...prev, activityLog: log }))}
            />
        </section>
    );
}

// Notes Tab
function NotesTab({ student, onNotesChange }) {
    return (
        <section className="card p-6 animate-fadeIn">
            <textarea
                value={student.notes || ''}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder="Add notes about this student's application…"
                rows={10}
                className="input-field resize-y"
            />
            <p className="text-xs text-neutral-400 mt-2">Changes are auto-saved</p>
        </section>
    );
}

// Activity/History Tab
function ActivityTab({ student, activityHistory, onAgentChangeRequest, onChange, onBlurSave }) {
    const [copied, setCopied] = useState(false);

    // Read from the unified activityLog stored in Firebase
    const logs = student.activityLog || [];

    // Map each log entry to a display format
    const allActivities = logs.map((item) => {
        let icon = '📝';
        let color = 'bg-neutral-400';

        switch (item.action) {
            case 'profile_created':
                icon = '🆕'; color = 'bg-green-500'; break;
            case 'field_edited':
                icon = '✏️'; color = 'bg-blue-400'; break;
            case 'status_changed':
                icon = '🔄'; color = 'bg-blue-600'; break;
            case 'agent_changed':
                icon = '👤'; color = 'bg-purple-500'; break;
            case 'document_added':
                icon = '📎'; color = 'bg-emerald-500'; break;
            case 'document_removed':
                icon = '🗑️'; color = 'bg-orange-500'; break;
            case 'profile_flagged':
                icon = '🚩'; color = 'bg-red-500'; break;
            case 'profile_unflagged':
                icon = '✅'; color = 'bg-green-500'; break;
            case 'paid_changed':
                icon = '💰'; color = 'bg-yellow-500'; break;
            default:
                icon = '📝'; color = 'bg-neutral-400';
        }

        return {
            date: item.timestamp,
            label: item.label || item.action,
            icon,
            color,
            oldValue: item.oldValue,
            newValue: item.newValue,
        };
    }).sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return db - da; // newest first
    });

    // Copy log to clipboard as plain text
    function handleCopyLog() {
        const text = allActivities.map((a) => {
            let line = `${a.icon} ${a.label}`;
            if (a.oldValue && a.newValue) line += ` (${a.oldValue} → ${a.newValue})`;
            line += ` — ${formatDate(a.date) || 'Unknown date'}`;
            return line;
        }).join('\n');
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }

    return (
        <section className="card p-0 animate-fadeIn flex flex-col" style={{ maxHeight: '70vh' }}>
            {/* Fixed Header */}
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between shrink-0">
                <h3 className="text-md font-semibold text-neutral-700 flex items-center gap-2">
                    <History size={18} className="text-primary-600" />
                    Activity Log ({allActivities.length} entries)
                </h3>
                <button
                    onClick={handleCopyLog}
                    className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-primary-600 bg-neutral-100 hover:bg-primary-50 rounded-lg px-2.5 py-1.5 transition-colors"
                    title="Copy all activity log to clipboard"
                >
                    {copied ? (
                        <><ClipboardCheck size={14} className="text-green-600" /><span className="text-green-600 font-medium">Copied!</span></>
                    ) : (
                        <><Copy size={14} /><span>Copy Log</span></>
                    )}
                </button>
            </div>

            {/* Scrollable Log */}
            <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
                {allActivities.length === 0 ? (
                    <p className="text-sm text-neutral-400 text-center py-8">
                        No activity recorded yet.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {allActivities.map((activity, index) => (
                            <div key={index} className="flex items-start gap-3 pb-3 border-b border-neutral-100 last:border-0">
                                <div className={`w-2 h-2 mt-2 rounded-full shrink-0 ${activity.color}`} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-neutral-700">
                                        <span className="mr-1.5">{activity.icon}</span>
                                        {activity.label}
                                    </p>
                                    {activity.oldValue && activity.newValue && (
                                        <p className="text-xs text-neutral-400 mt-0.5">
                                            <span className="line-through text-red-400">{activity.oldValue}</span>
                                            {' → '}
                                            <span className="text-green-600 font-medium">{activity.newValue}</span>
                                        </p>
                                    )}
                                    <p className="text-xs text-neutral-400 mt-0.5">
                                        {formatDate(activity.date) || 'Unknown date'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Fixed Profile Summary */}
            <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50/50 rounded-b-xl shrink-0">
                <h4 className="text-sm font-semibold text-neutral-700 mb-3">Profile Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center">
                        <span className="text-neutral-500">Assigned Agent:</span>
                        <select
                            value={student.assignedAgent || ''}
                            onChange={(e) => {
                                const newAgent = e.target.value;
                                onAgentChangeRequest(newAgent);
                            }}
                            className="ml-2 bg-transparent border-b border-neutral-300 text-neutral-800 text-sm font-medium focus:outline-none focus:border-primary-500 pb-0.5 cursor-pointer"
                        >
                            <option value="">Unassigned</option>
                            {getAgents().map(a => (
                                <option key={a.value} value={a.value}>{a.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <span className="text-neutral-500">Flagged:</span>
                        <span className={`ml-2 ${student.isFlagged ? 'text-red-600 font-medium' : 'text-neutral-800'}`}>
                            {student.isFlagged ? 'Yes' : 'No'}
                        </span>
                    </div>
                </div>
            </div>
        </section>
    );
}
