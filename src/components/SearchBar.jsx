import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Filter, X, ChevronDown } from 'lucide-react';
import { getAgents } from '../lib/firebase';

// Custom dropdown component
function CustomSelect({ value, onChange, options, placeholder, label }) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        function handleClickOutside(e) {
            if (ref.current && !ref.current.contains(e.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.value === value);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`input-field flex items-center justify-between gap-2 min-w-[140px] h-8 text-xs py-1.5 px-3 ${value ? 'text-neutral-800' : 'text-neutral-400'}`}
            >
                <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
                <ChevronDown size={14} className={`text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-full min-w-[160px] bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-50 animate-scaleIn">
                    <button
                        onClick={() => { onChange(''); setIsOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-neutral-50 ${!value ? 'text-primary-600 font-medium' : 'text-neutral-600'}`}
                    >
                        {placeholder}
                    </button>
                    {options.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => { onChange(opt.value); setIsOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-neutral-50 ${value === opt.value ? 'text-primary-600 font-medium bg-primary-50' : 'text-neutral-600'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// Filter chip component
function FilterChip({ label, value, onRemove }) {
    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded-full animate-fadeIn">
            <span className="truncate max-w-[120px]">{label}: {value}</span>
            <button
                onClick={onRemove}
                className="ml-0.5 p-0.5 rounded-full hover:bg-primary-200 transition-colors"
                title="Remove filter"
            >
                <X size={12} />
            </button>
        </span>
    );
}

export default function SearchBar({
    searchTerm,
    onSearchChange,
    statusFilter,
    onStatusFilterChange,
    universityFilter,
    onUniversityFilterChange,
    courseFilter,
    onCourseFilterChange,
    agentFilter,
    onAgentFilterChange,
    purposeFilter,
    onPurposeFilterChange,
    universities = [],
    courses = [],
    agents = [],
    purposeOptions = [],
    onClearFilters,
}) {
    const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);
    const [localAgents, setLocalAgents] = useState(agents);
    const debounceRef = useRef(null);

    // Update local agents when prop changes
    useEffect(() => {
        setLocalAgents(agents);
    }, [agents]);

    // Listen for agent name updates
    useEffect(() => {
        const handleAgentNamesUpdated = () => {
            setLocalAgents(getAgents());
        };
        window.addEventListener('agent-names-updated', handleAgentNamesUpdated);
        return () => window.removeEventListener('agent-names-updated', handleAgentNamesUpdated);
    }, []);

    // Debounced search handler
    const handleSearchChange = useCallback((value) => {
        setLocalSearchTerm(value);

        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            onSearchChange(value);
        }, 300);
    }, [onSearchChange]);

    // Sync with external searchTerm
    useEffect(() => {
        setLocalSearchTerm(searchTerm);
    }, [searchTerm]);

    // Cleanup debounce on unmount
    useEffect(() => {
        return () => clearTimeout(debounceRef.current);
    }, []);

    const hasFilters = searchTerm || statusFilter || universityFilter || courseFilter || agentFilter || purposeFilter;

    // Status options
    const statusOptions = [
        { value: 'Draft', label: 'Draft' },
        { value: 'Submitted', label: 'Submitted' },
        { value: 'Flagged', label: 'Flagged' },
        { value: 'Document', label: 'Document' },
        { value: 'Admitted', label: 'Admitted' },
        { value: 'Rejected', label: 'Rejected' },
    ];

    // University options
    const universityOptions = universities.map(uni => ({ value: uni, label: uni }));

    // Course options
    const courseOptions = courses.map(c => ({ value: c, label: c }));

    // Agent options
    const agentOptions = localAgents.map(a => ({ value: a.value, label: a.label }));

    // Purpose options
    const pOptions = purposeOptions.map(opt => ({ value: opt, label: opt }));

    // Get status display label
    const getStatusLabel = (val) => statusOptions.find(o => o.value === val)?.label || val;
    const getUniversityLabel = (val) => val;
    const getCourseLabel = (val) => val;
    const getAgentLabel = (val) => agentOptions.find(o => o.value === val)?.label || val;
    const getPurposeLabel = (val) => val;

    return (
        <div className="card p-4 mb-6 animate-fadeIn">
            <div className="flex flex-col lg:flex-row gap-3">
                {/* Enhanced Search input */}
                <div className="relative flex-1 max-w-md">
                    <input
                        type="text"
                        placeholder="Search by name, email, university, or course…"
                        value={localSearchTerm}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="input-field pl-4 pr-20 py-2 h-10 w-full text-sm transition-all duration-200 focus:max-w-none focus:ring-2 focus:ring-primary-200"
                    />
                    {/* Clear button inside input */}
                    {localSearchTerm && (
                        <button
                            onClick={() => { setLocalSearchTerm(''); onSearchChange(''); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-neutral-100 transition-colors"
                            title="Clear search"
                        >
                            <X size={14} className="text-neutral-400" />
                        </button>
                    )}
                </div>

                {/* Filter dropdowns */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2">
                        <Filter size={14} className="text-neutral-400 shrink-0" />
                    </div>

                    <CustomSelect
                        value={statusFilter}
                        onChange={onStatusFilterChange}
                        options={statusOptions}
                        placeholder="All Statuses"
                        label="Status"
                    />

                    <CustomSelect
                        value={universityFilter}
                        onChange={onUniversityFilterChange}
                        options={universityOptions}
                        placeholder="All Universities"
                        label="University"
                    />

                    <CustomSelect
                        value={courseFilter}
                        onChange={onCourseFilterChange}
                        options={courseOptions}
                        placeholder="All Courses"
                        label="Course"
                    />

                    <CustomSelect
                        value={agentFilter}
                        onChange={onAgentFilterChange}
                        options={agentOptions}
                        placeholder="All Agents"
                        label="Agent"
                    />

                    <CustomSelect
                        value={purposeFilter}
                        onChange={onPurposeFilterChange}
                        options={pOptions}
                        placeholder="All Purposes"
                        label="Purpose"
                    />

                    {hasFilters && (
                        <button
                            onClick={onClearFilters}
                            className="btn-secondary text-xs py-1.5 px-3 h-8 shrink-0"
                            title="Clear all filters"
                        >
                            <X size={14} />
                            Clear All
                        </button>
                    )}
                </div>
            </div>

            {/* Active filter chips */}
            {hasFilters && (
                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-neutral-100">
                    <span className="text-xs text-neutral-500">Active filters:</span>
                    {searchTerm && (
                        <FilterChip
                            label="Search"
                            value={searchTerm}
                            onRemove={() => { setLocalSearchTerm(''); onSearchChange(''); }}
                        />
                    )}
                    {statusFilter && (
                        <FilterChip
                            label="Status"
                            value={getStatusLabel(statusFilter)}
                            onRemove={() => onStatusFilterChange('')}
                        />
                    )}
                    {universityFilter && (
                        <FilterChip
                            label="University"
                            value={getUniversityLabel(universityFilter)}
                            onRemove={() => onUniversityFilterChange('')}
                        />
                    )}
                    {courseFilter && (
                        <FilterChip
                            label="Course"
                            value={getCourseLabel(courseFilter)}
                            onRemove={() => onCourseFilterChange('')}
                        />
                    )}
                    {agentFilter && (
                        <FilterChip
                            label="Agent"
                            value={getAgentLabel(agentFilter)}
                            onRemove={() => onAgentFilterChange('')}
                        />
                    )}
                    {purposeFilter && (
                        <FilterChip
                            label="Purpose"
                            value={getPurposeLabel(purposeFilter)}
                            onRemove={() => onPurposeFilterChange('')}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
