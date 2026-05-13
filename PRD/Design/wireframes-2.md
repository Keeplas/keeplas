<!-- Emergency Card -->
<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Keeplas | Emergency Card</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&amp;family=Inter:wght@400;500;600&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              "surface-bright": "#fcf9f8",
              "secondary-container": "#abe5fe",
              "surface-container-low": "#f6f3f2",
              "on-secondary-fixed-variant": "#004d61",
              "on-tertiary-fixed": "#001f26",
              "primary-fixed-dim": "#b7c7eb",
              "on-tertiary": "#ffffff",
              "tertiary-container": "#00303a",
              "secondary-fixed": "#b9eaff",
              "inverse-primary": "#b7c7eb",
              "tertiary-fixed-dim": "#8fd0e4",
              "surface-variant": "#e5e2e1",
              "surface-dim": "#dcd9d9",
              "on-secondary-container": "#2b687d",
              "outline": "#75777e",
              "background": "#fcf9f8",
              "on-primary-fixed": "#091b37",
              "surface": "#fcf9f8",
              "error-container": "#ffdad6",
              "surface-container": "#f0eded",
              "on-tertiary-container": "#5a9cae",
              "on-background": "#1b1c1c",
              "on-error-container": "#93000a",
              "surface-container-lowest": "#ffffff",
              "on-primary": "#ffffff",
              "on-tertiary-fixed-variant": "#004e5d",
              "primary-fixed": "#d7e2ff",
              "outline-variant": "#c5c6ce",
              "on-primary-fixed-variant": "#374765",
              "on-secondary-fixed": "#001f29",
              "on-surface": "#1b1c1c",
              "tertiary": "#001a20",
              "secondary-fixed-dim": "#95cfe7",
              "surface-container-highest": "#e5e2e1",
              "on-primary-container": "#8393b5",
              "primary-container": "#1b2b48",
              "surface-container-high": "#eae7e7",
              "surface-tint": "#4f5e7e",
              "on-error": "#ffffff",
              "on-surface-variant": "#44474d",
              "primary": "#041632",
              "inverse-surface": "#303030",
              "tertiary-fixed": "#aeecff",
              "on-secondary": "#ffffff",
              "inverse-on-surface": "#f3f0ef",
              "secondary": "#28657a",
              "error": "#ba1a1a"
            },
            fontFamily: {
              "headline": ["Manrope"],
              "body": ["Inter"],
              "label": ["Inter"]
            },
            borderRadius: {"DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem"},
          },
        },
      }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .vault-gradient {
            background: linear-gradient(135deg, #041632 0%, #1b2b48 100%);
        }
    </style>
</head>
<body class="bg-surface font-body text-on-surface min-h-screen flex flex-col">
<!-- TopAppBar -->
<header class="bg-[#041632]/80 backdrop-blur-xl dark:bg-[#041632]/90 docked full-width top-0 z-50 shadow-2xl shadow-[#1b1c1c]/10">
<div class="flex justify-between items-center w-full px-8 py-4 max-w-screen-2xl mx-auto">
<div class="text-2xl font-extrabold tracking-tighter text-white font-headline">Keeplas</div>
<nav class="hidden md:flex items-center space-x-8 font-headline font-bold tracking-tight">
<a class="text-slate-400 hover:text-white transition-colors" href="#">Vault</a>
<a class="text-slate-400 hover:text-white transition-colors" href="#">Life Check</a>
<a class="text-[#b9eaff] border-b-2 border-[#28657a] pb-1" href="#">Emergency Card</a>
<a class="text-slate-400 hover:text-white transition-colors" href="#">Trusted Contacts</a>
</nav>
<div class="flex items-center space-x-4">
<button class="text-[#28657a] dark:text-[#b9eaff] hover:bg-[#1b2b48]/50 rounded-lg transition-all p-2 scale-95 active:scale-90 duration-200">
<span class="material-symbols-outlined">verified_user</span>
</button>
<button class="text-[#28657a] dark:text-[#b9eaff] hover:bg-[#1b2b48]/50 rounded-lg transition-all p-2 scale-95 active:scale-90 duration-200">
<span class="material-symbols-outlined">notifications</span>
</button>
<button class="text-[#28657a] dark:text-[#b9eaff] hover:bg-[#1b2b48]/50 rounded-lg transition-all p-2 scale-95 active:scale-90 duration-200">
<span class="material-symbols-outlined">account_circle</span>
</button>
</div>
</div>
</header>
<main class="flex-grow max-w-screen-2xl mx-auto w-full px-8 py-12 md:py-20">
<div class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
<!-- Left: Configurator -->
<section class="lg:col-span-5 space-y-10">
<div class="space-y-4">
<h1 class="font-headline text-5xl font-extrabold tracking-tighter text-primary leading-none">Emergency Card</h1>
<p class="text-on-surface-variant text-lg max-w-md">Customize your public safety profile. This information remains accessible to responders even when your vault is locked.</p>
</div>
<!-- Toggle Settings Bento -->
<div class="bg-surface-container-low rounded-xl p-8 space-y-6">
<h3 class="font-headline font-bold text-xl text-primary">Privacy Controls</h3>
<div class="space-y-4">
<!-- Field Toggle 1 -->
<div class="flex items-center justify-between p-4 bg-surface-container-lowest rounded-lg">
<div class="flex items-center gap-3">
<span class="material-symbols-outlined text-secondary">person</span>
<span class="font-medium">Full Name</span>
</div>
<button class="w-12 h-6 bg-secondary rounded-full flex items-center px-1 transition-colors">
<div class="w-4 h-4 bg-white rounded-full ml-auto"></div>
</button>
</div>
<!-- Field Toggle 2 -->
<div class="flex items-center justify-between p-4 bg-surface-container-lowest rounded-lg">
<div class="flex items-center gap-3">
<span class="material-symbols-outlined text-secondary">bloodtype</span>
<span class="font-medium">Blood Type</span>
</div>
<button class="w-12 h-6 bg-secondary rounded-full flex items-center px-1 transition-colors">
<div class="w-4 h-4 bg-white rounded-full ml-auto"></div>
</button>
</div>
<!-- Field Toggle 3 -->
<div class="flex items-center justify-between p-4 bg-surface-container-lowest rounded-lg">
<div class="flex items-center gap-3">
<span class="material-symbols-outlined text-secondary">warning</span>
<span class="font-medium">Allergies</span>
</div>
<button class="w-12 h-6 bg-secondary rounded-full flex items-center px-1 transition-colors">
<div class="w-4 h-4 bg-white rounded-full ml-auto"></div>
</button>
</div>
<!-- Field Toggle 4 -->
<div class="flex items-center justify-between p-4 bg-surface-container-lowest rounded-lg">
<div class="flex items-center gap-3">
<span class="material-symbols-outlined text-secondary">contact_phone</span>
<span class="font-medium">Emergency Contact</span>
</div>
<button class="w-12 h-6 bg-secondary rounded-full flex items-center px-1 transition-colors">
<div class="w-4 h-4 bg-white rounded-full ml-auto"></div>
</button>
</div>
</div>
<div class="pt-4">
<button class="vault-gradient text-white w-full py-4 rounded-xl font-headline font-bold tracking-wide hover:shadow-lg transition-all active:scale-95">
                            Update Digital Card
                        </button>
</div>
</div>
</section>
<!-- Right: The Card Display (Asymmetric Placement) -->
<section class="lg:col-span-7 flex flex-col items-center lg:items-end">
<div class="relative group max-w-md w-full">
<!-- The Digital Card -->
<div class="bg-surface-container-lowest rounded-[2rem] overflow-hidden shadow-2xl border border-outline-variant/10 aspect-[3/4] flex flex-col">
<!-- Header / Identity -->
<div class="vault-gradient p-8 text-white">
<div class="flex justify-between items-start mb-12">
<div class="flex flex-col">
<span class="text-[0.65rem] uppercase tracking-[0.2em] font-label opacity-70 mb-1">Keeplas Identity</span>
<h2 class="font-headline font-extrabold text-3xl">Jonathan Arris</h2>
</div>
<div class="w-12 h-12 rounded-full overflow-hidden border-2 border-secondary-fixed">
<img class="w-full h-full object-cover" data-alt="close-up portrait of professional man in soft natural lighting with architectural background" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBCyjqdLCv7PvE0lTGCmzoqF1hMxZprolWZwgafHchKIERha9wuxn_vcxL5JMYoc_EzR8YwANtqdTG_1_OIbkdORp-gdfto_NtVIcRZQoPMJGQR_BC11smZBNaKGejp16ByGYzL5mXBWhDCHPpfNMGBDWC9IbS5hCD2eo6KPRaq1tAA0R8eTxYoQ8k_HQNTg1uArWqALLdvGrWW08jGjFGexTPnJehKNMhsKYQ5pLIL2Xix5GwbeaGnwA1SKxOhORrPoHe9UVR0fzj8"/>
</div>
</div>
<div class="space-y-4">
<div>
<span class="text-[0.6rem] uppercase tracking-widest font-label opacity-60">Status</span>
<div class="flex items-center gap-2">
<div class="w-2 h-2 rounded-full bg-secondary-fixed animate-pulse"></div>
<span class="text-sm font-medium tracking-wide">ACTIVE PROTECTION</span>
</div>
</div>
</div>
</div>
<!-- Info Content -->
<div class="p-8 flex-grow flex flex-col justify-between">
<div class="grid grid-cols-2 gap-8">
<div>
<span class="text-[0.65rem] uppercase tracking-widest font-label text-on-surface-variant block mb-1">Blood Type</span>
<p class="font-headline font-bold text-2xl text-primary">O+</p>
</div>
<div>
<span class="text-[0.65rem] uppercase tracking-widest font-label text-on-surface-variant block mb-1">Allergies</span>
<p class="font-headline font-bold text-lg text-primary">None Recorded</p>
</div>
<div class="col-span-2">
<span class="text-[0.65rem] uppercase tracking-widest font-label text-on-surface-variant block mb-1">Emergency Contact</span>
<p class="font-headline font-bold text-lg text-primary">Sarah Arris (Spouse)</p>
<p class="text-secondary font-medium">+1 (555) 012-3456</p>
</div>
</div>
<!-- QR Section -->
<div class="mt-12 flex flex-col items-center space-y-4">
<div class="p-4 bg-surface-container rounded-2xl">
<div class="w-32 h-32 bg-white flex items-center justify-center p-2 rounded-lg">
<!-- Placeholder for high-contrast QR code -->
<div class="w-full h-full border-[10px] border-primary flex flex-wrap p-1 gap-1">
<div class="w-3 h-3 bg-primary"></div><div class="w-3 h-3 bg-white"></div><div class="w-3 h-3 bg-primary"></div><div class="w-3 h-3 bg-primary"></div>
<div class="w-3 h-3 bg-white"></div><div class="w-3 h-3 bg-primary"></div><div class="w-3 h-3 bg-white"></div><div class="w-3 h-3 bg-white"></div>
<div class="w-3 h-3 bg-primary"></div><div class="w-3 h-3 bg-white"></div><div class="w-3 h-3 bg-primary"></div><div class="w-3 h-3 bg-white"></div>
<div class="w-3 h-3 bg-primary"></div><div class="w-3 h-3 bg-primary"></div><div class="w-3 h-3 bg-white"></div><div class="w-3 h-3 bg-primary"></div>
</div>
</div>
</div>
<p class="text-[0.7rem] uppercase tracking-[0.15em] font-label text-on-surface-variant text-center leading-relaxed">
                                    Scan for Emergency Info<br/>&amp; Medical Directives
                                </p>
</div>
</div>
</div>
<!-- Decorative Background Card -->
<div class="absolute -z-10 top-8 -right-8 w-full h-full bg-surface-container rounded-[2rem] transform rotate-3"></div>
</div>
<!-- Secondary Actions -->
<div class="mt-16 flex gap-4">
<button class="flex items-center gap-2 px-6 py-3 bg-surface-container text-primary font-bold rounded-xl hover:bg-surface-container-high transition-colors">
<span class="material-symbols-outlined">download</span>
<span>Save to Wallet</span>
</button>
<button class="flex items-center gap-2 px-6 py-3 bg-surface-container text-primary font-bold rounded-xl hover:bg-surface-container-high transition-colors">
<span class="material-symbols-outlined">print</span>
<span>Print Physical Card</span>
</button>
</div>
</section>
</div>
</main>
<!-- Footer -->
<footer class="bg-[#001a20] dark:bg-[#000000] w-full py-12 px-8 mt-auto tonal-shift top-layer">
<div class="flex flex-col md:flex-row justify-between items-center border-t border-white/5 pt-8 max-w-screen-2xl mx-auto w-full">
<span class="text-slate-400 font-inter text-xs uppercase tracking-widest">© 2024 Keeplas Life Continuity. Encrypted &amp; Secured.</span>
<div class="flex space-x-8 mt-6 md:mt-0">
<a class="text-slate-500 font-inter text-xs uppercase tracking-widest hover:text-[#28657a] transition-colors" href="#">Privacy Vault</a>
<a class="text-slate-500 font-inter text-xs uppercase tracking-widest hover:text-[#28657a] transition-colors" href="#">Security Protocol</a>
<a class="text-slate-500 font-inter text-xs uppercase tracking-widest hover:text-[#28657a] transition-colors" href="#">Terms of Legacy</a>
<a class="text-slate-500 font-inter text-xs uppercase tracking-widest hover:text-[#28657a] transition-colors" href="#">Contact Concierge</a>
</div>
</div>
</footer>
</body></html>

<!-- Life Map Overview -->
<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Keeplas | Life Map</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&amp;family=Inter:wght@400;500;600&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        "on-tertiary-fixed-variant": "#004e5d",
                        "primary-container": "#1b2b48",
                        "error": "#ba1a1a",
                        "surface-container-high": "#eae7e7",
                        "inverse-on-surface": "#f3f0ef",
                        "surface-container": "#f0eded",
                        "on-secondary-fixed-variant": "#004d61",
                        "surface-dim": "#dcd9d9",
                        "tertiary-fixed-dim": "#8fd0e4",
                        "surface-bright": "#fcf9f8",
                        "secondary": "#28657a",
                        "tertiary": "#001a20",
                        "surface-variant": "#e5e2e1",
                        "primary-fixed-dim": "#b7c7eb",
                        "on-surface-variant": "#44474d",
                        "on-primary": "#ffffff",
                        "background": "#fcf9f8",
                        "surface-container-highest": "#e5e2e1",
                        "primary": "#041632",
                        "on-primary-container": "#8393b5",
                        "on-background": "#1b1c1c",
                        "surface-container-low": "#f6f3f2",
                        "on-error-container": "#93000a",
                        "inverse-primary": "#b7c7eb",
                        "tertiary-container": "#00303a",
                        "surface-container-lowest": "#ffffff",
                        "surface": "#fcf9f8",
                        "tertiary-fixed": "#aeecff",
                        "on-tertiary": "#ffffff",
                        "on-primary-fixed": "#091b37",
                        "outline-variant": "#c5c6ce",
                        "on-surface": "#1b1c1c",
                        "error-container": "#ffdad6",
                        "outline": "#75777e",
                        "on-primary-fixed-variant": "#374765",
                        "primary-fixed": "#d7e2ff",
                        "on-secondary-container": "#2b687d",
                        "secondary-fixed-dim": "#95cfe7",
                        "inverse-surface": "#303030",
                        "on-secondary-fixed": "#001f29",
                        "surface-tint": "#4f5e7e",
                        "on-error": "#ffffff",
                        "secondary-fixed": "#b9eaff",
                        "on-tertiary-fixed": "#001f26",
                        "secondary-container": "#abe5fe",
                        "on-tertiary-container": "#5a9cae",
                        "on-secondary": "#ffffff"
                    },
                    fontFamily: {
                        "headline": ["Manrope"],
                        "body": ["Inter"],
                        "label": ["Inter"]
                    },
                    borderRadius: {"DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem"},
                },
            },
        }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
            display: inline-block;
            vertical-align: middle;
        }
        .node-path {
            background-image: radial-gradient(circle, #28657a 1px, transparent 1px);
            background-size: 24px 24px;
        }
    </style>
</head>
<body class="bg-surface font-body text-on-surface antialiased selection:bg-secondary-container selection:text-on-secondary-container">
<!-- TopAppBar -->
<header class="bg-[#041632]/80 backdrop-blur-xl dark:bg-[#041632]/90 docked full-width top-0 z-50 no-border tonal-shift-bg shadow-2xl shadow-[#1b1c1c]/10 fixed w-full">
<div class="flex justify-between items-center w-full px-8 py-4 max-w-screen-2xl mx-auto">
<div class="text-2xl font-extrabold tracking-tighter text-white font-headline">Keeplas</div>
<nav class="hidden md:flex items-center space-x-8">
<a class="font-manrope font-bold tracking-tight text-slate-400 hover:text-white transition-colors" href="#">Vault</a>
<a class="font-manrope font-bold tracking-tight text-slate-400 hover:text-white transition-colors" href="#">Life Check</a>
<a class="font-manrope font-bold tracking-tight text-slate-400 hover:text-white transition-colors" href="#">Emergency Card</a>
<a class="font-manrope font-bold tracking-tight text-slate-400 hover:text-white transition-colors" href="#">Trusted Contacts</a>
</nav>
<div class="flex items-center space-x-4">
<button class="hover:bg-[#1b2b48]/50 rounded-lg transition-all p-2 text-[#b9eaff] scale-95 active:scale-90 duration-200">
<span class="material-symbols-outlined" data-icon="verified_user">verified_user</span>
</button>
<button class="hover:bg-[#1b2b48]/50 rounded-lg transition-all p-2 text-[#b9eaff] scale-95 active:scale-90 duration-200">
<span class="material-symbols-outlined" data-icon="notifications">notifications</span>
</button>
<button class="hover:bg-[#1b2b48]/50 rounded-lg transition-all p-2 text-[#b9eaff] scale-95 active:scale-90 duration-200">
<span class="material-symbols-outlined" data-icon="account_circle">account_circle</span>
</button>
</div>
</div>
</header>
<!-- Sidebar -->
<aside class="hidden md:flex h-full w-72 fixed left-0 top-0 border-r-0 bg-[#f6f3f2] dark:bg-[#001a20] tonal-layering surface-container-low flat no-shadows flex-col p-6 space-y-8 z-40 pt-24">
<div class="flex items-center space-x-3 px-2">
<div class="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center overflow-hidden">
<img class="w-full h-full object-cover" data-alt="Professional headshot of a mature man with a calm and confident expression, soft natural lighting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBte4Y04kVaZSrEf4_SwTksNVFW2tDzC8x83_e6aKg9hAz-fIQQfxInOJlh_REwfo4jXviv-DbYqoTbQVoy0RnLqNMkEQzi1OOkZtW8Sn_RnDvRpeAzQm7ZA9rpPk2Pnul5CbzpKnUhgx5fF0j4DYFdITig8kWMatKd8Hth5Vc5Dmvxuugq_3jGjbdX-tZVw8-oHd7_Z4zuC0L08kVYuhLwoRnlzGOjK_T5KRxD-zbmo57isHdsN05zPHS6fH7iAE5Pjx6XTSd5Zlgi"/>
</div>
<div>
<p class="font-manrope font-black text-[#041632] text-sm">The Vault</p>
<p class="text-[10px] font-inter uppercase tracking-widest text-[#28657a]/70">Security Level: Maximum</p>
</div>
</div>
<nav class="flex-1 space-y-2">
<a class="flex items-center space-x-3 px-4 py-3 bg-[#28657a] text-white rounded-xl shadow-lg transition-transform hover:translate-x-1 duration-300" href="#">
<span class="material-symbols-outlined" data-icon="dashboard">dashboard</span>
<span class="font-inter text-sm font-medium uppercase tracking-widest">Dashboard</span>
</a>
<a class="flex items-center space-x-3 px-4 py-3 text-[#28657a]/70 hover:bg-[#e5e2e1] rounded-xl transition-transform hover:translate-x-1 duration-300" href="#">
<span class="material-symbols-outlined" data-icon="lock">lock</span>
<span class="font-inter text-sm font-medium uppercase tracking-widest">Digital Vault</span>
</a>
<a class="flex items-center space-x-3 px-4 py-3 text-[#28657a]/70 hover:bg-[#e5e2e1] rounded-xl transition-transform hover:translate-x-1 duration-300" href="#">
<span class="material-symbols-outlined" data-icon="medical_services">medical_services</span>
<span class="font-inter text-sm font-medium uppercase tracking-widest">Health Directives</span>
</a>
<a class="flex items-center space-x-3 px-4 py-3 text-[#28657a]/70 hover:bg-[#e5e2e1] rounded-xl transition-transform hover:translate-x-1 duration-300" href="#">
<span class="material-symbols-outlined" data-icon="gavel">gavel</span>
<span class="font-inter text-sm font-medium uppercase tracking-widest">Legal Legacy</span>
</a>
<a class="flex items-center space-x-3 px-4 py-3 text-[#28657a]/70 hover:bg-[#e5e2e1] rounded-xl transition-transform hover:translate-x-1 duration-300" href="#">
<span class="material-symbols-outlined" data-icon="shield">shield</span>
<span class="font-inter text-sm font-medium uppercase tracking-widest">Security Center</span>
</a>
</nav>
<button class="w-full py-4 bg-primary text-white rounded-xl font-headline font-bold text-sm tracking-wide shadow-xl active:scale-95 transition-all">
            Emergency Access
        </button>
</aside>
<!-- Main Content -->
<main class="md:ml-72 pt-28 pb-12 px-8 min-h-screen">
<div class="max-w-6xl mx-auto">
<!-- Header Section -->
<header class="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
<div>
<h1 class="font-headline text-5xl font-extrabold text-primary tracking-tighter mb-2">Life Map</h1>
<p class="text-secondary font-medium tracking-wide max-w-lg">A holistic visual overview of your protected legacy and continuity readiness.</p>
</div>
<div class="flex items-center gap-4 bg-surface-container-low p-4 rounded-full px-6">
<div class="relative w-12 h-12 flex items-center justify-center">
<svg class="absolute inset-0 w-full h-full -rotate-90">
<circle class="text-surface-container-high" cx="24" cy="24" fill="none" r="20" stroke="currentColor" stroke-width="4"></circle>
<circle class="text-secondary" cx="24" cy="24" fill="none" r="20" stroke="currentColor" stroke-dasharray="125.6" stroke-dashoffset="31.4" stroke-width="4"></circle>
</svg>
<span class="font-headline font-bold text-primary text-xs">75%</span>
</div>
<div>
<p class="font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Continuity Score</p>
<p class="text-sm font-bold text-primary">Strong Protection</p>
</div>
</div>
</header>
<!-- Life Map Canvas: Node Interface -->
<div class="relative min-h-[700px] bg-surface-container-low rounded-[2rem] overflow-hidden p-8 mb-12 node-path">
<!-- Center Node -->
<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
<div class="w-48 h-48 rounded-full bg-primary flex flex-col items-center justify-center text-white shadow-2xl p-6 text-center border-8 border-surface-container-low">
<span class="material-symbols-outlined text-4xl mb-2" data-icon="fingerprint">fingerprint</span>
<p class="font-headline font-extrabold text-lg leading-tight uppercase tracking-tighter">Your Legacy</p>
<p class="text-[10px] text-secondary-fixed font-medium mt-1 uppercase">Central Node</p>
</div>
</div>
<!-- Node Groups (Protected Zones) -->
<!-- Assets Group -->
<div class="absolute top-10 left-10 md:left-24 group">
<div class="bg-surface-container-lowest p-6 rounded-[2rem] shadow-xl hover:shadow-2xl transition-all duration-500 border border-secondary/10 w-64">
<div class="flex items-center justify-between mb-4">
<div class="w-12 h-12 bg-secondary-container/30 text-secondary rounded-2xl flex items-center justify-center">
<span class="material-symbols-outlined" data-icon="account_balance">account_balance</span>
</div>
<span class="text-[10px] font-bold uppercase tracking-widest text-secondary bg-secondary-container/20 px-2 py-1 rounded">Protected</span>
</div>
<h3 class="font-headline font-bold text-primary mb-1">Assets</h3>
<div class="space-y-3 mt-4">
<div class="flex justify-between items-center text-xs">
<span class="text-on-surface-variant">Real Estate Portfolio</span>
<span class="material-symbols-outlined text-secondary text-sm" data-icon="check_circle" data-weight="fill">check_circle</span>
</div>
<div class="flex justify-between items-center text-xs">
<span class="text-on-surface-variant">Retirement Accounts</span>
<span class="material-symbols-outlined text-secondary text-sm" data-icon="check_circle" data-weight="fill">check_circle</span>
</div>
<div class="flex justify-between items-center text-xs">
<span class="text-on-surface-variant">Digital Wallets</span>
<span class="material-symbols-outlined text-secondary text-sm" data-icon="check_circle" data-weight="fill">check_circle</span>
</div>
</div>
</div>
</div>
<!-- Contacts Group -->
<div class="absolute bottom-10 left-10 md:left-24 group">
<div class="bg-surface-container-lowest p-6 rounded-[2rem] shadow-xl hover:shadow-2xl transition-all duration-500 border border-secondary/10 w-64">
<div class="flex items-center justify-between mb-4">
<div class="w-12 h-12 bg-secondary-container/30 text-secondary rounded-2xl flex items-center justify-center">
<span class="material-symbols-outlined" data-icon="group">group</span>
</div>
<span class="text-[10px] font-bold uppercase tracking-widest text-secondary bg-secondary-container/20 px-2 py-1 rounded">Protected</span>
</div>
<h3 class="font-headline font-bold text-primary mb-1">Contacts</h3>
<div class="flex -space-x-3 mt-4 mb-3">
<img class="w-10 h-10 rounded-full border-2 border-surface shadow-sm" data-alt="Close up of a smiling woman with glasses, professional portrait" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBxEemR_5E7DRupdw-Lu3wilIM_InclqxdWSE-OKb0EPMnogOsFOvllAquREB-30woMLI3zkX4gnCzEybZKxEPxuhqfdDi95vHgBarzlpv7A_Td1FGDZ9SFqjPwDY_rgfaT5UkpGfkqnHsDAcc6XLg5aq_TwPlxnXacUPZ1IYyRBLJFtZV-nw7hdwj8AWFH-huX488CMIl4gYKwKBh03WJNjBVow4Nvnhgc8_1W5sJjTIYfWnHp3VCf-5nzxl-tPKKGympUE06YEz6Q"/>
<img class="w-10 h-10 rounded-full border-2 border-surface shadow-sm" data-alt="Portrait of a friendly man in a navy sweater, warm lighting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD85QClRg8Oza6VPza4Tj0va13he9b1kpjtgqU6rA9mtabQnVCd8ES-vUMQ2gZkEHvvNF_dokqAvMwhLhf2V07F71CBw7-RSMdvqb99j0ZvDTCtS9dPMKMhqTfK5U2cddpF7GsMOElJlo8YPEFUNja1DmYFS98HCh7azUn2fR7MYOn1HfRR8qzaQxgavwmozk012ITxrg7eNKECBrr9jJDAeRmzgE58Fg0J7N7bpimcJVxxYyA7TWBDZxcBaw1vJIStTy-md27D9TeN"/>
<img class="w-10 h-10 rounded-full border-2 border-surface shadow-sm" data-alt="Modern professional woman in a bright office setting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCNHGIO69wJXrhhfUzdzaubnMdQe0vPMSmou0Bk2fNF9wB8NJALQoUB1zuNZR1by35XivkgupgC-724SeH8eNLzoRPsWPnaWMQ9MYUMP2lkm4qeJMAgXYxfLpqLk6Scf_quO6zlfxqCpZtdrjWal042ifXK6Wz1EtEElHFc3lH0OwUjhJ-mjy_zFzG2FK1DUvmpxWHcrwSwZ2U5847ToVL5GhC6XnYlwEKM65cH4htY-UBgCzlYuEY6VABTdk1GH4jrwLhzUhLeLVKw"/>
<div class="w-10 h-10 rounded-full border-2 border-surface bg-surface-container-high flex items-center justify-center text-[10px] font-bold text-on-surface-variant">+2</div>
</div>
<p class="text-[10px] font-medium text-on-surface-variant uppercase tracking-widest">4 Primary Guardians Linked</p>
</div>
</div>
<!-- Directives Group (Unmapped Vulnerability) -->
<div class="absolute top-10 right-10 md:right-24 group">
<div class="bg-surface-container p-6 rounded-[2rem] shadow-xl hover:shadow-2xl transition-all duration-500 border-2 border-error/20 w-64 relative">
<div class="absolute -top-3 -right-3 bg-error text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-tighter animate-pulse">Action Required</div>
<div class="flex items-center justify-between mb-4">
<div class="w-12 h-12 bg-error/10 text-error rounded-2xl flex items-center justify-center">
<span class="material-symbols-outlined" data-icon="medical_information">medical_information</span>
</div>
<span class="text-[10px] font-bold uppercase tracking-widest text-error bg-error/10 px-2 py-1 rounded">Unmapped</span>
</div>
<h3 class="font-headline font-bold text-primary mb-1">Directives</h3>
<p class="text-xs text-on-surface-variant mt-2 leading-relaxed">Medical POA and Advance Directives are currently missing or expired.</p>
<button class="mt-4 w-full py-2 bg-error text-white rounded-lg text-xs font-bold font-headline transition-transform active:scale-95">Update Now</button>
</div>
</div>
<!-- Documents Group -->
<div class="absolute bottom-10 right-10 md:right-24 group">
<div class="bg-surface-container-lowest p-6 rounded-[2rem] shadow-xl hover:shadow-2xl transition-all duration-500 border border-secondary/10 w-64">
<div class="flex items-center justify-between mb-4">
<div class="w-12 h-12 bg-secondary-container/30 text-secondary rounded-2xl flex items-center justify-center">
<span class="material-symbols-outlined" data-icon="description">description</span>
</div>
<span class="text-[10px] font-bold uppercase tracking-widest text-secondary bg-secondary-container/20 px-2 py-1 rounded">Protected</span>
</div>
<h3 class="font-headline font-bold text-primary mb-1">Documents</h3>
<div class="grid grid-cols-2 gap-2 mt-4">
<div class="bg-surface-container p-2 rounded-lg flex flex-col items-center justify-center aspect-square text-center">
<span class="material-symbols-outlined text-on-surface-variant text-sm" data-icon="home">home</span>
<span class="text-[8px] font-bold mt-1 uppercase text-on-surface-variant">Deeds</span>
</div>
<div class="bg-surface-container p-2 rounded-lg flex flex-col items-center justify-center aspect-square text-center">
<span class="material-symbols-outlined text-on-surface-variant text-sm" data-icon="history_edu">history_edu</span>
<span class="text-[8px] font-bold mt-1 uppercase text-on-surface-variant">Will</span>
</div>
</div>
</div>
</div>
<!-- Connections (Decorative SVG Layer) -->
<svg class="absolute inset-0 w-full h-full pointer-events-none opacity-20">
<line stroke="#041632" stroke-dasharray="8 8" stroke-width="2" x1="25%" x2="50%" y1="20%" y2="50%"></line>
<line stroke="#041632" stroke-dasharray="8 8" stroke-width="2" x1="25%" x2="50%" y1="80%" y2="50%"></line>
<line stroke="#ba1a1a" stroke-dasharray="4 4" stroke-width="2" x1="75%" x2="50%" y1="20%" y2="50%"></line>
<line stroke="#041632" stroke-dasharray="8 8" stroke-width="2" x1="75%" x2="50%" y1="80%" y2="50%"></line>
</svg>
</div>
<!-- AI Completeness Analyzer -->
<section class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
<div class="md:col-span-2 bg-primary-container text-white p-8 rounded-[2rem] shadow-2xl relative overflow-hidden">
<div class="relative z-10">
<div class="flex items-center gap-3 mb-6">
<span class="material-symbols-outlined text-secondary-fixed text-3xl" data-icon="psychology">psychology</span>
<h2 class="font-headline text-2xl font-bold tracking-tight">AI Completeness Analyzer</h2>
</div>
<p class="text-on-primary-container max-w-lg mb-8 text-lg leading-relaxed italic">"You have secured 84% of your vital legacy. The missing link is your Digital Life Directive, which prevents executors from accessing your encrypted assets."</p>
<div class="flex flex-wrap gap-4">
<button class="bg-secondary-fixed text-on-secondary-fixed font-headline font-extrabold px-6 py-3 rounded-xl transition-all active:scale-95 shadow-lg shadow-black/20">Generate Digital Directive</button>
<button class="text-white border border-white/20 hover:bg-white/10 px-6 py-3 rounded-xl transition-all font-headline font-bold">Review Risks</button>
</div>
</div>
<!-- Decorative Element -->
<div class="absolute -right-20 -bottom-20 w-80 h-80 bg-secondary/10 rounded-full blur-[100px]"></div>
</div>
<div class="bg-surface-container-low p-8 rounded-[2rem] flex flex-col justify-center">
<h3 class="font-headline font-bold text-primary mb-4 text-xl">Protected Zones</h3>
<ul class="space-y-4">
<li class="flex items-center gap-3">
<span class="w-2 h-2 rounded-full bg-secondary"></span>
<span class="text-sm font-medium text-on-surface">Financial Redundancy</span>
</li>
<li class="flex items-center gap-3">
<span class="w-2 h-2 rounded-full bg-secondary"></span>
<span class="text-sm font-medium text-on-surface">Trusted Node Mesh</span>
</li>
<li class="flex items-center gap-3">
<span class="w-2 h-2 rounded-full bg-secondary"></span>
<span class="text-sm font-medium text-on-surface">Real Estate Chain</span>
</li>
<li class="flex items-center gap-3">
<span class="w-2 h-2 rounded-full bg-error animate-pulse"></span>
<span class="text-sm font-bold text-error">Healthcare Directive Gap</span>
</li>
</ul>
</div>
</section>
<!-- Secondary Bento Items -->
<section class="grid grid-cols-1 md:grid-cols-4 gap-6">
<div class="bg-surface-container-lowest p-6 rounded-[1.5rem] shadow-sm flex flex-col justify-between">
<div>
<span class="material-symbols-outlined text-secondary-fixed-dim mb-3" data-icon="history">history</span>
<h4 class="font-headline font-bold text-primary">Map Activity</h4>
</div>
<p class="text-xs text-on-surface-variant mt-4">Last verified by Sarah (Primary Trustee) 2 days ago.</p>
</div>
<div class="bg-surface-container-lowest p-6 rounded-[1.5rem] shadow-sm flex flex-col justify-between">
<div>
<span class="material-symbols-outlined text-secondary-fixed-dim mb-3" data-icon="cloud_sync">cloud_sync</span>
<h4 class="font-headline font-bold text-primary">Vault Sync</h4>
</div>
<p class="text-xs text-on-surface-variant mt-4">Active and encrypted. All documents mirrored to secure nodes.</p>
</div>
<div class="bg-surface-container-lowest p-6 rounded-[1.5rem] shadow-sm flex flex-col justify-between">
<div>
<span class="material-symbols-outlined text-secondary-fixed-dim mb-3" data-icon="lock_reset">lock_reset</span>
<h4 class="font-headline font-bold text-primary">Key Health</h4>
</div>
<p class="text-xs text-on-surface-variant mt-4">Physical keys and backup shards are in optimal storage locations.</p>
</div>
<div class="bg-surface-container-lowest p-6 rounded-[1.5rem] shadow-sm flex flex-col justify-between">
<div>
<span class="material-symbols-outlined text-secondary-fixed-dim mb-3" data-icon="share_reviews">share_reviews</span>
<h4 class="font-headline font-bold text-primary">Trustee Access</h4>
</div>
<p class="text-xs text-on-surface-variant mt-4">3 of 5 Trustees have successfully completed life-drill onboarding.</p>
</div>
</section>
</div>
</main>
<!-- Footer -->
<footer class="w-full py-12 px-8 mt-auto bg-[#001a20] dark:bg-[#000000] tonal-shift top-layer flex flex-col md:flex-row justify-between items-center border-t border-white/5">
<div class="text-slate-400 font-inter text-xs uppercase tracking-widest mb-6 md:mb-0">
            © 2024 Keeplas Life Continuity. Encrypted &amp; Secured.
        </div>
<div class="flex flex-wrap justify-center gap-8">
<a class="text-slate-500 font-inter text-xs uppercase tracking-widest hover:text-[#28657a] transition-colors" href="#">Privacy Vault</a>
<a class="text-slate-500 font-inter text-xs uppercase tracking-widest hover:text-[#28657a] transition-colors" href="#">Security Protocol</a>
<a class="text-slate-500 font-inter text-xs uppercase tracking-widest hover:text-[#28657a] transition-colors" href="#">Terms of Legacy</a>
<a class="text-slate-500 font-inter text-xs uppercase tracking-widest hover:text-[#28657a] transition-colors" href="#">Contact Concierge</a>
</div>
</footer>
</body></html>

<!-- Digital Vault Inventory -->
<!DOCTYPE html>

<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&amp;family=Inter:wght@400;500;600&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        "on-tertiary-fixed-variant": "#004e5d",
                        "primary-container": "#1b2b48",
                        "error": "#ba1a1a",
                        "surface-container-high": "#eae7e7",
                        "inverse-on-surface": "#f3f0ef",
                        "surface-container": "#f0eded",
                        "on-secondary-fixed-variant": "#004d61",
                        "surface-dim": "#dcd9d9",
                        "tertiary-fixed-dim": "#8fd0e4",
                        "surface-bright": "#fcf9f8",
                        "secondary": "#28657a",
                        "tertiary": "#001a20",
                        "surface-variant": "#e5e2e1",
                        "primary-fixed-dim": "#b7c7eb",
                        "on-surface-variant": "#44474d",
                        "on-primary": "#ffffff",
                        "background": "#fcf9f8",
                        "surface-container-highest": "#e5e2e1",
                        "primary": "#041632",
                        "on-primary-container": "#8393b5",
                        "on-background": "#1b1c1c",
                        "surface-container-low": "#f6f3f2",
                        "on-error-container": "#93000a",
                        "inverse-primary": "#b7c7eb",
                        "tertiary-container": "#00303a",
                        "surface-container-lowest": "#ffffff",
                        "surface": "#fcf9f8",
                        "tertiary-fixed": "#aeecff",
                        "on-tertiary": "#ffffff",
                        "on-primary-fixed": "#091b37",
                        "outline-variant": "#c5c6ce",
                        "on-surface": "#1b1c1c",
                        "error-container": "#ffdad6",
                        "outline": "#75777e",
                        "on-primary-fixed-variant": "#374765",
                        "primary-fixed": "#d7e2ff",
                        "on-secondary-container": "#2b687d",
                        "secondary-fixed-dim": "#95cfe7",
                        "inverse-surface": "#303030",
                        "on-secondary-fixed": "#001f29",
                        "surface-tint": "#4f5e7e",
                        "on-error": "#ffffff",
                        "secondary-fixed": "#b9eaff",
                        "on-tertiary-fixed": "#001f26",
                        "secondary-container": "#abe5fe",
                        "on-tertiary-container": "#5a9cae",
                        "on-secondary": "#ffffff"
                    },
                    fontFamily: {
                        "headline": ["Manrope"],
                        "body": ["Inter"],
                        "label": ["Inter"]
                    },
                    borderRadius: { "DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem" },
                },
            },
        }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .tonal-layering {
            background-color: var(--tw-bg-surface-container-low);
        }
        .glass-nav {
            backdrop-filter: blur(20px);
        }
        .signature-gradient {
            background: linear-gradient(135deg, #041632 0%, #1b2b48 100%);
        }
    </style>
</head>
<body class="bg-surface text-on-surface font-body min-h-screen flex flex-col">
<!-- TopAppBar -->
<header class="bg-[#041632]/80 backdrop-blur-xl dark:bg-[#041632]/90 docked full-width top-0 z-50 shadow-2xl shadow-[#1b1c1c]/10">
<div class="flex justify-between items-center w-full px-8 py-4 max-w-screen-2xl mx-auto">
<div class="text-2xl font-extrabold tracking-tighter text-white font-headline">Keeplas</div>
<nav class="hidden md:flex items-center space-x-8">
<a class="text-slate-400 hover:text-white transition-colors font-manrope font-bold tracking-tight" href="#">Vault</a>
<a class="text-slate-400 hover:text-white transition-colors font-manrope font-bold tracking-tight" href="#">Life Check</a>
<a class="text-slate-400 hover:text-white transition-colors font-manrope font-bold tracking-tight" href="#">Emergency Card</a>
<a class="text-slate-400 hover:text-white transition-colors font-manrope font-bold tracking-tight" href="#">Trusted Contacts</a>
</nav>
<div class="flex items-center space-x-6">
<button class="text-white hover:bg-[#1b2b48]/50 rounded-lg transition-all p-2 scale-95 active:scale-90 duration-200">
<span class="material-symbols-outlined" data-icon="verified_user">verified_user</span>
</button>
<button class="text-white hover:bg-[#1b2b48]/50 rounded-lg transition-all p-2 scale-95 active:scale-90 duration-200">
<span class="material-symbols-outlined" data-icon="notifications">notifications</span>
</button>
<button class="text-white hover:bg-[#1b2b48]/50 rounded-lg transition-all p-2 scale-95 active:scale-90 duration-200">
<span class="material-symbols-outlined" data-icon="account_circle">account_circle</span>
</button>
</div>
</div>
</header>
<div class="flex flex-1 overflow-hidden">
<!-- SideNavBar (Desktop) -->
<aside class="hidden md:flex flex-col h-full w-72 fixed left-0 top-0 pt-20 bg-[#f6f3f2] dark:bg-[#001a20] space-y-8 p-6 z-40">
<div class="mb-4">
<h2 class="font-manrope font-black text-[#041632] text-xl">The Vault</h2>
<p class="text-sm font-medium uppercase tracking-widest text-[#28657a]/70">Security Level: Maximum</p>
</div>
<nav class="flex flex-col space-y-2">
<a class="flex items-center space-x-4 p-3 text-[#28657a]/70 hover:bg-[#e5e2e1] hover:translate-x-1 transition-transform font-inter text-sm font-medium uppercase tracking-widest" href="#">
<span class="material-symbols-outlined" data-icon="dashboard">dashboard</span>
<span>Dashboard</span>
</a>
<a class="flex items-center space-x-4 p-3 bg-[#28657a] text-white rounded-xl shadow-lg hover:translate-x-1 transition-transform font-inter text-sm font-medium uppercase tracking-widest" href="#">
<span class="material-symbols-outlined" data-icon="lock">lock</span>
<span>Digital Vault</span>
</a>
<a class="flex items-center space-x-4 p-3 text-[#28657a]/70 hover:bg-[#e5e2e1] hover:translate-x-1 transition-transform font-inter text-sm font-medium uppercase tracking-widest" href="#">
<span class="material-symbols-outlined" data-icon="medical_services">medical_services</span>
<span>Health Directives</span>
</a>
<a class="flex items-center space-x-4 p-3 text-[#28657a]/70 hover:bg-[#e5e2e1] hover:translate-x-1 transition-transform font-inter text-sm font-medium uppercase tracking-widest" href="#">
<span class="material-symbols-outlined" data-icon="gavel">gavel</span>
<span>Legal Legacy</span>
</a>
<a class="flex items-center space-x-4 p-3 text-[#28657a]/70 hover:bg-[#e5e2e1] hover:translate-x-1 transition-transform font-inter text-sm font-medium uppercase tracking-widest" href="#">
<span class="material-symbols-outlined" data-icon="shield">shield</span>
<span>Security Center</span>
</a>
</nav>
<div class="mt-auto">
<button class="w-full signature-gradient text-white py-4 px-6 rounded-xl font-bold tracking-tight shadow-xl hover:scale-[1.02] transition-transform active:scale-95">
                    Emergency Access
                </button>
</div>
</aside>
<!-- Main Content Area -->
<main class="flex-1 md:ml-72 pt-24 px-8 pb-12 overflow-y-auto">
<div class="max-w-6xl mx-auto space-y-10">
<!-- Header & Action Row -->
<div class="flex flex-col md:flex-row justify-between items-end gap-6">
<div class="space-y-2">
<h1 class="text-5xl font-extrabold font-headline tracking-tighter text-primary">Digital Vault</h1>
<p class="text-on-surface-variant font-body max-w-md">Your life’s core documentation, secured with end-to-end zero-knowledge encryption.</p>
</div>
<button class="signature-gradient text-white px-8 py-4 rounded-xl font-bold flex items-center space-x-3 shadow-2xl hover:scale-105 transition-all">
<span class="material-symbols-outlined" data-icon="add_circle">add_circle</span>
<span>Add New Entry</span>
</button>
</div>
<!-- Integrity Summary & Bento Stats -->
<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
<div class="md:col-span-2 bg-primary text-white p-8 rounded-full flex flex-col justify-between relative overflow-hidden">
<div class="relative z-10">
<span class="bg-secondary px-3 py-1 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold">Status: Active</span>
<h3 class="text-3xl font-headline font-bold mt-4">Vault Integrity: 98%</h3>
<p class="text-on-primary-container mt-2 max-w-sm">System last verified 14 minutes ago. No vulnerabilities detected in 1,248 encrypted blocks.</p>
</div>
<div class="flex mt-8 gap-4 relative z-10">
<div class="bg-primary-container p-4 rounded-xl flex-1">
<p class="text-[10px] uppercase tracking-widest text-on-primary-container">Encrypted Items</p>
<p class="text-2xl font-bold">142</p>
</div>
<div class="bg-primary-container p-4 rounded-xl flex-1">
<p class="text-[10px] uppercase tracking-widest text-on-primary-container">Secure Nodes</p>
<p class="text-2xl font-bold">8</p>
</div>
</div>
<div class="absolute right-[-20px] bottom-[-20px] opacity-10">
<span class="material-symbols-outlined text-[200px]" data-icon="verified_user">verified_user</span>
</div>
</div>
<div class="bg-surface-container-low p-8 rounded-full border border-outline-variant/10 flex flex-col items-center justify-center text-center">
<span class="material-symbols-outlined text-secondary text-5xl mb-4" data-icon="history">history</span>
<p class="text-sm font-medium text-on-surface-variant uppercase tracking-widest">Last Access</p>
<p class="text-xl font-bold text-primary mt-1">Today, 11:24 AM</p>
<p class="text-xs text-on-surface-variant/60 mt-2">from London, UK (Verified Device)</p>
</div>
</div>
<!-- Vault Sections -->
<div class="space-y-12">
<!-- Personal Documents -->
<section class="space-y-6">
<div class="flex items-center justify-between">
<h2 class="text-2xl font-headline font-bold flex items-center gap-3">
<span class="w-2 h-8 bg-secondary rounded-full"></span>
                                Personal Documents
                            </h2>
<button class="text-secondary text-sm font-bold hover:underline">View All</button>
</div>
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
<!-- Card Item -->
<div class="bg-surface-container hover:bg-surface-container-high p-6 rounded-full transition-all group cursor-pointer border border-transparent hover:border-outline-variant/20">
<div class="flex justify-between items-start mb-4">
<div class="bg-white p-3 rounded-xl shadow-sm group-hover:bg-secondary group-hover:text-white transition-colors">
<span class="material-symbols-outlined" data-icon="contact_page">contact_page</span>
</div>
<span class="material-symbols-outlined text-secondary text-sm" data-icon="lock_open" data-weight="fill" style="font-variation-settings: 'FILL' 1;">lock_open</span>
</div>
<h4 class="font-bold text-lg text-primary">Passport Scan</h4>
<p class="text-xs text-on-surface-variant uppercase tracking-widest mt-1">Updated May 12, 2024</p>
</div>
<!-- Card Item -->
<div class="bg-surface-container hover:bg-surface-container-high p-6 rounded-full transition-all group cursor-pointer border border-transparent hover:border-outline-variant/20">
<div class="flex justify-between items-start mb-4">
<div class="bg-white p-3 rounded-xl shadow-sm group-hover:bg-secondary group-hover:text-white transition-colors">
<span class="material-symbols-outlined" data-icon="description">description</span>
</div>
<span class="material-symbols-outlined text-secondary text-sm" data-icon="lock_open" data-weight="fill" style="font-variation-settings: 'FILL' 1;">lock_open</span>
</div>
<h4 class="font-bold text-lg text-primary">Living Will</h4>
<p class="text-xs text-on-surface-variant uppercase tracking-widest mt-1">Updated Aug 04, 2023</p>
</div>
</div>
</section>
<!-- Financial Assets -->
<section class="space-y-6">
<div class="flex items-center justify-between">
<h2 class="text-2xl font-headline font-bold flex items-center gap-3">
<span class="w-2 h-8 bg-primary rounded-full"></span>
                                Financial Assets
                            </h2>
</div>
<div class="bg-surface-container-low rounded-full overflow-hidden">
<table class="w-full text-left border-collapse">
<thead class="border-b border-outline-variant/10">
<tr>
<th class="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Asset Name</th>
<th class="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Encryption Status</th>
<th class="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Last Updated</th>
<th class="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant text-right">Action</th>
</tr>
</thead>
<tbody>
<tr class="hover:bg-surface-container transition-colors group">
<td class="px-8 py-6">
<div class="flex items-center gap-4">
<span class="material-symbols-outlined text-secondary" data-icon="account_balance">account_balance</span>
<span class="font-bold text-primary">Offshore Accounts Ledger</span>
</div>
</td>
<td class="px-8 py-6">
<span class="flex items-center gap-2 text-xs font-bold text-on-tertiary-fixed-variant bg-tertiary-fixed px-3 py-1 rounded-full w-fit">
<span class="material-symbols-outlined text-[14px]" data-icon="verified" data-weight="fill" style="font-variation-settings: 'FILL' 1;">verified</span>
                                                ZERO-KNOWLEDGE
                                            </span>
</td>
<td class="px-8 py-6 text-on-surface-variant text-sm">Oct 29, 2024</td>
<td class="px-8 py-6 text-right">
<button class="text-primary hover:text-secondary p-2 transition-colors">
<span class="material-symbols-outlined" data-icon="more_horiz">more_horiz</span>
</button>
</td>
</tr>
<tr class="hover:bg-surface-container transition-colors group">
<td class="px-8 py-6">
<div class="flex items-center gap-4">
<span class="material-symbols-outlined text-secondary" data-icon="currency_bitcoin">currency_bitcoin</span>
<span class="font-bold text-primary">Crypto Wallet Recovery Seed</span>
</div>
</td>
<td class="px-8 py-6">
<span class="flex items-center gap-2 text-xs font-bold text-on-tertiary-fixed-variant bg-tertiary-fixed px-3 py-1 rounded-full w-fit">
<span class="material-symbols-outlined text-[14px]" data-icon="verified" data-weight="fill" style="font-variation-settings: 'FILL' 1;">verified</span>
                                                ZERO-KNOWLEDGE
                                            </span>
</td>
<td class="px-8 py-6 text-on-surface-variant text-sm">Nov 15, 2024</td>
<td class="px-8 py-6 text-right">
<button class="text-primary hover:text-secondary p-2 transition-colors">
<span class="material-symbols-outlined" data-icon="more_horiz">more_horiz</span>
</button>
</td>
</tr>
</tbody>
</table>
</div>
</section>
<!-- Conditional Messages & Digital Assets -->
<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
<section class="space-y-6">
<h2 class="text-2xl font-headline font-bold flex items-center gap-3">
<span class="w-2 h-8 bg-error rounded-full"></span>
                                Conditional Messages
                            </h2>
<div class="space-y-4">
<div class="bg-white p-6 rounded-full shadow-sm hover:shadow-md transition-shadow border border-outline-variant/10">
<div class="flex justify-between items-center mb-3">
<span class="text-xs font-bold text-error bg-error-container px-3 py-1 rounded-full">DEAD MAN'S SWITCH</span>
<span class="material-symbols-outlined text-on-surface-variant" data-icon="mail">mail</span>
</div>
<h4 class="font-bold text-primary">Message to Heirs: Allocation Strategy</h4>
<p class="text-sm text-on-surface-variant mt-2 line-clamp-2">This message will be released after 3 failed weekly check-ins. It contains the logic for asset distribution...</p>
</div>
</div>
</section>
<section class="space-y-6">
<h2 class="text-2xl font-headline font-bold flex items-center gap-3">
<span class="w-2 h-8 bg-tertiary rounded-full"></span>
                                Digital Assets
                            </h2>
<div class="grid grid-cols-1 gap-4">
<div class="bg-surface-container-highest p-6 rounded-full flex items-center justify-between group cursor-pointer hover:bg-surface-dim transition-colors">
<div class="flex items-center gap-4">
<div class="bg-white p-3 rounded-xl">
<span class="material-symbols-outlined text-primary" data-icon="cloud">cloud</span>
</div>
<div>
<h4 class="font-bold text-primary">Cloud Photo Archive Passkeys</h4>
<p class="text-xs text-on-surface-variant uppercase tracking-widest">Shared with 2 Contacts</p>
</div>
</div>
<span class="material-symbols-outlined text-on-surface-variant" data-icon="chevron_right">chevron_right</span>
</div>
</div>
</section>
</div>
</div>
</div>
</main>
</div>
<!-- Footer -->
<footer class="bg-[#001a20] dark:bg-[#000000] w-full py-12 px-8 mt-auto flex flex-col md:flex-row justify-between items-center border-t border-white/5 tonal-shift top-layer">
<div class="text-slate-400 font-inter text-xs uppercase tracking-widest">
            © 2024 Keeplas Life Continuity. Encrypted &amp; Secured.
        </div>
<div class="flex space-x-8 mt-6 md:mt-0">
<a class="text-slate-500 hover:text-[#28657a] transition-colors font-inter text-xs uppercase tracking-widest" href="#">Privacy Vault</a>
<a class="text-slate-500 hover:text-[#28657a] transition-colors font-inter text-xs uppercase tracking-widest" href="#">Security Protocol</a>
<a class="text-slate-500 hover:text-[#28657a] transition-colors font-inter text-xs uppercase tracking-widest" href="#">Terms of Legacy</a>
<a class="text-slate-500 hover:text-[#28657a] transition-colors font-inter text-xs uppercase tracking-widest" href="#">Contact Concierge</a>
</div>
</footer>
</body></html>

<!-- Subscription & Plans -->
<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Keeplas | Subscription &amp; Plans</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@200;300;400;500;600;700;800&amp;family=Inter:wght@300;400;500;600&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              "surface-container-highest": "#e5e2e1",
              "primary-container": "#1b2b48",
              "on-primary-fixed-variant": "#374765",
              "on-surface-variant": "#44474d",
              "on-background": "#1b1c1c",
              "secondary-fixed": "#b9eaff",
              "on-tertiary-fixed": "#001f26",
              "on-surface": "#1b1c1c",
              "outline": "#75777e",
              "secondary": "#28657a",
              "primary-fixed-dim": "#b7c7eb",
              "on-tertiary-fixed-variant": "#004e5d",
              "secondary-fixed-dim": "#95cfe7",
              "tertiary-fixed-dim": "#8fd0e4",
              "surface-bright": "#fcf9f8",
              "background": "#fcf9f8",
              "surface-container-low": "#f6f3f2",
              "on-secondary-fixed-variant": "#004d61",
              "on-secondary-container": "#2b687d",
              "inverse-on-surface": "#f3f0ef",
              "surface": "#fcf9f8",
              "on-primary-fixed": "#091b37",
              "tertiary": "#001a20",
              "error-container": "#ffdad6",
              "tertiary-fixed": "#aeecff",
              "tertiary-container": "#00303a",
              "surface-container-high": "#eae7e7",
              "on-tertiary-container": "#5a9cae",
              "surface-container-lowest": "#ffffff",
              "on-secondary-fixed": "#001f29",
              "on-secondary": "#ffffff",
              "inverse-surface": "#303030",
              "surface-tint": "#4f5e7e",
              "primary-fixed": "#d7e2ff",
              "on-primary-container": "#8393b5",
              "on-error-container": "#93000a",
              "on-error": "#ffffff",
              "surface-dim": "#dcd9d9",
              "surface-container": "#f0eded",
              "on-tertiary": "#ffffff",
              "inverse-primary": "#b7c7eb",
              "surface-variant": "#e5e2e1",
              "outline-variant": "#c5c6ce",
              "on-primary": "#ffffff",
              "primary": "#041632",
              "error": "#ba1a1a",
              "secondary-container": "#abe5fe"
            },
            fontFamily: {
              "headline": ["Manrope"],
              "body": ["Inter"],
              "label": ["Inter"]
            },
            borderRadius: {"DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem"},
          },
        },
      }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .glass-nav {
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
        }
        .primary-gradient {
            background: linear-gradient(135deg, #041632 0%, #1b2b48 100%);
        }
    </style>
</head>
<body class="bg-surface text-on-surface font-body selection:bg-secondary-container">
<!-- TopNavBar -->
<nav class="fixed top-0 w-full flex justify-between items-center px-8 py-4 max-w-full mx-auto bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-xl z-50 shadow-sm dark:shadow-none">
<div class="text-2xl font-bold tracking-tighter text-slate-900 dark:text-slate-50 font-manrope">
            Keeplas
        </div>
<div class="hidden md:flex items-center space-x-8 font-manrope tracking-tight font-semibold">
<a class="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors" href="#">Vault</a>
<a class="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors" href="#">Life Check</a>
<a class="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors" href="#">Emergency Card</a>
<a class="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors" href="#">Trusted Contacts</a>
</div>
<div class="flex items-center space-x-4">
<button class="p-2 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-lg transition-all active:scale-95">
<span class="material-symbols-outlined text-slate-900 dark:text-slate-50">notifications</span>
</button>
<button class="p-2 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-lg transition-all active:scale-95">
<span class="material-symbols-outlined text-slate-900 dark:text-slate-50">settings</span>
</button>
<div class="h-10 w-10 rounded-full bg-surface-container-high flex items-center justify-center overflow-hidden border border-outline-variant/20">
<img alt="User profile avatar" class="w-full h-full object-cover" data-alt="professional portrait of a person against a clean studio background with soft natural lighting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBugwPLrlFmKphDywyMpLaVnExyppAl6c9ZHooVumjvJaTMiuNqGVH1CvW-WQ4wJGG22HoUxyHpVfpZw_3pUOJiZ4RlzZHQrxoLowz7xGgik4hvvLplnC8SgNswim56ife3m63P05ucvY_7GTyyEduxis7wPJp0iEK8oBMYHZd2hjEL8bASEhmO7Vqy2O4h1UcenvnxnOzqpl1U9HSqlroIgiJ-Zr2Nl4kFP9FSV_0QBctekC4ZrNPzo9lHT8_NU_L4wQDoDPHWJlCY"/>
</div>
</div>
</nav>
<main class="pt-32 pb-24 px-6 md:px-12 lg:px-24">
<!-- Hero Section -->
<section class="max-w-5xl mx-auto mb-20 text-center md:text-left flex flex-col md:flex-row md:items-end gap-8">
<div class="flex-1">
<h1 class="font-headline text-5xl md:text-7xl font-extrabold tracking-tighter text-primary leading-[0.9] mb-6">
                    Legacy Architecture. <br/>
<span class="text-secondary">Secured Forever.</span>
</h1>
<p class="font-body text-xl text-on-surface-variant max-w-xl leading-relaxed">
                    Choose the level of protection that fits your life continuity needs. From personal digital vaults to comprehensive family estates.
                </p>
</div>
<div class="flex flex-col items-center md:items-end gap-2">
<span class="font-label text-xs uppercase tracking-widest font-bold text-secondary">Integrity Matters</span>
<div class="flex -space-x-3">
<img class="w-10 h-10 rounded-full border-2 border-surface object-cover" data-alt="close-up of a diverse person smiling softly" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDdgUEAmGlWyIQAYe2RNbMJYFS5B5TaFQZQuirFl5MuqtW1at6srAqYtkvAM2k_T7AbWcbcx54buiM9xCiF581YxngoBEQOkdBpLC5jisJQLQfvZRu5_jRPe86bOLOKYY9EL_xnSTKCwhGBZxLGQhMQ-I9qTOWXX-HcdiSYUEXEqknjvESttxQ0L04pZ0_olwY1-mdaGFjibxky5jTWQ2a-6hfxIRJbeAQ2fFZlAU5v9rqOvIw5z-M2d7K-inf2vsRGWlHhV6ZjfIsx"/>
<img class="w-10 h-10 rounded-full border-2 border-surface object-cover" data-alt="minimalist portrait of a man with spectacles in professional attire" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAZ3tfjx-6RBnutkXfxyLJfmCG3RnIm0g_8cRI5CvrQ3jM1JkDeFoDepG-5Jtft09ZWyNwGvacLuILU73ZWEvV1DRtYtc_whBy570O_WRscDV01QgZjuXTsTsTPJQtpzMSA0ts__-VPHqzFcVyLsmdKAsQIabHzfDduqOLdmf6fezTsmjO07MWbZO845IfFTTTgG7gR3IbowksGUTOO2WooZ8hX_l_baxC8YaN0fC90p1aK4a4qQQo2FJ3cHfQSd8qFQsK69vE_0D2a"/>
<img class="w-10 h-10 rounded-full border-2 border-surface object-cover" data-alt="smiling woman with long hair in warm golden hour lighting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCDa1_cFkybIGGKJ3wFzzw50y6du4eLFbXDtgNmJoFISWmBAkfSFrdH0gFfsOTmXDfXj-k3lED_fkKxh2Br6t4D4Hgx3w3t2Sq7zD0i_EQN5tcwlobcX3xVXtp0MU0hiyLL0euHc_02RJhzsTeqjj8AU_NZCUrLbU12Wqh4knmhaWEro7BVO7V3hVR9ZntILfpW5uAH8NPP10R9QlYUDzVmsy7eZYAxtIEw3StOpLQHjX5S5Hofsyz57teo7_j2Dbp3s2FlVXJLGBXX"/>
<div class="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-[10px] font-bold text-on-secondary-container border-2 border-surface">12k+</div>
</div>
</div>
</section>
<!-- Pricing Cards - Bento Grid Style -->
<div class="grid grid-cols-1 md:grid-cols-12 gap-6 max-w-7xl mx-auto mb-32">
<!-- Free Plan -->
<div class="md:col-span-4 bg-surface-container-low p-8 rounded-xl flex flex-col justify-between transition-transform hover:scale-[1.02] duration-300">
<div>
<div class="flex justify-between items-start mb-12">
<div>
<h3 class="font-headline text-2xl font-bold text-primary">Free</h3>
<p class="text-on-surface-variant text-sm">Essential Protection</p>
</div>
<span class="material-symbols-outlined text-outline">lock_open</span>
</div>
<div class="mb-12">
<span class="text-4xl font-headline font-black text-primary">$0</span>
<span class="text-on-surface-variant">/forever</span>
</div>
<ul class="space-y-4 mb-12">
<li class="flex items-center gap-3 text-sm">
<span class="material-symbols-outlined text-secondary text-lg">check_circle</span>
<span>1GB Encrypted Storage</span>
</li>
<li class="flex items-center gap-3 text-sm">
<span class="material-symbols-outlined text-secondary text-lg">check_circle</span>
<span>Basic Digital Vault</span>
</li>
<li class="flex items-center gap-3 text-sm">
<span class="material-symbols-outlined text-secondary text-lg">check_circle</span>
<span>Life Check (Monthly)</span>
</li>
</ul>
</div>
<button class="w-full py-4 text-sm font-bold tracking-tight text-primary bg-surface-container-high hover:bg-surface-container-highest transition-colors rounded-xl">
                    Get Started
                </button>
</div>
<!-- Pro Plan (Featured) -->
<div class="md:col-span-4 primary-gradient p-1 bg-primary-container rounded-xl shadow-2xl transition-transform hover:scale-[1.03] duration-300">
<div class="bg-primary h-full w-full rounded-[0.45rem] p-8 flex flex-col justify-between relative overflow-hidden">
<div class="absolute top-0 right-0 p-4">
<div class="bg-secondary-fixed text-on-secondary-fixed text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">Most Trusted</div>
</div>
<div>
<div class="flex justify-between items-start mb-12">
<div>
<h3 class="font-headline text-2xl font-bold text-on-primary">Pro</h3>
<p class="text-on-primary-container text-sm">Comprehensive Legacy</p>
</div>
<span class="material-symbols-outlined text-secondary-fixed">verified_user</span>
</div>
<div class="mb-12">
<span class="text-4xl font-headline font-black text-on-primary">$4.99</span>
<span class="text-on-primary-container">/month</span>
</div>
<ul class="space-y-4 mb-12">
<li class="flex items-center gap-3 text-sm text-surface-bright">
<span class="material-symbols-outlined text-secondary-fixed text-lg">verified</span>
<span>Unlimited Encrypted Storage</span>
</li>
<li class="flex items-center gap-3 text-sm text-surface-bright">
<span class="material-symbols-outlined text-secondary-fixed text-lg">verified</span>
<span>Advanced Legal Directives</span>
</li>
<li class="flex items-center gap-3 text-sm text-surface-bright">
<span class="material-symbols-outlined text-secondary-fixed text-lg">verified</span>
<span>Priority Emergency Response</span>
</li>
<li class="flex items-center gap-3 text-sm text-surface-bright">
<span class="material-symbols-outlined text-secondary-fixed text-lg">verified</span>
<span>24/7 Security Center Access</span>
</li>
</ul>
</div>
<button class="w-full py-4 text-sm font-bold tracking-tight text-primary bg-secondary-fixed hover:bg-secondary-fixed-dim transition-all rounded-xl shadow-lg shadow-black/20">
                        Secure Pro Access
                    </button>
</div>
</div>
<!-- Family Plan -->
<div class="md:col-span-4 bg-surface-container-low p-8 rounded-xl flex flex-col justify-between transition-transform hover:scale-[1.02] duration-300">
<div>
<div class="flex justify-between items-start mb-12">
<div>
<h3 class="font-headline text-2xl font-bold text-primary">Family</h3>
<p class="text-on-surface-variant text-sm">Protect the Household</p>
</div>
<span class="material-symbols-outlined text-outline">group</span>
</div>
<div class="mb-12">
<span class="text-4xl font-headline font-black text-primary">$9.99</span>
<span class="text-on-surface-variant">/month</span>
</div>
<ul class="space-y-4 mb-12">
<li class="flex items-center gap-3 text-sm">
<span class="material-symbols-outlined text-secondary text-lg">check_circle</span>
<span>Up to 5 Individual Accounts</span>
</li>
<li class="flex items-center gap-3 text-sm">
<span class="material-symbols-outlined text-secondary text-lg">check_circle</span>
<span>Shared Family Vault Access</span>
</li>
<li class="flex items-center gap-3 text-sm">
<span class="material-symbols-outlined text-secondary text-lg">check_circle</span>
<span>Inter-generational Continuity</span>
</li>
</ul>
</div>
<button class="w-full py-4 text-sm font-bold tracking-tight text-primary bg-surface-container-high hover:bg-surface-container-highest transition-colors rounded-xl">
                    Protect My Family
                </button>
</div>
</div>
<!-- Lifetime Option (Legacy Card) -->
<section class="max-w-7xl mx-auto mb-32">
<div class="bg-primary-container rounded-2xl p-12 relative overflow-hidden flex flex-col md:flex-row items-center gap-12">
<div class="absolute inset-0 opacity-10 pointer-events-none">
<img class="w-full h-full object-cover" data-alt="abstract cosmic light patterns with deep blue and white sparks suggesting advanced technology and eternity" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBxH4lzX8jJHCj0Mby0gtLxB-d_2E7LJiWuqPozuYEP3StwL9uXD9Mw9mf5So5ciwv0_gNFXUwocy58K2PPk7j3_WpboazBvCQRsCYlMbTD3X_MbzP6WHY7BzMD1ILVjdZ26BuhKYt9YGwGZb9CF89IDUoGphUwEJvuoEY36Fcz15ni8uDVmfj4T0IobBWy_FpJ5mPAkbuM2mIR-hSElzIUYK-crb19YEcKRzTRIbaI01XvkchqsgmNLi_vfPnabDftUi5pgpxQ5yCJ"/>
</div>
<div class="relative z-10 flex-1 text-center md:text-left">
<div class="inline-flex items-center gap-2 bg-secondary/20 px-4 py-2 rounded-full mb-6">
<span class="material-symbols-outlined text-secondary-fixed text-sm" style="font-variation-settings: 'FILL' 1;">star</span>
<span class="text-secondary-fixed text-xs font-bold uppercase tracking-widest">Ultimate Assurance</span>
</div>
<h2 class="font-headline text-4xl font-extrabold text-surface-bright mb-4 tracking-tighter">The Lifetime Legacy</h2>
<p class="text-on-primary-container text-lg max-w-lg mb-8 leading-relaxed">
                        Eliminate recurring costs forever. Secure your life continuity with a one-time contribution that guarantees your vault's existence for the next century and beyond.
                    </p>
<div class="flex flex-wrap gap-4 justify-center md:justify-start">
<div class="flex items-center gap-3 text-on-primary-container">
<span class="material-symbols-outlined text-secondary-fixed">auto_awesome</span>
<span class="text-sm">Never expires</span>
</div>
<div class="flex items-center gap-3 text-on-primary-container">
<span class="material-symbols-outlined text-secondary-fixed">shield</span>
<span class="text-sm">Legacy inheritance</span>
</div>
</div>
</div>
<div class="relative z-10 text-center bg-primary p-10 rounded-2xl shadow-xl border border-on-primary-fixed-variant/30">
<p class="text-on-primary-container text-xs font-bold uppercase tracking-widest mb-2">One-time payment</p>
<div class="text-6xl font-headline font-black text-on-primary mb-8">$499</div>
<button class="px-10 py-4 primary-gradient text-on-primary font-bold rounded-xl transition-all hover:shadow-lg hover:shadow-black/40 active:scale-95">
                        Secure Forever
                    </button>
</div>
</div>
</section>
<!-- Comparison Table -->
<section class="max-w-5xl mx-auto">
<h2 class="font-headline text-3xl font-bold text-primary mb-12 text-center">Feature Breakdown</h2>
<div class="overflow-hidden bg-surface rounded-2xl">
<div class="grid grid-cols-4 border-b border-outline-variant/10 py-6 px-6 font-bold text-primary uppercase tracking-widest text-[10px]">
<div class="col-span-1">Security Feature</div>
<div class="text-center">Free</div>
<div class="text-center text-secondary">Pro</div>
<div class="text-center">Family</div>
</div>
<!-- Rows -->
<div class="grid grid-cols-4 bg-surface-container-low/50 py-6 px-6 text-sm border-b border-outline-variant/5">
<div class="col-span-1 font-semibold">AES-256 Encryption</div>
<div class="text-center"><span class="material-symbols-outlined text-secondary">check</span></div>
<div class="text-center"><span class="material-symbols-outlined text-secondary">check</span></div>
<div class="text-center"><span class="material-symbols-outlined text-secondary">check</span></div>
</div>
<div class="grid grid-cols-4 py-6 px-6 text-sm border-b border-outline-variant/5">
<div class="col-span-1 font-semibold">Storage Capacity</div>
<div class="text-center text-on-surface-variant">1GB</div>
<div class="text-center text-primary font-bold">Unlimited</div>
<div class="text-center text-primary font-bold">Unlimited</div>
</div>
<div class="grid grid-cols-4 bg-surface-container-low/50 py-6 px-6 text-sm border-b border-outline-variant/5">
<div class="col-span-1 font-semibold">Trusted Contacts</div>
<div class="text-center text-on-surface-variant">2</div>
<div class="text-center text-primary font-bold">Unlimited</div>
<div class="text-center text-primary font-bold">Unlimited</div>
</div>
<div class="grid grid-cols-4 py-6 px-6 text-sm border-b border-outline-variant/5">
<div class="col-span-1 font-semibold">Legacy Directives</div>
<div class="text-center text-on-surface-variant">—</div>
<div class="text-center"><span class="material-symbols-outlined text-secondary">check</span></div>
<div class="text-center"><span class="material-symbols-outlined text-secondary">check</span></div>
</div>
<div class="grid grid-cols-4 bg-surface-container-low/50 py-6 px-6 text-sm border-b border-outline-variant/5">
<div class="col-span-1 font-semibold">Biometric Recovery</div>
<div class="text-center text-on-surface-variant">—</div>
<div class="text-center"><span class="material-symbols-outlined text-secondary">check</span></div>
<div class="text-center"><span class="material-symbols-outlined text-secondary">check</span></div>
</div>
</div>
</section>
</main>
<!-- Footer -->
<footer class="w-full py-12 px-8 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
<div class="flex flex-col md:flex-row justify-between items-center max-w-7xl mx-auto gap-8">
<div class="flex flex-col items-center md:items-start">
<div class="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2 font-manrope">Keeplas</div>
<p class="font-inter text-sm leading-relaxed text-slate-500 dark:text-slate-400">© 2024 Keeplas Life Continuity. All rights reserved.</p>
</div>
<div class="flex flex-wrap justify-center gap-8 font-inter text-sm leading-relaxed">
<a class="text-slate-500 dark:text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500" href="#">Privacy Policy</a>
<a class="text-slate-500 dark:text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500" href="#">Terms of Service</a>
<a class="text-slate-500 dark:text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500" href="#">Security Whitepaper</a>
<a class="text-slate-500 dark:text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500" href="#">GDPR Compliance</a>
</div>
</div>
</footer>
</body></html>

<!-- Conditional Messages -->
<!DOCTYPE html>

<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&amp;family=Inter:wght@400;500;600&amp;family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              "surface-container-highest": "#e5e2e1",
              "primary-container": "#1b2b48",
              "on-primary-fixed-variant": "#374765",
              "on-surface-variant": "#44474d",
              "on-background": "#1b1c1c",
              "secondary-fixed": "#b9eaff",
              "on-tertiary-fixed": "#001f26",
              "on-surface": "#1b1c1c",
              "outline": "#75777e",
              "secondary": "#28657a",
              "primary-fixed-dim": "#b7c7eb",
              "on-tertiary-fixed-variant": "#004e5d",
              "secondary-fixed-dim": "#95cfe7",
              "tertiary-fixed-dim": "#8fd0e4",
              "surface-bright": "#fcf9f8",
              "background": "#fcf9f8",
              "surface-container-low": "#f6f3f2",
              "on-secondary-fixed-variant": "#004d61",
              "on-secondary-container": "#2b687d",
              "inverse-on-surface": "#f3f0ef",
              "surface": "#fcf9f8",
              "on-primary-fixed": "#091b37",
              "tertiary": "#001a20",
              "error-container": "#ffdad6",
              "tertiary-fixed": "#aeecff",
              "tertiary-container": "#00303a",
              "surface-container-high": "#eae7e7",
              "on-tertiary-container": "#5a9cae",
              "surface-container-lowest": "#ffffff",
              "on-secondary-fixed": "#001f29",
              "on-secondary": "#ffffff",
              "inverse-surface": "#303030",
              "surface-tint": "#4f5e7e",
              "primary-fixed": "#d7e2ff",
              "on-primary-container": "#8393b5",
              "on-error-container": "#93000a",
              "on-error": "#ffffff",
              "surface-dim": "#dcd9d9",
              "surface-container": "#f0eded",
              "on-tertiary": "#ffffff",
              "inverse-primary": "#b7c7eb",
              "surface-variant": "#e5e2e1",
              "outline-variant": "#c5c6ce",
              "on-primary": "#ffffff",
              "primary": "#041632",
              "error": "#ba1a1a",
              "secondary-container": "#abe5fe"
            },
            fontFamily: {
              "headline": ["Manrope"],
              "body": ["Inter"],
              "label": ["Inter"]
            },
            borderRadius: {"DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem"},
          },
        },
      }
    </script>
