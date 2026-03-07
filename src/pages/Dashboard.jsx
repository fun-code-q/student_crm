import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, CheckCircle, Clock, XCircle, Flag, Folder, LogOut, Settings } from 'lucide-react';
import {
    firebaseInitialized,
    getStudents,
    addStudent,
    updateStudent,
    deleteStudent,
    defaultStudentData,
    STATUSES,
    getAgents,
    PURPOSE_OPTIONS
} from '../lib/firebase';
import StudentTable from '../components/StudentTable';
import SearchBar from '../components/SearchBar';
import ConfirmModal from '../components/ConfirmModal';
import AgentSettingsModal from '../components/AgentSettingsModal';
import { useAuth } from '../context/AuthContext';

// Demo data used when Firebase is not configured
const DEMO_STUDENTS = [
    {
        id: 'demo-1',
        firstName: 'Aarav',
        middleName: '',
        lastName: 'Sharma',
        email: 'aarav.sharma@email.com',
        givenEmail: 'aarav.sharma@tu-munich.de',
        phone: '+49 151 1234 5678',
        targetUniversity: 'TU Munich',
        targetCourse: 'M.Sc. Computer Science',
        status: 'Submitted',
        notes: '',
        documents: {},
        customFields: [],
        paid: false,
    },
    {
        id: 'demo-2',
        firstName: 'Priya',
        middleName: 'K.',
        lastName: 'Patel',
        email: 'priya.patel@email.com',
        givenEmail: 'priya.patel@rwth-aachen.de',
        phone: '+49 176 9876 5432',
        targetUniversity: 'RWTH Aachen',
        targetCourse: 'M.Sc. Mechanical Engineering',
        status: 'Admitted',
        notes: '',
        documents: {},
        customFields: [],
        paid: true,
    },
    {
        id: 'demo-3',
        firstName: 'Rahul',
        middleName: '',
        lastName: 'Desai',
        email: 'rahul.desai@email.com',
        givenEmail: 'rahul.desai@uni-hamburg.de',
        phone: '+49 172 5555 1234',
        targetUniversity: 'University of Hamburg',
        targetCourse: 'M.Sc. Data Science',
        status: 'Draft',
        notes: '',
        documents: {},
        customFields: [],
        paid: false,
    },
    {
        id: 'demo-4',
        firstName: 'Ananya',
        middleName: '',
        lastName: 'Reddy',
        email: 'ananya.reddy@email.com',
        givenEmail: 'ananya.reddy@tu-berlin.de',
        phone: '+49 157 4444 6789',
        targetUniversity: 'TU Berlin',
        targetCourse: 'M.Sc. Electrical Engineering',
        status: 'Rejected',
        notes: '',
        documents: {},
        customFields: [],
        paid: false,
    },
];

