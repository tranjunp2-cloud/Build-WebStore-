import Link from 'next/link'

export default function HomePage() {
    return (
        <div className="min-h-screen">
            {/* Navigation */}
            <nav className="fixed top-0 w-full z-50 border-b border-white/5 backdrop-blur-md bg-zinc-950/80">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-purple-600" />
                        <span className="font-heading font-bold text-xl">PrimeWeb</span>
                    </div>
                    <div className="hidden md:flex items-center gap-8">
                        <a href="#features" className="text-sm text-zinc-400 hover:text-white transition-colors">Features</a>
                        <a href="#pricing" className="text-sm text-zinc-400 hover:text-white transition-colors">Pricing</a>
                        <a href="#templates" className="text-sm text-zinc-400 hover:text-white transition-colors">Templates</a>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors px-4 py-2">
                            Sign In
                        </Link>
                        <Link href="/signup" className="btn-primary text-sm !px-5 !py-2.5">
                            Get Started Free
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-20 relative overflow-hidden">
                {/* Background effects */}
                <div className="absolute inset-0">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
                </div>

                <div className="relative max-w-5xl mx-auto px-6 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-sky-500/20 bg-sky-500/5 text-sky-400 text-sm font-medium mb-8 animate-fade-in">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
                        </span>
                        AI-Powered Website Builder
                    </div>

                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-heading font-bold leading-[0.95] mb-8 animate-slide-up">
                        Build Stunning
                        <br />
                        <span className="gradient-text-brand">Websites</span> in
                        <br />
                        Minutes
                    </h1>

                    <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-12 animate-slide-up animation-delay-100">
                        Describe your business and let AI create a beautiful, SEO-optimized website for you.
                        Customize with drag & drop. Publish instantly.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up animation-delay-200">
                        <Link href="/signup" className="btn-primary px-10 py-4 text-lg">
                            Start Building — Free
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                        </Link>
                        <a href="#demo" className="btn-secondary px-10 py-4 text-lg">
                            Watch Demo
                        </a>
                    </div>

                    <div className="mt-10 flex items-center justify-center gap-6 text-sm text-zinc-500 animate-slide-up animation-delay-300">
                        <span className="flex items-center gap-1.5">
                            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            No credit card required
                        </span>
                        <span className="flex items-center gap-1.5">
                            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            SEO-optimized from day one
                        </span>
                        <span className="flex items-center gap-1.5">
                            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Custom domain support
                        </span>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-24 border-t border-white/5">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center max-w-2xl mx-auto mb-16">
                        <p className="text-sm font-semibold uppercase tracking-widest text-sky-400 mb-4">Features</p>
                        <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6">
                            Everything You Need to <span className="gradient-text">Build & Scale</span>
                        </h2>
                        <p className="text-zinc-400 text-lg">From AI generation to drag & drop editing — all in one platform.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            { icon: '🤖', title: 'AI Website Generation', desc: 'Describe your business in plain text and get a complete website generated in seconds.' },
                            { icon: '🧩', title: 'Drag & Drop Editor', desc: 'Customize any section by dragging blocks — Hero, Features, Testimonials, Contact and more.' },
                            { icon: '🔍', title: 'SEO-First Architecture', desc: 'Server-side rendered pages. Google indexes every page. Structured data out of the box.' },
                            { icon: '🎨', title: 'Beautiful Templates', desc: 'Dozens of premium templates for every industry — restaurants, e-commerce, portfolios, blogs.' },
                            { icon: '🌐', title: 'Custom Domains', desc: 'Connect your own domain in minutes. Free SSL certificate included automatically.' },
                            { icon: '📦', title: 'E-commerce Ready', desc: 'Product management, cart, checkout, and payment processing — all built in.' },
                            { icon: '📊', title: 'Analytics Dashboard', desc: 'Track visitors, page views, conversions and sources in a beautiful dashboard.' },
                            { icon: '🔗', title: 'ECH Integration', desc: 'Sync with Centralised Distribution for real-time inventory and order management.' },
                            { icon: '⚡', title: 'Lightning Fast', desc: 'Global CDN, image optimization, and smart caching keep your site blazing fast.' },
                        ].map((feature, i) => (
                            <div
                                key={i}
                                className="group card card-hover p-8"
                            >
                                <div className="text-3xl mb-4">{feature.icon}</div>
                                <h3 className="text-lg font-heading font-bold mb-2 group-hover:text-sky-400 transition-colors">{feature.title}</h3>
                                <p className="text-zinc-500 text-sm leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 border-t border-white/5 relative overflow-hidden">
                <div className="absolute inset-0">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-b from-sky-500/10 to-transparent rounded-full blur-3xl" />
                </div>
                <div className="relative max-w-3xl mx-auto px-6 text-center">
                    <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6">
                        Ready to Build Your <span className="gradient-text-brand">Dream Website</span>?
                    </h2>
                    <p className="text-zinc-400 text-lg mb-10">
                        Join thousands of SMEs who trust PrimeWeb to power their online presence.
                    </p>
                    <Link href="/signup" className="btn-primary px-12 py-5 text-lg">
                        Get Started — It&apos;s Free
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-white/5">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-sky-500 to-purple-600" />
                        <span className="font-heading font-semibold">PrimeWeb</span>
                    </div>
                    <p className="text-sm text-zinc-600">© 2026 PrimeWeb. All rights reserved.</p>
                </div>
            </footer>
        </div>
    )
}
