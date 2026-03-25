"use client";

import React, { useState, useMemo, useTransition } from 'react';
import { Users, Plus, Trash2, Shield, ShieldAlert, Loader2, Search, MoreHorizontal, Mail, Power, PowerOff, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { removeStaff, bulkRemoveStaff, updateStaffStatus, resendInvite } from './actions';
import { StaffDrawer } from './StaffDrawer';

export type StaffMember = {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    avatar?: string | null;
    role: string;
    status: string;
    permissions: string[];
    lastLoginAt?: string | null;
};

export function StaffDirectoryClient({
    tenantId,
    initialStaff,
}: {
    tenantId: string;
    initialStaff: StaffMember[];
}) {
    const [staff, setStaff] = useState<StaffMember[]>(initialStaff);

    // Sync state when Server Action `revalidatePath` passes down a newly fetched `initialStaff` array
    React.useEffect(() => {
        setStaff(initialStaff);
    }, [initialStaff]);
    
    // UI States
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const itemsPerPage = 10;

    // Debounce search safely (simplified for local fast typing)
    const [debouncedSearch, setDebouncedSearch] = useState('');
    React.useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 1000);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Sorting & Filtering
    const filteredStaff = useMemo(() => {
        let filtered = [...staff];
        if (debouncedSearch) {
            const lowerQuery = debouncedSearch.toLowerCase();
            filtered = filtered.filter(s => 
                s.email.toLowerCase().includes(lowerQuery) || 
                ((s.firstName || '') + ' ' + (s.lastName || '')).toLowerCase().includes(lowerQuery)
            );
        }
        
        // Sort by lastLoginAt DESC
        filtered.sort((a, b) => {
            if (!a.lastLoginAt) return 1;
            if (!b.lastLoginAt) return -1;
            return new Date(b.lastLoginAt).getTime() - new Date(a.lastLoginAt).getTime();
        });

        return filtered;
    }, [staff, debouncedSearch]);

    const totalPages = Math.ceil(filteredStaff.length / itemsPerPage);
    const currentStaffPage = filteredStaff.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Handlers
    const handleSelectAll = () => {
        if (selectedIds.length === currentStaffPage.length && currentStaffPage.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(currentStaffPage.map(s => s.id));
        }
    };

    const handleSelectOne = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleBulkRemove = () => {
        if (!confirm(`Are you sure you want to remove ${selectedIds.length} staff members?`)) return;
        startTransition(async () => {
            const res = await bulkRemoveStaff(selectedIds);
            if (res.success) {
                setStaff(prev => prev.filter(s => !selectedIds.includes(s.id)));
                setSelectedIds([]);
                toast.success('Selected staff removed successfully');
            } else {
                toast.error(res.error || 'Failed to remove staff');
            }
        });
    };

    const handleRemove = (userId: string) => {
        if (!confirm('Are you sure you want to remove this user from the workspace?')) return;
        startTransition(async () => {
            const res = await removeStaff(userId);
            if (res.success) {
                setStaff(prev => prev.filter(s => s.id !== userId));
                toast.success('User removed from workspace');
                setOpenDropdownId(null);
            } else {
                toast.error(res.error || 'Failed to remove user');
            }
        });
    };

    const handleToggleStatus = (userId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
        startTransition(async () => {
            const res = await updateStaffStatus(userId, newStatus);
            if (res.success) {
                setStaff(prev => prev.map(s => s.id === userId ? { ...s, status: newStatus } : s));
                toast.success(`User marked as ${newStatus}`);
                setOpenDropdownId(null);
            } else {
                toast.error(res.error || 'Failed to update status');
            }
        });
    };

    const handleResend = (userId: string) => {
        startTransition(async () => {
            const res = await resendInvite(userId);
            if (res.success) {
                toast.success('Invitation email resent successfully');
                setOpenDropdownId(null);
            } else {
                toast.error(res.error || 'Failed to resend invite');
            }
        });
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'owner': return 'Workspace Owner';
            case 'admin': return 'Manager';
            case 'editor': return 'Editor';
            case 'viewer': return 'Viewer';
            case 'custom': return 'Crew (Custom)';
            default: return role;
        }
    };

    return (
        <div className="w-full space-y-[28px]">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="hidden sm:flex h-[50px] w-[50px] items-center justify-center rounded-[16px] bg-indigo-500/10 border border-indigo-500/20 shrink-0">
                        <Users className="h-6 w-6 text-indigo-500" />
                    </div>
                    <div>
                        <h1 className="text-[24px] font-bold text-slate-50">Team Members</h1>
                        <p className="mt-1 text-[14px] text-slate-50/60 font-normal">Manage who has access to your store and their permissions</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    {selectedIds.length > 0 && (
                        <button
                            type="button"
                            onClick={handleBulkRemove}
                            disabled={isPending}
                            className="flex items-center justify-center gap-2 h-[44px] px-[16px] rounded-[14px] bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors font-medium text-[14px]"
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete ({selectedIds.length})
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => { setEditingStaff(null); setIsDrawerOpen(true); }}
                        style={{ background: 'linear-gradient(90deg, rgba(59,130,246,1) 0%, rgba(45,212,191,1) 100%)' }}
                        className="flex items-center justify-center gap-2 h-[44px] px-[20px] rounded-[14px] text-white font-semibold shadow-[0_4px_6px_-4px_rgba(0,0,0,0.1)] hover:opacity-90 transition-opacity whitespace-nowrap font-['Inter']"
                    >
                        <Plus className="h-5 w-5" />
                        <span className="hidden sm:inline">Add Staff</span>
                    </button>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between gap-4">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                    <input 
                        type="text" 
                        placeholder="Search by email or name..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full h-[40px] pl-[40px] pr-[16px] rounded-[10px] bg-[#1E293B]/60 border border-white/[0.08] text-[14px] text-[#F8FAFC] placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
                    />
                </div>
            </div>

            {/* Table Area */}
            <div className="overflow-hidden rounded-[16px] border border-white/[0.08] bg-[#1E293B]/60 relative pb-[60px]">
                {/* Loader overlay */}
                {isPending && (
                    <div className="absolute inset-0 z-50 bg-[#0B1120]/50 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    </div>
                )}
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="border-b border-white/[0.08] bg-[#0B1120]/40">
                                <th className="px-[24px] py-[16px] w-[50px]">
                                    <div className="flex items-center justify-center">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedIds.length === currentStaffPage.length && currentStaffPage.length > 0}
                                            onChange={handleSelectAll}
                                            className="w-4 h-4 rounded-[4px] border-white/20 bg-[#1E293B] cursor-pointer" 
                                        />
                                    </div>
                                </th>
                                <th className="px-[24px] py-[16px] text-[13px] font-medium text-slate-400 uppercase tracking-wider">Full Name & Email</th>
                                <th className="px-[24px] py-[16px] text-[13px] font-medium text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="px-[24px] py-[16px] text-[13px] font-medium text-slate-400 uppercase tracking-wider">Role & Permissions</th>
                                <th className="px-[24px] py-[16px] text-[13px] font-medium text-slate-400 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.08]">
                            {currentStaffPage.map((user) => {
                                const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 
                                                    user.email.split('@')[0];
                                const isOwner = user.role === 'owner';
                                
                                return (
                                    <tr key={user.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-[24px] py-[20px]">
                                            <div className="flex items-center justify-center">
                                                <input 
                                                    type="checkbox" 
                                                    disabled={isOwner}
                                                    checked={selectedIds.includes(user.id)}
                                                    onChange={() => handleSelectOne(user.id)}
                                                    className="w-4 h-4 rounded-[4px] border-white/20 bg-[#1E293B] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" 
                                                />
                                            </div>
                                        </td>
                                        <td className="px-[24px] py-[20px] whitespace-nowrap">
                                            <div className="flex items-center gap-[16px]">
                                                {user.avatar ? (
                                                    <img src={user.avatar} alt={displayName} className="h-[44px] w-[44px] rounded-full object-cover border border-white/10" />
                                                ) : (
                                                    <div className="h-[44px] w-[44px] rounded-full bg-[#3B82F6]/20 border border-[#3B82F6]/30 flex items-center justify-center text-[#93C5FD] font-bold text-[18px]">
                                                        {displayName.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[15px] font-semibold text-[#F8FAFC]">{displayName}</span>
                                                        {isOwner && (
                                                            <div className="flex items-center justify-center h-[22px] px-2 rounded-full border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.2)]">
                                                                <span className="text-[11px] font-semibold text-[#C4B5FD] uppercase tracking-wider">Owner</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="text-[13px] text-slate-400">{user.email}</span>
                                                </div>
                                            </div>
                                        </td>
                                        
                                        <td className="px-[24px] py-[20px] whitespace-nowrap">
                                            {user.status === 'active' ? (
                                                <div className="flex h-[30px] w-fit items-center justify-center gap-[6px] rounded-[10px] border border-[#00C950]/30 bg-[#00C950]/10 pl-[8px] pr-[12px]">
                                                    <div className="w-2 h-2 rounded-full bg-[#05DF72]" />
                                                    <span className="text-[13px] font-medium leading-none text-[#B9F8CF]">Active</span>
                                                </div>
                                            ) : user.status === 'suspended' ? (
                                                <div className="flex h-[30px] w-fit items-center justify-center gap-[6px] rounded-[10px] border border-red-500/30 bg-red-500/10 pl-[8px] pr-[12px]">
                                                    <div className="w-2 h-2 rounded-full bg-red-400" />
                                                    <span className="text-[13px] font-medium leading-none text-red-300">Suspended</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-start gap-1">
                                                    <div className="flex h-[30px] w-fit items-center justify-center gap-[6px] rounded-[10px] border border-orange-500/30 bg-orange-500/10 pl-[8px] pr-[12px]">
                                                        <div className="w-2 h-2 rounded-full bg-orange-400" />
                                                        <span className="text-[13px] font-medium leading-none text-orange-300">Pending</span>
                                                    </div>
                                                    {/* Optional: Add Last Login check if relevant */}
                                                </div>
                                            )}
                                        </td>

                                        <td className="px-[24px] py-[20px]">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-[6px] text-slate-200">
                                                    {isOwner || user.role === 'admin' ? (
                                                        <Shield className="w-4 h-4 text-indigo-400" />
                                                    ) : (
                                                        <ShieldAlert className="w-4 h-4 text-emerald-400" />
                                                    )}
                                                    <span className="font-medium text-[14px]">{getRoleLabel(user.role)}</span>
                                                </div>
                                                
                                                {user.role === 'custom' && user.permissions?.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                        {user.permissions.map(p => (
                                                            <span key={p} className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                                                                {p.replace('-', ' ')}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        <td className="px-[24px] py-[20px] whitespace-nowrap text-right relative">
                                            {/* Action Dropdown Toggle */}
                                            <button
                                                type="button"
                                                onClick={() => setOpenDropdownId(openDropdownId === user.id ? null : user.id)}
                                                className="inline-flex items-center justify-center w-[36px] h-[36px] rounded-[10px] hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                                            >
                                                <MoreHorizontal className="w-5 h-5" />
                                            </button>

                                            {/* Dropdown Menu */}
                                            {openDropdownId === user.id && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={() => setOpenDropdownId(null)} />
                                                    <div className="absolute right-[24px] top-[50px] z-50 w-[180px] rounded-[12px] bg-[#1E293B] border border-white/[0.08] shadow-xl py-1 animate-in zoom-in-95 duration-150">
                                                        <button 
                                                            disabled={isOwner}
                                                            onClick={() => { setEditingStaff(user); setIsDrawerOpen(true); setOpenDropdownId(null); }}
                                                            className="flex w-full items-center gap-2 px-4 py-2 text-[13px] text-slate-200 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                                                        >
                                                            <Edit2 className="w-4 h-4 text-slate-400" /> Edit Details
                                                        </button>
                                                        
                                                        {user.status === 'pending' && (
                                                            <button 
                                                                disabled={isOwner}
                                                                onClick={() => handleResend(user.id)}
                                                                className="flex w-full items-center gap-2 px-4 py-2 text-[13px] text-slate-200 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                                                            >
                                                                <Mail className="w-4 h-4 text-indigo-400" /> Resend Invite
                                                            </button>
                                                        )}

                                                        <button 
                                                            disabled={isOwner}
                                                            onClick={() => handleToggleStatus(user.id, user.status)}
                                                            className="flex w-full items-center gap-2 px-4 py-2 text-[13px] text-slate-200 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                                                        >
                                                            {user.status === 'active' ? (
                                                                <><PowerOff className="w-4 h-4 text-orange-400" /> Deactivate</>
                                                            ) : (
                                                                <><Power className="w-4 h-4 text-emerald-400" /> Activate</>
                                                            )}
                                                        </button>

                                                        <div className="h-px bg-white/[0.06] my-1" />

                                                        <button 
                                                            disabled={isOwner}
                                                            onClick={() => handleRemove(user.id)}
                                                            className="flex w-full items-center gap-2 px-4 py-2 text-[13px] text-red-400 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed text-left hover:text-red-300"
                                                        >
                                                            <Trash2 className="w-4 h-4" /> Remove User
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}

                            {currentStaffPage.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-[24px] py-[60px] text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-3">
                                            <Users className="w-10 h-10 text-slate-600" />
                                            <p>{debouncedSearch ? 'No staff members match your search.' : 'No staff members found.'}</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination (Absolute bottom inside table wrapper) */}
                {totalPages > 1 && (
                    <div className="absolute bottom-0 left-0 right-0 h-[56px] border-t border-white/[0.08] flex items-center justify-between px-[24px] bg-[#0B1120]/40">
                        <span className="text-[13px] text-slate-400">
                            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredStaff.length)} of {filteredStaff.length} results
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                className="px-3 py-1.5 rounded-[8px] text-[13px] font-medium text-slate-300 bg-[#1E293B] border border-white/[0.08] hover:bg-[#1E293B]/80 disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <button
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                className="px-3 py-1.5 rounded-[8px] text-[13px] font-medium text-slate-300 bg-[#1E293B] border border-white/[0.08] hover:bg-[#1E293B]/80 disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <StaffDrawer 
                isOpen={isDrawerOpen} 
                onClose={() => { setIsDrawerOpen(false); setEditingStaff(null); }} 
                editData={editingStaff}
            />
        </div>
    );
}
