"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { inviteStaffAction, updateStaff } from './actions';
import type { StaffMember } from './StaffDirectoryClient';

const CUSTOM_FEATURES = [
    { id: 'web-builder', label: 'Web Builder' },
    { id: 'content-manager', label: 'Content Manager' },
    { id: 'sales-operation', label: 'Sales Operation' },
    { id: 'settings', label: 'Settings' },
];

export function StaffDrawer({
    isOpen,
    onClose,
    editData = null
}: {
    isOpen: boolean;
    onClose: () => void;
    editData?: StaffMember | null;
}) {
    const isEditMode = !!editData;
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState<'admin' | 'custom'>('admin');
    const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        if (isOpen) {
            if (editData) {
                setEmail(editData.email);
                const displayName = [editData.firstName, editData.lastName].filter(Boolean).join(' ') || '';
                setName(displayName);
                setRole(editData.role === 'admin' || editData.role === 'owner' ? 'admin' : 'custom');
                setSelectedFeatures(editData.permissions || []);
            } else {
                setEmail('');
                setName('');
                setRole('admin');
                setSelectedFeatures([]);
            }
        }
    }, [isOpen, editData]);

    if (!isOpen) return null;

    const handleToggleFeature = (featureId: string) => {
        setSelectedFeatures(prev => 
            prev.includes(featureId) 
                ? prev.filter(f => f !== featureId)
                : [...prev, featureId]
        );
    };

    const handleSave = () => {
        if (!name.trim()) {
            toast.error('Please enter a full name');
            return;
        }

        if (!isEditMode && (!email.trim() || !email.includes('@'))) {
            toast.error('Please enter a valid email address');
            return;
        }

        if (role === 'custom' && selectedFeatures.length === 0) {
            toast.error('Please select at least one custom permission');
            return;
        }

        startTransition(async () => {
            if (isEditMode) {
                // In edit mode we can only update role & permissions
                if (!editData) return;
                const res = await updateStaff(editData.id, name, role, role === 'custom' ? selectedFeatures : undefined);
                if (res.success) {
                    toast.success('Staff updated successfully!');
                    onClose();
                } else {
                    toast.error(res.error || 'Failed to update staff');
                }
            } else {
                // In add mode we invite
                const res = await inviteStaffAction({
                    email: email,
                    name: name,
                    role: role,
                    permissions: role === 'custom' ? selectedFeatures : undefined
                });
                if (res.success) {
                    toast.success('Invitation sent successfully!');
                    onClose();
                } else {
                    toast.error(res.error || 'Failed to send invitation');
                }
            }
        });
    };

    return (
        <>
            <div className="fixed inset-0 z-[100] bg-[#0B1120]/60 animate-in fade-in duration-200" onClick={onClose} />
            
            <div className="fixed right-0 top-0 bottom-0 z-[101] flex flex-col w-full max-w-[448px] sm:max-w-[448px] bg-[#0B1120] animate-in slide-in-from-right duration-300 shadow-[-25px_0_50px_-12px_rgba(0,0,0,0.5)]">
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-[20px] left-[-18px] flex h-[36px] w-[36px] items-center justify-center rounded-full bg-[#0B1120] border border-[#1F2937] text-white hover:bg-[#1E293B] transition-colors shrink-0 z-10"
                >
                    <ChevronRight className="h-5 w-5" />
                </button>

                <div className="flex flex-col flex-1 px-[32px] pt-[32px] pb-[24px] overflow-y-auto">
                        <h2 className="text-[20px] font-semibold text-[#F8FAFC] leading-[1.4em] font-['Inter'] mb-[24px]">
                            {isEditMode ? 'Edit Staff Permissions' : 'Invite Staff'}
                        </h2>

                        <div className="flex flex-col gap-[24px]">
                            {/* Name Input */}
                            <div className="flex flex-col gap-[8px]">
                                <label className="text-[14px] font-medium text-[rgba(248,250,252,0.8)] font-['Inter']">
                                    Full Name <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="John Doe"
                                    className="w-full h-[50px] px-[16px] rounded-[16px] bg-[#1E293B]/40 border border-white/[0.08] text-[16px] text-[#F8FAFC] placeholder:text-[rgba(248,250,252,0.4)] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all font-['Inter']"
                                />
                            </div>

                            {/* Email Input */}
                            <div className="flex flex-col gap-[8px]">
                                <label className="text-[14px] font-medium text-[rgba(248,250,252,0.8)] font-['Inter']">
                                    {isEditMode ? 'Login Email (Cannot be changed)' : 'Login Email '} <span className="text-red-400 opacity-80">*</span>
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={isEditMode}
                                    placeholder="colleague@example.com"
                                className="w-full h-[50px] px-[16px] rounded-[16px] bg-[#1E293B]/40 border border-white/[0.08] text-[16px] text-[#F8FAFC] placeholder:text-[rgba(248,250,252,0.4)] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all font-['Inter'] disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>

                        {/* Role Selection */}
                        <div className="flex flex-col gap-[12px]">
                            <label className="text-[14px] font-medium text-[rgba(248,250,252,0.8)] font-['Inter']">
                                Access Level
                            </label>
                            <div className="flex flex-col gap-[12px]">
                                {[ 
                                    { value: 'admin', label: 'Manager (Full Access)', desc: 'Can configure all store settings and manage staff.' },
                                    { value: 'custom', label: 'Crew (Custom Features)', desc: 'Select specific features to grant access to.' }
                                ].map(opt => {
                                    const isSelected = role === opt.value;
                                    const isDisabled = editData?.role === 'owner'; // Owners cannot restrict their own access here
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            disabled={isDisabled}
                                            onClick={() => setRole(opt.value as any)}
                                            className={`flex items-start gap-[12px] w-full p-[16px] rounded-[12px] border transition-all text-left font-['Inter'] disabled:opacity-50 disabled:cursor-not-allowed ${isSelected
                                                ? 'border-[#00D3D4] bg-[rgba(0,211,212,0.06)]'
                                                : 'border-[rgba(255,255,255,0.1)] bg-[#1E293B]/40 hover:bg-white/[0.03]'
                                                }`}
                                        >
                                            <div className={`flex shrink-0 items-center justify-center h-[20px] w-[20px] mt-0.5 rounded-full border-2 transition-all ${isSelected
                                                ? 'border-[#00D3D4]'
                                                : 'border-white/30 bg-transparent'
                                                }`}>
                                                {isSelected && <div className="h-[10px] w-[10px] rounded-full bg-[#00D3D4]" />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className={`text-[15px] font-medium leading-tight mb-1 ${isSelected ? 'text-white' : 'text-white/80'}`}>
                                                    {opt.label}
                                                </span>
                                                <span className="text-[13px] text-[rgba(248,250,252,0.5)]">
                                                    {opt.desc}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Custom Features Tick Boxes */}
                        {role === 'custom' && (
                            <div className="flex flex-col gap-[12px] animate-in slide-in-from-top-4 fade-in duration-200">
                                <label className="text-[14px] font-medium text-[rgba(248,250,252,0.8)] font-['Inter']">
                                    Select Permissions
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
                                    {CUSTOM_FEATURES.map(feature => {
                                        const isChecked = selectedFeatures.includes(feature.id);
                                        const isDisabled = editData?.role === 'owner';
                                        return (
                                            <label 
                                                key={feature.id}
                                                className={`flex items-center gap-[12px] p-[12px] rounded-[12px] border cursor-pointer transition-all ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''} ${isChecked ? 'border-blue-500/50 bg-blue-500/5' : 'border-white/[0.08] bg-[#1E293B]/20 hover:bg-white/[0.03]'}`}
                                            >
                                                <div className={`flex items-center justify-center w-[20px] h-[20px] rounded-[6px] border ${isChecked ? 'bg-blue-500 border-blue-500' : 'border-white/[0.2] bg-transparent'}`}>
                                                    <input 
                                                        type="checkbox"
                                                        className="hidden"
                                                        disabled={isDisabled}
                                                        checked={isChecked}
                                                        onChange={() => handleToggleFeature(feature.id)}
                                                    />
                                                    {isChecked && (
                                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <span className={`text-[14px] select-none ${isChecked ? 'text-white font-medium' : 'text-white/70'}`}>
                                                    {feature.label}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-[12px] px-[32px] pb-[32px] pt-[16px] border-t border-white/[0.06]">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 flex items-center justify-center h-[50px] rounded-[16px] border border-white/[0.08] bg-transparent text-[#F8FAFC] text-[16px] font-medium hover:bg-white/5 transition-colors font-['Inter']"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={isPending || editData?.role === 'owner'}
                        onClick={handleSave}
                        style={{ background: 'linear-gradient(90deg, rgba(59,130,246,1) 0%, rgba(45,212,191,1) 100%)' }}
                        className="flex-1 flex items-center justify-center gap-2 h-[50px] rounded-[16px] text-white text-[16px] font-semibold hover:opacity-90 transition-opacity shadow-[0_4px_6px_-4px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgba(0,0,0,0.1)] font-['Inter'] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isPending && <Loader2 className="w-5 h-5 animate-spin" />}
                        {isEditMode ? 'Save Changes' : 'Send Invite'}
                    </button>
                </div>
            </div>
        </>
    );
}
