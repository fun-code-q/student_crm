import { useNavigate } from 'react-router-dom';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Users, Flag, ChevronDown, Trash2, DollarSign, StickyNote, History } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import StatusBadge from './StatusBadge';
import { getAgents } from '../lib/firebase';

// Custom dropdown for agent selection
function AgentDropdown({ value, onChange, studentId, onUpdateAgent }) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);
    const [agents, setAgents] = useState(getAgents());

    useEffect(() => {
        function handleClickOutside(e) {
            if (ref.current && !ref.current.contains(e.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Listen for agent name changes
    useEffect(() => {
        const handleAgentNamesUpdated = () => {
            setAgents(getAgents());
        };
        window.addEventListener('agent-names-updated', handleAgentNamesUpdated);
        return () => window.removeEventListener('agent-names-updated', handleAgentNamesUpdated);
    }, []);

    const selectedAgent = agents.find(a => a.value === value);

    const handleToggle = (e) => {
        e.stopPropagation();
        setIsOpen(!isOpen);
    };

    const handleSelect = (e, agentValue) => {
        e.stopPropagation();
        onChange(agentValue);
        if (onUpdateAgent) onUpdateAgent(studentId, agentValue);
        setIsOpen(false);
    };

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={handleToggle}
                className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${value ? 'bg-primary-100 text-primary-700 hover:bg-primary-200' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                    }`}
            >
                <span className="truncate max-w-[80px]">{selectedAgent ? selectedAgent.label : 'Assign'}</span>
                <ChevronDown size={12} className={`text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-50 animate-scaleIn max-h-48 overflow-y-auto custom-scrollbar">
                    <button
                        onClick={(e) => handleSelect(e, '')}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-neutral-50 ${!value ? 'text-primary-600 font-medium' : 'text-neutral-600'}`}
                    >
                        Unassigned
                    </button>
                    {agents.map((agent) => (
                        <button
                            key={agent.value}
                            onClick={(e) => handleSelect(e, agent.value)}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-neutral-50 ${value === agent.value ? 'text-primary-600 font-medium bg-primary-50' : 'text-neutral-600'}`}
                        >
                            {agent.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// Flag indicator component
function FlagIndicator({ isFlagged, flagReason, onClick }) {
    return (
        <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className={`inline-flex items-center justify-center w-5 h-5 rounded-full transition-colors ${isFlagged ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'text-neutral-300 hover:text-red-400 hover:bg-red-50'
                }`}
            title={isFlagged ? (flagReason || 'Flagged') : 'Flag this student'}
        >
            <Flag size={12} fill={isFlagged ? 'currentColor' : 'none'} />
        </button>
    );
}

export default function StudentTable({ students, sortField, sortDir, onSort, onUpdateAgent, onToggleFlag, onDelete }) {
    const navigate = useNavigate();

    const columns = [
        { key: 'name', label: 'Name' },
        { key: 'agent', label: 'Agent' },
        { key: 'targetCourse', label: 'Target Course' },
        { key: 'targetUniversity', label: 'Target University' },
        { key: 'email', label: 'Given Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'status', label: 'Status' },
        { key: 'actions', label: '' },
    ];

    function SortIcon({ field }) {
        if (sortField !== field) return <ArrowUpDown size={14} className="text-neutral-300" />;
        return sortDir === 'asc'
            ? <ArrowUp size={14} className="text-primary-600" />
            : <ArrowDown size={14} className="text-primary-600" />;
    }

    // Empty state component
    function EmptyState() {
        return (
            <tr>
                <td colSpan={columns.length} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center justify-center animate-fadeIn">
                        <div className="w-16 h-16 mb-4 rounded-full bg-neutral-100 flex items-center justify-center">
                            <Users size={32} className="text-neutral-300" />
                        </div>
                        <h3 className="text-lg font-semibold text-neutral-700 mb-2">No students found</h3>
                        <p className="text-sm text-neutral-500 max-w-md">
                            We couldn't find any students matching your criteria. Try adjusting your search or filters, or add a new student to get started.
                        </p>
                    </div>
                </td>
            </tr>
        );
    }

    return (
        <div className="card overflow-hidden animate-fadeIn flex flex-col hide-scrollbar">
            {/* Table wrapper with custom scrollbar and max height */}
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] custom-scrollbar">
                <table className="w-full text-sm relative">
                    <thead className="sticky top-0 z-10 bg-neutral-50 shadow-sm">
                        <tr>
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    onClick={() => onSort(col.key)}
                                    className="text-left px-5 py-3.5 font-semibold text-neutral-600 cursor-pointer select-none hover:bg-neutral-100 transition-colors border-b border-neutral-200"
                                >
                                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                                        {col.label}
                                        <SortIcon field={col.key} />
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {students.length === 0 ? (
                            <EmptyState />
                        ) : (
                            students.map((s, idx) => (
                                <tr
                                    key={s.id}
                                    onClick={() => navigate(`/students/${s.id}`)}
                                    className={`cursor-pointer transition-colors hover:bg-primary-50/40 group ${idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50/50'
                                        }`}
                                    style={{ animationDelay: `${idx * 30}ms` }}
                                >
                                    <td className="px-5 py-3.5 font-medium text-neutral-800">
                                        <div className="flex items-center gap-2">
                                            <FlagIndicator
                                                isFlagged={s.isFlagged}
                                                flagReason={s.flagReason}
                                                onClick={() => onToggleFlag && onToggleFlag(s)}
                                            />
                                            {s.paid && (
                                                <span
                                                    className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600"
                                                    title="Payment Received"
                                                >
                                                    <DollarSign size={12} />
                                                </span>
                                            )}
                                            <span>{[s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ') || '—'}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center gap-2">
                                            <AgentDropdown
                                                value={s.assignedAgent || ''}
                                                onChange={() => { }}
                                                studentId={s.id}
                                                onUpdateAgent={onUpdateAgent}
                                            />
                                            <div className="flex items-center gap-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/students/${s.id}`, { state: { initialTab: 'notes' } });
                                                    }}
                                                    className="p-1.5 rounded-md text-neutral-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                                                    title="Go to Notes"
                                                >
                                                    <StickyNote size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/students/${s.id}`, { state: { initialTab: 'activity' } });
                                                    }}
                                                    className="p-1.5 rounded-md text-neutral-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                                                    title="Go to Activity History"
                                                >
                                                    <History size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5 text-neutral-600">{s.targetCourse || '—'}</td>
                                    <td className="px-5 py-3.5 text-neutral-600">{s.targetUniversity || '—'}</td>
                                    <td className="px-5 py-3.5 text-neutral-600">{s.givenEmail || '—'}</td>
                                    <td className="px-5 py-3.5 text-neutral-600">{s.phone || '—'}</td>
                                    <td className="px-5 py-3.5">
                                        <StatusBadge status={s.status} />
                                    </td>
                                    <td className="px-5 py-3.5 text-right">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onDelete && onDelete(s.id); }}
                                            className="p-1.5 rounded-md text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                            title="Delete student"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
