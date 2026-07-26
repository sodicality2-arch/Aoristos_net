const CONFIG = {
    microCMS: {
        serviceId: 'aoristos',
        apiKey: 'lxuvJf8zdRDrRcQGpQ3SwQQh1JlDd7JJ5b9j',
        endpoint: 'blogs'
    },
    pagination: { limit: 9 }
};

const store = {
    articles: [],
    totalCount: 0,
    categories: [],
    currentArticle: null,
    cache: new Map(),
    settings: {}
};

const api = {
    async fetchList(offset = 0, limit = CONFIG.pagination.limit, filters = '') {
        const cacheKey = `list_${offset}_${limit}_${filters}`;
        if (store.cache.has(cacheKey)) return store.cache.get(cacheKey);

        try {
            let url = `https://${CONFIG.microCMS.serviceId}.microcms.io/api/v1/${CONFIG.microCMS.endpoint}?offset=${offset}&limit=${limit}`;
            if (filters) url += `&filters=${encodeURIComponent(filters)}`;

            const res = await fetch(url, { headers: { 'X-MICROCMS-API-KEY': CONFIG.microCMS.apiKey } });
            if (!res.ok) throw new Error('API Error');
            const data = await res.json();
            store.cache.set(cacheKey, data);
            return data;
        } catch (e) {
            console.error('Fetch List Error:', e);
            return { contents: [], totalCount: 0 };
        }
    },
    async fetchDetail(id) {
        const cacheKey = `detail_${id}`;
        if (store.cache.has(cacheKey)) return store.cache.get(cacheKey);

        try {
            const res = await fetch(`https://${CONFIG.microCMS.serviceId}.microcms.io/api/v1/${CONFIG.microCMS.endpoint}/${id}`, {
                headers: { 'X-MICROCMS-API-KEY': CONFIG.microCMS.apiKey }
            });
            if (!res.ok) throw new Error('Article not found');
            const data = await res.json();
            store.cache.set(cacheKey, data);
            return data;
        } catch (e) {
            console.error('Fetch Detail Error:', e);
            return null;
        }
    },
    async search(query) {
        try {
            const res = await fetch(`https://${CONFIG.microCMS.serviceId}.microcms.io/api/v1/${CONFIG.microCMS.endpoint}?q=${encodeURIComponent(query)}&limit=10`, {
                headers: { 'X-MICROCMS-API-KEY': CONFIG.microCMS.apiKey }
            });
            if (!res.ok) return [];
            const data = await res.json();
            return data.contents;
        } catch (e) {
            console.error('Search Error:', e);
            return [];
        }
    }
};

const utils = {
    formatDate: (isoString) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    },
    getCategory: (article) => {
        if (!article.category) return { name: 'Uncategorized', id: '' };
        return typeof article.category === 'string' ? { name: article.category, id: article.category } : article.category;
    },
    getThumbnail: (article) => {
        if (article.eyecatch && article.eyecatch.url) return article.eyecatch.url + '?w=800&q=80';
        if (article.imageUrl) return article.imageUrl;
        return `https://images.unsplash.com/photo-1516116216624-53e697fedbea?auto=format&fit=crop&w=800&q=80`;
    },
    stripHtml: (html) => {
        const tmp = document.createElement('DIV');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    },
    generateTOC: (htmlContent) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const headings = doc.querySelectorAll('h2, h3');
        if (headings.length === 0) return { updatedHTML: htmlContent, toc: '' };

        let tocHTML = '<ul class="space-y-1">';
        headings.forEach((h, index) => {
            const id = h.id || `heading-${index}`;
            h.id = id;
            const levelClass = h.tagName.toLowerCase() === 'h3' ? 'toc-h3' : '';
            tocHTML += `<li><a href="#${id}" class="toc-link ${levelClass} truncate" data-target="${id}">${h.textContent}</a></li>`;
        });
        tocHTML += '</ul>';

        return { updatedHTML: doc.body.innerHTML, toc: tocHTML };
    }
};

class NetworkCanvas {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.mouse = { x: null, y: null, radius: 150 };
        this.isDark = document.documentElement.classList.contains('dark');