<style>
      .material-symbols-outlined {
        font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
      }
      .glass-effect {
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
      }
    </style>
</head>
<body class="bg-surface text-on-surface font-body selection:bg-secondary-fixed">
<!-- Top Navigation -->
<nav class="fixed top-0 w-full flex justify-between items-center px-8 py-4 max-w-full mx-auto bg-slate-50/80 backdrop-blur-xl z-50 shadow-sm font-manrope tracking-tight font-semibold">
<div class="text-2xl font-bold tracking-tighter text-slate-900">Keeplas</div>
<div class="hidden md:flex items-center gap-8">
<a class="text-slate-600 hover:text-slate-900 transition-colors" href="#">Vault</a>
<a class="text-cyan-700 font-bold border-b-2 border-cyan-700 pb-1" href="#">Life Check</a>
<a class="text-slate-600 hover:text-slate-900 transition-colors" href="#">Emergency Card</a>
<a class="text-slate-600 hover:text-slate-900 transition-colors" href="#">Trusted Contacts</a>
</div>
<div class="flex items-center gap-4">
<button class="p-2 hover:bg-slate-200/50 rounded-lg transition-all active:scale-95">
<span class="material-symbols-outlined text-slate-900">notifications</span>
</button>
<button class="p-2 hover:bg-slate-200/50 rounded-lg transition-all active:scale-95">
<span class="material-symbols-outlined text-slate-900">settings</span>
</button>
<img alt="User profile avatar" class="w-10 h-10 rounded-full border border-outline-variant/30" data-alt="Close up portrait of a professional man in a dark suit with a calm expression, soft studio lighting, neutral background" src="https://lh3.googleusercontent.com/aida-public/AB6AXuArNWuC_g6aiMzrRfaupWHVrUuUijq93opMPLdx0G8T7wN1vROKarZi6TEUeMdEgv5yItjn_PTva_ZeZLhY2QNThHgDMD9DRW3o_u0RJZeE442vjc2DgUPgKTD0g0QrB7HLUO7_m-ANsxau82iwmWWWo9CUCq0d2Qa9sSqRDkW4aX2mHXjT9ko7yu524I68B7ZEtRQ7FcFwNNF234-DHNs-GfV7uy7IF_N9gOOEiZNXKKfy-jui9AeDKCRA2xMF8yEJTCkXmVgF-ORO"/>
</div>
</nav>
<div class="flex min-h-screen pt-20">
<!-- Sidebar Navigation -->
<aside class="h-screen w-64 fixed left-0 top-0 pt-24 bg-slate-100 flex flex-col py-8 border-r border-transparent z-40">
<div class="px-8 mb-8">
<div class="text-xl font-black text-slate-900 font-headline uppercase tracking-widest text-xs">Keeplas</div>
<div class="text-slate-500 text-[10px] font-bold tracking-widest mt-1">THE ARCHITECTURAL VAULT</div>
</div>
<nav class="flex-1 space-y-1 pr-4">
<a class="flex items-center gap-3 px-8 py-3 text-slate-500 font-manrope uppercase tracking-widest text-xs font-bold hover:translate-x-1 transition-transform" href="#">
<span class="material-symbols-outlined">dashboard</span>
                    Dashboard
                </a>