export default function Dashboard() {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [headerNode, setHeaderNode] = useState(null);

    // Modal states
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [studentToDelete, setStudentToDelete] = useState(null);
    const [agentModalOpen, setAgentModalOpen] = useState(false);
    const [pendingAgentUpdate, setPendingAgentUpdate] = useState(null);
    const [settingsModalOpen, setSettingsModalOpen] = useState(false);

    useEffect(() => {
        setHeaderNode(document.getElementById('header-actions'));
    }, []);

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (err) {
            console.error('Logout failed:', err);
        }
    };

    // Search & filter state
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [universityFilter, setUniversityFilter] = useState('');
    const [courseFilter, setCourseFilter] = useState('');
    const [agentFilter, setAgentFilter] = useState('');
    const [purposeFilter, setPurposeFilter] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const debounceTimerRef = useRef(null);

    // Sort state
    const [sortField, setSortField] = useState('name');
    const [sortDir, setSortDir] = useState('asc');

    // Load students
    useEffect(() => {
        async function load() {
            try {
                if (firebaseInitialized) {
                    const data = await getStudents();
                    setStudents(data);
                } else {
                    setStudents(DEMO_STUDENTS);
                }
            } catch (err) {
                console.error('Failed to load students:', err);
                setStudents(DEMO_STUDENTS);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    // Debounce search term
    useEffect(() => {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);
        return () => clearTimeout(debounceTimerRef.current);
    }, [searchTerm]);

    // Unique values for filter dropdowns
    const universities = useMemo(
        () => [...new Set(students.map((s) => s.targetUniversity).filter(Boolean))].sort(),
        [students]
    );
    const courses = useMemo(
        () => [...new Set(students.map((s) => s.targetCourse).filter(Boolean))].sort(),
        [students]
    );


    // Filter + Search
    const filtered = useMemo(() => {
        let result = [...students];

        if (debouncedSearchTerm) {
            const term = debouncedSearchTerm.toLowerCase();
            result = result.filter(
                (s) =>
                    `${s.firstName} ${s.middleName} ${s.lastName}`.toLowerCase().includes(term) ||
                    s.email?.toLowerCase().includes(term) ||
                    s.targetUniversity?.toLowerCase().includes(term) ||
                    s.targetCourse?.toLowerCase().includes(term)
            );
        }

        if (statusFilter) result = result.filter((s) => s.status === statusFilter);
        if (universityFilter) result = result.filter((s) => s.targetUniversity === universityFilter);
        if (courseFilter) result = result.filter((s) => s.targetCourse === courseFilter);
        if (agentFilter) result = result.filter((s) => s.assignedAgent === agentFilter);
        if (purposeFilter) result = result.filter((s) => s.purpose === purposeFilter);

        return result;
    }, [students, debouncedSearchTerm, statusFilter, universityFilter, courseFilter, agentFilter, purposeFilter]);

    // Sort
    const sorted = useMemo(() => {
        const arr = [...filtered];
        arr.sort((a, b) => {
            let va, vb;
            if (sortField === 'name') {
                va = `${a.firstName} ${a.lastName}`.toLowerCase();
                vb = `${b.firstName} ${b.lastName}`.toLowerCase();
            } else {
                va = (a[sortField] || '').toLowerCase();
                vb = (b[sortField] || '').toLowerCase();
            }
            if (va < vb) return sortDir === 'asc' ? -1 : 1;
            if (va > vb) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
        return arr;
    }, [filtered, sortField, sortDir]);

    function handleSort(field) {
        if (sortField === field) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    }

    async function handleAddStudent() {
        navigate(`/students/new`);
    }

    const handleDeleteStudent = useCallback(async (id) => {
        setStudentToDelete(id);
        setDeleteModalOpen(true);
    }, []);

    const confirmDeleteStudent = useCallback(async () => {
        if (!studentToDelete) return;

        try {
            if (firebaseInitialized) {
                await deleteStudent(studentToDelete);
            }
            setStudents(prev => prev.filter(s => s.id !== studentToDelete));
        } catch (err) {
            console.error('Failed to delete student:', err);
            alert('Failed to delete student: ' + err.message);
        } finally {
            setStudentToDelete(null);
            setDeleteModalOpen(false);
        }
    }, [studentToDelete, firebaseInitialized]);

    // Handle agent assignment
    async function handleUpdateAgent(studentId, agentValue) {
        // Store the pending update and show confirmation modal
        setPendingAgentUpdate({ studentId, agentValue });
        setAgentModalOpen(true);
    }

    const confirmAgentUpdate = useCallback(async () => {
        if (!pendingAgentUpdate) return;

        const { studentId, agentValue } = pendingAgentUpdate;

        try {
            if (firebaseInitialized) {
                await updateStudent(studentId, { assignedAgent: agentValue });
                setStudents(prev => prev.map(s =>
                    s.id === studentId ? { ...s, assignedAgent: agentValue } : s
                ));
            } else {
                // Demo mode - update local state
                setStudents(prev => prev.map(s =>
                    s.id === studentId ? { ...s, assignedAgent: agentValue } : s
                ));
            }
        } catch (err) {
            console.error('Failed to update agent:', err);
        } finally {
            setPendingAgentUpdate(null);
            setAgentModalOpen(false);
        }
    }, [pendingAgentUpdate, firebaseInitialized]);

    // Handle flag toggle
    async function handleToggleFlag(student) {
        const newFlagged = !student.isFlagged;
        const reason = newFlagged ? prompt('Enter reason for flagging (optional):') || '' : '';
        try {
            if (firebaseInitialized) {
                await updateStudent(student.id, {
                    isFlagged: newFlagged,
                    flagReason: reason,
                    flaggedBy: newFlagged ? 'Boss' : ''
                });
            }
            // Update local state
            setStudents(prev => prev.map(s =>
                s.id === student.id ? {
                    ...s,
                    isFlagged: newFlagged,
                    flagReason: reason,
                    flaggedBy: newFlagged ? 'Boss' : ''
                } : s
            ));
        } catch (err) {
            console.error('Failed to toggle flag:', err);
        }
    }

    // Stats
    const stats = useMemo(() => ({
        total: students.length,
        draft: students.filter((s) => s.status === 'Draft').length,
        document: students.filter((s) => s.status === 'Document').length,
        submitted: students.filter((s) => s.status === 'Submitted').length,
        admitted: students.filter((s) => s.status === 'Admitted').length,
        rejected: students.filter((s) => s.status === 'Rejected').length,
        flagged: students.filter((s) => s.isFlagged).length,
    }), [students]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            </div>
        );
    }

    // Prepare filter options (Already defined above using useMemo)

    return (
        <div className="max-w-7xl mx-auto">
            {/* Header controls portaled into Layout.jsx top bar */}
            {headerNode && createPortal(
                <>
                    {/* Stats */}
                    <div className="flex items-center gap-2 flex-wrap shrink-0 mr-auto text-xs font-semibold">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 whitespace-nowrap">
                            <Users size={12} /> {stats.total} Total
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 whitespace-nowrap">
                            <Clock size={12} /> {stats.draft} Draft
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 whitespace-nowrap">
                            <Folder size={12} /> {stats.document} Document
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 whitespace-nowrap">
                            <CheckCircle size={12} /> {stats.submitted} Submitted
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 whitespace-nowrap">
                            <CheckCircle size={12} /> {stats.admitted} Admitted
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 whitespace-nowrap">
                            <XCircle size={12} /> {stats.rejected} Rejected
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 whitespace-nowrap">
                            <Flag size={12} /> {stats.flagged} Flagged
                        </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        <button onClick={handleAddStudent} className="btn-primary h-9 whitespace-nowrap">
                            <Plus size={16} /> Add Student
                        </button>
                        <button
                            onClick={() => setSettingsModalOpen(true)}
                            className="btn-secondary h-9"
                            title="Agent Settings"
                        >
                            <Settings size={16} /> Settings
                        </button>
                        <button
                            onClick={handleLogout}
                            className="btn-secondary h-9 text-red-600 hover:bg-red-50 hover:border-red-200"
                            title="Sign Out"
                        >
                            <LogOut size={16} /> Logout
                        </button>
                    </div>
                </>,
                headerNode
            )}

            {/* Search & Filters */}
            <SearchBar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                universityFilter={universityFilter}
                onUniversityFilterChange={setUniversityFilter}
                courseFilter={courseFilter}
                onCourseFilterChange={setCourseFilter}
                agentFilter={agentFilter}
                onAgentFilterChange={setAgentFilter}
                purposeFilter={purposeFilter}
                onPurposeFilterChange={setPurposeFilter}
                universities={universities}
                courses={courses}
                agents={getAgents()}
                purposeOptions={PURPOSE_OPTIONS}
                onClearFilters={() => {
                    setSearchTerm('');
                    setStatusFilter('');
                    setUniversityFilter('');
                    setCourseFilter('');
                    setAgentFilter('');
                    setPurposeFilter('');
                }}
            />

            {/* Data Table */}
            <StudentTable
                students={sorted}
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
                onUpdateAgent={handleUpdateAgent}
                onToggleFlag={handleToggleFlag}
                onDelete={handleDeleteStudent}
            />

            {/* Results count */}
            <p className="text-xs text-neutral-400 mt-3 text-right">
                Showing {sorted.length} of {students.length} students
            </p>

            {/* Modals */}
            <ConfirmModal
                isOpen={deleteModalOpen}
                onClose={() => { setDeleteModalOpen(false); setStudentToDelete(null); }}
                onConfirm={confirmDeleteStudent}
                title="Delete Student"
                message="Are you sure you want to delete this student profile? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                type="danger"
            />

            <ConfirmModal
                isOpen={agentModalOpen}
                onClose={() => { setAgentModalOpen(false); setPendingAgentUpdate(null); }}
                onConfirm={confirmAgentUpdate}
                title="Change Agent"
                message="Are you sure you want to change the assigned agent for this student?"
                confirmText="Yes, Change Agent"
                cancelText="Cancel"
                type="info"
            />

            <AgentSettingsModal
                isOpen={settingsModalOpen}
                onClose={() => setSettingsModalOpen(false)}
            />
        </div>
    );
}
