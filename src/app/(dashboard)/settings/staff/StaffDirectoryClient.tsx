"use client";

import React, { useState, useMemo, useTransition } from 'react';
import { useI18n } from '@/i18n';
import { Users, UserPlus, Trash2, Loader2, Search, Edit2, SearchX } from 'lucide-react';
import { toast } from 'sonner';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableActionButton } from '@/components/ui/table';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { TablePagination, shouldShowTablePagination, useTablePageClamp } from '@/components/ui/table-pagination';
import { TableEmptyState } from '@/components/ui/table-empty-state';
import { Button } from '@/components/ui/button';
import { removeStaff } from './actions';
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
    const [userToRemove, setUserToRemove] = useState<StaffMember | null>(null);
    const [isPending, startTransition] = useTransition();

    // Rows-per-page stateful for the DS pagination selector ([10,25,50,100]) (GH-1290 Bug 4)
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const handleLimitChange = (n: number) => { setItemsPerPage(n); setCurrentPage(1); };

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
    // GH-1579: snap back when removals/search strand currentPage past the last page
    useTablePageClamp(currentPage, filteredStaff.length, itemsPerPage, setCurrentPage);

    // Handlers
    const handleRemove = (userId: string) => {
        const user = staff.find(s => s.id === userId);
        if (user) setUserToRemove(user);
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
                    <div className="m-0 p-0 text-[30px] font-bold text-[var(--dash-text)] leading-[1.2em] font-['Inter']">{t?.Staff?.title || 'Staff Management'}</div>
                    <div className="m-0 p-0 mt-[2px] text-[14px] font-normal text-[var(--dash-text-muted)] leading-[1.428em] font-['Inter']">{t?.Staff?.description || 'Manage your team members and their access permissions'}</div>
                </div>

                <div className="flex items-center gap-[12px]">
                    {/* Invite Staff Button — Figma 31058:699 */}
                    <Button
                        type="button"
                        onClick={() => { setEditingStaff(null); setIsDrawerOpen(true); }}
                        variant="dashPrimary"
                        size="dash"
                        className="whitespace-nowrap font-['Inter']"
                    >
                        <UserPlus className="h-4 w-4" />
                        <span>{t?.Staff?.inviteBtn || 'Invite Staff'}</span>
                    </Button>
                </div>
            </div>



            {/* Table Area — shared <Table> (GH-1222); relative wrapper hosts the loader overlay */}
            <div className="relative">
                {/* Loader overlay */}
                {isPending && (
                    <div className="absolute inset-0 z-50 bg-black/30 flex items-center justify-center rounded-[12px]">
                        <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
                    </div>
                )}

                {/* Empty state — shown in place of the table when no staff match */}
                {filteredStaff.length === 0 ? (
                    debouncedSearch ? (
                        <TableEmptyState
                            icon={<SearchX />}
                            title={t?.Staff?.emptyState?.noMatch || 'No staff members match your search.'}
                        />
                    ) : (
                        <TableEmptyState
                            icon={<Users />}
                            title={t?.Staff?.emptyState?.noStaff || 'No staff members found.'}
                        />
                    )
                ) : (
                    <>
                    {/* Mobile (< md): card list — easier to read than the scrolling table */}
                    <div className="md:hidden flex flex-col gap-3">
                        {currentStaffPage.map((user) => {
                            const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email.split('@')[0];
                            const isOwner = user.role === 'owner';
                            const canManage = user.id !== currentUserId && currentUserRole === 'owner';
                            return (
                                <div key={user.id} className="rounded-[12px] border p-4 flex flex-col gap-3" style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-surface)' }}>
                                    <div className="flex items-start gap-3">
                                        {user.avatar ? (
                                            <img src={user.avatar} alt={displayName} className="h-[40px] w-[40px] rounded-full object-cover shrink-0" />
                                        ) : (
                                            <div className="h-[40px] w-[40px] rounded-full flex items-center justify-center text-white text-[14px] font-semibold shrink-0" style={{ background: 'linear-gradient(135deg, hsl(var(--info)) 0%, hsl(var(--primary)) 100%)' }}>
                                                {displayName.substring(0, 2).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="flex flex-col min-w-0 flex-1">
                                            <span className="text-[14px] font-medium text-[var(--dash-text)] truncate">{displayName}</span>
                                            <span className="text-[12px] text-[var(--dash-text-muted)] truncate" title={user.email}>{user.email}</span>
                                        </div>
                                        {canManage && (
                                            <div className="flex items-center gap-1 shrink-0">
                                                <TableActionButton onClick={() => { setEditingStaff(user); setIsDrawerOpen(true); }}>
                                                    <Edit2 className="w-4 h-4" />
                                                </TableActionButton>
                                                <TableActionButton variant="danger" onClick={() => handleRemove(user.id)}>
                                                    <Trash2 className="w-4 h-4" />
                                                </TableActionButton>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        {isOwner ? (
                                            <div className="inline-flex items-center h-[28px] px-[12px] rounded-[12px] bg-[hsl(var(--info)/0.1)] border border-[hsl(var(--info)/0.2)]"><span className="text-[12px] font-semibold text-[hsl(var(--info))]">{t?.Staff?.table?.owner || 'Owner'}</span></div>
                                        ) : user.role === 'custom' ? (
                                            <div className="inline-flex items-center h-[28px] px-[12px] rounded-[12px] bg-[hsl(var(--warning)/0.1)] border border-[hsl(var(--warning)/0.2)]"><span className="text-[12px] font-semibold text-[hsl(var(--warning))]">{t?.Staff?.table?.custom || 'Custom Features'}</span></div>
                                        ) : (
                                            <div className="inline-flex items-center h-[28px] px-[12px] rounded-[12px] bg-[hsl(var(--success)/0.1)] border border-[hsl(var(--success)/0.2)]"><span className="text-[12px] font-semibold text-[hsl(var(--success))]">{t?.Staff?.table?.fullAccess || 'Manager'}</span></div>
                                        )}
                                        <div className="flex items-center gap-[8px] shrink-0">
                                            <div className="w-[8px] h-[8px] rounded-full" style={{ background: user.status === 'active' ? 'hsl(var(--success))' : user.status === 'suspended' ? 'hsl(var(--destructive))' : 'var(--dash-text-muted)', opacity: user.status === 'pending' ? 0.5 : 1 }} />
                                            <span className="text-[13px] text-[var(--dash-text)]">{user.status === 'active' ? (t?.Staff?.table?.active || 'Active') : user.status === 'suspended' ? (t?.Staff?.table?.suspended || 'Suspended') : (t?.Staff?.table?.pending || 'Pending')}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {shouldShowTablePagination(filteredStaff.length) && (
                            <div className="pt-2">
                                <TablePagination
                                    page={currentPage}
                                    total={filteredStaff.length}
                                    limit={itemsPerPage}
                                    onPageChange={setCurrentPage}
                                    onLimitChange={handleLimitChange}
                                    labels={{ unit: t?.Staff?.title || 'staff' }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Tablet / desktop (md+): table */}
                    <div className="hidden md:block">
                    <Table
                        minWidth={640}
                        footer={shouldShowTablePagination(filteredStaff.length) ? (
                            <TablePagination
                                page={currentPage}
                                total={filteredStaff.length}
                                limit={itemsPerPage}
                                onPageChange={setCurrentPage}
                                onLimitChange={handleLimitChange}
                                labels={{ unit: t?.Staff?.title || 'staff' }}
                            />
                        ) : undefined}
                    >
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t?.Staff?.table?.nameEmail || 'NAME / EMAIL'}</TableHead>
                                <TableHead>{t?.Staff?.table?.role || 'ROLE'}</TableHead>
                                <TableHead>{t?.Staff?.table?.status || 'STATUS'}</TableHead>
                                <TableHead>{t?.Staff?.table?.actions || 'ACTIONS'}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {currentStaffPage.map((user) => {
                                const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') ||
                                    user.email.split('@')[0];
                                const isOwner = user.role === 'owner';

                                const isSelf = user.id === currentUserId;
                                const amIOwner = currentUserRole === 'owner';

                                // Owner can edit/delete anyone except themselves (to prevent accidental self-demotion or error)
                                const canEdit = !isSelf && amIOwner;
                                const canDelete = !isSelf && amIOwner;

                                return (
                                    <TableRow key={user.id} className="hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors group">
                                        {/* NAME / EMAIL */}
                                        <TableCell className="px-4 py-3 whitespace-nowrap">
                                            <div className="flex items-center gap-[12px]">
                                                {user.avatar ? (
                                                    <img src={user.avatar} alt={displayName} className="h-[40px] w-[40px] rounded-full object-cover" />
                                                ) : (
                                                    <div
                                                        className="h-[40px] w-[40px] rounded-full flex items-center justify-center text-white text-[14px] font-semibold font-['Inter'] leading-[1.428em]"
                                                        style={{ background: 'linear-gradient(135deg, hsl(var(--info)) 0%, hsl(var(--primary)) 100%)' }}
                                                    >
                                                        {displayName.substring(0, 2).toUpperCase()}
                                                    </div>
                                                )}
                                                <div className="flex flex-col h-[40px] justify-center gap-[0px]">
                                                    <span className="text-[14px] font-medium text-[var(--dash-text)] leading-[1.428em] font-['Inter']">{displayName}</span>
                                                    <span className="text-[12px] font-normal text-[var(--dash-text-muted)] leading-[1.333em] font-['Inter'] max-w-[140px] xl:max-w-[200px] truncate block" title={user.email}>{user.email}</span>
                                                </div>
                                            </div>
                                        </TableCell>

                                        {/* ROLE */}
                                        <TableCell className="px-4 py-3 whitespace-nowrap">
                                            {isOwner ? (
                                                <div className="inline-flex items-center justify-center h-[30px] px-[12px] py-[6px] rounded-[12px] bg-[hsl(var(--info)/0.1)] border border-[hsl(var(--info)/0.2)]">
                                                    <span className="text-[12px] font-semibold text-[hsl(var(--info))] leading-[1.333em] font-['Inter']">{t?.Staff?.table?.owner || 'Owner'}</span>
                                                </div>
                                            ) : user.role === 'custom' ? (
                                                <div className="inline-flex items-center justify-center h-[30px] px-[12px] py-[6px] rounded-[12px] bg-[hsl(var(--warning)/0.1)] border border-[hsl(var(--warning)/0.2)]">
                                                    <span className="text-[12px] font-semibold text-[hsl(var(--warning))] leading-[1.333em] font-['Inter']">{t?.Staff?.table?.custom || 'Custom Features'}</span>
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center justify-center h-[30px] px-[12px] py-[6px] rounded-[12px] bg-[hsl(var(--success)/0.1)] border border-[hsl(var(--success)/0.2)]">
                                                    <span className="text-[12px] font-semibold text-[hsl(var(--success))] leading-[1.333em] font-['Inter']">{t?.Staff?.table?.fullAccess || 'Manager'}</span>
                                                </div>
                                            )}
                                        </TableCell>

                                        {/* STATUS */}
                                        <TableCell className="px-4 py-3 whitespace-nowrap">
                                            {user.status === 'active' ? (
                                                <div className="flex items-center gap-[8px]">
                                                    <div className="w-[8px] h-[8px] rounded-full bg-[hsl(var(--success))]"></div>
                                                    <span className="text-[14px] font-normal text-[var(--dash-text)] leading-[1.428em] font-['Inter']">{t?.Staff?.table?.active || 'Active'}</span>
                                                </div>
                                            ) : user.status === 'suspended' ? (
                                                <div className="flex items-center gap-[8px]">
                                                    <div className="w-[8px] h-[8px] rounded-full bg-[hsl(var(--destructive))]"></div>
                                                    <span className="text-[14px] font-normal text-[var(--dash-text)] leading-[1.428em] font-['Inter']">{t?.Staff?.table?.suspended || 'Suspended'}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-[8px]">
                                                    <div className="w-[8px] h-[8px] rounded-full" style={{ background: 'var(--dash-text-muted)', opacity: 0.5 }}></div>
                                                    <span className="text-[14px] font-normal text-[var(--dash-text)] leading-[1.428em] font-['Inter']">{t?.Staff?.table?.pending || 'Pending'}</span>
                                                </div>
                                            )}
                                        </TableCell>

                                        {/* ACTIONS */}
                                        <TableCell className="px-4 py-3 whitespace-nowrap relative">
                                            {(!canEdit && !canDelete) ? (
                                                <span className="text-[14px] font-normal text-[var(--dash-text-muted)] leading-[1.428em] font-['Inter']">—</span>
                                            ) : (
                                                <TooltipProvider>
                                                <div className="flex items-center gap-1">
                                                    {canEdit && (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <TableActionButton
                                                                    onClick={() => { setEditingStaff(user); setIsDrawerOpen(true); }}
                                                                >
                                                                    <Edit2 className="w-4 h-4" />
                                                                </TableActionButton>
                                                            </TooltipTrigger>
                                                            <TooltipContent>{t?.Staff?.tooltip?.edit || 'Edit Details'}</TooltipContent>
                                                        </Tooltip>
                                                    )}
                                                    {canDelete && (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <TableActionButton
                                                                    variant="danger"
                                                                    onClick={() => handleRemove(user.id)}
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </TableActionButton>
                                                            </TooltipTrigger>
                                                            <TooltipContent>{t?.Staff?.tooltip?.remove || 'Remove User'}</TooltipContent>
                                                        </Tooltip>
                                                    )}
                                                </div>
                                                </TooltipProvider>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                    </div>
                    </>
                )}
            </div>

            <StaffDrawer
                isOpen={isDrawerOpen}
                onClose={() => { setIsDrawerOpen(false); setEditingStaff(null); }}
                editData={editingStaff}
                currentUserId={currentUserId}
                currentUserEmail={staff.find(s => s.id === currentUserId)?.email || ''}
                tenantId={tenantId}
            />

            <RemoveStaffModal
                isOpen={!!userToRemove}
                onClose={() => setUserToRemove(null)}
                user={userToRemove}
                onSuccess={(userId) => {
                    setStaff(prev => prev.filter(s => s.id !== userId));
                    setUserToRemove(null);
                }}
            />
        </div>
    );
}
