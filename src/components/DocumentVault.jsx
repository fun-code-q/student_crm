import { useState } from 'react';
import { Upload, FileText, Eye, Trash2, Link2, X, Check, Plus, Pencil } from 'lucide-react';
import { DOCUMENT_SLOTS, updateStudent } from '../lib/firebase';
import ConfirmModal from './ConfirmModal';

export default function DocumentVault({
    studentId,
    studentData = {},
    documents = {},
    customSlots = [],
    onUpdate,
    onCustomSlotsUpdate,
    activityLog = [],
    onActivityUpdate
}) {
    const [saving, setSaving] = useState({});
    const [linkInputs, setLinkInputs] = useState({});
    const [linkValues, setLinkValues] = useState({});
    const [deleteSlot, setDeleteSlot] = useState(null); // Track which slot is pending deletion
    const [isAddingCustom, setIsAddingCustom] = useState(false);
    const [newCustomLabel, setNewCustomLabel] = useState('');
    const [editingSlot, setEditingSlot] = useState(null);
    const [editLabelValue, setEditLabelValue] = useState('');

    function openLinkInput(slot) {
        setLinkInputs(prev => ({ ...prev, [slot]: true }));
        setLinkValues(prev => ({ ...prev, [slot]: '' }));
    }

    function closeLinkInput(slot) {
        setLinkInputs(prev => ({ ...prev, [slot]: false }));
        setLinkValues(prev => ({ ...prev, [slot]: '' }));
    }

    async function handleSaveLink(slot) {
        const url = (linkValues[slot] || '').trim();
        if (!url) {
            alert('Please paste a link first.');
            return;
        }
        if (!url.startsWith('http')) {
            alert('Please enter a valid URL starting with http:// or https://');
            return;
        }

        const slotLabel = [...DOCUMENT_SLOTS, ...customSlots].find(s => s.key === slot)?.label || slot;

        setSaving(prev => ({ ...prev, [slot]: true }));
        try {
            const docInfo = {
                url: url,
                name: 'Google Drive Link',
                type: 'link',
                isLink: true,
            };
            const updatedDocs = { ...documents, [slot]: docInfo };

            // Create activity log entry
            const logEntry = {
                action: 'document_added',
                label: slotLabel,
                url: url,
                timestamp: new Date().toISOString(),
            };
            const currentLog = activityLog || [];
            const updatedLog = [...currentLog, logEntry];

            await updateStudent(studentId, { documents: updatedDocs, activityLog: updatedLog });
            onUpdate(updatedDocs);
            if (onActivityUpdate) onActivityUpdate(updatedLog);
            closeLinkInput(slot);
        } catch (err) {
            console.error('Failed to save link:', err);
            alert('Failed to save link: ' + err.message);
        } finally {
            setSaving(prev => ({ ...prev, [slot]: false }));
        }
    }

    async function handleAddCustomSlot() {
        if (!newCustomLabel.trim()) return;

        const key = `custom_${Date.now()}`;
        const newSlot = { key, label: newCustomLabel.trim() };
        const updatedCustomSlots = [...customSlots, newSlot];

        try {
            await updateStudent(studentId, { customDocumentSlots: updatedCustomSlots });
            if (onCustomSlotsUpdate) onCustomSlotsUpdate(updatedCustomSlots);
            setIsAddingCustom(false);
            setNewCustomLabel('');
        } catch (err) {
            console.error('Failed to add custom slot:', err);
            alert('Failed to add custom slot');
        }
    }

    async function handleUpdateCustomLabel(key) {
        if (!editLabelValue.trim()) return;

        const updatedCustomSlots = customSlots.map(s =>
            s.key === key ? { ...s, label: editLabelValue.trim() } : s
        );

        try {
            await updateStudent(studentId, { customDocumentSlots: updatedCustomSlots });
            if (onCustomSlotsUpdate) onCustomSlotsUpdate(updatedCustomSlots);
            setEditingSlot(null);
            setEditLabelValue('');
        } catch (err) {
            console.error('Failed to update custom label:', err);
            alert('Failed to update title');
        }
    }

    async function handleDeleteConfirmed() {
        if (!deleteSlot) return;
        const allSlots = [...DOCUMENT_SLOTS, ...customSlots];
        const slotConfig = allSlots.find(s => s.key === deleteSlot);
        const isCustom = deleteSlot.startsWith('custom_');

        try {
            const updatedDocs = { ...documents };
            delete updatedDocs[deleteSlot];

            const updates = { documents: updatedDocs };

            // Create activity log entry
            const logEntry = {
                action: isCustom ? 'custom_document_removed' : 'document_removed',
                label: slotConfig?.label || deleteSlot,
                timestamp: new Date().toISOString(),
            };
            const currentLog = activityLog || [];
            const updatedLog = [...currentLog, logEntry];
            updates.activityLog = updatedLog;

            // Also remove from customSlots if it's a custom one
            if (isCustom) {
                const updatedCustomSlots = customSlots.filter(s => s.key !== deleteSlot);
                updates.customDocumentSlots = updatedCustomSlots;
                if (onCustomSlotsUpdate) onCustomSlotsUpdate(updatedCustomSlots);
            }

            await updateStudent(studentId, updates);
            onUpdate(updatedDocs);
            if (onActivityUpdate) onActivityUpdate(updatedLog);
        } catch (err) {
            console.error('Delete failed:', err);
            alert('Delete failed: ' + err.message);
        } finally {
            setDeleteSlot(null);
        }
    }

    const allSlots = [...DOCUMENT_SLOTS, ...customSlots];

    return (
        <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {allSlots.map(({ key, label }) => {
                    const doc = documents[key];
                    const isLinkOpen = linkInputs[key];
                    const isSaving = saving[key];
                    const isCustom = key.startsWith('custom_');
                    const isEditingLabel = editingSlot === key;

                    return (
                        <div
                            key={key}
                            className={`card p-3 flex flex-col gap-2 card-hover h-[140px] overflow-hidden ${isCustom ? 'border-primary-100 bg-primary-50/10' : ''}`}
                        >
                            <div className="flex items-center justify-between gap-1 group/title">
                                {isEditingLabel ? (
                                    <div className="flex-1 flex gap-1 items-center">
                                        <input
                                            type="text"
                                            value={editLabelValue}
                                            onChange={(e) => setEditLabelValue(e.target.value)}
                                            className="text-[10px] py-0.5 px-1 border border-primary-300 rounded outline-none w-full"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleUpdateCustomLabel(key);
                                                if (e.key === 'Escape') setEditingSlot(null);
                                            }}
                                        />
                                        <button onClick={() => handleUpdateCustomLabel(key)} className="text-primary-600">
                                            <Check size={10} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex items-center gap-1 min-w-0">
                                        <h4 className="text-[11px] font-semibold text-neutral-700 leading-tight truncate" title={label}>{label}</h4>
                                        {isCustom && (
                                            <button
                                                onClick={() => {
                                                    setEditingSlot(key);
                                                    setEditLabelValue(label);
                                                }}
                                                className="opacity-0 group-hover/title:opacity-100 transition-opacity text-neutral-300 hover:text-primary-600"
                                            >
                                                <Pencil size={10} />
                                            </button>
                                        )}
                                    </div>
                                )}
                                <FileText size={14} className={`shrink-0 ${doc ? "text-primary-600" : "text-neutral-300"}`} />
                            </div>

                            {doc ? (
                                <div className="flex-1 flex flex-col justify-between min-h-0">
                                    <div>
                                        <p className="text-[10px] text-green-600 font-medium">✓ Linked</p>
                                        <p className="text-[9px] text-neutral-400 truncate" title={doc.url}>{doc.url}</p>
                                    </div>
                                    <div className="flex gap-1">
                                        <a
                                            href={doc.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn-secondary text-[10px] py-0.5 px-2 flex-items-center justify-center gap-1 rounded"
                                        >
                                            <Eye size={10} />
                                            View
                                        </a>
                                        <button
                                            onClick={() => setDeleteSlot(key)}
                                            className="text-[10px] py-0.5 px-1.5 rounded bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center"
                                            title="Remove"
                                        >
                                            <Trash2 size={10} />
                                        </button>
                                    </div>
                                </div>
                            ) : isLinkOpen ? (
                                <div className="flex-1 flex flex-col justify-between gap-1 min-h-0">
                                    <input
                                        type="url"
                                        value={linkValues[key] || ''}
                                        onChange={(e) => setLinkValues(prev => ({ ...prev, [key]: e.target.value }))}
                                        placeholder="Paste link here..."
                                        className="input-field text-[10px] py-1 px-2 w-full"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveLink(key);
                                            if (e.key === 'Escape') closeLinkInput(key);
                                        }}
                                    />
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => handleSaveLink(key)}
                                            disabled={isSaving}
                                            className="btn-primary text-[10px] py-0.5 px-2 flex-1 flex items-center justify-center gap-1 rounded"
                                        >
                                            <Check size={10} />
                                            {isSaving ? 'Saving…' : 'Save'}
                                        </button>
                                        <button
                                            onClick={() => closeLinkInput(key)}
                                            className="text-[10px] py-0.5 px-1.5 rounded bg-neutral-100 text-neutral-500 hover:bg-neutral-200 flex items-center justify-center"
                                            title="Cancel"
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center justify-center relative">
                                    <button
                                        onClick={() => openLinkInput(key)}
                                        className="w-full h-full border-2 border-dashed border-neutral-200 rounded-lg
                                        hover:border-primary-300 hover:bg-primary-50/30 transition-colors
                                        flex flex-col items-center justify-center gap-1 text-neutral-400 hover:text-primary-600"
                                    >
                                        <Link2 size={16} />
                                        <span className="text-[10px] font-medium">Add Link</span>
                                    </button>
                                    {isCustom && (
                                        <button
                                            onClick={() => setDeleteSlot(key)}
                                            className="absolute top-0 right-0 p-1 text-neutral-300 hover:text-red-500 transition-colors"
                                            title="Delete Slot"
                                        >
                                            <Trash2 size={10} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Add Custom Slot Button/Input */}
                <div className="card p-3 flex flex-col gap-2 card-hover h-[140px] border-dashed border-2 border-neutral-200 bg-neutral-50/30">
                    {isAddingCustom ? (
                        <div className="flex-1 flex flex-col justify-between gap-1">
                            <div>
                                <h4 className="text-[11px] font-semibold text-neutral-700 mb-1">Custom Doc Title</h4>
                                <input
                                    type="text"
                                    value={newCustomLabel}
                                    onChange={(e) => setNewCustomLabel(e.target.value)}
                                    placeholder="e.g. Internship"
                                    className="input-field text-[10px] py-1 px-2 w-full"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleAddCustomSlot();
                                        if (e.key === 'Escape') setIsAddingCustom(false);
                                    }}
                                />
                            </div>
                            <div className="flex gap-1">
                                <button
                                    onClick={handleAddCustomSlot}
                                    className="btn-primary text-[10px] py-0.5 px-2 flex-1 flex items-center justify-center gap-1 rounded"
                                >
                                    <Check size={10} />
                                    Create
                                </button>
                                <button
                                    onClick={() => setIsAddingCustom(false)}
                                    className="text-[10px] py-0.5 px-1.5 rounded bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                                >
                                    <X size={10} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsAddingCustom(true)}
                            className="w-full h-full flex flex-col items-center justify-center gap-2 text-neutral-400 hover:text-primary-600 transition-colors"
                        >
                            <Plus size={24} className="p-1 rounded-full bg-neutral-100" />
                            <span className="text-[11px] font-semibold uppercase tracking-wider">Add Document</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {
                deleteSlot && (
                    <ConfirmModal
                        isOpen={!!deleteSlot}
                        onClose={() => setDeleteSlot(null)}
                        onConfirm={handleDeleteConfirmed}
                        title="Remove Document"
                        message={`Are you sure you want to remove "${[...DOCUMENT_SLOTS, ...customSlots].find(s => s.key === deleteSlot)?.label}"? This action cannot be undone.`}
                        confirmText="Remove"
                        cancelText="Cancel"
                        type="danger"
                    />
                )
            }
        </>
    );
}