<a class="flex items-center gap-3 px-8 py-3 text-slate-500 font-manrope uppercase tracking-widest text-xs font-bold hover:translate-x-1 transition-transform" href="#">
<span class="material-symbols-outlined">lock</span>
                    Digital Vault
                </a>
<a class="flex items-center gap-3 px-8 py-3 bg-white text-cyan-700 shadow-sm rounded-r-full font-manrope uppercase tracking-widest text-xs font-bold" href="#">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">medical_services</span>
                    Health Directives
                </a>
<a class="flex items-center gap-3 px-8 py-3 text-slate-500 font-manrope uppercase tracking-widest text-xs font-bold hover:translate-x-1 transition-transform" href="#">
<span class="material-symbols-outlined">gavel</span>
                    Legal Legacy
                </a>
<a class="flex items-center gap-3 px-8 py-3 text-slate-500 font-manrope uppercase tracking-widest text-xs font-bold hover:translate-x-1 transition-transform" href="#">
<span class="material-symbols-outlined">verified_user</span>
                    Security Center
                </a>
</nav>
<div class="px-6 mt-auto">
<button class="w-full bg-primary text-white py-4 rounded-xl font-bold text-xs tracking-widest uppercase flex items-center justify-center gap-2 hover:opacity-90 transition-all">
<span class="material-symbols-outlined text-sm">add</span>
                    Secure New Asset
                </button>