        this.init();
        window.addEventListener('resize', () => this.resize());
        this.canvas.parentElement.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });
        this.canvas.parentElement.addEventListener('mouseleave', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((m) => {
                if (m.attributeName === 'class') {
                    this.isDark = document.documentElement.classList.contains('dark');
                }
            });
        });
        observer.observe(document.documentElement, { attributes: true });

        this.animate();
    }

    resize() {
        this.canvas.width = this.canvas.parentElement.offsetWidth;
        this.canvas.height = this.canvas.parentElement.offsetHeight;
        this.initParticles();
    }

    init() {
        this.resize();
    }

    initParticles() {
        this.particles = [];
        const numberOfParticles = (this.canvas.width * this.canvas.height) / 15000;
        for (let i = 0; i < numberOfParticles; i++) {
            const size = (Math.random() * 2) + 1;
            const x = (Math.random() * ((innerWidth - size * 2) - (size * 2)) + size * 2);
            const y = (Math.random() * ((innerHeight - size * 2) - (size * 2)) + size * 2);
            const directionX = (Math.random() * 2) - 1;
            const directionY = (Math.random() * 2) - 1;
            this.particles.push(new Particle(x, y, directionX, directionY, size, this));
        }
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i].update();
        }
        this.connect();
    }

    connect() {
        let opacityValue = 1;
        for (let a = 0; a < this.particles.length; a++) {
            for (let b = a; b < this.particles.length; b++) {
                const dx = this.particles[a].x - this.particles[b].x;
                const dy = this.particles[a].y - this.particles[b].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 120) {
                    opacityValue = 1 - (distance / 120);
                    const color = this.isDark ? `rgba(14, 165, 233, ${opacityValue * 0.5})` : `rgba(15, 23, 42, ${opacityValue * 0.2})`;
                    this.ctx.strokeStyle = color;
                    this.ctx.lineWidth = 1;
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.particles[a].x, this.particles[a].y);
                    this.ctx.lineTo(this.particles[b].x, this.particles[b].y);
                    this.ctx.stroke();
                }
            }
        }
    }
}

class Particle {
    constructor(x, y, directionX, directionY, size, canvasObj) {
        this.x = x; this.y = y; this.directionX = directionX; this.directionY = directionY;
        this.size = size; this.canvasObj = canvasObj;
    }
    draw() {
        this.canvasObj.ctx.beginPath();
        this.canvasObj.ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
        this.canvasObj.ctx.fillStyle = this.canvasObj.isDark ? '#38bdf8' : '#0ea5e9';
        this.canvasObj.ctx.fill();
    }
    update() {
        if (this.x > this.canvasObj.canvas.width || this.x < 0) this.directionX = -this.directionX;
        if (this.y > this.canvasObj.canvas.height || this.y < 0) this.directionY = -this.directionY;

        if (this.canvasObj.mouse.x != null) {
            const dx = this.canvasObj.mouse.x - this.x;
            const dy = this.canvasObj.mouse.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < this.canvasObj.mouse.radius + this.size) {
                if (this.canvasObj.mouse.x < this.x && this.x < this.canvasObj.canvas.width - this.size * 10) this.x += 2;
                if (this.canvasObj.mouse.x > this.x && this.x > this.size * 10) this.x -= 2;
                if (this.canvasObj.mouse.y < this.y && this.y < this.canvasObj.canvas.height - this.size * 10) this.y += 2;
                if (this.canvasObj.mouse.y > this.y && this.y > this.size * 10) this.y -= 2;
            }
        }
        this.x += this.directionX * 0.5;
        this.y += this.directionY * 0.5;
        this.draw();
    }
}

