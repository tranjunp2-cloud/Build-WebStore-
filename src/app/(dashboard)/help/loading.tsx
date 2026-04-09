export default function HelpLoading() {
  return (
    <div className="w-full bg-[#161E2E] border border-slate-800 rounded-xl p-6 md:p-8 shadow-sm animate-pulse">
      <div className="flex flex-col gap-10 max-w-5xl">
        <section className="flex flex-col gap-4">
          <div className="h-8 w-64 bg-slate-800 rounded-md" />
          <div className="h-20 w-full max-w-2xl bg-slate-800 rounded-md" />
        </section>

        <section className="flex flex-col gap-6">
          <div className="h-7 w-48 bg-slate-800 rounded-md" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="flex gap-4 p-5 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <div className="w-12 h-12 shrink-0 rounded-lg bg-slate-800" />
                <div className="flex flex-col gap-2 w-full">
                  <div className="h-4 w-24 bg-slate-800 rounded" />
                  <div className="h-8 w-full bg-slate-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