</div>
<div class="mt-8 px-8 space-y-4">
<a class="flex items-center gap-3 text-slate-500 text-xs font-bold uppercase tracking-widest hover:text-slate-900" href="#">
<span class="material-symbols-outlined text-sm">help</span>
                    Support
                </a>
<a class="flex items-center gap-3 text-slate-500 text-xs font-bold uppercase tracking-widest hover:text-slate-900" href="#">
<span class="material-symbols-outlined text-sm">logout</span>
                    Sign Out
                </a>
</div>
</aside>
<!-- Main Content Canvas -->
<main class="ml-64 flex-1 bg-surface-bright min-h-screen p-12">
<!-- Header Section -->
<header class="flex flex-col md:flex-row justify-between items-end gap-6 mb-16">
<div class="max-w-2xl">
<span class="text-secondary font-bold tracking-widest text-xs uppercase mb-3 block">Life Continuity Systems</span>
<h1 class="font-headline text-5xl font-extrabold tracking-tighter text-primary leading-none mb-6">Conditional Messages</h1>
<p class="text-body text-lg text-on-surface-variant leading-relaxed">
                        A sanctuary for words intended for the future. These messages remain encrypted and sealed until specific life events trigger their release.
                    </p>
</div>
<!-- Dead Man Switch Status -->
<div class="bg-primary-container p-8 rounded-xl text-on-primary-container min-w-[320px] shadow-sm relative overflow-hidden">
<div class="relative z-10">
<div class="flex items-center gap-2 mb-4">
<span class="material-symbols-outlined text-secondary-fixed">vibration</span>
<span class="font-bold text-xs uppercase tracking-widest">Dead Man Switch Status</span>
</div>
<div class="flex items-center justify-between mb-2">
<span class="text-white text-2xl font-bold font-headline">Active</span>
<span class="bg-secondary/20 text-secondary-fixed px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">Monitoring</span>
</div>
<p class="text-xs opacity-80 mb-6">Last heartbeat detected: 4 hours ago via Mobile App</p>
<button class="w-full bg-white/10 hover:bg-white/20 py-2 rounded-lg text-xs font-bold transition-colors">Configure Trigger Logic</button>
</div>
<div class="absolute -right-4 -bottom-4 opacity-5">
<span class="material-symbols-outlined text-9xl">lock_clock</span>
</div>
</div>
</header>
<!-- Bento Grid of Messages -->
<section class="grid grid-cols-1 md:grid-cols-12 gap-8">
<!-- Action Card -->
<div class="md:col-span-4 bg-surface-container-low p-8 rounded-xl flex flex-col justify-between group cursor-pointer hover:bg-surface-container-high transition-colors">
<div>
<div class="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
<span class="material-symbols-outlined text-secondary">edit_note</span>
</div>
<h3 class="font-headline text-2xl font-bold text-primary mb-2">Draft a New Legacy</h3>
<p class="text-on-surface-variant text-sm leading-relaxed">Prepare a message for business partners, children, or spouse to be opened only when needed.</p>
</div>
<div class="mt-8 flex items-center gap-2 text-secondary font-bold text-sm">
                        Create Message <span class="material-symbols-outlined">arrow_forward</span>
