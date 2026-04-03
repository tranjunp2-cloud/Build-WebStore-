"use client";

import React, { useState, useMemo, useTransition } from 'react';
import { useI18n } from '@/i18n';
import { Users, Plus, UserPlus, Trash2, Shield, ShieldAlert, Loader2, Search, MoreHorizontal, Mail, Power, PowerOff, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { removeStaff, bulkRemoveStaff, updateStaffStatus, resendInvite } from './actions';
import { StaffDrawer } from './StaffDrawer';
import { RemoveStaffModal } from './RemoveStaffModal';

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
    createdAt?: string | null;
};

export function StaffDirectoryClient({
    tenantId,
    initialStaff,
    currentUserId,
    currentUserRole,
}: {
    tenantId: string;
    initialStaff: StaffMember[];
    currentUserId: string;
    currentUserRole: string;
}) {
    const { t, ti } = useI18n();
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
    const [userToRemove, setUserToRemove] = useState<StaffMember | null>(null);
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

        // Sort by createdAt DESC (newest first)
        filtered.sort((a, b) => {
            if (!a.createdAt) return 1;
            if (!b.createdAt) return -1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
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
                toast.success(t?.Staff?.toast?.removedBulk || 'Selected staff removed successfully');
            } else {
                toast.error(res.error || 'Failed to remove staff');
            }
        });
    };

    const handleRemove = (userId: string) => {
        const user = staff.find(s => s.id === userId);
        if (user) setUserToRemove(user);
    };

    const handleToggleStatus = (userId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
        startTransition(async () => {
            const res = await updateStaffStatus(userId, newStatus);
            if (res.success) {
                setStaff(prev => prev.map(s => s.id === userId ? { ...s, status: newStatus } : s));
                toast.success(ti(t?.Staff?.toast?.updated || 'User marked as {status}', { status: newStatus }));
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
                toast.success(t?.Staff?.toast?.resent || 'Invitation email resent successfully');
                setOpenDropdownId(null);
            } else {
                toast.error(res.error || 'Failed to resend invite');
            }
        });
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'owner': return t?.Staff?.table?.owner || 'Workspace Owner';
            case 'admin': return t?.Staff?.drawer?.roles?.admin || 'Manager';
            case 'viewer': return t?.Staff?.table?.viewer || 'Viewer';
            case 'custom': return t?.Staff?.table?.custom || 'Crew (Custom)';
            default: return role;
        }
    };

    return (
        <div className="w-full space-y-[28px]">
            {/* Page Header — Figma 31058:693 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col">
                    <div className="m-0 p-0 text-[30px] font-bold text-[#F8FAFC] leading-[1.2em] font-['Inter']">{t?.Staff?.title || 'Staff Management'}</div>
                    <div className="m-0 p-0 mt-[2px] text-[14px] font-normal text-[rgba(248,250,252,0.6)] leading-[1.428em] font-['Inter']">{t?.Staff?.description || 'Manage your team members and their access permissions'}</div>
                </div>

                <div className="flex items-center gap-[12px]">
                    {selectedIds.length > 0 && (
                        <button
                            type="button"
                            onClick={handleBulkRemove}
                            disabled={isPending}
                            className="flex items-center justify-center gap-2 h-[48px] px-[16px] rounded-[16px] bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors font-medium text-[14px]"
                        >
                            <Trash2 className="h-4 w-4" />
                            {ti(t?.Staff?.deleteSelected || 'Delete ({count})', { count: selectedIds.length })}
                        </button>
                    )}
                    {/* Invite Staff Button — Figma 31058:699 */}
                    <button
                        type="button"
                        onClick={() => { setEditingStaff(null); setIsDrawerOpen(true); }}
                        style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)', boxShadow: '0px 4px 6px -4px rgba(59, 130, 246, 0.3), 0px 10px 15px -3px rgba(59, 130, 246, 0.3)' }}
                        className="flex items-center justify-center gap-[8px] h-[48px] px-[24px] rounded-[16px] text-white text-[16px] font-semibold leading-[1.5em] hover:opacity-90 transition-opacity whitespace-nowrap font-['Inter']"
                    >
                        <UserPlus className="h-5 w-5" />
                        <span>{t?.Staff?.inviteBtn || 'Invite Staff'}</span>
                    </button>
                </div>
            </div>



            {/* Table Area — Figma 31058:706 */}
            <div className="overflow-hidden rounded-[16px] border border-white/[0.08] bg-[#1E293B]">
                {/* Heading 2 — Figma 31058:708 */}
                <div className="py-[16px] px-[24px] pb-[1px] border-b border-white/[0.08]">
                    <h2 className="text-[18px] font-semibold text-[#F8FAFC] leading-[1.556em] font-['Inter']">{t?.Staff?.directoryTitle || 'Staff Directory'}</h2>
                </div>

                {/* Loader overlay */}
                {isPending && (
                    <div className="absolute inset-0 z-50 bg-[#0B1120]/50 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    </div>
                )}
                
                {/* Card Gap: 24px — Figma 31058:706 */}
                <div className="overflow-x-auto mt-[24px]">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="border-b border-white/[0.08]">
                                <th className="px-[24px] py-[16px] text-[12px] font-semibold text-[rgba(248,250,252,0.6)] uppercase tracking-[0.05em] leading-[1.333em] font-['Inter']">{t?.Staff?.table?.nameEmail || 'NAME / EMAIL'}</th>
                                <th className="px-[24px] py-[16px] text-[12px] font-semibold text-[rgba(248,250,252,0.6)] uppercase tracking-[0.05em] leading-[1.333em] font-['Inter']">{t?.Staff?.table?.role || 'ROLE'}</th>
                                <th className="px-[24px] py-[16px] text-[12px] font-semibold text-[rgba(248,250,252,0.6)] uppercase tracking-[0.05em] leading-[1.333em] font-['Inter']">{t?.Staff?.table?.status || 'STATUS'}</th>
                                <th className="px-[24px] py-[16px] text-[12px] font-semibold text-[rgba(248,250,252,0.6)] uppercase tracking-[0.05em] leading-[1.333em] font-['Inter']">{t?.Staff?.table?.actions || 'ACTIONS'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.08]">
                            {currentStaffPage.map((user) => {
                                const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') ||
                                    user.email.split('@')[0];
                                const isOwner = user.role === 'owner';
                                
                                const isSelf = user.id === currentUserId;
                                const isTargetOwner = user.role === 'owner';
                                const amIOwner = currentUserRole === 'owner';

                                // Owner can edit/delete anyone except themselves (to prevent accidental self-demotion or error)
                                const canEdit = !isSelf && amIOwner;
                                const canDelete = !isSelf && amIOwner;

                                return (
                                    <tr key={user.id} className="h-[73px] border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors group">
                                        {/* NAME / EMAIL */}
                                        <td className="px-[24px] whitespace-nowrap">
                                            <div className="flex items-center gap-[12px]">
                                                {user.avatar ? (
                                                    <img src={user.avatar} alt={displayName} className="h-[40px] w-[40px] rounded-full object-cover" />
                                                ) : (
                                                    <div
                                                        className="h-[40px] w-[40px] rounded-full flex items-center justify-center text-white text-[14px] font-semibold font-['Inter'] leading-[1.428em]"
                                                        style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 1) 0%, rgba(57, 137, 243, 1) 7%, rgba(55, 143, 239, 1) 14%, rgba(53, 150, 236, 1) 21%, rgba(51, 156, 233, 1) 29%, rgba(45, 212, 191, 1) 100%)' }}
                                                    >
                                                        {displayName.substring(0, 2).toUpperCase()}
                                                    </div>
                                                )}
                                                <div className="flex flex-col h-[40px] justify-center gap-[0px]">
                                                    <span className="text-[14px] font-medium text-[#F8FAFC] leading-[1.428em] font-['Inter']">{displayName}</span>
                                                    <span className="text-[12px] font-normal text-[rgba(248,250,252,0.6)] leading-[1.333em] font-['Inter']">{user.email}</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* ROLE */}
                                        <td className="px-[24px] whitespace-nowrap">
                                            {isOwner ? (
                                                <div className="inline-flex items-center justify-center h-[30px] px-[12px] py-[6px] rounded-[12px] bg-[rgba(59,130,246,0.1)] border border-[rgba(59,130,246,0.2)]">
                                                    <span className="text-[12px] font-semibold text-[#3B82F6] leading-[1.333em] font-['Inter']">{t?.Staff?.table?.owner || 'Owner'}</span>
                                                </div>
                                            ) : user.role === 'custom' ? (
                                                <div className="inline-flex items-center justify-center h-[30px] px-[12px] py-[6px] rounded-[12px] bg-[rgba(240,177,0,0.1)] border border-[rgba(240,177,0,0.2)]">
                                                    <span className="text-[12px] font-semibold text-[#FDC700] leading-[1.333em] font-['Inter']">{t?.Staff?.table?.custom || 'Custom Features'}</span>
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center justify-center h-[30px] px-[12px] py-[6px] rounded-[12px] bg-[rgba(0,201,80,0.1)] border border-[rgba(0,201,80,0.2)]">
                                                    <span className="text-[12px] font-semibold text-[#05DF72] leading-[1.333em] font-['Inter']">{t?.Staff?.table?.fullAccess || 'Full Access'}</span>
                                                </div>
                                            )}
                                        </td>

                                        {/* STATUS */}
                                        <td className="px-[24px] whitespace-nowrap">
                                            {user.status === 'active' ? (
                                                <div className="flex items-center gap-[8px]">
                                                    <div className="w-[8px] h-[8px] rounded-full bg-[#00C950]"></div>
                                                    <span className="text-[14px] font-normal text-[rgba(248,250,252,0.8)] leading-[1.428em] font-['Inter']">{t?.Staff?.table?.active || 'Active'}</span>
                                                </div>
                                            ) : user.status === 'suspended' ? (
                                                <div className="flex items-center gap-[8px]">
                                                    <div className="w-[8px] h-[8px] rounded-full bg-[#EF4444]"></div>
                                                    <span className="text-[14px] font-normal text-[rgba(248,250,252,0.8)] leading-[1.428em] font-['Inter']">{t?.Staff?.table?.suspended || 'Suspended'}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-[8px]">
                                                    <div className="w-[8px] h-[8px] rounded-full bg-[rgba(248,250,252,0.3)]"></div>
                                                    <span className="text-[14px] font-normal text-[rgba(248,250,252,0.8)] leading-[1.428em] font-['Inter']">Pending</span>
                                                </div>
                                            )}
                                        </td>

                                        {/* ACTIONS */}
                                        <td className="px-[24px] whitespace-nowrap relative">
                                            {(!canEdit && !canDelete) ? (
                                                <span className="text-[14px] font-normal text-[rgba(248,250,252,0.4)] leading-[1.428em] font-['Inter']">—</span>
                                            ) : (
                                                <div className="flex items-center gap-[16px]">
                                                    {canEdit && (
                                                        <button
                                                            type="button"
                                                            onClick={() => { setEditingStaff(user); setIsDrawerOpen(true); }}
                                                            className="bg-transparent border-none shadow-none p-0 m-0 outline-none hover:opacity-80 transition-opacity flex items-center justify-center"
                                                            title="Edit Details"
                                                        >
                                                            <Edit2 className="w-[18px] h-[18px] text-[#3B82F6]" strokeWidth={2.5} />
                                                        </button>
                                                    )}
                                                    
                                                    {canDelete && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemove(user.id)}
                                                            className="bg-transparent border-none shadow-none p-0 m-0 outline-none hover:opacity-80 transition-opacity flex items-center justify-center"
                                                            title="Remove User"
                                                        >
                                                            <Trash2 className="w-[18px] h-[18px] text-[#FF6467]" strokeWidth={2.5} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}

                            {currentStaffPage.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-[24px] py-[60px] text-center text-[rgba(248,250,252,0.6)]">
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

                {/* Pagination (Inline flow) */}
                {totalPages > 1 && (
                    <div className="h-[56px] border-t border-white/[0.08] flex items-center justify-between px-[24px] bg-[#1E293B]">
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
                currentUserId={currentUserId}
                tenantId={tenantId}
            />

            <RemoveStaffModal
                isOpen={!!userToRemove}
                onClose={() => setUserToRemove(null)}
                user={userToRemove}
                onSuccess={(userId) => {
                    setStaff(prev => prev.filter(s => s.id !== userId));
                    setSelectedIds(prev => prev.filter(id => id !== userId));
                    setUserToRemove(null);
                }}
            />
        </div>
    );
}
