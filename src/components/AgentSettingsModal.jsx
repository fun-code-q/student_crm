import { createPortal } from 'react-dom';
import { X, Settings, Plus } from 'lucide-react';
import { getDefaultAgents, getCustomAgentNames, saveCustomAgentNames, getAgents, getAgentCount, saveAgentCount } from '../lib/firebase';
import { useState, useEffect } from 'react';

export default function AgentSettingsModal({ isOpen, onClose }) {
    const [agentCount, setAgentCount] = useState(5);
    const [agentNames, setAgentNames] = useState({});
    const defaultAgents = getDefaultAgents();
    const MAX_NAME_LENGTH = 7;

    useEffect(() => {
        if (isOpen) {
            const count = getAgentCount();
            setAgentCount(count);
            const customNames = getCustomAgentNames();
            const initialNames = {};
            for (let i = 1; i <= count; i++) {
                const agentValue = `agent${i}`;
                initialNames[agentValue] = customNames[agentValue] || `Agent ${i}`;
            }
            setAgentNames(initialNames);
        }
    }, [isOpen]);

    const handleChange = (value, agentValue) => {
        // Limit to 7 characters
        if (value.length > MAX_NAME_LENGTH) return;
        setAgentNames(prev => ({
            ...prev,
            [agentValue]: value
        }));
    };

    const handleAddAgent = () => {
        const newCount = agentCount + 1;
        setAgentCount(newCount);
        saveAgentCount(newCount);
        const newAgentValue = `agent${newCount}`;
        setAgentNames(prev => ({
            ...prev,
            [newAgentValue]: `Agent ${newCount}`
        }));
    };

    const handleSave = () => {
        const customNames = {};
        for (let i = 1; i <= agentCount; i++) {
            const agentValue = `agent${i}`;
            const name = agentNames[agentValue]?.trim() || `Agent ${i}`;
            customNames[agentValue] = name;
        }
        saveCustomAgentNames(customNames);
        onClose();
        // Force re-render by triggering a custom event
        window.dispatchEvent(new Event('agent-names-updated'));
    };

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fadeIn"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-scaleIn"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100">
                            <Settings size={18} className="text-blue-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-neutral-800">
                            Agent Settings
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="px-5 py-4">
                    <p className="text-sm text-neutral-600 mb-4">
                        Customize the names of your agents. Maximum 7 characters (including spaces).
                    </p>
                    <div className="space-y-3">
                        {Object.keys(agentNames).map((agentValue, index) => (
                            <div key={agentValue} className="flex items-center gap-3">
                                <label className="w-20 text-sm font-medium text-neutral-700">
                                    Agent {index + 1}:
                                </label>
                                <input
                                    type="text"
                                    value={agentNames[agentValue]}
                                    onChange={(e) => handleChange(e.target.value, agentValue)}
                                    placeholder={`Agent ${index + 1}`}
                                    maxLength={MAX_NAME_LENGTH}
                                    className="flex-1 px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <span className="text-xs text-neutral-400">
                                    {agentNames[agentValue]?.length || 0}/{MAX_NAME_LENGTH}
                                </span>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={handleAddAgent}
                        className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                        <Plus size={16} />
                        Add Agent
                    </button>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-neutral-200 bg-neutral-50 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