</div>
</div>
<!-- Featured Message Card -->
<div class="md:col-span-8 bg-surface-container p-8 rounded-xl shadow-sm border border-outline-variant/10">
<div class="flex justify-between items-start mb-8">
<div>
<span class="bg-secondary-fixed text-on-secondary-fixed px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4 inline-block">Primary Active</span>
<h2 class="font-headline text-3xl font-bold text-primary">"Open if... Accidental Death"</h2>
</div>
<div class="flex gap-2">
<button class="p-2 hover:bg-surface-container-high rounded-lg transition-colors"><span class="material-symbols-outlined">visibility</span></button>
<button class="p-2 hover:bg-surface-container-high rounded-lg transition-colors"><span class="material-symbols-outlined">more_vert</span></button>
</div>
</div>
<div class="grid grid-cols-1 md:grid-cols-3 gap-12 border-t border-outline-variant/20 pt-8">
<div>
<span class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Recipients</span>
<div class="flex -space-x-2">
<img class="w-8 h-8 rounded-full border-2 border-surface" data-alt="Close up of a smiling woman with glasses and dark hair, soft natural lighting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAi3jaYaLbigHVB_BBNz42OtKay0Yoqlic700as2z881ErGO4xwpsnssr5DlTYQn-eeWQbgwueSwaX-SJLRUu70WHJn2FZY6l1LpdcuGLrbElaVsDLqt6qGA1iPbFOCwllocabzGnnNjlxnq991AG93nb5Yfsykxhp9iYApH7OPMpYYXKPxD46Pq1UahUpm55jzHYWnnCVmA6iQWRPEQE5Y0oVfrQpX6cPFDHGGWRIWr7g6xVZsLO-oFEqYRMPymbpeJcSMFYYCGYGw"/>
<img class="w-8 h-8 rounded-full border-2 border-surface" data-alt="Close up of a middle aged man with a beard and friendly expression, warm outdoor lighting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA4QH7jloEzc-hM3byNIc1kaK-cZfPydfqBY-kMesezL0UWII_loxMVRaWOXU8KABTPzCmFSWEWSiSGfnx5XqAbgTl-c1zNOtsjPtPOmf1eURc1raOJJrkpSD0aW7JMMR85HYqsHagzUt2Y8cmn33lICB90X7gKeYdE3ViZgI5drLun4Xd4qieIlqebJxtkQss5p_NnvAflPMZ_hRvxlZMqYFPR-hGtBUGZIDXRRHCS6dsLlQSNdkVQLIP8xCtF7okB0TLGhqaKxR43"/>
<div class="w-8 h-8 rounded-full bg-surface-container-highest border-2 border-surface flex items-center justify-center text-[10px] font-bold">+2</div>
</div>
</div>
<div>
<span class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Trigger Protocol</span>
<div class="flex items-center gap-2 text-sm font-semibold text-primary">
<span class="material-symbols-outlined text-xs">gavel</span>
                                Verified Legal Event
                            </div>