const components = {
    Loader: () => `<div class="flex items-center justify-center py-20"><div class="spinner"></div></div>`,
    ArticleCard: (article) => {
        const cat = utils.getCategory(article);
        return `
                <article class="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100 dark:border-gray-700 reveal flex flex-col h-full">
                    <a href="#/article/${article.id}" class="block relative aspect-video overflow-hidden">
                        <img src="${utils.getThumbnail(article)}" alt="${article.title}" class="w-full h-full object-cover transition-transform duration-500 hover:scale-105" loading="lazy">
                        <div class="absolute top-4 left-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur text-xs font-bold px-3 py-1 rounded-full text-aoristos-primary">
                            ${cat.name}
                        </div>
                    </a>
                    <div class="p-6 flex flex-col flex-grow">
                        <div class="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-3 gap-4">
                            <span class="flex items-center gap-1"><i class="ph ph-calendar-blank"></i> ${utils.formatDate(article.publishedAt)}</span>
                        </div>
                        <h3 class="text-xl font-bold mb-3 line-clamp-2 hover:text-aoristos-primary transition-colors">
                            <a href="#/article/${article.id}">${article.title}</a>
                        </h3>
                        <p class="text-gray-600 dark:text-gray-400 text-sm line-clamp-3 mb-4 flex-grow">
                            ${utils.stripHtml(article.content || '').substring(0, 120)}...
                        </p>
                        <a href="#/article/${article.id}" class="inline-flex items-center gap-1 text-sm font-bold text-aoristos-primary hover:text-aoristos-secondary transition-colors mt-auto">
                            Read More <i class="ph ph-arrow-right"></i>
                        </a>
                    </div>
                </article>
                `;
    },
    Pagination: (totalCount, currentOffset, limit, currentCategory) => {
        const totalPages = Math.ceil(totalCount / limit);
        if (totalPages <= 1) return '';

        const currentPage = Math.floor(currentOffset / limit) + 1;
        let html = '<div class="flex justify-center items-center gap-2 mt-12">';
        const baseHash = currentCategory ? `#/blog?category=${currentCategory}&page=` : `#/blog?page=`;

        if (currentPage > 1) {
            html += `<a href="${baseHash}${currentPage - 1}" class="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 hover:border-aoristos-primary hover:text-aoristos-primary transition-colors"><i class="ph ph-caret-left"></i></a>`;
        }

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                const activeCls = i === currentPage ? 'bg-aoristos-primary text-white border-aoristos-primary' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-700 hover:border-aoristos-primary hover:text-aoristos-primary';
                html += `<a href="${baseHash}${i}" class="w-10 h-10 flex items-center justify-center rounded-full border transition-colors ${activeCls}">${i}</a>`;
            } else if (i === currentPage - 2 || i === currentPage + 2) {
                html += `<span class="px-2 text-gray-400">...</span>`;
            }
        }

        if (currentPage < totalPages) {
            html += `<a href="${baseHash}${currentPage + 1}" class="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 hover:border-aoristos-primary hover:text-aoristos-primary transition-colors"><i class="ph ph-caret-right"></i></a>`;
        }

        html += '</div>';
        return html;
    }
};

