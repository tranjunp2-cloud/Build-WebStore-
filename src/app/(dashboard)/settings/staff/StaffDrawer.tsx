"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { inviteStaffAction, updateStaff } from './actions';
import type { StaffMember } from './StaffDirectoryClient';

const CUSTOM_FEATURES = [
    { id: 'products', label: 'Products & Inventory' },
    { id: 'orders', label: 'Orders & Fulfillment' },
    { id: 'blog', label: 'Blog Management' },
    { id: 'builder', label: 'Store Design (Builder)' },
    { id: 'settings', label: 'Settings & Domain' },
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
    const [role, setRole] = useState<'admin' | 'custom'>('admin');
    const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        if (isOpen) {
            if (editData) {
                setEmail(editData.email);
                setRole(editData.role === 'admin' || editData.role === 'owner' ? 'admin' : 'custom');
                setSelectedFeatures(editData.permissions || []);
            } else {
                setEmail('');
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
                if (!editData) return;
                const displayName = [editData.firstName, editData.lastName].filter(Boolean).join(' ') || '';
                const res = await updateStaff(editData.id, displayName, role, role === 'custom' ? selectedFeatures : undefined);
                if (res.success) {
                    toast.success('Staff updated successfully!');
                    onClose();
                } else {
                    toast.error(res.error || 'Failed to update staff');
                }
            } else {
                const res = await inviteStaffAction({
                    email: email,
                    name: email.split('@')[0], 
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
            <div className="fixed inset-0 z-[100] bg-slate-950/60 animate-in fade-in duration-200" onClick={onClose} />
            
            <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] flex flex-col w-[calc(100%-32px)] sm:w-full max-w-[448px] max-h-[calc(100vh-32px)] bg-slate-800 rounded-[16px] animate-in zoom-in-95 duration-200" style={{ border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 25px 50px -12px rgba(59,130,246,0.2)' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-[24px] pt-[24px] pb-[16px]">
                    <h2 className="text-[24px] font-bold text-slate-50 leading-[1.333em] font-['Inter']">
                        {isEditMode ? 'Edit Staff Permissions' : 'Invite New Staff'}
                    </h2>
                    <button onClick={onClose} className="p-0 m-0 border-none shadow-none outline-none appearance-none bg-transparent hover:bg-white/5 rounded-[8px] flex items-center justify-center w-[32px] h-[32px] text-slate-50/60 hover:text-white transition-colors">
                        <X className="w-5 h-5" strokeWidth={1.6} />
                    </button>
                </div>

                {/* Header bottom divider (Above Email) */}
                <div className="w-full h-[1px] bg-[rgba(255,255,255,0.08)] shrink-0" />

                {/* Body Content */}
                <div className="flex flex-col overflow-y-auto max-h-[70vh]">
                    
                    {/* Email Input */}
                    <div className="flex flex-col gap-[8px] px-[24px] pt-[24px]">
                        <label className="text-[14px] font-medium text-slate-50 font-['Inter']">
                            {isEditMode ? 'Login Email' : 'Email Address'}
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isEditMode}
                            placeholder="staff@domain.com"
                            className="w-full h-[48px] px-[16px] rounded-[12px] bg-slate-900/50 text-[16px] text-slate-50 placeholder:text-slate-50/40 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all font-['Inter'] disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                        />
                        {!isEditMode && (
                            <p className="text-[12px] font-normal text-slate-50/50 font-['Inter'] mt-[4px]">
                                Send an invitation to join your store.
                            </p>
                        )}
                    </div>

                    {/* Role Selection */}
                    <div className="flex flex-col gap-[16px] px-[24px] pt-[24px] pb-[24px]">
                        <label className="text-[14px] font-semibold text-slate-50 font-['Inter']">
                            Select Role
                        </label>
                        <div className="flex flex-col gap-[12px]">
                            
                            {/* Full Access Option */}
                            <div 
                                onClick={() => { if(editData?.role !== 'owner') setRole('admin'); }}
                                className={`flex items-start px-[18px] py-[18px] min-h-[76px] rounded-[12px] border-2 border-solid transition-all cursor-pointer ${
                                    role === 'admin' 
                                        ? 'border-blue-500 bg-blue-500/5' 
                                        : 'border-white/10 bg-transparent hover:bg-white/5'
                                } ${editData?.role === 'owner' ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <div className={`flex shrink-0 items-center justify-center w-[20px] h-[20px] rounded-full border-2 border-solid transition-all mr-[16px] mt-[1px] ${role === 'admin' ? 'border-blue-500' : 'border-white/30 bg-transparent'}`}>
                                    {role === 'admin' && <div className="w-[10px] h-[10px] rounded-full bg-blue-500" />}
                                </div>
                                <div className="flex flex-col">
                                    <span className={`text-[15px] font-medium leading-tight mb-[6px] ${role === 'admin' ? 'text-slate-50' : 'text-slate-50/80'}`}>Full Access</span>
                                    <span className="text-[13px] text-slate-50/50">Can manage everything except delete the store.</span>
                                </div>
                            </div>

                            {/* Custom Features Option */}
                            <div 
                                onClick={() => {
                                    if(editData?.role !== 'owner' && role !== 'custom') {
                                        setRole('custom');
                                    }
                                }}
                                className={`flex flex-col w-full rounded-[12px] border-2 border-solid transition-all ${
                                    role === 'custom' 
                                        ? 'border-blue-500 bg-blue-500/5' 
                                        : 'border-white/10 bg-transparent hover:bg-white/5 cursor-pointer'
                                } ${editData?.role === 'owner' ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <div className={`flex items-center px-[18px] ${role === 'custom' ? 'pt-[18px] pb-[16px]' : 'py-[18px]'}`}>
                                    <div className={`flex shrink-0 items-center justify-center w-[20px] h-[20px] rounded-full border-2 border-solid transition-all mr-[16px] ${role === 'custom' ? 'border-blue-500' : 'border-white/30 bg-transparent'}`}>
                                        {role === 'custom' && <div className="w-[10px] h-[10px] rounded-full bg-blue-500" />}
                                    </div>
                                    <span className={`text-[15px] font-medium leading-tight ${role === 'custom' ? 'text-slate-50' : 'text-slate-50/80'}`}>
                                        Custom Features
                                    </span>
                                </div>
                                
                                {role === 'custom' && (
                                    <div className="flex flex-col gap-[12px] pb-[20px] pr-[18px] pl-[54px] animate-in fade-in duration-200">
                                        {CUSTOM_FEATURES.map(feature => {
                                            const isChecked = selectedFeatures.includes(feature.id);
                                            const isFeatureDisabled = editData?.role === 'owner';
                                            return (
                                                <div 
                                                    key={feature.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if(!isFeatureDisabled) handleToggleFeature(feature.id);
                                                    }}
                                                    className={`flex items-center gap-[12px] cursor-pointer transition-all ${isFeatureDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    <div className={`flex shrink-0 items-center justify-center w-[18px] h-[18px] rounded-[4px] border border-solid transition-colors ${isChecked ? 'bg-blue-500 border-blue-500' : 'border-white/20 bg-transparent hover:border-white/40'}`} />
                                                    <span className={`text-[14px] leading-tight select-none ${isChecked ? 'text-slate-50 font-medium' : 'text-slate-50/80 font-normal'}`}>
                                                        {feature.label}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                </div>

                {/* Divider below Role Selection (Footer top line) */}
                <div className="w-full h-[1px] bg-[rgba(255,255,255,0.08)] shrink-0" />

                {/* Footer buttons */}
                <div className="flex items-center justify-end gap-[12px] px-[24px] py-[24px]">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex items-center justify-center px-[28px] h-[46px] rounded-[12px] bg-slate-900/50 text-slate-50 text-[16px] font-medium hover:bg-white/10 transition-colors font-['Inter']"
                        style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={isPending || editData?.role === 'owner'}
                        onClick={handleSave}
                        style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)', boxShadow: '0px 4px 6px -4px rgba(59, 130, 246, 0.3), 0px 10px 15px -3px rgba(59, 130, 246, 0.3)' }}
                        className="flex items-center justify-center px-[32px] h-[46px] rounded-[12px] text-white text-[16px] font-semibold hover:opacity-90 transition-opacity font-['Inter'] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        {isEditMode ? 'Save Changes' : 'Send Invite'}
                    </button>
                </div>
            </div>
        </>
    );
}