</div>
<div>
<span class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Encryption</span>
<div class="flex items-center gap-2 text-sm font-semibold text-secondary">
<span class="material-symbols-outlined text-xs">verified</span>
                                Zero-Knowledge Seal
                            </div>
</div>
</div>
</div>
<!-- Secondary Grid Items -->
<div class="md:col-span-6 bg-surface-container-low p-8 rounded-xl border border-outline-variant/10">
<div class="flex justify-between mb-6">
<span class="text-outline text-[10px] font-black uppercase tracking-[0.2em]">Draft Status</span>
<span class="material-symbols-outlined text-outline">history_edu</span>
</div>
<h3 class="font-headline text-xl font-bold text-primary mb-2">Instructions for Business Partners</h3>
<p class="text-on-surface-variant text-sm mb-6">Technical handoff and equity distribution guidelines in the event of incapacity.</p>
<div class="flex items-center justify-between pt-6 border-t border-outline-variant/10">
<span class="text-xs text-on-surface-variant">Last edited: Oct 12, 2024</span>
<button class="text-secondary text-sm font-bold flex items-center gap-1">Resume <span class="material-symbols-outlined text-xs">chevron_right</span></button>
</div>
</div>
<div class="md:col-span-6 bg-surface-container-low p-8 rounded-xl border border-outline-variant/10">
<div class="flex justify-between mb-6">
<span class="text-secondary font-black uppercase tracking-[0.2em] text-[10px]">Active</span>
<span class="material-symbols-outlined text-secondary">family_history</span>
</div>
<h3 class="font-headline text-xl font-bold text-primary mb-2">Letter to my children (Open if age 21)</h3>
<p class="text-on-surface-variant text-sm mb-6">Encapsulated wisdom and personal history for the next generation.</p>
<div class="flex items-center justify-between pt-6 border-t border-outline-variant/10">
<span class="text-xs text-on-surface-variant">Release trigger: Time-based</span>
<button class="text-secondary text-sm font-bold flex items-center gap-1">Manage <span class="material-symbols-outlined text-xs">chevron_right</span></button>
</div>
</div>
<!-- Asymmetric Focus Area -->
<div class="md:col-span-12 mt-8 grid grid-cols-1 md:grid-cols-2 gap-12 bg-primary py-16 px-12 rounded-[2rem] text-white">
<div class="space-y-6">
<h2 class="font-headline text-4xl font-extrabold tracking-tight">The "Dead Man Switch" Philosophy</h2>
<p class="text-on-primary-container text-lg leading-relaxed">
                            Our system uses a multi-layered verification protocol. If you fail to respond to check-ins over a predefined period, your designated "Legacy Curators" are contacted to verify your status before any message is unsealed.
                        </p>
<div class="flex gap-4 pt-4">
<button class="bg-secondary-fixed text-on-secondary-fixed px-6 py-3 rounded-xl font-bold text-sm tracking-wide transition-all active:scale-95">Verify Verification Logic</button>
<button class="border border-on-primary-container px-6 py-3 rounded-xl font-bold text-sm tracking-wide hover:bg-white/10 transition-all">Audit My Security</button>
</div>
</div>
<div class="relative">
<div class="absolute inset-0 bg-secondary/20 blur-3xl rounded-full"></div>
<div class="relative z-10 space-y-4">
<div class="bg-white/10 p-6 rounded-2xl backdrop-blur-md border border-white/10">
<div class="flex gap-4 items-start">
<div class="w-10 h-10 rounded-full bg-secondary-fixed/20 flex items-center justify-center flex-shrink-0">
<span class="material-symbols-outlined text-secondary-fixed">security</span>
</div>
<div>
<h4 class="font-bold text-lg">Curator Check-in Protocol</h4>
<p class="text-sm opacity-70">3 contacts required to authorize release</p>
</div>
</div>
</div>
<div class="bg-white/10 p-6 rounded-2xl backdrop-blur-md border border-white/10">
<div class="flex gap-4 items-start">
<div class="w-10 h-10 rounded-full bg-secondary-fixed/20 flex items-center justify-center flex-shrink-0">
<span class="material-symbols-outlined text-secondary-fixed">timer</span>
</div>
<div>
<h4 class="font-bold text-lg">Heartbeat Interval</h4>
<p class="text-sm opacity-70">Currently set to 14 days</p>
</div>
</div>
</div>
</div>
</div>
</div>
</section>
</main>
</div>
<!-- Footer -->
<footer class="bg-slate-50 border-t border-slate-200 py-12 px-8 font-inter text-sm leading-relaxed mt-12">
<div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
<div class="space-y-2 text-center md:text-left">
<div class="text-lg font-bold text-slate-800 tracking-tighter">Keeplas</div>
<p class="text-slate-500">© 2024 Keeplas Life Continuity. All rights reserved.</p>
</div>
<div class="flex flex-wrap justify-center gap-8">
<a class="text-slate-500 hover:text-cyan-700 transition-colors" href="#">Privacy Policy</a>
<a class="text-slate-500 hover:text-cyan-700 transition-colors" href="#">Terms of Service</a>
<a class="text-slate-500 hover:text-cyan-700 transition-colors" href="#">Security Whitepaper</a>
<a class="text-slate-500 hover:text-cyan-700 transition-colors" href="#">GDPR Compliance</a>
</div>
</div>
</footer>
</body></html>

<!-- Recovery Kit Export -->
<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Recovery Kit Export | Keeplas</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@200;400;600;700;800&amp;family=Inter:wght@300;400;500;600&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              "surface-container-highest": "#e5e2e1",
              "primary-container": "#1b2b48",
              "on-primary-fixed-variant": "#374765",
              "on-surface-variant": "#44474d",
              "on-background": "#1b1c1c",
              "secondary-fixed": "#b9eaff",
              "on-tertiary-fixed": "#001f26",
              "on-surface": "#1b1c1c",
              "outline": "#75777e",
              "secondary": "#28657a",
              "primary-fixed-dim": "#b7c7eb",
              "on-tertiary-fixed-variant": "#004e5d",
              "secondary-fixed-dim": "#95cfe7",
              "tertiary-fixed-dim": "#8fd0e4",
              "surface-bright": "#fcf9f8",
              "background": "#fcf9f8",
              "surface-container-low": "#f6f3f2",
              "on-secondary-fixed-variant": "#004d61",
              "on-secondary-container": "#2b687d",
              "inverse-on-surface": "#f3f0ef",
              "surface": "#fcf9f8",
              "on-primary-fixed": "#091b37",
              "tertiary": "#001a20",
              "error-container": "#ffdad6",
              "tertiary-fixed": "#aeecff",
              "tertiary-container": "#00303a",
              "surface-container-high": "#eae7e7",
              "on-tertiary-container": "#5a9cae",
              "surface-container-lowest": "#ffffff",
              "on-secondary-fixed": "#001f29",
              "on-secondary": "#ffffff",
              "inverse-surface": "#303030",
              "surface-tint": "#4f5e7e",
              "primary-fixed": "#d7e2ff",
              "on-primary-container": "#8393b5",
              "on-error-container": "#93000a",
              "on-error": "#ffffff",
              "surface-dim": "#dcd9d9",
              "surface-container": "#f0eded",
              "on-tertiary": "#ffffff",
              "inverse-primary": "#b7c7eb",
              "surface-variant": "#e5e2e1",
              "outline-variant": "#c5c6ce",
              "on-primary": "#ffffff",
              "primary": "#041632",
              "error": "#ba1a1a",
              "secondary-container": "#abe5fe"
            },
            fontFamily: {
              "headline": ["Manrope"],
              "body": ["Inter"],
              "label": ["Inter"]
            },
            borderRadius: {"DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem"},
          },
        },
      }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        @media print {
            .no-print { display: none !important; }
            body { background-color: white !important; }
            .print-container { box-shadow: none !important; margin: 0 !important; width: 100% !important; max-width: none !important; }
        }
        .grain-overlay {
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
            opacity: 0.03;
            pointer-events: none;
        }
    </style>
</head>
<body class="bg-surface-container-low font-body text-on-surface antialiased min-h-screen">
<!-- Header / Nav -->
<header class="fixed top-0 w-full flex justify-between items-center px-8 py-4 max-w-full mx-auto bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-xl text-slate-900 dark:text-slate-50 font-manrope tracking-tight font-semibold shadow-sm z-50 no-print">
<div class="text-2xl font-bold tracking-tighter text-slate-900 dark:text-slate-50">Keeplas</div>
<nav class="hidden md:flex gap-8">
<a class="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors" href="#">Vault</a>
<a class="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors" href="#">Life Check</a>
<a class="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors" href="#">Emergency Card</a>
<a class="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors" href="#">Trusted Contacts</a>
</nav>
<div class="flex items-center gap-4">
<button class="p-2 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-lg transition-all active:scale-95 duration-200">
<span class="material-symbols-outlined">notifications</span>
</button>
<button class="p-2 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-lg transition-all active:scale-95 duration-200">
<span class="material-symbols-outlined">settings</span>
</button>
</div>
</header>
<main class="pt-24 pb-12 px-4 md:px-8">
<div class="max-w-5xl mx-auto flex flex-col gap-10">
<!-- Toolbar -->
<div class="flex flex-col md:flex-row justify-between items-end gap-6 no-print">
<div class="max-w-2xl">
<h1 class="font-headline text-display-md md:text-display-lg text-primary tracking-tight font-extrabold leading-none mb-4">Master Recovery Key</h1>
<p class="text-body-lg text-on-surface-variant leading-relaxed">This document is the sole method for recovering your Keeplas Architectural Vault should you lose access. Keep it in a physically secure, fireproof location. Do not share these credentials with anyone.</p>
</div>
<div class="flex gap-4">
<button class="flex items-center gap-2 px-6 py-3 bg-white hover:bg-surface-container-high text-primary border border-outline-variant/30 rounded-xl transition-all font-semibold" onclick="window.print()">
<span class="material-symbols-outlined">print</span>
                        Print Secure Copy
                    </button>