const views = {
    Home: async () => {
        const recentData = await api.fetchList(0, 3);
        const s = store.settings;
        return `
                <section class="relative w-full h-[90vh] flex flex-col items-center justify-center text-center px-4 overflow-hidden mt-[-4rem]">
                    <canvas id="hero-canvas"></canvas>
                    <div class="relative z-10 max-w-4xl animate-slide-up pointer-events-none">
                        <div class="inline-block px-4 py-1.5 rounded-full glass text-sm font-bold tracking-widest text-aoristos-primary mb-6">
                            ${s.hero.subtitle}
                        </div>
                        <h1 class="text-6xl md:text-8xl font-serif font-bold tracking-widest mb-6 drop-shadow-lg text-gray-900 dark:text-white">
                            ${s.hero.headline}
                        </h1>
                        <p class="text-xl md:text-2xl text-gray-700 dark:text-gray-300 font-light max-w-2xl mx-auto drop-shadow">
                            ${s.hero.description}
                        </p>
                        <div class="mt-10 flex flex-wrap justify-center gap-4 pointer-events-auto">
                            <a href="${s.hero.primaryCta.href}" class="px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full font-bold hover:bg-aoristos-primary dark:hover:bg-aoristos-primary dark:hover:text-white transition-colors shadow-lg">
                                ${s.hero.primaryCta.label}
                            </a>
                            <a href="${s.hero.secondaryCta.href}" class="px-8 py-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-full font-bold hover:border-aoristos-primary transition-colors shadow-lg">
                                ${s.hero.secondaryCta.label}
                            </a>
                        </div>
                    </div>
                    <div class="absolute bottom-10 left-1/2 transform -translate-x-1/2 animate-bounce">
                        <i class="ph ph-arrow-down text-3xl text-gray-400"></i>
                    </div>
                </section>
                <section class="py-24 px-6 relative">
                    <div class="max-w-4xl mx-auto text-center reveal">
                        <h2 class="text-3xl md:text-4xl font-serif font-bold mb-8">Philosophy</h2>
                        <p class="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
                            ${s.siteInfo.description}
                        </p>
                    </div>
                </section>
                <section class="py-24 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-y border-gray-100 dark:border-gray-800">
                    <div class="max-w-7xl mx-auto px-6">
                        <div class="text-center mb-16 reveal">
                            <h2 class="text-3xl md:text-4xl font-serif font-bold mb-4">Core Activities</h2>
                            <p class="text-gray-500">私たちの主要な研究領域</p>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                            ${s.activities.map((act, i) => `
                                <div class="glass p-8 rounded-2xl reveal hover:-translate-y-2 transition-transform duration-300" style="transition-delay: ${i * 100}ms">
                                    <div class="w-14 h-14 bg-aoristos-primary/10 rounded-xl flex items-center justify-center mb-6 text-aoristos-primary text-3xl">
                                        <i class="ph ${act.icon}"></i>
                                    </div>
                                    <h3 class="text-xl font-bold mb-3">${act.title}</h3>
                                    <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">${act.desc}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </section>
                <section class="py-24 px-6">
                    <div class="max-w-7xl mx-auto">
                        <div class="flex justify-between items-end mb-12 reveal">
                            <div>
                                <h2 class="text-3xl md:text-4xl font-serif font-bold mb-2">Latest Notes</h2>
                                <p class="text-gray-500">最新の研究成果と知見</p>
                            </div>
                            <a href="#/blog" class="hidden md:flex items-center gap-2 font-bold text-aoristos-primary hover:text-aoristos-secondary transition-colors">
                                View All <i class="ph ph-arrow-right"></i>
                            </a>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            ${recentData.contents.length > 0
                                ? recentData.contents.map(art => components.ArticleCard(art)).join('')
                                : '<p class="col-span-full text-center text-gray-500">記事がありません。</p>'}
                        </div>
                        <div class="mt-12 text-center md:hidden reveal">
                            <a href="#/blog" class="inline-flex items-center gap-2 font-bold px-6 py-3 border-2 border-aoristos-primary text-aoristos-primary rounded-full hover:bg-aoristos-primary hover:text-white transition-colors">
                                View All Notes
                            </a>
                        </div>
                    </div>
                </section>
                `;
    },
    About: async () => {
        const s = store.settings;
        return `
                <div class="max-w-5xl mx-auto px-6 py-20 animate-fade-in w-full">
                    <div class="text-center mb-20">
                        <h1 class="text-4xl md:text-5xl font-serif font-bold mb-6">About Aoristos</h1>
                        <p class="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
                            ${s.about.intro}
                        </p>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-16 items-center mb-24">
                        <div class="reveal">
                            <h2 class="text-3xl font-bold mb-6 border-l-4 border-aoristos-primary pl-4">${s.about.visionTitle}</h2>
                            ${s.about.visionParagraphs.map(p => `<p class="text-gray-600 dark:text-gray-400 text-lg leading-relaxed mb-4">${p}</p>`).join('')}
                        </div>
                        <div class="reveal relative">
                            <div class="aspect-square rounded-3xl overflow-hidden glass p-2">
                                <img src="${s.about.image.url}" alt="${s.about.image.alt}" class="w-full h-full object-cover rounded-2xl">
                            </div>
                            <div class="absolute -bottom-6 -left-6 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl">
                                <div class="text-4xl font-bold text-aoristos-primary mb-1">${s.about.image.badge}</div>
                                <div class="text-xl text-gray-500 font-serif">2022</div>
                            </div>
                        </div>
                    </div>
                    <div class="mt-24">
                        <h2 class="text-3xl font-bold mb-12 text-center reveal">Members</h2>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                            ${s.members.map((m, i) => `
                                <div class="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center shadow-sm border border-gray-100 dark:border-gray-700 reveal" style="transition-delay: ${i * 150}ms">
                                    <div class="w-24 h-24 mx-auto mb-6 rounded-full overflow-hidden border-4 border-gray-50 dark:border-slate-700 bg-gray-100">
                                        <a href="${m.profileLink}"><img src="${m.avatar}" alt="${m.name}" class="w-full h-full object-cover"></a>
                                    </div>
                                    <h3 class="text-xl font-bold mb-1">${m.name}</h3>
                                    <div class="text-sm font-medium text-aoristos-primary mb-4">${m.role}</div>
                                    <p class="text-sm text-gray-500 dark:text-gray-400 text-left leading-relaxed">${m.bio}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                `;
    },
    BlogList: async (params) => {
        const page = parseInt(params.get('page')) || 1;
        const limit = CONFIG.pagination.limit;
        const offset = (page - 1) * limit;
        const categoryFilter = params.get('category');
        let filtersString = '';
        if (categoryFilter) {
            filtersString = `category[equals]${categoryFilter}`;
        }

        const data = await api.fetchList(offset, limit, filtersString);
        const categories = store.settings.blog.categories || [];

        return `
                <div class="max-w-7xl mx-auto px-6 py-12 animate-fade-in w-full">
                    <div class="text-center mb-12">
                        <h1 class="text-4xl md:text-5xl font-serif font-bold mb-4">Research Notes</h1>
                        <p class="text-gray-500">${store.settings.blog.intro}</p>
                    </div>
                    <div class="flex flex-wrap justify-center gap-3 mb-12">
                        <a href="#/blog" class="px-5 py-2 rounded-full text-sm font-medium transition-colors ${!categoryFilter ? 'bg-aoristos-primary text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-gray-700'}">All</a>
                        ${categories.map(c => `
                            <a href="#/blog?category=${c.id}" class="px-5 py-2 rounded-full text-sm font-medium transition-colors ${categoryFilter === c.id ? 'bg-aoristos-primary text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-gray-700'}">${c.name}</a>
                        `).join('')}
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        ${data.contents.length > 0
                            ? data.contents.map(art => components.ArticleCard(art)).join('')
                            : '<div class="col-span-full text-center py-20 text-gray-500 text-lg">記事が見つかりませんでした。</div>'}
                    </div>
                    ${components.Pagination(data.totalCount, offset, limit, categoryFilter)}
                </div>
                `;
    },
    ArticleDetail: async (id) => {
        const article = await api.fetchDetail(id);
        if (!article) return `<div class="text-center py-20 text-2xl text-red-500">Article not found.</div>`;
        const cat = utils.getCategory(article);
        const processed = utils.generateTOC(article.content || '');
        const contentHTML = processed.updatedHTML;
        const tocHTML = processed.toc;

        return `
                <div class="max-w-7xl mx-auto px-6 py-10 w-full animate-fade-in flex flex-col lg:flex-row gap-12">
                    <article class="w-full lg:w-3/4 max-w-4xl">
                        <header class="mb-10 text-center lg:text-left">
                            <div class="inline-block px-3 py-1 mb-4 rounded-full bg-aoristos-primary/10 text-aoristos-primary text-sm font-bold">
                                ${cat.name}
                            </div>
                            <h1 class="text-3xl md:text-5xl font-bold leading-tight mb-6">${article.title}</h1>
                            <div class="flex items-center justify-center lg:justify-start gap-4 text-gray-500 text-sm">
                                <span class="flex items-center gap-1"><i class="ph ph-calendar-blank"></i> Published: ${utils.formatDate(article.publishedAt)}</span>
                                ${article.updatedAt !== article.publishedAt ? `<span class="flex items-center gap-1"><i class="ph ph-clock-counter-clockwise"></i> Updated: ${utils.formatDate(article.updatedAt)}</span>` : ''}
                            </div>
                        </header>
                        <figure class="mb-12 rounded-2xl overflow-hidden shadow-lg border border-gray-100 dark:border-gray-800">
                            <img src="${utils.getThumbnail(article)}" alt="${article.title}" class="w-full h-auto object-cover max-h-[500px]">
                        </figure>
                        <div class="prose-custom katex-content" id="article-body">
                            ${contentHTML}
                        </div>
                        <div class="mt-16 pt-8 border-t border-gray-200 dark:border-gray-800">
                            <a href="#/blog" class="inline-flex items-center gap-2 text-aoristos-primary font-bold hover:gap-3 transition-all">
                                <i class="ph ph-arrow-left"></i> Back to Notes
                            </a>
                        </div>
                    </article>
                    <aside class="hidden lg:block w-1/4 relative">
                        <div class="sticky top-24 bg-white/50 dark:bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
                            <h4 class="font-bold mb-4 uppercase tracking-wider text-sm text-gray-400 border-b border-gray-200 dark:border-gray-700 pb-2">Table of Contents</h4>
                            <nav id="toc-nav" class="max-h-[60vh] overflow-y-auto pr-2">
                                ${tocHTML || '<p class="text-sm text-gray-500">目次はありません</p>'}
                            </nav>
                        </div>
                    </aside>
                </div>
                `;
    }
};

const appContainer = document.getElementById('app-container');

async function loadSettings() {
    try {
        const response = await fetch('./settings.json');
        if (!response.ok) throw new Error('Settings fetch failed');
        return await response.json();
    } catch (e) {
        console.warn('Failed to load settings.json, using fallback settings.', e);
        return FALLBACK_SETTINGS;
    }
}

function renderLayout() {
    const s = store.settings;
    const navLinks = document.getElementById('nav-links');
    const mobileLinks = document.getElementById('mobile-links');
    const brandText = document.getElementById('brand-text');
    const footerDescription = document.getElementById('footer-description');
    const footerExplore = document.getElementById('footer-explore-links');
    const footerConnect = document.getElementById('footer-connect-links');
    const footerCopyright = document.getElementById('footer-copyright');

    if (brandText) {
        brandText.textContent = s.nav.logo.text;
    }
    if (navLinks) {
        navLinks.innerHTML = s.nav.links.map(link => `
            <a href="${link.href}" class="nav-link hover:text-aoristos-primary transition-colors relative after:absolute after:-bottom-1 after:left-0 after:w-0 after:h-0.5 after:bg-aoristos-primary after:transition-all hover:after:w-full">${link.label}</a>
        `).join('');
    }
    if (mobileLinks) {
        mobileLinks.innerHTML = s.nav.links.map(link => `<a href="${link.href}" class="mobile-link hover:text-aoristos-primary">${link.label}</a>`).join('');
    }
    if (footerDescription) {
        footerDescription.textContent = s.footer.description;
    }
    if (footerExplore) {
        footerExplore.innerHTML = s.footer.explore.map(link => `<li><a href="${link.href}" class="hover:text-aoristos-primary transition-colors">${link.label}</a></li>`).join('');
    }
    if (footerConnect) {
        footerConnect.innerHTML = s.footer.connect.map(link => `
            <a href="${link.href}" class="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-aoristos-primary hover:text-white transition-colors" aria-label="${link.label}">
                <i class="ph ${link.icon} text-xl"></i>
            </a>
        `).join('');
    }
    if (footerCopyright) {
        footerCopyright.innerHTML = s.footer.copyright;
    }
}

async function renderView() {
    const hash = window.location.hash || '#/';
    const path = hash.replace(/^#\//, '').split('?')[0];
    const queryString = hash.split('?')[1] || '';
    const params = new URLSearchParams(queryString);

    appContainer.style.opacity = '0';
    await new Promise(r => setTimeout(r, 200));
    appContainer.innerHTML = components.Loader();
    appContainer.style.opacity = '1';

    let html = '';
    try {
        if (path === '') {
            html = await views.Home();
        } else if (path === 'about') {
            html = await views.About();
        } else if (path === 'blog') {
            html = await views.BlogList(params);
        } else if (path.startsWith('article/')) {
            const id = path.split('/')[1];
            html = await views.ArticleDetail(id);
        } else {
            html = `<div class="text-center py-32"><h1 class="text-6xl font-bold text-gray-300">404</h1><p class="mt-4">Page not found.</p><a href="#/" class="text-aoristos-primary mt-4 inline-block">Go Home</a></div>`;
        }
    } catch (error) {
        console.error('Rendering error:', error);
        html = `<div class="text-center py-20 text-red-500">An error occurred while loading the page.</div>`;
    }

    appContainer.style.opacity = '0';
    await new Promise(r => setTimeout(r, 50));
    appContainer.innerHTML = html;
    appContainer.style.opacity = '1';
    window.scrollTo({ top: 0, behavior: 'auto' });
    initInteractions(path);
}

function initInteractions(path) {
    const reveals = document.querySelectorAll('.reveal');
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    reveals.forEach(el => revealObserver.observe(el));

    if (path === '') {
        new NetworkCanvas('hero-canvas');
    }

    if (path.startsWith('article/')) {
        if (window.renderMathInElement) {
            renderMathInElement(document.getElementById('article-body'), {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false },
                    { left: '\\(', right: '\\)', display: false },
                    { left: '\\[', right: '\\]', display: true }
                ],
                throwOnError: false
            });
        }

        const headings = document.querySelectorAll('#article-body h2, #article-body h3');
        const tocLinks = document.querySelectorAll('.toc-link');
        tocLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('data-target');
                const targetEl = document.getElementById(targetId);
                if (targetEl) {
                    const headerOffset = 80;
                    const elementPosition = targetEl.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                    window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                }
            });
        });

        const spyObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    tocLinks.forEach(link => {
                        link.classList.remove('active');
                        if (link.getAttribute('data-target') === id) {
                            link.classList.add('active');
                        }
                    });
                }
            });
        }, { rootMargin: '-80px 0px -80% 0px' });
        headings.forEach(h => spyObserver.observe(h));
    }
}

