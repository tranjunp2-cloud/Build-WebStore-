const fs = require('fs');
const file = 'src/app/(dashboard)/blog/page.tsx';
const code = fs.readFileSync(file, 'utf8');
const lines = code.split('\n');

const newUI = `    return (
        <div className="flex flex-col w-full max-w-[1594px] mx-auto p-[24px] font-['Inter']">
            {/* Header Container */}
            <div className="flex flex-col xl:flex-row xl:justify-between xl:items-center w-full gap-4 xl:gap-0">
                <div className="flex flex-col items-stretch gap-[4px] min-w-[242.98px] h-[56px]">
                    <div className="w-full h-[32px]">
                        <h1 className="mt-[-1px] w-[242px] h-[32px] text-[#F8FAFC] text-[24px] font-[700] leading-[1.3333333333333333em]">
                            Blog Posts
                        </h1>
                    </div>
                    <div className="w-full h-[20px]">
                        <p className="w-max h-[20px] text-[rgba(248,250,252,0.6)] text-[14px] font-[400] leading-[1.4285714285714286em]">
                            {meta?.totalDocs || 0} post{(meta?.totalDocs || 0) !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>
                
                <div className="flex flex-row items-center gap-[12px]">
                    <button 
                        onClick={() => router.push('/blog/categories')}
                        className="flex flex-row items-center justify-center gap-[10px] bg-[#1E293B] border border-[rgba(255,255,255,0.08)] rounded-[16px] px-[16px] py-[14px] hover:bg-white/5 transition-colors"
                    >
                        <Tag className="w-[20px] h-[20px] text-[#F8FAFC]" />
                        <span className="text-[#F8FAFC] text-[14px] font-[600] leading-[1.4285714285714286em] text-center uppercase tracking-[0.025em]">Categories</span>
                    </button>
                    <button 
                        onClick={() => router.push('/blog/new')}
                        className="flex flex-row items-center justify-center gap-[8px] rounded-[16px] px-[24px] py-[11px] bg-[linear-gradient(90deg,rgba(59,130,246,1)_0%,rgba(45,212,191,1)_100%)] shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),0px_10px_15px_-3px_rgba(0,0,0,0.1)] text-[#F8FAFC] hover:opacity-90 transition-opacity"
                    >
                        <Plus className="w-[20px] h-[20px] text-[#F8FAFC]" />
                        <span className="text-[16px] font-[600] leading-[1.5em] text-center">Create Post</span>
                    </button>
                </div>
            </div>

            {/* Filters Container */}
            <div className="flex flex-col xl:flex-row justify-between xl:items-center w-full min-h-[50px] mt-[32px] gap-[12px] xl:gap-0">
                <div className="flex flex-row items-center bg-[#1E293B] border border-[rgba(255,255,255,0.08)] rounded-[16px] relative w-full xl:w-[831px] h-[50px]">
                    <Search className="absolute left-[16px] w-[20px] h-[20px] text-[rgba(248,250,252,0.4)]" />
                    <input 
                        type="text" 
                        placeholder="Search posts..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-transparent border-none outline-none text-[#F8FAFC] placeholder:text-[rgba(248,250,252,0.4)] pl-[48px] pr-[16px] py-[12px] text-[16px] font-[400] leading-[1.2102272510528564em]"
                    />
                </div>

                <div className="flex flex-row flex-wrap items-center gap-[12px] min-h-[50px]">
                    <div className="relative">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="appearance-none flex flex-row items-center justify-between px-[16px] pr-[40px] bg-[#1E293B] border border-[rgba(255,255,255,0.08)] rounded-[16px] min-w-[150px] w-auto h-[50px] text-[#F8FAFC] text-[16px] font-[400] leading-[1.2102272510528564em] outline-none cursor-pointer"
                        >
                            <option value="">All Status</option>
                            <option value="draft">Draft</option>
                            <option value="published">Published</option>
                        </select>
                        <ChevronDown className="absolute right-[16px] top-1/2 -translate-y-1/2 w-[20px] h-[20px] text-[rgba(248,250,252,0.4)] pointer-events-none" />
                    </div>

                    {categories.length > 0 && (
                        <div className="relative">
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="appearance-none flex flex-row items-center justify-between px-[16px] pl-[16px] pr-[40px] bg-[#1E293B] border border-[rgba(255,255,255,0.08)] rounded-[16px] min-w-[200px] w-auto h-[50px] text-[#F8FAFC] text-[16px] font-[400] leading-[1.2102272510528564em] outline-none cursor-pointer"
                            >
                                <option value="">All Categories</option>
                                {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-[16px] top-1/2 -translate-y-1/2 w-[20px] h-[20px] text-[rgba(248,250,252,0.4)] pointer-events-none" />
                        </div>
                    )}

                    <div className="relative">
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="appearance-none flex flex-row items-center justify-between px-[16px] pl-[16px] pr-[40px] bg-[#1E293B] border border-[rgba(255,255,255,0.08)] rounded-[16px] min-w-[200px] w-auto h-[50px] text-[#F8FAFC] text-[16px] font-[400] leading-[1.2102272510528564em] outline-none cursor-pointer"
                        >
                            <option value="-createdAt">Date (Newest)</option>
                            <option value="createdAt">Date (Oldest)</option>
                            <option value="title">Title (A-Z)</option>
                            <option value="-title">Title (Z-A)</option>
                        </select>
                        <ChevronDown className="absolute right-[16px] top-1/2 -translate-y-1/2 w-[20px] h-[20px] text-[rgba(248,250,252,0.4)] pointer-events-none" />
                    </div>
                </div>
            </div>

            {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-[rgba(255,255,255,0.08)] bg-white/5 px-[16px] py-[10px] mt-[16px]">
                    <span className="text-[14px] text-[rgba(248,250,252,0.6)]">{selectedIds.size} selected</span>
                    <button
                        onClick={handleBulkPublish}
                        disabled={bulkActionLoading}
                        className="rounded-[12px] px-[12px] py-[4px] border border-[rgba(0,201,80,0.3)] bg-[rgba(0,201,80,0.1)] text-[#05DF72] font-medium text-[12px] hover:opacity-80 transition-opacity disabled:opacity-50"
                    >
                        Publish
                    </button>
                    <button
                        onClick={handleBulkDelete}
                        disabled={bulkActionLoading}
                        className="rounded-[12px] px-[12px] py-[4px] border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.1)] text-red-400 font-medium text-[12px] hover:opacity-80 transition-opacity disabled:opacity-50"
                    >
                        Delete
                    </button>
                </div>
            )}

            <div className="flex flex-col w-full bg-[rgba(30,41,59,0.6)] border border-[rgba(255,255,255,0.08)] rounded-[16px] p-[1px] mt-[32px] overflow-x-auto">
                <div className="min-w-[1200px] rounded-[15px] overflow-hidden">
                    {/* Header */}
                    <div className="flex flex-row items-center w-full h-[56px] bg-[rgba(11,17,32,0.5)]">
                        <div className="flex justify-center items-center w-[66.55px] h-[56px] shrink-0">
                            <input type="checkbox" checked={posts.length > 0 && selectedIds.size === posts.length} onChange={toggleSelectAll} className="rounded border-gray-600 bg-transparent w-[16px] h-[16px] cursor-pointer" />
                        </div>
                        <div className="flex-1 min-w-[200px] pl-[24px]">
                            <span className="font-['Inter'] text-[12px] font-[600] leading-[1.3333333333333333em] uppercase tracking-[0.025em] text-[rgba(248,250,252,0.6)]">Title</span>
                        </div>
                        <div className="w-[155.3px] pl-[24px] shrink-0">
                            <span className="font-['Inter'] text-[12px] font-[600] leading-[1.3333333333333333em] uppercase tracking-[0.025em] text-[rgba(248,250,252,0.6)]">Category</span>
                        </div>
                        <div className="w-[135.7px] pl-[24px] shrink-0">
                            <span className="font-['Inter'] text-[12px] font-[600] leading-[1.3333333333333333em] uppercase tracking-[0.025em] text-[rgba(248,250,252,0.6)]">Status</span>
                        </div>
                        <div className="w-[157.33px] pl-[24px] shrink-0">
                            <span className="font-['Inter'] text-[12px] font-[600] leading-[1.3333333333333333em] uppercase tracking-[0.025em] text-[rgba(248,250,252,0.6)]">Author</span>
                        </div>
                        <div className="w-[142.13px] pl-[24px] shrink-0">
                            <span className="font-['Inter'] text-[12px] font-[600] leading-[1.3333333333333333em] uppercase tracking-[0.025em] text-[rgba(248,250,252,0.6)]">Date</span>
                        </div>
                        <div className="w-[124.83px] pl-[24px] shrink-0">
                            <span className="font-['Inter'] text-[12px] font-[600] leading-[1.3333333333333333em] uppercase tracking-[0.025em] text-[rgba(248,250,252,0.6)]">Actions</span>
                        </div>
                    </div>

                    <div className="flex flex-col w-full bg-transparent">
                        {posts.map((post, index) => (
                            <div 
                                key={post.id}
                                className={\`flex flex-row items-center w-full h-[80.5px] cursor-pointer hover:bg-white/[0.02] transition-colors \${index !== posts.length - 1 ? 'border-b border-[rgba(255,255,255,0.05)]' : ''}\`}
                                onClick={() => router.push(\`/blog/\${post.id}\`)}
                            >
                                <div className="flex justify-center items-center w-[66.55px] h-[80.5px] shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <input type="checkbox" checked={selectedIds.has(post.id)} onChange={() => toggleSelect(post.id)} className="rounded border-gray-600 bg-transparent w-[16px] h-[16px] cursor-pointer" />
                                </div>

                                <div className="flex-1 min-w-[200px] h-[80.5px] pl-[24px] flex items-center pr-[16px]">
                                    <span className="truncate font-['Inter'] text-[14px] font-[600] leading-[1.4285714285714286em] text-[#F8FAFC]">
                                        {post.title}
                                    </span>
                                </div>

                                <div className="w-[155.3px] h-[80.5px] pl-[24px] flex items-center shrink-0">
                                    <div className="rounded-[12px] px-[12px] py-[4px] border border-solid border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.1)]">
                                        <span className="font-['Inter'] text-[12px] font-[500] leading-[1.3333333333333333em] text-[#F8FAFC]">
                                            {getCategoryName(post.category)}
                                        </span>
                                    </div>
                                </div>

                                <div className="w-[135.7px] h-[80.5px] pl-[24px] flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <button 
                                        onClick={() => handleToggleStatus(post)}
                                        title={post.status === 'published' ? 'Move to Draft' : 'Publish'}
                                        className={\`rounded-[12px] px-[12px] py-[4px] border border-solid transition-colors cursor-pointer \${
                                            post.status === 'published' 
                                            ? 'bg-[rgba(0,201,80,0.1)] border-[rgba(0,201,80,0.3)]' 
                                            : 'bg-[rgba(106,114,130,0.1)] border-[rgba(106,114,130,0.3)]'
                                        }\`}
                                    >
                                        <span className={\`font-['Inter'] text-[12px] font-[500] leading-[1.3333333333333333em] flex items-center gap-1.5 \${
                                            post.status === 'published' ? 'text-[#05DF72]' : 'text-[#99A1AF]'
                                        }\`}>
                                            {post.status === 'published' ? <><Eye className="w-[12px] h-[12px]" /> Published</> : <><EyeOff className="w-[12px] h-[12px]" /> Draft</>}
                                        </span>
                                    </button>
                                </div>

                                <div className="w-[157.33px] h-[80.5px] pl-[24px] flex items-center shrink-0">
                                    <span className="truncate font-['Inter'] text-[14px] font-[400] leading-[1.4285714285714286em] text-[rgba(248,250,252,0.7)]">
                                        {getAuthorName(post.author)}
                                    </span>
                                </div>

                                <div className="w-[142.13px] h-[80.5px] pl-[24px] flex items-center shrink-0">
                                    <span className="font-['Inter'] text-[14px] font-[400] leading-[1.4285714285714286em] text-[rgba(248,250,252,0.7)]">
                                        {formatDate(post.updatedAt)}
                                    </span>
                                </div>

                                <div className="w-[124.83px] h-[80.5px] pl-[24px] flex flex-row gap-2 items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <button onClick={() => openDeleteConfirm(post)} className="rounded-[8px] p-[6px] text-gray-500 hover:bg-[rgba(239,68,68,0.1)] hover:text-red-400 transition-all" title="Delete">
                                        <Trash2 className="h-[20px] w-[20px]" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {!loading && posts.length === 0 && (search || statusFilter) && (
                <div className="py-[48px] text-center mt-[32px]">
                    <p className="text-[14px] text-[rgba(248,250,252,0.6)]">No posts match your filters</p>
                </div>
            )}

            {meta && meta.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.08)] pt-[16px] mt-[32px]">
                    <p className="text-[14px] text-[rgba(248,250,252,0.6)]">
                        Page {meta.page} of {meta.totalPages}
                    </p>
                    <div className="flex gap-[8px]">
                        <button onClick={() => setPage((p) => p - 1)} disabled={!meta.hasPrevPage} className="inline-flex items-center gap-[4px] rounded-[8px] border border-[rgba(255,255,255,0.08)] px-[12px] py-[6px] text-[14px] text-[rgba(248,250,252,0.6)] hover:bg-[rgba(255,255,255,0.05)] disabled:opacity-30 transition-colors">
                            <ChevronLeft className="h-[16px] w-[16px]" /> Prev
                        </button>
                        <button onClick={() => setPage((p) => p + 1)} disabled={!meta.hasNextPage} className="inline-flex items-center gap-[4px] rounded-[8px] border border-[rgba(255,255,255,0.08)] px-[12px] py-[6px] text-[14px] text-[rgba(248,250,252,0.6)] hover:bg-[rgba(255,255,255,0.05)] disabled:opacity-30 transition-colors">
                            Next <ChevronRight className="h-[16px] w-[16px]" />
                        </button>
                    </div>
                </div>
            )}
`;

fs.writeFileSync(file, lines.slice(0, 300).join('\n') + '\n' + newUI + '\n' + lines.slice(521).join('\n'));
console.log('Patched');