<button class="flex items-center gap-2 px-6 py-3 bg-primary text-white hover:opacity-90 rounded-xl transition-all font-semibold shadow-lg shadow-primary/20">
<span class="material-symbols-outlined">download</span>
                        Export PDF
                    </button>
</div>
</div>
<!-- The Architectural Vault Document -->
<div class="print-container relative bg-surface-container-lowest overflow-hidden shadow-2xl rounded-2xl flex flex-col md:flex-row min-h-[800px]">
<div class="grain-overlay absolute inset-0"></div>
<!-- Left Column: Branding & Logic -->
<div class="w-full md:w-1/3 bg-primary text-on-primary-container p-12 flex flex-col justify-between relative">
<div class="space-y-12">
<div class="space-y-2">
<div class="text-3xl font-black tracking-tighter text-white">Keeplas</div>
<div class="font-label uppercase tracking-widest text-[10px] opacity-70">The Architectural Vault</div>
</div>
<div class="space-y-6">
<div class="p-6 bg-white/5 rounded-xl space-y-4">
<span class="material-symbols-outlined text-secondary-fixed text-3xl">verified_user</span>
<h3 class="font-headline text-xl text-white font-bold">Identity Verification</h3>
<p class="text-sm opacity-80 leading-relaxed">This key is cryptographically bound to your biometric footprint and verified life-ledger.</p>
</div>
<div class="p-6 bg-white/5 rounded-xl space-y-4">
<span class="material-symbols-outlined text-secondary-fixed text-3xl">security</span>
<h3 class="font-headline text-xl text-white font-bold">Cold Storage</h3>
<p class="text-sm opacity-80 leading-relaxed">Recommended for physical storage only. Offline backups prevent digital extraction.</p>
</div>
</div>
</div>
<div class="mt-12 pt-12 border-t border-white/10">
<div class="text-[10px] font-label uppercase tracking-widest opacity-40 mb-2">Document ID</div>
<div class="font-mono text-xs opacity-60">KP-REC-2024-0812-UX-99</div>
</div>
</div>
<!-- Right Column: Recovery Data -->
<div class="w-full md:w-2/3 p-12 bg-white flex flex-col gap-12">
<!-- Top Section: QR & Instructions -->
<div class="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
<div class="space-y-6">
<div class="inline-block px-3 py-1 bg-secondary-container text-on-secondary-container font-label text-[10px] font-bold uppercase tracking-widest rounded">Step 01</div>
<h2 class="font-headline text-2xl text-primary font-extrabold tracking-tight">Recovery QR Code</h2>
<p class="text-sm text-on-surface-variant leading-relaxed">Scan this code using the Keeplas Recovery portal or any secure Material-compatible device to initiate the vault restoration process.</p>
<div class="flex flex-col gap-4 pt-4">
<div class="flex items-center gap-3 text-sm text-primary font-semibold">
<span class="material-symbols-outlined text-secondary">check_circle</span>
<span>End-to-end encrypted protocol</span>
</div>
<div class="flex items-center gap-3 text-sm text-primary font-semibold">
<span class="material-symbols-outlined text-secondary">check_circle</span>
<span>Single-use recovery token</span>
</div>
</div>
</div>
<div class="flex flex-col items-center justify-center p-6 bg-surface-container-low rounded-2xl relative aspect-square">
<img alt="minimalist vector qr code with primary navy squares on white background clean technical style" class="w-full h-full object-contain mix-blend-multiply" data-alt="minimalist technical vector qr code with primary navy squares on white background high contrast security theme" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA-e32XBT8e_fWOrOu2L8kte6qHYbcMwD3ULcv4hntSBMZwjJlVh6gLVKcbYcJEke3nG5vVkY6ytjYvNrU2actLfROUdtL0r1FEQQlxfyj_LTj8hXBNCXcrLl2NDqEBGlk6NbaYgxJZCj41PPSEEc4qyaf_Yt7pzTQIcOCIf6maKFROzgrABQR5ibiICekhUs_q3MH5hpn0eSmAdhZhnytlxbSkO4RN7AvCr9wVQ6OHo5AFq7zoZFoD0l-zh2d175Y-eDe7umTjX0zi"/>
<div class="absolute -bottom-3 bg-white px-4 py-1 shadow-sm border border-outline-variant/20 rounded-full text-[10px] font-label font-bold uppercase tracking-tighter text-on-surface-variant">Secure Scan Point</div>
</div>
</div>
<!-- Middle Section: Seed Phrase -->
<div class="space-y-6">
<div class="flex items-center justify-between">
<div class="space-y-1">
<div class="inline-block px-3 py-1 bg-secondary-container text-on-secondary-container font-label text-[10px] font-bold uppercase tracking-widest rounded">Step 02</div>
<h2 class="font-headline text-2xl text-primary font-extrabold tracking-tight">Recovery Seed Phrase</h2>
</div>
<span class="material-symbols-outlined text-on-surface-variant opacity-30 text-4xl">lock_open</span>
</div>
<div class="grid grid-cols-2 md:grid-cols-3 gap-3">
<!-- Phrase Blocks -->
<div class="bg-surface-container-low p-4 rounded-xl flex items-center gap-4 group hover:bg-primary transition-all duration-300">
<span class="text-[10px] font-label font-bold text-on-surface-variant/50 group-hover:text-white/50">01</span>
<span class="font-mono text-sm font-bold text-primary group-hover:text-white uppercase tracking-wider">ARCHITECT</span>
</div>
<div class="bg-surface-container-low p-4 rounded-xl flex items-center gap-4 group hover:bg-primary transition-all duration-300">
<span class="text-[10px] font-label font-bold text-on-surface-variant/50 group-hover:text-white/50">02</span>
<span class="font-mono text-sm font-bold text-primary group-hover:text-white uppercase tracking-wider">MARBLE</span>
</div>
<div class="bg-surface-container-low p-4 rounded-xl flex items-center gap-4 group hover:bg-primary transition-all duration-300">
<span class="text-[10px] font-label font-bold text-on-surface-variant/50 group-hover:text-white/50">03</span>
<span class="font-mono text-sm font-bold text-primary group-hover:text-white uppercase tracking-wider">LEGACY</span>
</div>
<div class="bg-surface-container-low p-4 rounded-xl flex items-center gap-4 group hover:bg-primary transition-all duration-300">
<span class="text-[10px] font-label font-bold text-on-surface-variant/50 group-hover:text-white/50">04</span>
<span class="font-mono text-sm font-bold text-primary group-hover:text-white uppercase tracking-wider">VAULT</span>
</div>
<div class="bg-surface-container-low p-4 rounded-xl flex items-center gap-4 group hover:bg-primary transition-all duration-300">
<span class="text-[10px] font-label font-bold text-on-surface-variant/50 group-hover:text-white/50">05</span>
<span class="font-mono text-sm font-bold text-primary group-hover:text-white uppercase tracking-wider">PRECISION</span>
</div>
<div class="bg-surface-container-low p-4 rounded-xl flex items-center gap-4 group hover:bg-primary transition-all duration-300">
<span class="text-[10px] font-label font-bold text-on-surface-variant/50 group-hover:text-white/50">06</span>
<span class="font-mono text-sm font-bold text-primary group-hover:text-white uppercase tracking-wider">QUARTZ</span>
</div>
<div class="bg-surface-container-low p-4 rounded-xl flex items-center gap-4 group hover:bg-primary transition-all duration-300">
<span class="text-[10px] font-label font-bold text-on-surface-variant/50 group-hover:text-white/50">07</span>
<span class="font-mono text-sm font-bold text-primary group-hover:text-white uppercase tracking-wider">HORIZON</span>
</div>
<div class="bg-surface-container-low p-4 rounded-xl flex items-center gap-4 group hover:bg-primary transition-all duration-300">
<span class="text-[10px] font-label font-bold text-on-surface-variant/50 group-hover:text-white/50">08</span>
<span class="font-mono text-sm font-bold text-primary group-hover:text-white uppercase tracking-wider">SHADOW</span>
</div>
<div class="bg-surface-container-low p-4 rounded-xl flex items-center gap-4 group hover:bg-primary transition-all duration-300">
<span class="text-[10px] font-label font-bold text-on-surface-variant/50 group-hover:text-white/50">09</span>
<span class="font-mono text-sm font-bold text-primary group-hover:text-white uppercase tracking-wider">TEMPLE</span>
</div>
<div class="bg-surface-container-low p-4 rounded-xl flex items-center gap-4 group hover:bg-primary transition-all duration-300">
<span class="text-[10px] font-label font-bold text-on-surface-variant/50 group-hover:text-white/50">10</span>
<span class="font-mono text-sm font-bold text-primary group-hover:text-white uppercase tracking-wider">SILENCE</span>
</div>
<div class="bg-surface-container-low p-4 rounded-xl flex items-center gap-4 group hover:bg-primary transition-all duration-300">
<span class="text-[10px] font-label font-bold text-on-surface-variant/50 group-hover:text-white/50">11</span>
<span class="font-mono text-sm font-bold text-primary group-hover:text-white uppercase tracking-wider">CANVAS</span>
</div>
<div class="bg-surface-container-low p-4 rounded-xl flex items-center gap-4 group hover:bg-primary transition-all duration-300">
<span class="text-[10px] font-label font-bold text-on-surface-variant/50 group-hover:text-white/50">12</span>
<span class="font-mono text-sm font-bold text-primary group-hover:text-white uppercase tracking-wider">ETERNITY</span>
</div>
</div>
</div>
<!-- Bottom Section: Legal & Verification -->
<div class="mt-auto grid grid-cols-1 md:grid-cols-2 gap-8 pt-12 border-t border-surface-container">
<div class="flex items-start gap-4">
<div class="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center shrink-0">
<span class="material-symbols-outlined text-primary">warning</span>
</div>
<div class="space-y-1">
<div class="font-bold text-xs uppercase tracking-wider">Final Warning</div>
<p class="text-[11px] text-on-surface-variant leading-normal">Losing this document means permanent loss of all legacy assets. Keeplas does not store copies of your recovery phrase.</p>
</div>
</div>
<div class="flex items-start gap-4">
<div class="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center shrink-0">
<span class="material-symbols-outlined text-primary">history_edu</span>
</div>
<div class="space-y-1">
<div class="font-bold text-xs uppercase tracking-wider">User Validation</div>
<div class="flex items-center gap-2">
<div class="w-4 h-4 rounded-full bg-secondary-fixed"></div>
<span class="text-[11px] font-mono">SECURE_AUTH_STATUS: VALIDATED</span>
</div>
<p class="text-[11px] text-on-surface-variant leading-normal">Generated on Aug 12, 2024 at 14:32 UTC. </p>
</div>
</div>
</div>
</div>
</div>
<!-- Footer Section -->
<footer class="mt-12 flex flex-col md:flex-row justify-between items-center gap-8 no-print max-w-7xl mx-auto w-full py-12 px-8 border-t border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-50 font-inter text-sm leading-relaxed">
<div class="flex flex-col items-center md:items-start gap-2">
<div class="text-lg font-bold text-slate-800 dark:text-slate-200">Keeplas</div>
<p class="text-slate-500 dark:text-slate-400">© 2024 Keeplas Life Continuity. All rights reserved.</p>
</div>
<div class="flex flex-wrap justify-center gap-8">
<a class="text-slate-500 dark:text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500" href="#">Privacy Policy</a>
<a class="text-slate-500 dark:text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500" href="#">Terms of Service</a>
<a class="text-slate-500 dark:text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500" href="#">Security Whitepaper</a>
<a class="text-slate-500 dark:text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500" href="#">GDPR Compliance</a>
</div>
</footer>
</div>
</main>
</body></html>

<!-- Financial Assets Management -->
<!DOCTYPE html>