function bindGlobalEvents() {
    document.getElementById('current-year').textContent = new Date().getFullYear();

    const themeToggleBtn = document.getElementById('theme-toggle');
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    themeToggleBtn.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        if (document.documentElement.classList.contains('dark')) {
            localStorage.theme = 'dark';
        } else {
            localStorage.theme = 'light';
        }
    });

    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileCloseBtn = document.getElementById('mobile-close-btn');
    const mobileMenu = document.getElementById('mobile-menu');

    const toggleMobileMenu = () => {
        mobileMenu.classList.toggle('translate-x-full');
    };

    mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    mobileCloseBtn.addEventListener('click', toggleMobileMenu);

    const mobileLinks = document.querySelectorAll('.mobile-link');
    mobileLinks.forEach(link => link.addEventListener('click', toggleMobileMenu));

    const header = document.getElementById('global-header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 20) {
            header.classList.add('shadow-md', 'bg-white/90', 'dark:bg-slate-900/90');
        } else {
            header.classList.remove('shadow-md', 'bg-white/90', 'dark:bg-slate-900/90');
        }
    }, { passive: true });

    const searchBtn = document.getElementById('search-btn');
    const searchModal = document.getElementById('search-modal');
    const searchContainer = document.getElementById('search-container');
    const searchClose = document.getElementById('search-close');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const searchSettings = store.settings.search;

    if (searchInput && searchSettings) {
        searchInput.placeholder = searchSettings.placeholder;
    }

    let searchTimeout = null;
    const openSearch = () => {
        searchModal.classList.remove('opacity-0', 'pointer-events-none');
        setTimeout(() => searchContainer.classList.remove('-translate-y-8'), 10);
        searchInput.focus();
    };
    const closeSearch = () => {
        searchContainer.classList.add('-translate-y-8');
        setTimeout(() => {
            searchModal.classList.add('opacity-0', 'pointer-events-none');
            searchInput.value = '';
            searchResults.innerHTML = `<div class="text-center py-8 text-gray-500 text-sm">${searchSettings.empty}</div>`;
        }, 300);
    };

    searchBtn.addEventListener('click', openSearch);
    searchClose.addEventListener('click', closeSearch);
    searchModal.addEventListener('click', (e) => {
        if (e.target === searchModal) closeSearch();
    });

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(searchTimeout);

        if (query.length < searchSettings.minQueryLength) {
            searchResults.innerHTML = `<div class="text-center py-8 text-gray-500 text-sm">${searchSettings.empty}</div>`;
            return;
        }

        searchResults.innerHTML = '<div class="flex justify-center py-8"><div class="spinner !w-6 !h-6 !border-2"></div></div>';

        searchTimeout = setTimeout(async () => {
            const results = await api.search(query);
            if (results.length === 0) {
                searchResults.innerHTML = `<div class="text-center py-8 text-gray-500 text-sm">「${query}」${searchSettings.noResults}</div>`;
                return;
            }

            searchResults.innerHTML = results.map(art => `
                <a href="#/article/${art.id}" class="search-result-item block p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors" onclick="document.getElementById('search-close').click()">
                    <h4 class="font-bold text-aoristos-primary mb-1">${art.title}</h4>
                    <p class="text-sm text-gray-500 truncate">${utils.stripHtml(art.content).substring(0, 80)}...</p>
                </a>
            `).join('');
        }, 500);
    });
}

async function initApp() {
    store.settings = await loadSettings();
    renderLayout();
    bindGlobalEvents();
    window.addEventListener('hashchange', renderView);
    renderView();
}

document.addEventListener('DOMContentLoaded', initApp);