<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@200;400;600;700;800&amp;family=Inter:wght@300;400;500;600&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              "surface-container-highest": "#e5e2e1",
              "primary-container": "#1b2b48",
              "on-primary-fixed-variant": "#374765",
              "on-surface-variant": "#44474d",
              "on-background": "#1b1c1c",
              "secondary-fixed": "#b9eaff",
              "on-tertiary-fixed": "#001f26",
              "on-surface": "#1b1c1c",
              "outline": "#75777e",
              "secondary": "#28657a",
              "primary-fixed-dim": "#b7c7eb",
              "on-tertiary-fixed-variant": "#004e5d",
              "secondary-fixed-dim": "#95cfe7",
              "tertiary-fixed-dim": "#8fd0e4",
              "surface-bright": "#fcf9f8",
              "background": "#fcf9f8",
              "surface-container-low": "#f6f3f2",
              "on-secondary-fixed-variant": "#004d61",
              "on-secondary-container": "#2b687d",
              "inverse-on-surface": "#f3f0ef",
              "surface": "#fcf9f8",
              "on-primary-fixed": "#091b37",
              "tertiary": "#001a20",
              "error-container": "#ffdad6",
              "tertiary-fixed": "#aeecff",
              "tertiary-container": "#00303a",
              "surface-container-high": "#eae7e7",
              "on-tertiary-container": "#5a9cae",
              "surface-container-lowest": "#ffffff",
              "on-secondary-fixed": "#001f29",
              "on-secondary": "#ffffff",
              "inverse-surface": "#303030",
              "surface-tint": "#4f5e7e",
              "primary-fixed": "#d7e2ff",
              "on-primary-container": "#8393b5",
              "on-error-container": "#93000a",
              "on-error": "#ffffff",
              "surface-dim": "#dcd9d9",
              "surface-container": "#f0eded",
              "on-tertiary": "#ffffff",
              "inverse-primary": "#b7c7eb",
              "surface-variant": "#e5e2e1",
              "outline-variant": "#c5c6ce",
              "on-primary": "#ffffff",
              "primary": "#041632",
              "error": "#ba1a1a",
              "secondary-container": "#abe5fe"
            },
            fontFamily: {
              "headline": ["Manrope"],
              "body": ["Inter"],
              "label": ["Inter"]
            },
            borderRadius: {"DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem"},
          },
        },
      }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
            vertical-align: middle;
        }
        .glass-panel {
            background: rgba(252, 249, 248, 0.8);
            backdrop-filter: blur(20px);
        }
        .signature-gradient {
            background: linear-gradient(135deg, #041632 0%, #1b2b48 100%);
        }
    </style>
</head>
<body class="bg-surface font-body text-on-surface">
<!-- TopNavBar Implementation -->
<header class="fixed top-0 w-full flex justify-between items-center px-8 py-4 max-w-full mx-auto bg-slate-50/80 backdrop-blur-xl z-50 shadow-sm">
<div class="text-2xl font-bold tracking-tighter text-slate-900">Keeplas</div>
<nav class="hidden md:flex items-center space-x-8">
<a class="text-slate-600 hover:text-slate-900 transition-colors font-manrope tracking-tight font-semibold" href="#">Vault</a>
<a class="text-slate-600 hover:text-slate-900 transition-colors font-manrope tracking-tight font-semibold" href="#">Life Check</a>
<a class="text-slate-600 hover:text-slate-900 transition-colors font-manrope tracking-tight font-semibold" href="#">Emergency Card</a>
<a class="text-slate-600 hover:text-slate-900 transition-colors font-manrope tracking-tight font-semibold" href="#">Trusted Contacts</a>
</nav>
<div class="flex items-center space-x-4">
<div class="relative hidden sm:block">
<span class="absolute inset-y-0 left-3 flex items-center text-slate-400">
<span class="material-symbols-outlined text-sm">search</span>
</span>
<input class="pl-10 pr-4 py-2 bg-slate-200/50 border-none rounded-xl text-sm focus:ring-2 focus:ring-secondary w-64" placeholder="Search Vault..." type="text"/>
</div>
<button class="p-2 text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors">
<span class="material-symbols-outlined" data-icon="notifications">notifications</span>
</button>
<button class="p-2 text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors">
<span class="material-symbols-outlined" data-icon="settings">settings</span>
</button>
<div class="h-10 w-10 rounded-full overflow-hidden bg-surface-container">
<img alt="User profile avatar" data-alt="Close up portrait of a professional man in a dark suit against a neutral studio background with soft lighting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBogxvzjqKp874nucF6BhrvaOmvjgwAMOjm6Zhmf-oED2qqyy0YxQS1k0R4Lt-Je_mPwzKB6a9iD_Ys1II7DF37HZSZvL3W0fbK0UeZy0BjGtri-1lLnBIyVjaZHtFQSPelpedo1iG2dpUmZTKY5fEd0OfYTFQQd-x6xTztCTbDBf5D-e-iSt5sfaWrx3bCqioM76x-_UmvBeStY1m2qIeyR2WKPJuqh2OAdWvdaaeqdCkTCUsH2QJNWFiVCelH4aBlo8Da2C6xbjkz"/>
</div>
</div>
</header>
<!-- SideNavBar Implementation -->
<aside class="hidden lg:flex flex-col h-screen w-64 fixed left-0 top-0 py-8 bg-slate-100 border-r border-transparent z-40">
<div class="px-6 mb-10">
<div class="text-xl font-black text-slate-900">Keeplas</div>
<div class="text-[10px] font-manrope uppercase tracking-widest font-bold text-slate-500">The Architectural Vault</div>
</div>
<nav class="flex-1 space-y-2 px-4">
<a class="flex items-center space-x-3 px-4 py-3 text-slate-500 hover:translate-x-1 transition-transform font-manrope uppercase tracking-widest text-xs font-bold" href="#">
<span class="material-symbols-outlined" data-icon="dashboard">dashboard</span>
<span>Dashboard</span>
</a>
<a class="flex items-center space-x-3 px-4 py-3 bg-white text-cyan-700 shadow-sm rounded-r-full font-manrope uppercase tracking-widest text-xs font-bold" href="#">
<span class="material-symbols-outlined" data-icon="lock">lock</span>
<span>Digital Vault</span>
</a>
<a class="flex items-center space-x-3 px-4 py-3 text-slate-500 hover:translate-x-1 transition-transform font-manrope uppercase tracking-widest text-xs font-bold" href="#">
<span class="material-symbols-outlined" data-icon="medical_services">medical_services</span>
<span>Health Directives</span>
</a>
<a class="flex items-center space-x-3 px-4 py-3 text-slate-500 hover:translate-x-1 transition-transform font-manrope uppercase tracking-widest text-xs font-bold" href="#">
<span class="material-symbols-outlined" data-icon="gavel">gavel</span>
<span>Legal Legacy</span>
</a>
<a class="flex items-center space-x-3 px-4 py-3 text-slate-500 hover:translate-x-1 transition-transform font-manrope uppercase tracking-widest text-xs font-bold" href="#">
<span class="material-symbols-outlined" data-icon="verified_user">verified_user</span>
<span>Security Center</span>
</a>
</nav>
<div class="px-4 mt-auto">
<button class="w-full signature-gradient text-white py-3 rounded-xl font-bold flex items-center justify-center space-x-2 text-sm shadow-lg mb-8">
<span class="material-symbols-outlined text-sm">add</span>
<span>Secure New Asset</span>
</button>
<div class="space-y-1">
<a class="flex items-center space-x-3 px-4 py-2 text-slate-500 hover:text-slate-900 transition-colors text-xs font-bold uppercase tracking-wider" href="#">
<span class="material-symbols-outlined" data-icon="help">help</span>
<span>Support</span>
</a>
<a class="flex items-center space-x-3 px-4 py-2 text-slate-500 hover:text-slate-900 transition-colors text-xs font-bold uppercase tracking-wider" href="#">
<span class="material-symbols-outlined" data-icon="logout">logout</span>
<span>Sign Out</span>
</a>
</div>
</div>
</aside>
<!-- Main Content Canvas -->
<main class="lg:pl-64 pt-24 min-h-screen">
<div class="max-w-7xl mx-auto px-8 py-10">
<!-- Header Section: Editorial Authority -->
<div class="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
<div>
<h1 class="text-5xl font-extrabold font-headline tracking-tighter text-primary mb-2">Financial Portfolio</h1>
<p class="text-on-surface-variant max-w-xl text-lg leading-relaxed">A holistic synchronization of your life's capital. Secured with zero-knowledge architecture and real-time transmission protocols.</p>
</div>
<div class="bg-primary-container p-6 rounded-xl shadow-xl border-l-4 border-secondary min-w-[300px]">
<div class="text-on-primary-container text-xs font-bold uppercase tracking-[0.2em] mb-1">Net Vault Valuation</div>
<div class="text-3xl font-headline font-bold text-white tracking-tight">$4,285,190.42</div>
<div class="flex items-center gap-2 mt-2">
<span class="w-2 h-2 rounded-full bg-secondary"></span>
<span class="text-secondary-fixed text-xs font-medium">All systems synchronized • 2m ago</span>
</div>
</div>
</div>
<!-- Dashboard Grid: Bento Style -->
<div class="grid grid-cols-1 md:grid-cols-12 gap-6">
<!-- Summary Card 1: Crypto (Asymmetric) -->
<div class="md:col-span-4 bg-surface-container-low p-8 rounded-full border border-transparent hover:bg-surface-container transition-colors group">
<div class="flex justify-between items-start mb-12">
<div class="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white">
<span class="material-symbols-outlined" data-icon="currency_bitcoin">currency_bitcoin</span>
</div>
<span class="px-3 py-1 bg-secondary/10 text-secondary text-[10px] font-bold uppercase tracking-widest rounded-full">Encrypted</span>
</div>
<h3 class="font-headline text-2xl font-bold text-primary mb-1">Crypto Ledger</h3>
<div class="text-3xl font-headline font-light tracking-tight text-on-surface mb-6">$842,109.20</div>
<div class="space-y-4">
<div class="flex justify-between items-center text-xs">
<span class="text-on-surface-variant">Sync Date</span>
<span class="text-on-surface font-semibold">Today, 09:12 AM</span>
</div>
<div class="flex justify-between items-center text-xs">
<span class="text-on-surface-variant">Transmission</span>
<span class="text-secondary font-bold flex items-center gap-1">
<span class="material-symbols-outlined text-xs" style="font-variation-settings: 'FILL' 1;">check_circle</span>
                                ACTIVE
                            </span>
</div>
</div>
</div>
<!-- Summary Card 2: Banking (Main Content) -->
<div class="md:col-span-8 bg-white p-8 rounded-full shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
<div class="absolute top-0 right-0 w-64 h-64 opacity-[0.03] pointer-events-none -mr-20 -mt-20">
<span class="material-symbols-outlined text-[200px]" data-icon="account_balance">account_balance</span>
</div>
<div class="flex items-center gap-3 mb-8">
<span class="material-symbols-outlined text-secondary" data-icon="verified">verified</span>
<span class="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Primary Liquidity</span>
</div>
<div class="grid grid-cols-1 md:grid-cols-2 gap-12">
<div>
<h3 class="font-headline text-2xl font-bold text-primary mb-4">Cash &amp; Equivalents</h3>
<div class="text-5xl font-headline font-black text-primary tracking-tighter mb-8">$1,243,081.22</div>
<button class="flex items-center gap-2 text-secondary font-bold text-sm hover:translate-x-2 transition-transform">
<span>View all accounts</span>
<span class="material-symbols-outlined">arrow_forward</span>
</button>
</div>
<div class="bg-surface-container-low p-6 rounded-xl space-y-4">
<div class="flex items-center justify-between border-b border-surface-container pb-4">
<div>
<div class="text-xs font-bold text-primary">Chase Sapphire Private</div>
<div class="text-[10px] text-on-surface-variant">**** 9021</div>
</div>
<div class="text-sm font-semibold">$842,000.00</div>
</div>
<div class="flex items-center justify-between border-b border-surface-container pb-4">
<div>
<div class="text-xs font-bold text-primary">Goldman Sachs Marcus</div>
<div class="text-[10px] text-on-surface-variant">High-Yield</div>
</div>
<div class="text-sm font-semibold">$401,081.22</div>
</div>
</div>
</div>
</div>
<!-- Asset Table: Data Dense Implementation -->
<div class="md:col-span-12 mt-6">
<div class="bg-surface-container-low rounded-xl overflow-hidden">
<div class="px-8 py-6 flex items-center justify-between bg-white/50 backdrop-blur-sm">
<h2 class="font-headline text-xl font-bold text-primary">Real Estate &amp; Fixed Assets</h2>
<div class="flex gap-4">
<button class="p-2 bg-white rounded-lg shadow-sm text-slate-400 hover:text-primary transition-colors">
<span class="material-symbols-outlined">filter_list</span>
</button>
<button class="p-2 bg-white rounded-lg shadow-sm text-slate-400 hover:text-primary transition-colors">
<span class="material-symbols-outlined">download</span>
</button>
</div>
</div>
<div class="overflow-x-auto">
<table class="w-full text-left">
<thead class="bg-slate-50 border-b border-surface-container">
<tr>
<th class="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Asset Identity</th>
<th class="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Appraised Value</th>
<th class="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Zero-Knowledge</th>
<th class="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Last Sync</th>
<th class="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Transmission</th>
<th class="px-8 py-4 text-right"></th>
</tr>
</thead>
<tbody class="divide-y divide-surface-container">
<tr class="hover:bg-white transition-colors">
<td class="px-8 py-6">
<div class="flex items-center gap-4">
<div class="w-10 h-10 rounded-lg overflow-hidden bg-slate-200">
<img alt="Property" data-alt="Modern minimalist luxury villa with large glass windows and clean white lines at twilight with soft warm interior lighting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBXBrQlfLgGD6bNsQnh3JUyhtMdd9MkTseLQaAIsIxDcBUR46akYbzDTxAzdxh7zSoqWJfPEwAuYLPUa0hEUJtMkIGiteld8OwKdNHHN_65HuSMAd74kjfb7rujtJV90rq31mCSrwvK5nVH42azF7BiEaaObwgEHVHviudujFMNR-q7Ob4KS5iAkBIEGKBhzaVkU4cObXhPs-EQXa-VeivbysYw3eKBu5qGQO_SvoXEVMEQBIzntzxL1PqBoQNBExmVGvMBfNaYF-lh"/>
</div>
<div>
<div class="font-bold text-primary">Malibu Coastal Residence</div>
<div class="text-xs text-on-surface-variant">Primary Estate • CA, USA</div>
</div>
</div>
</td>
<td class="px-8 py-6 font-semibold">$1,850,000.00</td>
<td class="px-8 py-6">
<span class="flex items-center gap-1.5 text-secondary text-xs font-bold">
<span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1;">lock</span>
                                                VERIFIED
                                            </span>
</td>
<td class="px-8 py-6 text-xs text-on-surface-variant">Jan 12, 2024</td>
<td class="px-8 py-6">
<span class="px-3 py-1 bg-secondary-fixed text-on-secondary-fixed text-[10px] font-bold rounded-full">STANDBY</span>
</td>
<td class="px-8 py-6 text-right">
<button class="text-slate-400 hover:text-primary"><span class="material-symbols-outlined">more_vert</span></button>
</td>
</tr>
<tr class="hover:bg-white transition-colors">
<td class="px-8 py-6">
<div class="flex items-center gap-4">
<div class="w-10 h-10 rounded-lg overflow-hidden bg-slate-200">
<img alt="Property" data-alt="Cozy wooden alpine cabin surrounded by snow-covered pine trees in a misty mountain setting at dusk" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB-wM_yoGVXqlCMi65r1ADXsj06EcoIKvDN3py5ochCGFXy7C3d4GydjM9DfLQzdMK56aWtr04mTV8yvOGkvalQY_2nAzVByx6UHl6W_5p83aaIztorCRUwEbfyfsvj-4DZWHHi2EMXMxCDp8mgW0JCvpOk_QZCLQ7DtFHjZBYj1EnTVhkp9JdysO73O-Zuyhp4l7-IR1o-XpATQrveVCplRs3BRZLCuMo-tQsGjUFbnNb8_M3X7Gti8JsOxOEh0_xNoeBliQOv0EXB"/>
</div>
<div>
<div class="font-bold text-primary">Aspen Retreat</div>
<div class="text-xs text-on-surface-variant">Leisure Holding • CO, USA</div>
</div>
</div>
</td>
<td class="px-8 py-6 font-semibold">$350,000.00</td>
<td class="px-8 py-6">
<span class="flex items-center gap-1.5 text-secondary text-xs font-bold">
<span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1;">lock</span>
                                                VERIFIED
                                            </span>
</td>
<td class="px-8 py-6 text-xs text-on-surface-variant">Jan 10, 2024</td>
<td class="px-8 py-6">
<span class="px-3 py-1 bg-secondary-container text-on-secondary-container text-[10px] font-bold rounded-full">ACTIVE</span>
</td>
<td class="px-8 py-6 text-right">
<button class="text-slate-400 hover:text-primary"><span class="material-symbols-outlined">more_vert</span></button>
</td>
</tr>
</tbody>
</table>
</div>
</div>
</div>
<!-- Legacy Directive: Editorial Block -->
<div class="md:col-span-12 mt-8">
<div class="signature-gradient rounded-full p-12 flex flex-col md:flex-row items-center justify-between text-white relative overflow-hidden">
<div class="relative z-10">
<h2 class="text-3xl font-headline font-extrabold mb-2">Continuity Transmission</h2>
<p class="text-on-primary-container max-w-lg leading-relaxed">Your assets are currently set to transmit to your designated beneficiaries upon 48 hours of inactivity on your 'Life Check' protocol. Security clearance: Tier 1.</p>
</div>
<div class="mt-8 md:mt-0 relative z-10 flex gap-4">
<button class="px-8 py-4 bg-white text-primary font-bold rounded-xl hover:bg-slate-100 transition-colors">Edit Transmission Logic</button>
<button class="px-8 py-4 bg-primary border border-primary-container font-bold rounded-xl hover:bg-on-primary-fixed-variant transition-colors">Test Protocol</button>
</div>
<div class="absolute -right-20 -bottom-20 opacity-10">
<span class="material-symbols-outlined text-[300px]" data-icon="shield">shield</span>
</div>
</div>
</div>
</div>
</div>
</main>
<!-- Footer -->
<footer class="w-full py-12 px-8 bg-slate-50 mt-20 border-t border-slate-200">
<div class="flex flex-col md:flex-row justify-between items-center max-w-7xl mx-auto">
<div class="mb-8 md:mb-0">
<div class="text-lg font-bold text-slate-800 mb-2">Keeplas</div>
<p class="font-inter text-sm leading-relaxed text-slate-500">© 2024 Keeplas Life Continuity. All rights reserved.</p>
</div>
<div class="flex flex-wrap justify-center gap-8">
<a class="text-slate-500 hover:text-cyan-700 transition-colors font-inter text-sm leading-relaxed" href="#">Privacy Policy</a>
<a class="text-slate-500 hover:text-cyan-700 transition-colors font-inter text-sm leading-relaxed" href="#">Terms of Service</a>
<a class="text-slate-500 hover:text-cyan-700 transition-colors font-inter text-sm leading-relaxed" href="#">Security Whitepaper</a>
<a class="text-slate-500 hover:text-cyan-700 transition-colors font-inter text-sm leading-relaxed" href="#">GDPR Compliance</a>
</div>
</div>
</footer>

```</body></html>

```
