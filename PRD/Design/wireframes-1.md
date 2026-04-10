<!-- Trusted Contacts -->
<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Keeplas | Trusted Contacts Management</title>
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
      .glass-nav {
        background: rgba(4, 22, 50, 0.8);
        backdrop-filter: blur(20px);
      }
    </style>
</head>
<body class="bg-surface font-body text-on-surface selection:bg-secondary-container selection:text-on-secondary-container">
<!-- TopAppBar -->
<nav class="bg-[#041632]/80 backdrop-blur-xl dark:bg-[#041632]/90 fixed top-0 z-50 w-full shadow-2xl shadow-[#1b1c1c]/10">
<div class="flex justify-between items-center w-full px-8 py-4 max-w-screen-2xl mx-auto">
<div class="text-2xl font-extrabold tracking-tighter text-white font-headline">Keeplas</div>
<div class="hidden md:flex items-center space-x-8 font-headline font-bold tracking-tight">
<a class="text-slate-400 hover:text-white transition-colors" href="#">Vault</a>
<a class="text-slate-400 hover:text-white transition-colors" href="#">Life Check</a>
<a class="text-slate-400 hover:text-white transition-colors" href="#">Emergency Card</a>
<a class="text-[#b9eaff] border-b-2 border-[#28657a] pb-1" href="#">Trusted Contacts</a>
</div>
<div class="flex items-center space-x-4">
<button class="hover:bg-[#1b2b48]/50 rounded-lg transition-all p-2 text-white scale-95 active:scale-90 duration-200">
<span class="material-symbols-outlined" data-icon="verified_user">verified_user</span>
</button>
<button class="hover:bg-[#1b2b48]/50 rounded-lg transition-all p-2 text-white scale-95 active:scale-90 duration-200">
<span class="material-symbols-outlined" data-icon="notifications">notifications</span>
</button>
<button class="hover:bg-[#1b2b48]/50 rounded-lg transition-all p-2 text-white scale-95 active:scale-90 duration-200">
<span class="material-symbols-outlined" data-icon="account_circle">account_circle</span>
</button>
</div>
</div>
</nav>
<main class="pt-32 pb-24 px-6 md:px-12 max-w-screen-2xl mx-auto min-h-screen">
<!-- Hero Section -->
<header class="mb-16 max-w-3xl">
<h1 class="font-headline font-extrabold text-5xl md:text-6xl text-primary tracking-tight mb-6">
                Social Recovery &amp; <br/>
<span class="text-secondary">Trusted Circles</span>
</h1>
<p class="text-lg text-on-surface-variant leading-relaxed">
                Designate the individuals you trust to protect your legacy. These contacts act as your digital guardians, ensuring continuity when it matters most.
            </p>
</header>
<div class="grid grid-cols-1 lg:grid-cols-12 gap-12">
<!-- Side Explanation & Controls (Asymmetric Layout) -->
<aside class="lg:col-span-4 space-y-10">
<section class="bg-surface-container-low p-8 rounded-full">
<h3 class="font-headline font-bold text-xl mb-4 text-primary">The Role of Guardians</h3>
<div class="space-y-6">
<div class="flex gap-4">
<div class="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center shrink-0">
<span class="material-symbols-outlined text-secondary-fixed text-lg" data-icon="shield">shield</span>
</div>
<div>
<p class="font-bold text-sm uppercase tracking-widest text-primary mb-1">Recovery Partner</p>
<p class="text-xs text-on-surface-variant leading-normal">Empowered to initiate account recovery and verify identity in case of lost access.</p>
</div>
</div>
<div class="flex gap-4">
<div class="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center shrink-0">
<span class="material-symbols-outlined text-secondary-fixed text-lg" data-icon="medical_services">medical_services</span>
</div>
<div>
<p class="font-bold text-sm uppercase tracking-widest text-primary mb-1">Medical Proxy</p>
<p class="text-xs text-on-surface-variant leading-normal">Grants instant access to health directives and medical history during emergencies.</p>
</div>
</div>
<div class="flex gap-4">
<div class="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center shrink-0">
<span class="material-symbols-outlined text-secondary-fixed text-lg" data-icon="gavel">gavel</span>
</div>
<div>
<p class="font-bold text-sm uppercase tracking-widest text-primary mb-1">Legal Legacy</p>
<p class="text-xs text-on-surface-variant leading-normal">Notified to manage digital assets and final wishes according to your protocol.</p>
</div>
</div>
</div>
</section>
<div class="relative overflow-hidden rounded-full bg-primary p-1 text-white shadow-xl">
<img class="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-overlay" data-alt="close-up of two people shaking hands in soft, warm indoor lighting, symbolizing trust and mutual agreement" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDq7gANvJAit9JpuWsMRLTvjZ50sPg2ZNgtotb8PkmZesaegPA8xyOYUBme_FXaoo8jqd4D8kUXop--vpgQnir0wBGRlF30T0nevrD1gIv2KJ-bxSSzYuwNPDnNP1Iixf6GQDGB7-cim6VS5wpXOMzGDD6nClVT2drDQLz3cKlMVKaVD0Bqjr3SeX2BQ-CSbchXLXNLcPKcSGPx-NP_PmkVE_TZ6tFZqbmjPQzd_v-Nztri74Zh_GkkJcI7O0bEqDPkYYDVnVdtc6eM"/>
<div class="relative p-8">
<h4 class="font-headline font-bold text-lg mb-2">Secure Invitation</h4>
<p class="text-sm opacity-80 mb-6">Each contact must verify their identity and accept their role via encrypted invitation.</p>
<button class="w-full py-4 bg-secondary text-white font-bold rounded-xl hover:bg-on-secondary-container transition-all flex items-center justify-center gap-2">
<span class="material-symbols-outlined text-xl" data-icon="person_add">person_add</span>
                            Add New Guardian
                        </button>
</div>
</div>
</aside>
<!-- Main Contact Grid -->
<div class="lg:col-span-8">
<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
<!-- Contact Card 1 -->
<div class="bg-surface-container-low group hover:bg-surface-container transition-all p-8 rounded-full border border-transparent hover:border-outline-variant/10">
<div class="flex justify-between items-start mb-6">
<div class="w-14 h-14 rounded-full overflow-hidden border-2 border-secondary p-0.5">
<img class="w-full h-full object-cover rounded-full" data-alt="Portrait of a middle-aged man with a friendly smile, professional lighting, neutral grey background" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDBNjtA_nWbJLdzwlVBTc5ccp_5cjvUeXku9v5b_ZLfV-lvEa0tF_XGowTnwBXHBKY0FId6LUrOAaSMlEIyinTWoOC24hfj49y_71zAlOBUKdbyvP3BKl4ioZ1l-ZShURGSQ5bgLAJuHl7A0tjNIY_pPT_Itf1fQd6Id1TaE-JfOmSKu9f7rXrQgGdA56FkQO7nyMV-PP4D0CikrDHR_NjonrSzvUJCYsR0RQVj5iclcHg3vcJawYrcisQUnkztaXru7ZNlrfFxlz_3"/>
</div>
<span class="px-3 py-1 bg-secondary-container text-on-secondary-container text-[10px] font-black uppercase tracking-widest rounded-full">Verified</span>
</div>
<h3 class="font-headline font-bold text-xl text-primary">Marcus Thorne</h3>
<p class="text-sm text-on-surface-variant mb-6">m.thorne@arch.design</p>
<div class="flex items-center gap-2 mb-8">
<div class="flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 rounded-lg">
<span class="material-symbols-outlined text-sm text-primary" data-icon="shield" style="font-variation-settings: 'FILL' 1;">shield</span>
<span class="text-[10px] font-bold uppercase tracking-tight text-primary">Primary Recovery</span>
</div>
<div class="flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 rounded-lg">
<span class="material-symbols-outlined text-sm text-primary" data-icon="gavel" style="font-variation-settings: 'FILL' 1;">gavel</span>
<span class="text-[10px] font-bold uppercase tracking-tight text-primary">Legal</span>
</div>
</div>
<div class="flex justify-between items-center border-t border-outline-variant/10 pt-6">
<button class="text-xs font-bold text-secondary hover:underline">Manage Access</button>
<button class="text-on-surface-variant hover:text-error transition-colors">
<span class="material-symbols-outlined" data-icon="more_vert">more_vert</span>
</button>
</div>
</div>
<!-- Contact Card 2 -->
<div class="bg-surface-container-low group hover:bg-surface-container transition-all p-8 rounded-full border border-transparent hover:border-outline-variant/10">
<div class="flex justify-between items-start mb-6">
<div class="w-14 h-14 rounded-full overflow-hidden border-2 border-outline-variant p-0.5">
<img class="w-full h-full object-cover rounded-full" data-alt="Portrait of a young woman with glasses, warm smiling expression, bright morning sunlight" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB892ByiUbolGpGcsnOMXfH5NWW3eD0QlqNsER-OVyybpCR7WcoFyQbhde7d8FTP9kbprLepVY2kiCKgo3LtxeUCVqTezBiBm2MvyOYVK9eSl6f5sgrCnZVWkgU5r6FiNEhd8JiEX6SqghnSfUmpJvTDOO2Eem5bK5mZUTtYda-eqkcdSUNFmJosPQ5HgXdZYq-o1h3zC5okrQRucBhA_8AVYXtxdOeMd6O6yzuWQwesEPwZeOGZ-ZXGkw7XMGLEEdBhQEkAfTTjC2a"/>
</div>
<span class="px-3 py-1 bg-surface-variant text-on-surface-variant text-[10px] font-black uppercase tracking-widest rounded-full">Pending</span>
</div>
<h3 class="font-headline font-bold text-xl text-primary">Elena Rodriguez</h3>
<p class="text-sm text-on-surface-variant mb-6">elena.rodriguez@med.co</p>
<div class="flex items-center gap-2 mb-8">
<div class="flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 rounded-lg">
<span class="material-symbols-outlined text-sm text-primary" data-icon="heart_active" style="font-variation-settings: 'FILL' 1;">medical_services</span>
<span class="text-[10px] font-bold uppercase tracking-tight text-primary">Medical</span>
</div>
</div>
<div class="flex justify-between items-center border-t border-outline-variant/10 pt-6">
<button class="text-xs font-bold text-primary/40 cursor-not-allowed">Awaiting Verification</button>
<button class="text-on-surface-variant hover:text-error transition-colors">
<span class="material-symbols-outlined" data-icon="delete">delete</span>
</button>
</div>
</div>
<!-- Empty State / Add Card -->
<div class="border-2 border-dashed border-outline-variant/30 flex flex-col items-center justify-center p-8 rounded-full hover:bg-surface-container-low transition-colors cursor-pointer group">
<div class="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
<span class="material-symbols-outlined text-secondary text-3xl" data-icon="add">add</span>
</div>
<p class="font-headline font-bold text-primary">Invite Next Contact</p>
<p class="text-xs text-on-surface-variant mt-2">Maximum 5 trusted guardians</p>
</div>
<!-- Trust Stats Card -->
<div class="bg-primary-container p-8 rounded-full text-on-primary-container relative overflow-hidden flex flex-col justify-end">
<div class="absolute top-0 right-0 p-8 opacity-10">
<span class="material-symbols-outlined text-8xl" data-icon="lock_person">lock_person</span>
</div>
<h4 class="text-4xl font-headline font-black mb-2">2 / 5</h4>
<p class="text-sm font-medium opacity-80 uppercase tracking-widest">Network Strength: Stable</p>
<div class="mt-4 h-1.5 w-full bg-primary rounded-full overflow-hidden">
<div class="h-full bg-secondary-fixed w-[40%]"></div>
</div>
</div>
</div>
<!-- Invite Form (Tonal Layering Level 2) -->
<section class="mt-12 bg-surface-container p-10 rounded-full">
<h2 class="font-headline font-extrabold text-3xl text-primary mb-8">Establish Trust</h2>
<form class="space-y-8">
<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
<div class="space-y-2">
<label class="text-[10px] font-black uppercase tracking-widest text-primary ml-2">Full Name</label>
<input class="w-full bg-surface-container-low border-none rounded-xl focus:ring-1 focus:ring-secondary transition-all py-4 px-6 text-on-surface" placeholder="e.g. Sarah Jenkins" type="text"/>
</div>
<div class="space-y-2">
<label class="text-[10px] font-black uppercase tracking-widest text-primary ml-2">Email or Phone</label>
<input class="w-full bg-surface-container-low border-none rounded-xl focus:ring-1 focus:ring-secondary transition-all py-4 px-6 text-on-surface" placeholder="sarah.j@example.com" type="email"/>
</div>
</div>
<div class="space-y-4">
<label class="text-[10px] font-black uppercase tracking-widest text-primary ml-2">Assign Primary Responsibilities</label>
<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
<label class="cursor-pointer">
<input class="hidden peer" type="checkbox"/>
<div class="p-4 rounded-xl border-2 border-transparent bg-surface-container-low peer-checked:bg-primary peer-checked:text-white transition-all flex flex-col items-center gap-2">
<span class="material-symbols-outlined" data-icon="shield">shield</span>
<span class="text-[10px] font-bold uppercase">Recovery</span>
</div>
</label>
<label class="cursor-pointer">
<input class="hidden peer" type="checkbox"/>
<div class="p-4 rounded-xl border-2 border-transparent bg-surface-container-low peer-checked:bg-primary peer-checked:text-white transition-all flex flex-col items-center gap-2">
<span class="material-symbols-outlined" data-icon="medical_services">medical_services</span>
<span class="text-[10px] font-bold uppercase">Medical</span>
</div>
</label>
<label class="cursor-pointer">
<input class="hidden peer" type="checkbox"/>
<div class="p-4 rounded-xl border-2 border-transparent bg-surface-container-low peer-checked:bg-primary peer-checked:text-white transition-all flex flex-col items-center gap-2">
<span class="material-symbols-outlined" data-icon="gavel">gavel</span>
<span class="text-[10px] font-bold uppercase">Legal</span>
</div>
</label>
<label class="cursor-pointer">
<input class="hidden peer" type="checkbox"/>
<div class="p-4 rounded-xl border-2 border-transparent bg-surface-container-low peer-checked:bg-primary peer-checked:text-white transition-all flex flex-col items-center gap-2">
<span class="material-symbols-outlined" data-icon="family_history">family_history</span>
<span class="text-[10px] font-bold uppercase">Family</span>
</div>
</label>
</div>
</div>
<div class="space-y-2">
<label class="text-[10px] font-black uppercase tracking-widest text-primary ml-2">Access Level Authorization</label>
<select class="w-full bg-surface-container-low border-none rounded-xl focus:ring-1 focus:ring-secondary transition-all py-4 px-6 text-on-surface appearance-none">
<option>Level 1: Emergency Visibility Only</option>
<option>Level 2: Identity Verification Partner</option>
<option>Level 3: Full Administrative Backup</option>
</select>
</div>
<div class="pt-4 flex items-center gap-6">
<button class="px-10 py-5 bg-primary text-white font-headline font-bold rounded-xl shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all" type="submit">
                                Send Secure Invitation
                            </button>
<p class="text-xs text-on-surface-variant max-w-[200px] leading-tight">
                                This action will generate a unique hash-linked invitation valid for 72 hours.
                            </p>
</div>
</form>
</section>
</div>
</div>
</main>
<!-- Footer -->
<footer class="bg-[#001a20] dark:bg-[#000000] w-full py-12 px-8 mt-auto border-t border-white/5">
<div class="max-w-screen-2xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
<div class="font-inter text-xs uppercase tracking-widest text-slate-400">
                © 2024 Keeplas Life Continuity. Encrypted &amp; Secured.
            </div>
<div class="flex gap-8 font-inter text-xs uppercase tracking-widest">
<a class="text-slate-500 hover:text-[#28657a] transition-colors" href="#">Privacy Vault</a>
<a class="text-slate-500 hover:text-[#28657a] transition-colors" href="#">Security Protocol</a>
<a class="text-slate-500 hover:text-[#28657a] transition-colors" href="#">Terms of Legacy</a>
<a class="text-slate-500 hover:text-[#28657a] transition-colors" href="#">Contact Concierge</a>
</div>
</div>
</footer>
<!-- Mobile Navigation (Responsive Pivot) -->
<nav class="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-outline-variant/10 px-6 py-4 flex justify-around items-center z-50">
<button class="flex flex-col items-center gap-1 text-on-surface-variant">
<span class="material-symbols-outlined" data-icon="dashboard">dashboard</span>
<span class="text-[8px] font-bold uppercase">Dash</span>
</button>
<button class="flex flex-col items-center gap-1 text-on-surface-variant">
<span class="material-symbols-outlined" data-icon="lock">lock</span>
<span class="text-[8px] font-bold uppercase">Vault</span>
</button>
<button class="flex flex-col items-center gap-1 text-secondary">
<span class="material-symbols-outlined" data-icon="groups" style="font-variation-settings: 'FILL' 1;">groups</span>
<span class="text-[8px] font-bold uppercase">Trust</span>
</button>
<button class="flex flex-col items-center gap-1 text-on-surface-variant">
<span class="material-symbols-outlined" data-icon="shield">shield</span>
<span class="text-[8px] font-bold uppercase">Safety</span>
</button>
</nav>
</body></html>

<!-- Life Check Setup -->
<!DOCTYPE html>

<html class="scroll-smooth" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Keeplas | Life Check Setup</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&amp;family=Inter:wght@300;400;500;600&amp;display=swap" rel="stylesheet"/>
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
        .glass-panel {
            background: rgba(252, 249, 248, 0.8);
            backdrop-filter: blur(20px);
        }
        .signature-gradient {
            background: linear-gradient(135deg, #041632 0%, #1b2b48 100%);
        }
    </style>
</head>
<body class="bg-background text-on-background font-body selection:bg-secondary-container">
<!-- TopAppBar -->
<nav class="fixed top-0 z-50 w-full bg-[#041632]/80 backdrop-blur-xl dark:bg-[#041632]/90 shadow-2xl shadow-[#1b1c1c]/10">
<div class="flex justify-between items-center w-full px-8 py-4 max-w-screen-2xl mx-auto">
<div class="text-2xl font-extrabold tracking-tighter text-white font-headline">Keeplas</div>
<div class="hidden md:flex items-center space-x-8 font-headline font-bold tracking-tight">
<a class="text-slate-400 hover:text-white transition-colors" href="#">Vault</a>
<a class="text-[#b9eaff] border-b-2 border-[#28657a] pb-1" href="#">Life Check</a>
<a class="text-slate-400 hover:text-white transition-colors" href="#">Emergency Card</a>
<a class="text-slate-400 hover:text-white transition-colors" href="#">Trusted Contacts</a>
</div>
<div class="flex items-center space-x-4">
<button class="p-2 hover:bg-[#1b2b48]/50 rounded-lg transition-all text-[#b9eaff] scale-95 active:scale-90 duration-200">
<span class="material-symbols-outlined">verified_user</span>
</button>
<button class="p-2 hover:bg-[#1b2b48]/50 rounded-lg transition-all text-[#b9eaff] scale-95 active:scale-90 duration-200">
<span class="material-symbols-outlined">notifications</span>
</button>
<button class="p-2 hover:bg-[#1b2b48]/50 rounded-lg transition-all text-[#b9eaff] scale-95 active:scale-90 duration-200">
<span class="material-symbols-outlined">account_circle</span>
</button>
</div>
</div>
</nav>
<main class="pt-24 pb-20 px-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
<!-- Header Section -->
<header class="lg:col-span-12 mb-8">
<div class="flex flex-col md:flex-row md:items-end justify-between gap-6">
<div class="max-w-2xl">
<h1 class="text-5xl font-extrabold font-headline tracking-tight text-primary mb-4 leading-tight">Life Continuity <br/><span class="text-secondary">Verification Engine</span></h1>
<p class="text-on-surface-variant text-lg max-w-xl">Configure your automated proof-of-life protocol. If you are unresponsive, Keeplas securely executes your legacy directives.</p>
</div>
<!-- Pause Toggle (The 'Pause Life Check' Feature) -->
<div class="bg-surface-container-low p-6 rounded-full flex items-center gap-6 shadow-sm">
<div class="flex flex-col">
<span class="font-headline font-bold text-primary">Travel Mode</span>
<span class="text-xs text-on-surface-variant uppercase tracking-widest">Pause Life Check</span>
</div>
<label class="relative inline-flex items-center cursor-pointer">
<input class="sr-only peer" type="checkbox" value=""/>
<div class="w-14 h-7 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-secondary"></div>
</label>
</div>
</div>
</header>
<!-- Configuration Grid (Bento Style) -->
<section class="lg:col-span-7 space-y-8">
<!-- Silence Period Setting -->
<div class="bg-surface-container-low rounded-full p-10 relative overflow-hidden">
<div class="relative z-10">
<h2 class="text-xl font-bold font-headline text-primary mb-2 flex items-center gap-2">
<span class="material-symbols-outlined text-secondary">timer</span>
                        Inactivity Threshold
                    </h2>
<p class="text-on-surface-variant text-sm mb-8">The period of total silence before the verification sequence begins.</p>
<div class="grid grid-cols-4 gap-4">
<button class="flex flex-col items-center justify-center p-6 bg-surface-container-highest rounded-xl border-2 border-transparent hover:border-secondary transition-all group">
<span class="text-2xl font-black font-headline text-primary group-hover:text-secondary">7</span>
<span class="text-[10px] uppercase font-bold tracking-tighter text-on-surface-variant">Days</span>
</button>
<button class="flex flex-col items-center justify-center p-6 bg-secondary text-white rounded-xl shadow-lg scale-105 border-2 border-secondary">
<span class="text-2xl font-black font-headline">30</span>
<span class="text-[10px] uppercase font-bold tracking-tighter opacity-80">Days</span>
</button>
<button class="flex flex-col items-center justify-center p-6 bg-surface-container-highest rounded-xl border-2 border-transparent hover:border-secondary transition-all group">
<span class="text-2xl font-black font-headline text-primary group-hover:text-secondary">90</span>
<span class="text-[10px] uppercase font-bold tracking-tighter text-on-surface-variant">Days</span>
</button>
<button class="flex flex-col items-center justify-center p-6 bg-surface-container-highest rounded-xl border-2 border-transparent hover:border-secondary transition-all group">
<span class="text-2xl font-black font-headline text-primary group-hover:text-secondary">180</span>
<span class="text-[10px] uppercase font-bold tracking-tighter text-on-surface-variant">Days</span>
</button>
</div>
</div>
</div>
<!-- Check-in Channels -->
<div class="bg-surface-container-lowest rounded-full p-10 shadow-sm border border-surface-container">
<h2 class="text-xl font-bold font-headline text-primary mb-6 flex items-center gap-2">
<span class="material-symbols-outlined text-secondary">notification_add</span>
                    Verification Channels
                </h2>
<div class="space-y-6">
<div class="flex items-center justify-between p-4 bg-surface-container-low rounded-xl">
<div class="flex items-center gap-4">
<div class="w-12 h-12 flex items-center justify-center bg-white rounded-lg shadow-sm">
<span class="material-symbols-outlined text-primary">mail</span>
</div>
<div>
<p class="font-bold text-primary">Email Verification</p>
<p class="text-xs text-on-surface-variant">Sent to primary &amp; recovery address</p>
</div>
</div>
<div class="w-12 h-6 bg-secondary rounded-full relative">
<div class="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
</div>
</div>
<div class="flex items-center justify-between p-4 bg-surface-container-low rounded-xl">
<div class="flex items-center gap-4">
<div class="w-12 h-12 flex items-center justify-center bg-white rounded-lg shadow-sm">
<span class="material-symbols-outlined text-primary">sms</span>
</div>
<div>
<p class="font-bold text-primary">SMS &amp; WhatsApp</p>
<p class="text-xs text-on-surface-variant">+1 (555) ••• ••89</p>
</div>
</div>
<div class="w-12 h-6 bg-secondary rounded-full relative">
<div class="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
</div>
</div>
<div class="flex items-center justify-between p-4 bg-surface-container-low rounded-xl opacity-60">
<div class="flex items-center gap-4">
<div class="w-12 h-12 flex items-center justify-center bg-white rounded-lg shadow-sm">
<span class="material-symbols-outlined text-primary">notifications_active</span>
</div>
<div>
<p class="font-bold text-primary">App Push Notification</p>
<p class="text-xs text-on-surface-variant">Encrypted mobile ping</p>
</div>
</div>
<div class="w-12 h-6 bg-surface-container-highest rounded-full relative">
<div class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full"></div>
</div>
</div>
</div>
</div>
</section>
<!-- Escalation Timeline -->
<aside class="lg:col-span-5">
<div class="signature-gradient rounded-full p-10 text-white h-full shadow-2xl">
<h2 class="text-2xl font-black font-headline mb-2 tracking-tight">Escalation Protocol</h2>
<p class="text-slate-400 text-sm mb-12">Visual logic of the 30-day fail-safe trigger.</p>
<div class="relative">
<!-- Timeline Line -->
<div class="absolute left-6 top-0 bottom-0 w-0.5 bg-secondary/30"></div>
<div class="space-y-12">
<!-- Step 1 -->
<div class="relative pl-16">
<div class="absolute left-3.5 -translate-x-1/2 top-1 w-5 h-5 rounded-full bg-secondary ring-4 ring-secondary/20 z-10"></div>
<h3 class="font-bold text-lg mb-1">J+0: Verification Window Opens</h3>
<p class="text-slate-400 text-sm">A discreet notification is sent to your active devices. No one else is notified.</p>
</div>
<!-- Step 2 -->
<div class="relative pl-16">
<div class="absolute left-3.5 -translate-x-1/2 top-1 w-5 h-5 rounded-full bg-secondary/50 z-10"></div>
<h3 class="font-bold text-lg mb-1 text-slate-200">J+7: Secondary Reach-out</h3>
<p class="text-slate-400 text-sm">Alternative channels (SMS/Recovery Email) are utilized. Frequency increases to daily.</p>
</div>
<!-- Step 3 -->
<div class="relative pl-16">
<div class="absolute left-3.5 -translate-x-1/2 top-1 w-5 h-5 rounded-full bg-error/50 z-10"></div>
<h3 class="font-bold text-lg mb-1 text-error-container">J+25: Critical Alert</h3>
<p class="text-slate-400 text-sm font-medium">Final 120-hour countdown. This is the last chance to abort the automated protocol.</p>
</div>
<!-- Step 4 -->
<div class="relative pl-16">
<div class="absolute left-3.5 -translate-x-1/2 top-1 w-5 h-5 rounded-full bg-error ring-4 ring-error/30 z-10"></div>
<div class="bg-white/5 p-6 rounded-2xl border border-white/10 mt-4 backdrop-blur-md">
<h3 class="font-black text-xl mb-2 text-white">J+30: Protocol Triggered</h3>
<p class="text-slate-300 text-sm mb-4">The Vault decrypts. Access keys are released to your Trusted Contacts automatically.</p>
<div class="flex gap-2">
<span class="px-3 py-1 bg-secondary text-[10px] font-bold rounded-full uppercase tracking-tighter">Legal Legacy</span>
<span class="px-3 py-1 bg-secondary text-[10px] font-bold rounded-full uppercase tracking-tighter">Health Directives</span>
</div>
</div>
</div>
</div>
</div>
<div class="mt-12 p-6 bg-white/5 rounded-2xl border border-dashed border-white/20">
<div class="flex gap-4 items-start">
<span class="material-symbols-outlined text-secondary">shield</span>
<p class="text-xs text-slate-400 leading-relaxed italic">"Keeplas uses zero-knowledge encryption. Even our system administrators cannot abort a triggered protocol once the J+30 threshold is crossed without your master key."</p>
</div>
</div>
</div>
</aside>
<!-- Final Action Section -->
<div class="lg:col-span-12 mt-8 flex flex-col md:flex-row items-center justify-between bg-surface-container-high p-8 rounded-full">
<div class="flex items-center gap-6 mb-6 md:mb-0">
<div class="w-16 h-16 rounded-full overflow-hidden shadow-lg border-2 border-white">
<img alt="User" class="w-full h-full object-cover" data-alt="Close-up professional portrait of a calm man with silver hair in a dark suit, soft natural studio lighting, high-end editorial feel" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAF0jGnTkkIHPZHqrrnMMxs9qKzZc6qql78LAmQsU-FxX-ICHG9cTeZFjr1MtJvU8j3XThf70R5wtLDNSjTHYTBFf-4uRCZGmlPJmVMTidd7YK-blKNyRqAJDJJXSsoItvx9axnl5Hd8lbkzfA1ejQ0rj8nKaFj4Qxx1jlPJK20xhwg6CCy82zgN1phYB6Pchf0m7qZO-A2IJKEIjqkIqqHRa4Hfo0D-s6S6exm3FZFx_vxbmGRYyMMAv65siWVTBA0UXs5Fhp_CMQI"/>
</div>
<div>
<h4 class="font-headline font-black text-primary text-xl">Confirm Verification Profile</h4>
<p class="text-on-surface-variant text-sm">Settings will take effect across all linked vaults immediately.</p>
</div>
</div>
<div class="flex gap-4">
<button class="px-8 py-4 font-headline font-bold text-on-surface-variant hover:text-primary transition-colors">Reset to Default</button>
<button class="px-10 py-4 signature-gradient text-white font-headline font-extrabold rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all">Enable Life Check</button>
</div>
</div>
</main>
<!-- Footer -->
<footer class="w-full py-12 px-8 mt-auto bg-[#001a20] dark:bg-[#000000] border-t border-white/5">
<div class="max-w-screen-2xl mx-auto flex flex-col md:flex-row justify-between items-center">
<div class="font-inter text-xs uppercase tracking-widest text-slate-400 mb-6 md:mb-0">
                © 2024 Keeplas Life Continuity. Encrypted &amp; Secured.
            </div>
<div class="flex flex-wrap justify-center gap-8">
<a class="font-inter text-xs uppercase tracking-widest text-slate-500 hover:text-[#28657a] transition-colors" href="#">Privacy Vault</a>
<a class="font-inter text-xs uppercase tracking-widest text-slate-500 hover:text-[#28657a] transition-colors" href="#">Security Protocol</a>
<a class="font-inter text-xs uppercase tracking-widest text-slate-500 hover:text-[#28657a] transition-colors" href="#">Terms of Legacy</a>
<a class="font-inter text-xs uppercase tracking-widest text-slate-500 hover:text-[#28657a] transition-colors" href="#">Contact Concierge</a>
</div>
</div>
</footer>
</body></html>

<!-- Scenario Engine -->
<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Scenario Engine | Keeplas</title>
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
      }
      body { font-family: 'Inter', sans-serif; }
      h1, h2, h3 { font-family: 'Manrope', sans-serif; }
      .glass-effect { backdrop-filter: blur(20px); }
    </style>
</head>
<body class="bg-surface text-on-surface min-h-screen flex flex-col">
<!-- TopAppBar -->
<header class="bg-[#041632]/80 backdrop-blur-xl dark:bg-[#041632]/90 docked full-width top-0 z-50 shadow-2xl shadow-[#1b1c1c]/10">
<div class="flex justify-between items-center w-full px-8 py-4 max-w-screen-2xl mx-auto">
<div class="text-2xl font-extrabold tracking-tighter text-white font-headline">Keeplas</div>
<nav class="hidden md:flex items-center space-x-8 font-manrope font-bold tracking-tight">
<a class="text-slate-400 hover:text-white transition-colors" href="#">Vault</a>
<a class="text-[#b9eaff] border-b-2 border-[#28657a] pb-1" href="#">Life Check</a>
<a class="text-slate-400 hover:text-white transition-colors" href="#">Emergency Card</a>
<a class="text-slate-400 hover:text-white transition-colors" href="#">Trusted Contacts</a>
</nav>
<div class="flex items-center space-x-6 text-[#b9eaff]">
<button class="hover:bg-[#1b2b48]/50 rounded-lg transition-all p-2 scale-95 active:scale-90 duration-200">
<span class="material-symbols-outlined" data-icon="verified_user">verified_user</span>
</button>
<button class="hover:bg-[#1b2b48]/50 rounded-lg transition-all p-2 scale-95 active:scale-90 duration-200">
<span class="material-symbols-outlined" data-icon="notifications">notifications</span>
</button>
<button class="hover:bg-[#1b2b48]/50 rounded-lg transition-all p-2 scale-95 active:scale-90 duration-200">
<span class="material-symbols-outlined" data-icon="account_circle">account_circle</span>
</button>
</div>
</div>
</header>
<div class="flex flex-1 pt-16">
<!-- SideNavBar -->
<aside class="h-full w-72 fixed left-0 top-16 bg-[#f6f3f2] dark:bg-[#001a20] flex flex-col p-6 space-y-8 z-40">
<div class="space-y-2">
<div class="flex items-center space-x-3">
<div class="w-10 h-10 rounded-full bg-surface-container-highest overflow-hidden">
<img alt="User Profile" data-alt="close-up portrait of a professional man with a neutral expression against a soft gray background" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAeYkWVtWRffxoyBjh3-n7yE_Wb2jzAnzbijSVO9OUGUpJ5eBkVoFY-dNNM9vuyt4yC_4TegVx6fckwIYWL6JLTXJlarZ8YEuJRR2n8V3C7jpzfphLgRyWIkwNez0JuBwLafPLMIbFWuPCD3sKgCck_91zOf2wdpzFsUL_LWsPL9IUsHc2is5Fe0HOStlpOQLdjuqLeFcLws4lkTE3cnhdPRMVqNwUeYh4GlNMSQlWRJ9tfNvL2OP_eyaGrIsS2FtdMpw_edN4J5tXQ"/>
</div>
<div>
<div class="font-manrope font-black text-[#041632] text-lg">The Vault</div>
<div class="text-[10px] uppercase tracking-widest text-[#28657a]/70 font-bold">Security Level: Maximum</div>
</div>
</div>
</div>
<nav class="space-y-2">
<a class="flex items-center space-x-3 px-4 py-3 text-[#28657a]/70 hover:bg-[#e5e2e1] transition-transform hover:translate-x-1 rounded-xl font-inter text-sm font-medium uppercase tracking-widest" href="#">
<span class="material-symbols-outlined" data-icon="dashboard">dashboard</span>
<span>Dashboard</span>
</a>
<a class="flex items-center space-x-3 px-4 py-3 bg-[#28657a] text-white rounded-xl shadow-lg transition-transform hover:translate-x-1 font-inter text-sm font-medium uppercase tracking-widest" href="#">
<span class="material-symbols-outlined" data-icon="lock" style="font-variation-settings: 'FILL' 1;">lock</span>
<span>Digital Vault</span>
</a>
<a class="flex items-center space-x-3 px-4 py-3 text-[#28657a]/70 hover:bg-[#e5e2e1] transition-transform hover:translate-x-1 rounded-xl font-inter text-sm font-medium uppercase tracking-widest" href="#">
<span class="material-symbols-outlined" data-icon="medical_services">medical_services</span>
<span>Health Directives</span>
</a>
<a class="flex items-center space-x-3 px-4 py-3 text-[#28657a]/70 hover:bg-[#e5e2e1] transition-transform hover:translate-x-1 rounded-xl font-inter text-sm font-medium uppercase tracking-widest" href="#">
<span class="material-symbols-outlined" data-icon="gavel">gavel</span>
<span>Legal Legacy</span>
</a>
<a class="flex items-center space-x-3 px-4 py-3 text-[#28657a]/70 hover:bg-[#e5e2e1] transition-transform hover:translate-x-1 rounded-xl font-inter text-sm font-medium uppercase tracking-widest" href="#">
<span class="material-symbols-outlined" data-icon="shield">shield</span>
<span>Security Center</span>
</a>
</nav>
<div class="pt-8">
<button class="w-full bg-primary text-white py-4 rounded-xl font-bold tracking-tight hover:bg-primary-container transition-all scale-95 active:scale-90">
                    Emergency Access
                </button>
</div>
</aside>
<!-- Main Content -->
<main class="ml-72 flex-1 p-12 bg-surface">
<div class="max-w-5xl mx-auto">
<!-- Header Section -->
<div class="flex justify-between items-end mb-16">
<div class="space-y-4">
<span class="inline-block px-3 py-1 bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase tracking-widest rounded-full">Protocol Configuration</span>
<h1 class="text-5xl font-extrabold tracking-tighter text-primary">Scenario Engine</h1>
<p class="text-on-surface-variant max-w-xl body-lg leading-relaxed">
                            Configure autonomous actions triggered by a Life Check failure. These events will only execute if the inactivity window is breached without a manual override.
                        </p>
</div>
<!-- Safe Pause Toggle -->
<div class="bg-surface-container-low p-6 rounded-full flex items-center space-x-6 border border-outline-variant/15">
<div class="text-right">
<div class="text-[10px] font-bold uppercase tracking-widest text-secondary">Safe Pause</div>
<div class="text-xs text-on-surface-variant">Active for Travel</div>
</div>
<button class="relative inline-flex h-8 w-14 items-center rounded-full bg-secondary">
<span class="sr-only">Toggle Travel Mode</span>
<span class="inline-block h-6 w-6 translate-x-7 transform rounded-full bg-white transition duration-200"></span>
</button>
</div>
</div>
<!-- Scenario Timeline / Bento Grid -->
<div class="grid grid-cols-12 gap-8">
<!-- Timeline Control -->
<div class="col-span-12 lg:col-span-8 space-y-8">
<div class="bg-surface-container-lowest p-10 rounded-full shadow-2xl shadow-primary/5 relative overflow-hidden">
<div class="absolute top-0 right-0 p-8 opacity-10">
<span class="material-symbols-outlined text-8xl" data-icon="history_toggle_off">history_toggle_off</span>
</div>
<h2 class="text-2xl font-bold text-primary mb-10 flex items-center">
<span class="material-symbols-outlined mr-3 text-secondary" data-icon="account_tree">account_tree</span>
                                Triggered Event Chain
                            </h2>
<div class="relative pl-8 border-l-2 border-secondary/20 space-y-12">
<!-- Step 1 -->
<div class="relative">
<div class="absolute -left-[41px] top-0 w-4 h-4 rounded-full bg-secondary border-4 border-surface-container-lowest"></div>
<div class="flex justify-between items-start">
<div>
<div class="text-sm font-bold text-secondary uppercase tracking-tighter mb-1">T+ 7 Days Inactivity</div>
<h3 class="text-xl font-bold text-primary">Primary Outreach Phase</h3>
<div class="mt-4 flex flex-wrap gap-3">
<div class="bg-surface-container px-4 py-2 rounded-xl flex items-center space-x-3 text-sm font-medium">
<span class="material-symbols-outlined text-secondary" data-icon="mail">mail</span>
<span>Send message to Sarah Mitchell</span>
</div>
<div class="bg-surface-container px-4 py-2 rounded-xl flex items-center space-x-3 text-sm font-medium">
<span class="material-symbols-outlined text-secondary" data-icon="sms">sms</span>
<span>SMS Alert to Marcus V.</span>
</div>
</div>
</div>
<button class="text-on-surface-variant hover:text-primary"><span class="material-symbols-outlined" data-icon="edit">edit</span></button>
</div>
</div>
<!-- Step 2 -->
<div class="relative">
<div class="absolute -left-[41px] top-0 w-4 h-4 rounded-full bg-secondary/50 border-4 border-surface-container-lowest"></div>
<div class="flex justify-between items-start">
<div>
<div class="text-sm font-bold text-secondary/70 uppercase tracking-tighter mb-1">T+ 30 Days Inactivity</div>
<h3 class="text-xl font-bold text-primary">Asset Transfer Phase</h3>
<div class="mt-4 flex flex-wrap gap-3">
<div class="bg-primary-container text-white px-4 py-2 rounded-xl flex items-center space-x-3 text-sm font-medium">
<span class="material-symbols-outlined" data-icon="key" style="font-variation-settings: 'FILL' 1;">key</span>
<span>Grant Marcus access to 'Digital Assets'</span>
</div>
<div class="bg-surface-container px-4 py-2 rounded-xl flex items-center space-x-3 text-sm font-medium">
<span class="material-symbols-outlined text-secondary" data-icon="encrypted">encrypted</span>
<span>Unlock 'Personal Correspondence' Vault</span>
</div>
</div>
</div>
<button class="text-on-surface-variant hover:text-primary"><span class="material-symbols-outlined" data-icon="edit">edit</span></button>
</div>
</div>
<!-- Step 3 -->
<div class="relative">
<div class="absolute -left-[41px] top-0 w-4 h-4 rounded-full bg-error border-4 border-surface-container-lowest"></div>
<div class="flex justify-between items-start">
<div>
<div class="text-sm font-bold text-error uppercase tracking-tighter mb-1">T+ 60 Days Inactivity</div>
<h3 class="text-xl font-bold text-primary">Legacy Legal Protocol</h3>
<p class="text-sm text-on-surface-variant mt-2">Final verification check initiated by third-party legal counsel.</p>
<div class="mt-4 flex flex-wrap gap-3">
<div class="bg-surface-container px-4 py-2 rounded-xl flex items-center space-x-3 text-sm font-medium">
<span class="material-symbols-outlined text-secondary" data-icon="gavel">gavel</span>
<span>Alert Legal Legacy (Goldstein LLP)</span>
</div>
</div>
</div>
<button class="text-on-surface-variant hover:text-primary"><span class="material-symbols-outlined" data-icon="edit">edit</span></button>
</div>
</div>
</div>
<div class="mt-12 pt-10 border-t border-outline-variant/15">
<button class="flex items-center space-x-2 text-secondary font-bold hover:translate-x-1 transition-transform">
<span class="material-symbols-outlined" data-icon="add_circle">add_circle</span>
<span>Add Trigger Milestone</span>
</button>
</div>
</div>
</div>
<!-- Right Column: Status & Quick Actions -->
<div class="col-span-12 lg:col-span-4 space-y-8">
<!-- Status Card -->
<div class="bg-primary text-white p-8 rounded-full shadow-2xl relative overflow-hidden">
<div class="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
<div class="text-[10px] font-bold uppercase tracking-[0.2em] text-on-primary-container mb-6">Engine Status</div>
<div class="flex items-center space-x-4 mb-4">
<div class="w-3 h-3 bg-secondary-fixed rounded-full animate-pulse"></div>
<span class="text-2xl font-headline font-bold">Armed &amp; Ready</span>
</div>
<p class="text-xs text-on-primary-container leading-relaxed">
                                System monitored. Last life check: 4 hours ago. All scenarios synchronized with the main vault.
                            </p>
</div>
<!-- Granular Actions -->
<div class="bg-surface-container-low p-8 rounded-full">
<h3 class="font-manrope font-bold text-primary mb-6 flex items-center">
<span class="material-symbols-outlined mr-2 text-secondary" data-icon="settings_suggest">settings_suggest</span>
                                Action Library
                            </h3>
<div class="space-y-4">
<div class="bg-white p-4 rounded-xl flex items-center justify-between group cursor-pointer hover:bg-secondary/5 transition-colors">
<div class="flex items-center space-x-3">
<div class="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center">
<span class="material-symbols-outlined text-secondary text-sm" data-icon="chat_bubble">chat_bubble</span>
</div>
<span class="text-xs font-bold text-primary">Send Message</span>
</div>
<span class="material-symbols-outlined text-xs text-on-surface-variant group-hover:translate-x-1 transition-transform" data-icon="arrow_forward_ios">arrow_forward_ios</span>
</div>
<div class="bg-white p-4 rounded-xl flex items-center justify-between group cursor-pointer hover:bg-secondary/5 transition-colors">
<div class="flex items-center space-x-3">
<div class="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center">
<span class="material-symbols-outlined text-secondary text-sm" data-icon="share">share</span>
</div>
<span class="text-xs font-bold text-primary">Grant Access</span>
</div>
<span class="material-symbols-outlined text-xs text-on-surface-variant group-hover:translate-x-1 transition-transform" data-icon="arrow_forward_ios">arrow_forward_ios</span>
</div>
<div class="bg-white p-4 rounded-xl flex items-center justify-between group cursor-pointer hover:bg-secondary/5 transition-colors">
<div class="flex items-center space-x-3">
<div class="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center">
<span class="material-symbols-outlined text-secondary text-sm" data-icon="notifications_active">notifications_active</span>
</div>
<span class="text-xs font-bold text-primary">Alert Authority</span>
</div>
<span class="material-symbols-outlined text-xs text-on-surface-variant group-hover:translate-x-1 transition-transform" data-icon="arrow_forward_ios">arrow_forward_ios</span>
</div>
<div class="bg-white p-4 rounded-xl flex items-center justify-between group cursor-pointer hover:bg-secondary/5 transition-colors">
<div class="flex items-center space-x-3">
<div class="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center">
<span class="material-symbols-outlined text-secondary text-sm" data-icon="cloud_off">cloud_off</span>
</div>
<span class="text-xs font-bold text-primary">Account Wipe</span>
</div>
<span class="material-symbols-outlined text-xs text-on-surface-variant group-hover:translate-x-1 transition-transform" data-icon="arrow_forward_ios">arrow_forward_ios</span>
</div>
</div>
</div>
<!-- Technical Card -->
<div class="bg-surface-container-highest p-8 rounded-full border border-outline-variant/10">
<div class="flex items-center justify-between mb-4">
<span class="text-[10px] font-bold text-secondary uppercase tracking-widest">Fail-Safe Log</span>
<span class="material-symbols-outlined text-on-surface-variant text-sm" data-icon="info">info</span>
</div>
<div class="space-y-3 text-[10px] font-mono text-on-surface-variant">
<div class="flex justify-between border-b border-outline-variant/10 pb-2">
<span>Latent Integrity:</span>
<span class="text-primary font-bold">100% Verified</span>
</div>
<div class="flex justify-between border-b border-outline-variant/10 pb-2">
<span>Sync Hash:</span>
<span class="text-primary font-bold">0x8B...F32A</span>
</div>
<div class="flex justify-between">
<span>Trigger Protocol:</span>
<span class="text-primary font-bold">AES-256-GCM</span>
</div>
</div>
</div>
</div>
</div>
</div>
</main>
</div>
<!-- Footer -->
<footer class="w-full py-12 px-8 mt-auto bg-[#001a20] dark:bg-[#000000] border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-slate-400 font-inter text-xs uppercase tracking-widest">
<div class="mb-4 md:mb-0">© 2024 Keeplas Life Continuity. Encrypted &amp; Secured.</div>
<div class="flex space-x-8">
<a class="text-slate-500 hover:text-[#28657a] transition-colors" href="#">Privacy Vault</a>
<a class="text-slate-500 hover:text-[#28657a] transition-colors" href="#">Security Protocol</a>
<a class="text-slate-500 hover:text-[#28657a] transition-colors" href="#">Terms of Legacy</a>
<a class="text-slate-500 hover:text-[#28657a] transition-colors" href="#">Contact Concierge</a>
</div>
</footer>
</body></html>

<!-- Security & Recovery Center -->
<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&amp;family=Inter:wght@400;500;600&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
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
      }
      .glass-effect {
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
      }
      .signature-gradient {
        background: linear-gradient(135deg, #041632 0%, #1b2b48 100%);
      }
    </style>
</head>
<body class="bg-background font-body text-on-background min-h-screen flex flex-col">
<!-- TopAppBar -->
<header class="bg-[#041632]/80 backdrop-blur-xl dark:bg-[#041632]/90 docked full-width top-0 z-50 shadow-2xl shadow-[#1b1c1c]/10">
<div class="flex justify-between items-center w-full px-8 py-4 max-w-screen-2xl mx-auto">
<div class="text-2xl font-extrabold tracking-tighter text-white font-headline">Keeplas</div>
<nav class="hidden md:flex items-center space-x-8">
<a class="text-slate-400 hover:text-white transition-colors font-headline font-bold tracking-tight" href="#">Vault</a>
<a class="text-slate-400 hover:text-white transition-colors font-headline font-bold tracking-tight" href="#">Life Check</a>
<a class="text-slate-400 hover:text-white transition-colors font-headline font-bold tracking-tight" href="#">Emergency Card</a>
<a class="text-slate-400 hover:text-white transition-colors font-headline font-bold tracking-tight" href="#">Trusted Contacts</a>
</nav>
<div class="flex items-center space-x-4">
<button class="material-symbols-outlined text-white hover:bg-[#1b2b48]/50 rounded-lg transition-all p-2 scale-95 active:scale-90 duration-200" data-icon="verified_user">verified_user</button>
<button class="material-symbols-outlined text-white hover:bg-[#1b2b48]/50 rounded-lg transition-all p-2 scale-95 active:scale-90 duration-200" data-icon="notifications">notifications</button>
<button class="material-symbols-outlined text-white hover:bg-[#1b2b48]/50 rounded-lg transition-all p-2 scale-95 active:scale-90 duration-200" data-icon="account_circle">account_circle</button>
</div>
</div>
</header>
<div class="flex flex-1 pt-16">
<!-- SideNavBar -->
<aside class="hidden lg:flex flex-col h-[calc(100vh-4rem)] w-72 fixed left-0 top-16 bg-[#f6f3f2] dark:bg-[#001a20] p-6 space-y-8 z-40">
<div class="space-y-2">
<div class="font-manrope font-black text-[#041632] text-xl">The Vault</div>
<div class="text-[#28657a]/70 text-xs uppercase tracking-widest font-medium">Security Level: Maximum</div>
</div>
<nav class="flex flex-col space-y-2 flex-1">
<a class="flex items-center space-x-3 p-3 text-[#28657a]/70 hover:bg-[#e5e2e1] hover:translate-x-1 transition-transform font-inter text-sm font-medium uppercase tracking-widest" href="#">
<span class="material-symbols-outlined" data-icon="dashboard">dashboard</span>
<span>Dashboard</span>
</a>
<a class="flex items-center space-x-3 p-3 text-[#28657a]/70 hover:bg-[#e5e2e1] hover:translate-x-1 transition-transform font-inter text-sm font-medium uppercase tracking-widest" href="#">
<span class="material-symbols-outlined" data-icon="lock">lock</span>
<span>Digital Vault</span>
</a>
<a class="flex items-center space-x-3 p-3 text-[#28657a]/70 hover:bg-[#e5e2e1] hover:translate-x-1 transition-transform font-inter text-sm font-medium uppercase tracking-widest" href="#">
<span class="material-symbols-outlined" data-icon="medical_services">medical_services</span>
<span>Health Directives</span>
</a>
<a class="flex items-center space-x-3 p-3 text-[#28657a]/70 hover:bg-[#e5e2e1] hover:translate-x-1 transition-transform font-inter text-sm font-medium uppercase tracking-widest" href="#">
<span class="material-symbols-outlined" data-icon="gavel">gavel</span>
<span>Legal Legacy</span>
</a>
<a class="bg-[#28657a] text-white rounded-xl shadow-lg flex items-center space-x-3 p-3 font-inter text-sm font-medium uppercase tracking-widest" href="#">
<span class="material-symbols-outlined" data-icon="shield" style="font-variation-settings: 'FILL' 1;">shield</span>
<span>Security Center</span>
</a>
</nav>
<button class="signature-gradient text-white py-4 px-6 rounded-xl font-bold text-sm uppercase tracking-widest hover:shadow-xl transition-all active:scale-95">
                Emergency Access
            </button>
</aside>
<!-- Main Content Canvas -->
<main class="flex-1 lg:ml-72 p-8 md:p-12 max-w-7xl mx-auto w-full">
<!-- Header Section -->
<section class="mb-12">
<h1 class="text-display-md md:text-display-lg font-headline font-extrabold text-primary tracking-tight leading-none mb-4">Security Center</h1>
<p class="text-body-lg text-on-surface-variant max-w-2xl">
                    Manage your life continuity protocols. From decentralized recovery kits to biometric locks, ensure your legacy remains protected and accessible only to those you trust.
                </p>
</section>
<!-- Bento Grid Layout -->
<div class="grid grid-cols-1 md:grid-cols-12 gap-8">
<!-- Social Recovery Status (Large Card) -->
<div class="md:col-span-8 bg-surface-container-low p-8 rounded-full border-none flex flex-col justify-between">
<div>
<div class="flex justify-between items-start mb-8">
<div>
<h2 class="text-headline-lg font-headline font-bold text-primary mb-2">Social Recovery</h2>
<p class="text-label-md uppercase tracking-widest text-secondary font-semibold">Status: Active &amp; Secure</p>
</div>
<div class="bg-secondary-container text-on-secondary-container px-4 py-2 rounded-full font-bold text-sm">
                                3 of 5 Guardians Verified
                            </div>
</div>
<div class="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-10">
<!-- Guardian Avatars -->
<div class="flex flex-col items-center space-y-3">
<div class="w-16 h-16 rounded-full bg-primary flex items-center justify-center border-4 border-secondary-fixed">
<img class="w-full h-full rounded-full object-cover" data-alt="portrait of a middle-aged man with kind eyes and short grey hair, professional headshot style" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAHhmpE9PcHBWSjsZ1mJHeXJJsd8MDmzA3F8WG7QeJ9fwPRvLo4sRvW9lUbxURcFB5Jjt0sytuRr2aZL4MCohgiJ5XxzaBEmXIyUx3Iklf4lHSFYRxRRvHsaoJajNbQRKB3unXFmRtBOgRTZzOAHJ4M0IrpVGXvn3GdhvQlTziqiRodVDLcg7o3j1ihPLnr_s3Zs208_HsXKAvDGuG0P7m-lG4YRCcmfMzLfaQxk-4UKjnn-tJOsS8nb77D8cgUZtaQ7GEGWqd_6bRy"/>
</div>
<span class="text-xs font-bold text-primary">Marcus V.</span>
</div>
<div class="flex flex-col items-center space-y-3">
<div class="w-16 h-16 rounded-full bg-primary flex items-center justify-center border-4 border-secondary-fixed">
<img class="w-full h-full rounded-full object-cover" data-alt="professional woman in her 30s with long brown hair, soft studio lighting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuADq6DFhj8_VNxQA0QU_pJ1foI64Vn93oiCQGQSjTcSXbeePbv15KH6u3VTSfu_RNVk5c8Ooe9AgjCDRuiJBE3u6y_EtE8_piTT1E_MFjHXNF_k1qHSa2dlETx_HOUok46kUqj6yQ5OreWZ68wO3Gql_NQN6IXDbUFGRlt8yej3AX0ikPHaOS3MKyFTdWpArtKeI49lB9Bs21tYqd1tOoPDmGKtPTzYrmpAVM7V0A02dsHlj874L4rSS7EJUaHK1OGMmUMJ-RS_SfsK"/>
</div>
<span class="text-xs font-bold text-primary">Elena S.</span>
</div>
<div class="flex flex-col items-center space-y-3">
<div class="w-16 h-16 rounded-full bg-primary flex items-center justify-center border-4 border-secondary-fixed">
<img class="w-full h-full rounded-full object-cover" data-alt="young man with glasses and creative aesthetic, warm natural light" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB2GtlmUuItUBA1WYxJgiWmDGkOCo95bOZyqRzfna5sMoQkGYrtWXWqTgwLdtGBKzZa_-SBrZkwFVMZi5UAWxrwtRa3ud9FsfYOMW2gz4_94RHxeHhngIn3EI4M4qDDYVI6ejmBwZLS1pVedb_x7hq0KvmbnnPdGvEOfSuX4QX0FlBSdb7oYxrkhCHsiORM69OarapgtLQBp6ymqZF1Whw1UnDS4XtO61dRZLisvaRcqZaWKKvtxax0VG2jGjOF7nbboMnFaAJ3hrpx"/>
</div>
<span class="text-xs font-bold text-primary">Julian K.</span>
</div>
<div class="flex flex-col items-center space-y-3 opacity-40 grayscale">
<div class="w-16 h-16 rounded-full bg-surface-dim flex items-center justify-center border-4 border-outline-variant">
<span class="material-symbols-outlined text-outline" data-icon="person">person</span>
</div>
<span class="text-xs font-bold text-outline">Pending...</span>
</div>
<div class="flex flex-col items-center space-y-3 opacity-40 grayscale">
<div class="w-16 h-16 rounded-full bg-surface-dim flex items-center justify-center border-4 border-outline-variant">
<span class="material-symbols-outlined text-outline" data-icon="person">person</span>
</div>
<span class="text-xs font-bold text-outline">Pending...</span>
</div>
</div>
</div>
<div class="flex flex-col sm:flex-row gap-4">
<button class="bg-surface-container-highest hover:bg-surface-variant text-primary px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center space-x-2">
<span class="material-symbols-outlined text-sm" data-icon="mail">mail</span>
<span>Resend Invites</span>
</button>
<button class="text-secondary hover:underline px-6 py-3 font-bold text-sm transition-all">
                            Manage Guardian Rules
                        </button>
</div>
</div>
<!-- Recovery Kit (Legacy Card) -->
<div class="md:col-span-4 bg-primary-container text-on-primary-container p-8 rounded-full flex flex-col justify-between">
<div>
<span class="material-symbols-outlined text-4xl mb-6 text-secondary-fixed" data-icon="description" style="font-variation-settings: 'FILL' 1;">description</span>
<h2 class="text-headline-lg font-headline font-bold text-white mb-4">Recovery Kit</h2>
<p class="text-body-lg text-slate-300 mb-8 leading-relaxed">
                            Generate a physical, offline recovery sheet containing encrypted metadata shards for your vault.
                        </p>
</div>
<button class="signature-gradient text-white w-full py-4 rounded-xl font-bold flex items-center justify-center space-x-3 shadow-lg hover:shadow-primary/20 transition-all active:scale-95">
<span class="material-symbols-outlined" data-icon="print">print</span>
<span>Print Physical Kit</span>
</button>
</div>
<!-- Master Password Shards (Shamir's Logic) -->
<div class="md:col-span-7 bg-surface-container p-8 rounded-full">
<div class="flex items-center space-x-4 mb-6">
<span class="material-symbols-outlined text-secondary" data-icon="hub">hub</span>
<h2 class="text-headline-lg font-headline font-bold text-primary">Master Recovery</h2>
</div>
<p class="text-body-lg text-on-surface-variant mb-8">
                        Your master key is split into <strong class="text-primary">7 cryptographic shards</strong> using Shamir's Secret Sharing. You need <strong class="text-primary">4 shards</strong> to reconstruct the vault.
                    </p>
<div class="space-y-4">
<div class="flex items-center justify-between p-4 bg-surface-container-low rounded-xl">
<div class="flex items-center space-x-4">
<div class="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
<span class="material-symbols-outlined" data-icon="key">key</span>
</div>
<div>
<p class="text-sm font-bold text-primary">Digital Shard #1</p>
<p class="text-xs text-on-surface-variant">Stored on Personal Device</p>
</div>
</div>
<span class="text-secondary-fixed-dim material-symbols-outlined" data-icon="check_circle" style="font-variation-settings: 'FILL' 1;">check_circle</span>
</div>
<div class="flex items-center justify-between p-4 bg-surface-container-low rounded-xl">
<div class="flex items-center space-x-4">
<div class="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
<span class="material-symbols-outlined" data-icon="cloud">cloud</span>
</div>
<div>
<p class="text-sm font-bold text-primary">Cloud Shard #2</p>
<p class="text-xs text-on-surface-variant">Encrypted in Trusted Cloud</p>
</div>
</div>
<span class="text-secondary-fixed-dim material-symbols-outlined" data-icon="check_circle" style="font-variation-settings: 'FILL' 1;">check_circle</span>
</div>
<button class="w-full p-4 border-2 border-dashed border-outline-variant rounded-xl flex items-center justify-center space-x-2 text-on-surface-variant hover:bg-surface-container-low transition-colors">
<span class="material-symbols-outlined" data-icon="add">add</span>
<span class="text-sm font-bold">Configure Additional Shard</span>
</button>
</div>
</div>
<!-- Biometrics (Control Card) -->
<div class="md:col-span-5 bg-surface-container-highest p-8 rounded-full flex flex-col space-y-8">
<h2 class="text-headline-lg font-headline font-bold text-primary">Biometrics</h2>
<div class="space-y-6">
<div class="flex items-center justify-between">
<div class="flex items-center space-x-4">
<span class="material-symbols-outlined text-primary text-3xl" data-icon="face">face</span>
<div>
<p class="font-bold text-primary">FaceID Access</p>
<p class="text-xs text-on-surface-variant">Fast unlocking on mobile</p>
</div>
</div>
<div class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-secondary transition-colors duration-200 ease-in-out focus:outline-none">
<span class="translate-x-5 pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
</div>
</div>
<div class="flex items-center justify-between">
<div class="flex items-center space-x-4">
<span class="material-symbols-outlined text-primary text-3xl" data-icon="fingerprint">fingerprint</span>
<div>
<p class="font-bold text-primary">TouchID Access</p>
<p class="text-xs text-on-surface-variant">Biometric fingerprint auth</p>
</div>
</div>
<div class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-outline-variant transition-colors duration-200 ease-in-out focus:outline-none">
<span class="translate-x-0 pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
</div>
</div>
</div>
<div class="mt-auto pt-6 border-t border-white/20">
<div class="flex items-start space-x-3 text-on-error-container bg-error-container/30 p-4 rounded-xl">
<span class="material-symbols-outlined text-error" data-icon="warning">warning</span>
<p class="text-xs leading-relaxed">
                                Biometrics are convenient but should never be your <strong>only</strong> recovery method. Ensure your physical kit is printed.
                            </p>
</div>
</div>
</div>
</div>
</main>
</div>
<!-- Footer -->
<footer class="bg-[#001a20] dark:bg-[#000000] w-full py-12 px-8 mt-auto flex flex-col md:flex-row justify-between items-center border-t border-white/5">
<div class="font-inter text-xs uppercase tracking-widest text-slate-400 mb-6 md:mb-0">
            © 2024 Keeplas Life Continuity. Encrypted &amp; Secured.
        </div>
<div class="flex flex-wrap justify-center gap-8">
<a class="font-inter text-xs uppercase tracking-widest text-slate-500 hover:text-[#28657a] transition-colors" href="#">Privacy Vault</a>
<a class="font-inter text-xs uppercase tracking-widest text-slate-500 hover:text-[#28657a] transition-colors" href="#">Security Protocol</a>
<a class="font-inter text-xs uppercase tracking-widest text-slate-500 hover:text-[#28657a] transition-colors" href="#">Terms of Legacy</a>
<a class="font-inter text-xs uppercase tracking-widest text-slate-500 hover:text-[#28657a] transition-colors" href="#">Contact Concierge</a>
</div>
</footer>
</body></html>

<!-- Business Continuity -->
<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&amp;family=Inter:wght@400;500;600&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
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
        }
        body { font-family: 'Inter', sans-serif; }
        h1, h2, h3 { font-family: 'Manrope', sans-serif; }
    </style>
</head>
<body class="bg-background text-on-background min-h-screen flex flex-col">
<!-- TopAppBar -->
<header class="bg-[#041632]/80 backdrop-blur-xl fixed top-0 z-50 w-full shadow-2xl shadow-[#1b1c1c]/10">
<nav class="flex justify-between items-center w-full px-8 py-4 max-w-screen-2xl mx-auto">
<div class="text-2xl font-extrabold tracking-tighter text-white font-headline">Keeplas</div>
<div class="hidden md:flex space-x-8 font-headline font-bold tracking-tight">
<a class="text-slate-400 hover:text-white transition-colors" href="#">Vault</a>
<a class="text-slate-400 hover:text-white transition-colors" href="#">Life Check</a>
<a class="text-slate-400 hover:text-white transition-colors" href="#">Emergency Card</a>
<a class="text-slate-400 hover:text-white transition-colors" href="#">Trusted Contacts</a>
</div>
<div class="flex items-center space-x-6 text-[#b9eaff]">
<span class="material-symbols-outlined hover:bg-[#1b2b48]/50 rounded-lg transition-all p-2 cursor-pointer scale-95 active:scale-90 duration-200">verified_user</span>
<span class="material-symbols-outlined hover:bg-[#1b2b48]/50 rounded-lg transition-all p-2 cursor-pointer scale-95 active:scale-90 duration-200">notifications</span>
<span class="material-symbols-outlined hover:bg-[#1b2b48]/50 rounded-lg transition-all p-2 cursor-pointer scale-95 active:scale-90 duration-200">account_circle</span>
</div>
</nav>
</header>
<div class="flex pt-20 h-full">
<!-- SideNavBar -->
<aside class="hidden md:flex flex-col h-screen w-72 fixed left-0 top-0 pt-20 bg-[#f6f3f2] space-y-8 p-6 z-40">
<div class="mb-6">
<h2 class="font-headline font-black text-[#041632] text-xl">The Vault</h2>
<p class="font-inter text-[10px] font-medium uppercase tracking-[0.2em] text-[#041632]/60 mt-1">Security Level: Maximum</p>
</div>
<nav class="flex-1 space-y-2">
<a class="flex items-center px-4 py-3 text-[#28657a]/70 hover:bg-[#e5e2e1] hover:translate-x-1 transition-transform font-inter text-sm font-medium uppercase tracking-widest" href="#">
<span class="material-symbols-outlined mr-4">dashboard</span> Dashboard
                </a>
<a class="flex items-center px-4 py-3 text-[#28657a]/70 hover:bg-[#e5e2e1] hover:translate-x-1 transition-transform font-inter text-sm font-medium uppercase tracking-widest" href="#">
<span class="material-symbols-outlined mr-4">lock</span> Digital Vault
                </a>
<a class="flex items-center px-4 py-3 text-[#28657a]/70 hover:bg-[#e5e2e1] hover:translate-x-1 transition-transform font-inter text-sm font-medium uppercase tracking-widest" href="#">
<span class="material-symbols-outlined mr-4">medical_services</span> Health Directives
                </a>
<a class="flex items-center px-4 py-3 bg-[#28657a] text-white rounded-xl shadow-lg hover:translate-x-1 transition-transform font-inter text-sm font-medium uppercase tracking-widest" href="#">
<span class="material-symbols-outlined mr-4">gavel</span> Legal Legacy
                </a>
<a class="flex items-center px-4 py-3 text-[#28657a]/70 hover:bg-[#e5e2e1] hover:translate-x-1 transition-transform font-inter text-sm font-medium uppercase tracking-widest" href="#">
<span class="material-symbols-outlined mr-4">shield</span> Security Center
                </a>
</nav>
<div class="mt-auto">
<button class="w-full bg-primary text-white py-4 rounded-xl font-headline font-bold text-sm tracking-tight flex items-center justify-center space-x-2 shadow-xl active:scale-95 transition-all">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">bolt</span>
<span>Emergency Access</span>
</button>
</div>
</aside>
<!-- Main Content Canvas -->
<main class="flex-1 md:ml-72 p-8 lg:p-12 max-w-7xl mx-auto w-full">
<!-- Hero / Header Section -->
<section class="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-8">
<div class="max-w-2xl">
<span class="text-secondary font-headline font-bold tracking-[0.2em] uppercase text-xs mb-4 block">Entrepreneur Portal</span>
<h1 class="text-primary text-5xl md:text-6xl font-headline font-extrabold tracking-tighter leading-tight mb-6">
                        Business Continuity &amp; Professional Legacy
                    </h1>
<p class="text-on-surface-variant text-lg font-body leading-relaxed">
                        Secure the operational integrity of your ventures. Ensure that your partners, employees, and successors have the precise directives required to maintain momentum in your absence.
                    </p>
</div>
<div class="hidden lg:block">
<div class="w-48 h-48 bg-surface-container rounded-full overflow-hidden relative">
<img alt="Modern architectural building facade" class="w-full h-full object-cover grayscale brightness-75 hover:grayscale-0 transition-all duration-700" data-alt="abstract architectural glass facade of a modern skyscraper with sharp angles and clean blue sky reflections" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCylr209VDy6GvuPUz1hd77KiAaZJhAFVFct08az7PAtqkHXt3Qq9RSnTT8kdjGtmzULnPKaIP_aIe2Nv97DgTBltJ5BttUWCvYFyACbhooCwDuNddXwy-OgMI39ZtAJ3xIdy8B1KnWr4HXZD2WDMBXzP9ioX-L04pAxVc7Rck7zwEZ9f5KSw_Y7WmCaWXNy8J2rl0Wm7KcggShUv-Ax9zVEAlfluqsOtjizM-eElMIKeVXha7vIviNgAk_a4UjNEEeGnkeP9M5jLCt"/>
</div>
</div>
</section>
<!-- Bento Grid - Core Continuity Modules -->
<div class="grid grid-cols-1 md:grid-cols-12 gap-8 mb-16">
<!-- Professional Procedures (Large Feature) -->
<div class="md:col-span-8 bg-surface-container-low rounded-[2rem] p-10 flex flex-col justify-between group">
<div>
<div class="flex items-center justify-between mb-8">
<span class="material-symbols-outlined text-4xl text-primary p-3 bg-surface rounded-2xl shadow-sm">account_tree</span>
<span class="text-xs font-bold tracking-widest text-on-surface-variant/40 uppercase">Module 01</span>
</div>
<h3 class="text-3xl font-headline font-bold text-primary mb-4">Professional Procedures</h3>
<p class="text-on-surface-variant font-body mb-8 max-w-md">Detailed SOPs and executive decision-making frameworks. Map out the critical workflows that keep your business breathing.</p>
<div class="space-y-4">
<div class="flex items-center p-4 bg-surface rounded-xl hover:bg-surface-container transition-colors cursor-pointer">
<span class="material-symbols-outlined text-secondary mr-4">description</span>
<span class="flex-1 font-medium">Executive Succession Plan 2024</span>
<span class="text-xs text-on-surface-variant">Last updated 12d ago</span>
</div>
<div class="flex items-center p-4 bg-surface rounded-xl hover:bg-surface-container transition-colors cursor-pointer">
<span class="material-symbols-outlined text-secondary mr-4">list_alt</span>
<span class="flex-1 font-medium">Monthly Payroll &amp; Compliance Protocol</span>
<span class="text-xs text-on-surface-variant">Secure access required</span>
</div>
</div>
</div>
<button class="mt-12 flex items-center text-secondary font-headline font-bold text-sm uppercase tracking-widest group-hover:translate-x-2 transition-transform">
                        Manage Procedures <span class="material-symbols-outlined ml-2">arrow_forward</span>
</button>
</div>
<!-- Operational Access Keys -->
<div class="md:col-span-4 bg-primary text-white rounded-[2rem] p-10 flex flex-col relative overflow-hidden">
<div class="relative z-10">
<span class="material-symbols-outlined text-4xl mb-8" style="font-variation-settings: 'FILL' 1;">vpn_key</span>
<h3 class="text-3xl font-headline font-bold mb-4">Operational Access Keys</h3>
<p class="text-on-primary-container font-body text-sm mb-8">Encrypted credentials for cloud infrastructure, banking, and physical assets.</p>
<div class="space-y-3">
<div class="bg-primary-container p-4 rounded-xl border border-white/5 flex items-center justify-between">
<div class="flex items-center">
<span class="material-symbols-outlined text-sm mr-2">dns</span>
<span class="text-xs font-medium">Cloud Console</span>
</div>
<span class="material-symbols-outlined text-sm cursor-pointer opacity-50 hover:opacity-100">content_copy</span>
</div>
<div class="bg-primary-container p-4 rounded-xl border border-white/5 flex items-center justify-between">
<div class="flex items-center">
<span class="material-symbols-outlined text-sm mr-2">account_balance</span>
<span class="text-xs font-medium">Corporate Treasury</span>
</div>
<span class="material-symbols-outlined text-sm cursor-pointer opacity-50 hover:opacity-100">content_copy</span>
</div>
</div>
</div>
<button class="mt-auto bg-white text-primary py-4 rounded-xl font-bold text-sm uppercase tracking-widest z-10">
                        Enter Vault
                    </button>
<!-- Background aesthetic blur -->
<div class="absolute -bottom-10 -right-10 w-48 h-48 bg-secondary blur-[80px] opacity-20"></div>
</div>
<!-- Business Associates -->
<div class="md:col-span-5 bg-surface-container rounded-[2rem] p-10">
<h3 class="text-2xl font-headline font-bold text-primary mb-6">Business Associates</h3>
<div class="space-y-6">
<div class="flex items-center gap-4">
<div class="w-12 h-12 rounded-full bg-surface-dim overflow-hidden">
<img alt="Executive portrait" class="w-full h-full object-cover" data-alt="professional portrait of a middle-aged male executive in a grey blazer with a confident expression and minimalist background" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAJ3N8pa9Zvnx-lBAWrh5fbckvBRn1BfutHjc9M0hem01hHiAFDEHAReb-NIRiqMH4HyFC5bqBXD195_-kvnkcuDFuBPzDi9oooCGgcmP9D-gPGuHO06N0QNeEEf-x2Sf1X98nICfseGWMcODw9Q5xO0G8T_8y-rfdpZ2RuIiPM4R0CzFrNlu_ZK0cuqaycOLlTAMF_6yKRBjmlt5Hdbdq0Sef6qKCA6ftbU4jAD89o_EhN8dP8uJfau937ylmfN1-IzblGY93deDFe"/>
</div>
<div>
<p class="font-bold text-sm">Marcus Thorne</p>
<p class="text-xs text-on-surface-variant">Co-Founder &amp; CTO</p>
</div>
<span class="ml-auto material-symbols-outlined text-secondary" style="font-variation-settings: 'FILL' 1;">verified</span>
</div>
<div class="flex items-center gap-4">
<div class="w-12 h-12 rounded-full bg-surface-dim overflow-hidden">
<img alt="Legal advisor portrait" class="w-full h-full object-cover" data-alt="professional portrait of a female legal advisor in formal black attire with soft studio lighting and neutral background" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBA6_suXeOfyuv8Zwe0FQpPTnugXB-FpdEcnyPjHmJ7gIGbpZ4IlmHtMO7s_L67FllAuNkLEyBpvvNv1JVWntUTV76mNsvAKzBlmDe-aXqJbMHEJG6tBFuVf8w_IbpCslpDyGZ66z_719MBFyLCPriHkYK0ZW409xpzosIIu4Fpnl8aaFkrC6tx5DM75bnpDTNCO4LZxlEzMp9Qu9PBH8AWbBkr7pcdtL5F6OFPilIw_2wz0L9YPwOrYBrbjXSBEXtBuPFwF4itzkLH"/>
</div>
<div>
<p class="font-bold text-sm">Elena Rodriguez</p>
<p class="text-xs text-on-surface-variant">Primary Legal Counsel</p>
</div>
<span class="ml-auto material-symbols-outlined text-secondary" style="font-variation-settings: 'FILL' 1;">verified</span>
</div>
</div>
<button class="w-full mt-10 py-3 border border-outline-variant text-primary font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-surface-variant transition-colors">
                        Expand Network
                    </button>
</div>
<!-- Contingency Instructions -->
<div class="md:col-span-7 bg-secondary-container text-on-secondary-container rounded-[2rem] p-10 overflow-hidden relative">
<div class="relative z-10">
<h3 class="text-2xl font-headline font-bold mb-6">Contingency Instructions</h3>
<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
<div class="bg-white/40 backdrop-blur-md p-6 rounded-2xl">
<span class="material-symbols-outlined mb-4 text-3xl">priority_high</span>
<h4 class="font-bold mb-2">Immediate 24h Actions</h4>
<p class="text-xs leading-relaxed opacity-80">Notify external stakeholders and trigger secure communication server protocols.</p>
</div>
<div class="bg-white/40 backdrop-blur-md p-6 rounded-2xl">
<span class="material-symbols-outlined mb-4 text-3xl">contract</span>
<h4 class="font-bold mb-2">Equity Distribution</h4>
<p class="text-xs leading-relaxed opacity-80">Reference Ledger B-04 for private equity vesting and handover instructions.</p>
</div>
</div>
</div>
<div class="absolute top-0 right-0 p-8 opacity-10">
<span class="material-symbols-outlined text-[120px]">policy</span>
</div>
</div>
</div>
<!-- Detailed Table/List (High-Trust) -->
<section class="bg-surface-container-lowest rounded-[2rem] p-10 shadow-sm">
<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
<div>
<h3 class="text-2xl font-headline font-bold text-primary">Operational Asset Registry</h3>
<p class="text-sm text-on-surface-variant">A comprehensive log of business-critical assets under protection.</p>
</div>
<div class="flex gap-3">
<button class="px-6 py-2 bg-surface text-xs font-bold uppercase tracking-widest rounded-full border border-outline-variant">Export CSV</button>
<button class="px-6 py-2 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded-full shadow-lg">+ New Entry</button>
</div>
</div>
<div class="overflow-x-auto">
<table class="w-full text-left font-body">
<thead>
<tr class="text-on-surface-variant/60 text-[10px] uppercase tracking-[0.2em] border-b border-outline-variant/20">
<th class="pb-4 font-semibold">Asset Name</th>
<th class="pb-4 font-semibold">Type</th>
<th class="pb-4 font-semibold">Security Status</th>
<th class="pb-4 font-semibold">Custodian</th>
<th class="pb-4 text-right">Action</th>
</tr>
</thead>
<tbody class="text-sm">
<tr class="hover:bg-surface-container-low transition-colors group">
<td class="py-6 font-bold text-primary">Main Operating Account (Chase)</td>
<td class="py-6 text-on-surface-variant">Financial</td>
<td class="py-6"><span class="px-3 py-1 bg-secondary/10 text-secondary text-[10px] font-bold rounded-full">ENCRYPTED</span></td>
<td class="py-6 text-on-surface-variant">Self</td>
<td class="py-6 text-right"><span class="material-symbols-outlined text-on-surface-variant cursor-pointer group-hover:text-primary">more_vert</span></td>
</tr>
<tr class="hover:bg-surface-container-low transition-colors group">
<td class="py-6 font-bold text-primary">AWS Master Infrastructure</td>
<td class="py-6 text-on-surface-variant">Cloud/Digital</td>
<td class="py-6"><span class="px-3 py-1 bg-secondary/10 text-secondary text-[10px] font-bold rounded-full">ENCRYPTED</span></td>
<td class="py-6 text-on-surface-variant">Marcus Thorne</td>
<td class="py-6 text-right"><span class="material-symbols-outlined text-on-surface-variant cursor-pointer group-hover:text-primary">more_vert</span></td>
</tr>
<tr class="hover:bg-surface-container-low transition-colors group">
<td class="py-6 font-bold text-primary">HK HQ Physical Access</td>
<td class="py-6 text-on-surface-variant">Physical</td>
<td class="py-6"><span class="px-3 py-1 bg-secondary/10 text-secondary text-[10px] font-bold rounded-full">ENCRYPTED</span></td>
<td class="py-6 text-on-surface-variant">Elena Rodriguez</td>
<td class="py-6 text-right"><span class="material-symbols-outlined text-on-surface-variant cursor-pointer group-hover:text-primary">more_vert</span></td>
</tr>
</tbody>
</table>
</div>
</section>
</main>
</div>
<!-- Footer -->
<footer class="bg-[#001a20] w-full py-12 px-8 mt-auto border-t border-white/5">
<div class="flex flex-col md:flex-row justify-between items-center max-w-screen-2xl mx-auto w-full">
<div class="mb-8 md:mb-0">
<p class="font-inter text-xs uppercase tracking-widest text-slate-400">© 2024 Keeplas Life Continuity. Encrypted &amp; Secured.</p>
</div>
<div class="flex flex-wrap justify-center gap-8 font-inter text-xs uppercase tracking-widest">
<a class="text-slate-500 hover:text-[#28657a] transition-colors" href="#">Privacy Vault</a>
<a class="text-slate-500 hover:text-[#28657a] transition-colors" href="#">Security Protocol</a>
<a class="text-slate-500 hover:text-[#28657a] transition-colors" href="#">Terms of Legacy</a>
<a class="text-slate-500 hover:text-[#28657a] transition-colors" href="#">Contact Concierge</a>
</div>
</div>
</footer>
</body></html>

<!-- AI Setup & Family Guide -->
<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Keeplas | AI Assistant &amp; Family Guide</title>
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
                    borderRadius: {"DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem"},
                },
            },
        }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .glass-panel {
            background: rgba(252, 249, 248, 0.8);
            backdrop-filter: blur(20px);
        }
    </style>
</head>
<body class="bg-background text-on-background font-body min-h-screen flex flex-col">
<!-- TopAppBar -->
<header class="bg-[#041632]/80 backdrop-blur-xl dark:bg-[#041632]/90 docked full-width top-0 z-50 shadow-2xl shadow-[#1b1c1c]/10">
<div class="flex justify-between items-center w-full px-8 py-4 max-w-screen-2xl mx-auto">
<div class="text-2xl font-extrabold tracking-tighter text-white font-headline">Keeplas</div>
<nav class="hidden md:flex items-center space-x-8 font-headline font-bold tracking-tight">
<a class="text-slate-400 hover:text-white transition-colors" href="#">Vault</a>
<a class="text-slate-400 hover:text-white transition-colors" href="#">Life Check</a>
<a class="text-slate-400 hover:text-white transition-colors" href="#">Emergency Card</a>
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
<div class="flex flex-1 pt-4">
<!-- SideNavBar -->
<aside class="hidden lg:flex flex-col h-full w-72 fixed left-0 top-0 pt-20 bg-[#f6f3f2] dark:bg-[#001a20] p-6 space-y-8 z-40">
<div class="flex items-center space-x-3 mb-4">
<div class="w-12 h-12 rounded-full overflow-hidden bg-surface-container">
<img class="w-full h-full object-cover" data-alt="professional portrait of a middle aged man with a kind smile wearing a dark suit in a bright office" src="https://lh3.googleusercontent.com/aida-public/AB6AXuANLo11Q86ywbyL4-YLLVVpUN_RKXzcUilMfCojcki0-aJp0pm19_ky1OCdLgxtDkKrreEEnadFq3wFBnTz8gB70Khp_5Mpm0vhGndWWCR5Tg-ODZWs588JyE0UeaDO8BXTC9h8UBK8s-9RVvikE6lYRbK9Doih8_LzHYmVpBprgRsZNE7f3Z6BEajio3ivDekDaFhthmo451AiBX63HsaWambEqQCKoYEPInAzSJM4Tn4o5yxkdqDhTJHxaxMqKSNRVKXVAOMBqDkU"/>
</div>
<div>
<p class="font-manrope font-black text-[#041632] text-sm uppercase">The Vault</p>
<p class="text-[10px] text-[#28657a]/70 font-medium tracking-widest uppercase">Security Level: Maximum</p>
</div>
</div>
<nav class="space-y-2">
<a class="flex items-center space-x-3 p-3 font-inter text-sm font-medium uppercase tracking-widest text-[#28657a]/70 hover:bg-[#e5e2e1] hover:translate-x-1 transition-transform group" href="#">
<span class="material-symbols-outlined">dashboard</span>
<span>Dashboard</span>
</a>
<a class="flex items-center space-x-3 p-3 font-inter text-sm font-medium uppercase tracking-widest bg-[#28657a] text-white rounded-xl shadow-lg group" href="#">
<span class="material-symbols-outlined">smart_toy</span>
<span>AI Assistant</span>
</a>
<a class="flex items-center space-x-3 p-3 font-inter text-sm font-medium uppercase tracking-widest text-[#28657a]/70 hover:bg-[#e5e2e1] hover:translate-x-1 transition-transform group" href="#">
<span class="material-symbols-outlined">lock</span>
<span>Digital Vault</span>
</a>
<a class="flex items-center space-x-3 p-3 font-inter text-sm font-medium uppercase tracking-widest text-[#28657a]/70 hover:bg-[#e5e2e1] hover:translate-x-1 transition-transform group" href="#">
<span class="material-symbols-outlined">medical_services</span>
<span>Health Directives</span>
</a>
<a class="flex items-center space-x-3 p-3 font-inter text-sm font-medium uppercase tracking-widest text-[#28657a]/70 hover:bg-[#e5e2e1] hover:translate-x-1 transition-transform group" href="#">
<span class="material-symbols-outlined">gavel</span>
<span>Legal Legacy</span>
</a>
</nav>
<div class="mt-auto">
<button class="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-xl hover:bg-primary-container transition-all flex items-center justify-center space-x-2">
<span class="material-symbols-outlined">emergency</span>
<span>Emergency Access</span>
</button>
</div>
</aside>
<!-- Main Content Canvas -->
<main class="flex-1 lg:ml-72 p-8 pt-24 max-w-7xl mx-auto w-full">
<!-- Page Header -->
<div class="flex flex-col md:flex-row justify-between items-end mb-12 space-y-4 md:space-y-0">
<div class="max-w-2xl">
<h1 class="text-5xl font-headline font-extrabold tracking-tight text-primary mb-4 leading-tight">Legacy Curation &amp; <br/><span class="text-secondary">AI Continuity</span></h1>
<p class="text-body-lg text-on-surface-variant leading-relaxed">Your digital sanctuary uses neural assistance to ensure no detail of your life's work is left undocumented or misunderstood.</p>
</div>
<!-- Multi-Language Toggle -->
<div class="bg-surface-container-low p-1 rounded-full flex items-center">
<button class="px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary bg-white rounded-full shadow-sm">English</button>
<button class="px-4 py-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors">Français</button>
<button class="px-4 py-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors">Kiswahili</button>
</div>
</div>
<!-- Bento Grid Layout -->
<div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
<!-- AI Assistant Chat (Bento Large) -->
<section class="lg:col-span-7 bg-surface-container-lowest rounded-3xl overflow-hidden flex flex-col min-h-[600px] shadow-sm">
<div class="p-6 bg-primary text-white flex justify-between items-center">
<div class="flex items-center space-x-3">
<div class="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
<span class="material-symbols-outlined text-white">neurology</span>
</div>
<div>
<h2 class="font-headline font-bold text-lg leading-tight">AI Setup Assistant</h2>
<p class="text-[10px] text-secondary-fixed uppercase tracking-widest">Active Curation Mode</p>
</div>
</div>
<div class="flex items-center space-x-2 text-xs">
<span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
<span class="font-medium opacity-80 uppercase tracking-tighter">Analyzing Vault Completeness</span>
</div>
</div>
<!-- Chat History -->
<div class="flex-1 p-8 space-y-6 overflow-y-auto bg-surface-container-lowest">
<!-- AI Message -->
<div class="flex flex-col items-start space-y-2 max-w-[85%]">
<div class="p-4 bg-surface-container-low rounded-2xl rounded-tl-none text-on-surface leading-relaxed">
                                Hello, Marcus. I've analyzed your current vault status. Your <span class="font-bold text-secondary">Digital Assets</span> section is 85% complete, but your <span class="font-bold text-secondary">Health Directives</span> lacks specific guidance on long-term care preferences. 
                                <br/><br/>
                                Would you like to address this now through a few targeted questions?
                            </div>
<span class="text-[10px] uppercase font-bold text-outline tracking-widest px-1">Vault Assistant • 09:41 AM</span>
</div>
<!-- User Message -->
<div class="flex flex-col items-end space-y-2 ml-auto max-w-[85%]">
<div class="p-4 bg-primary text-white rounded-2xl rounded-tr-none leading-relaxed">
                                Yes, let's do it. Keep it simple and focused on my recovery preferences.
                            </div>
<span class="text-[10px] uppercase font-bold text-outline tracking-widest px-1">You • 09:42 AM</span>
</div>
<!-- AI Question -->
<div class="flex flex-col items-start space-y-2 max-w-[85%]">
<div class="p-4 bg-surface-container-low rounded-2xl rounded-tl-none text-on-surface leading-relaxed">
                                Understood. Transitioning to <span class="italic">Directive Simplification</span>. 
                                <br/><br/>
                                Question: In the event of a prolonged recovery, do you prefer a specialized rehabilitation facility or home-based nursing care with your current primary contacts?
                            </div>
<div class="flex flex-wrap gap-2 mt-2">
<button class="px-4 py-2 bg-white border border-outline-variant rounded-full text-sm font-semibold hover:border-secondary hover:text-secondary transition-all">Home-based Care</button>
<button class="px-4 py-2 bg-white border border-outline-variant rounded-full text-sm font-semibold hover:border-secondary hover:text-secondary transition-all">Rehabilitation Facility</button>
<button class="px-4 py-2 bg-white border border-outline-variant rounded-full text-sm font-semibold hover:border-secondary hover:text-secondary transition-all">I'm unsure, tell me more</button>
</div>
</div>
</div>
<!-- Input Area -->
<div class="p-6 border-t border-outline-variant/20 bg-surface-container-low/30">
<div class="relative">
<input class="w-full bg-white border-0 rounded-2xl p-4 pr-16 focus:ring-2 focus:ring-secondary/50 shadow-inner" placeholder="Describe your wishes here..." type="text"/>
<button class="absolute right-2 top-2 bottom-2 w-12 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-secondary transition-colors">
<span class="material-symbols-outlined">send</span>
</button>
</div>
<div class="mt-4 flex items-center justify-between text-[10px] uppercase font-bold text-outline tracking-widest">
<div class="flex items-center space-x-4">
<button class="flex items-center space-x-1 hover:text-primary"><span class="material-symbols-outlined text-sm">mic</span><span>Voice Input</span></button>
<button class="flex items-center space-x-1 hover:text-primary"><span class="material-symbols-outlined text-sm">attach_file</span><span>Upload Doc</span></button>
</div>
<span>End-to-End Encrypted Session</span>
</div>
</div>
</section>
<!-- Family Guide & PDF (Bento Side) -->
<div class="lg:col-span-5 flex flex-col gap-8">
<!-- Generate Family Guide Card -->
<section class="bg-primary-container text-white p-8 rounded-3xl relative overflow-hidden shadow-2xl">
<div class="relative z-10">
<div class="flex items-center space-x-2 mb-6">
<span class="material-symbols-outlined text-secondary-fixed">description</span>
<h3 class="font-headline font-bold text-xl">Generate Family Guide</h3>
</div>
<p class="text-on-primary-container text-sm leading-relaxed mb-8">
                                Transform your complex vault data into a clear, structured PDF summary. This guide provides step-by-step instructions for your loved ones during critical moments.
                            </p>
<div class="space-y-4 mb-8">
<div class="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
<div class="flex items-center space-x-3">
<span class="material-symbols-outlined text-secondary-fixed">translate</span>
<span class="text-sm font-medium">Auto-Translation</span>
</div>
<div class="w-10 h-5 bg-secondary rounded-full relative">
<div class="absolute right-1 top-1 bottom-1 w-3 bg-white rounded-full"></div>
</div>
</div>
<div class="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
<div class="flex items-center space-x-3">
<span class="material-symbols-outlined text-secondary-fixed">psychology</span>
<span class="text-sm font-medium">Simplify Legal Jargon</span>
</div>
<div class="w-10 h-5 bg-secondary rounded-full relative">
<div class="absolute right-1 top-1 bottom-1 w-3 bg-white rounded-full"></div>
</div>
</div>
</div>
<button class="w-full py-4 bg-secondary-fixed text-primary font-black uppercase tracking-widest text-xs rounded-xl hover:bg-white transition-all shadow-lg flex items-center justify-center space-x-2">
<span class="material-symbols-outlined">picture_as_pdf</span>
<span>Export Encrypted PDF</span>
</button>
</div>
<!-- Background Accent -->
<div class="absolute -bottom-10 -right-10 w-40 h-40 bg-secondary opacity-20 blur-3xl rounded-full"></div>
</section>
<!-- Preview / Status Card -->
<section class="bg-surface-container p-8 rounded-3xl flex-1">
<h4 class="font-headline font-bold text-primary mb-6">Guide Readiness</h4>
<div class="space-y-6">
<div>
<div class="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-outline mb-2">
<span>Financial Instructions</span>
<span class="text-primary">100%</span>
</div>
<div class="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
<div class="h-full bg-secondary w-full"></div>
</div>
</div>
<div>
<div class="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-outline mb-2">
<span>Medical Directives</span>
<span class="text-primary">62%</span>
</div>
<div class="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
<div class="h-full bg-secondary w-[62%]"></div>
</div>
</div>
<div>
<div class="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-outline mb-2">
<span>Personal Messages</span>
<span class="text-primary">40%</span>
</div>
<div class="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
<div class="h-full bg-secondary w-[40%]"></div>
</div>
</div>
</div>
<div class="mt-8 p-4 bg-white/50 border border-outline-variant/30 rounded-2xl flex items-center space-x-4">
<span class="material-symbols-outlined text-secondary">info</span>
<p class="text-xs text-on-surface-variant font-medium">Adding more medical detail will unlock the <span class="text-primary font-bold">Comprehensive Continuity</span> status.</p>
</div>
</section>
</div>
</div>
<!-- Contextual Stats / Insights -->
<div class="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
<div class="bg-surface-container-low p-6 rounded-2xl">
<p class="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">Last Analysis</p>
<p class="text-xl font-headline font-extrabold text-primary">2 hours ago</p>
</div>
<div class="bg-surface-container-low p-6 rounded-2xl">
<p class="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">Security Score</p>
<p class="text-xl font-headline font-extrabold text-secondary">94 / 100</p>
</div>
<div class="bg-surface-container-low p-6 rounded-2xl">
<p class="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">Trusted Entities</p>
<p class="text-xl font-headline font-extrabold text-primary">4 Verified</p>
</div>
</div>
</main>
</div>
<!-- Footer -->
<footer class="bg-[#001a20] dark:bg-[#000000] w-full py-12 px-8 mt-auto flex flex-col md:flex-row justify-between items-center border-t border-white/5">
<div class="mb-6 md:mb-0">
<p class="font-inter text-xs uppercase tracking-widest text-slate-400">© 2024 Keeplas Life Continuity. Encrypted &amp; Secured.</p>
</div>
<nav class="flex flex-wrap justify-center gap-8">
<a class="font-inter text-xs uppercase tracking-widest text-slate-500 hover:text-[#28657a] transition-colors" href="#">Privacy Vault</a>
<a class="font-inter text-xs uppercase tracking-widest text-slate-500 hover:text-[#28657a] transition-colors" href="#">Security Protocol</a>
<a class="font-inter text-xs uppercase tracking-widest text-slate-500 hover:text-[#28657a] transition-colors" href="#">Terms of Legacy</a>
<a class="font-inter text-xs uppercase tracking-widest text-slate-500 hover:text-[#28657a] transition-colors" href="#">Contact Concierge</a>
</nav>
</footer>
</body></html>

<!-- Keeplas Dashboard -->
<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Keeplas | Vault Dashboard</title>
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
<nav class="hidden md:flex items-center space-x-8">
<a class="font-manrope font-bold tracking-tight text-[#b9eaff] border-b-2 border-[#28657a] pb-1" href="#">Vault</a>
<a class="font-manrope font-bold tracking-tight text-slate-400 hover:text-white transition-colors" href="#">Life Check</a>
<a class="font-manrope font-bold tracking-tight text-slate-400 hover:text-white transition-colors" href="#">Emergency Card</a>
<a class="font-manrope font-bold tracking-tight text-slate-400 hover:text-white transition-colors" href="#">Trusted Contacts</a>
</nav>
<div class="flex items-center space-x-4">
<button class="p-2 text-slate-400 hover:bg-[#1b2b48]/50 rounded-lg transition-all scale-95 active:scale-90 duration-200">
<span class="material-symbols-outlined" data-icon="verified_user">verified_user</span>
</button>
<button class="p-2 text-slate-400 hover:bg-[#1b2b48]/50 rounded-lg transition-all scale-95 active:scale-90 duration-200 relative">
<span class="material-symbols-outlined" data-icon="notifications">notifications</span>
<span class="absolute top-2 right-2 w-2 h-2 bg-secondary rounded-full"></span>
</button>
<button class="p-2 text-slate-400 hover:bg-[#1b2b48]/50 rounded-lg transition-all scale-95 active:scale-90 duration-200">
<span class="material-symbols-outlined" data-icon="account_circle">account_circle</span>
</button>
</div>
</div>
</header>
<div class="flex flex-1 pt-4">
<!-- SideNavBar (Desktop Only) -->
<aside class="hidden lg:flex flex-col h-[calc(100vh-80px)] w-72 fixed left-0 top-20 bg-[#f6f3f2] dark:bg-[#001a20] p-6 space-y-8 z-40">
<div class="flex items-center space-x-3 px-2">
<div class="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">JD</div>
<div>
<div class="font-manrope font-black text-[#041632] uppercase text-xs tracking-widest">The Vault</div>
<div class="text-[10px] text-secondary font-medium uppercase tracking-tighter">Security Level: Maximum</div>
</div>
</div>
<nav class="flex flex-col space-y-2">
<a class="flex items-center space-x-3 px-4 py-3 bg-[#28657a] text-white rounded-xl shadow-lg transition-transform hover:translate-x-1" href="#">
<span class="material-symbols-outlined" data-icon="dashboard">dashboard</span>
<span class="font-inter text-sm font-medium uppercase tracking-widest">Dashboard</span>
</a>
<a class="flex items-center space-x-3 px-4 py-3 text-[#28657a]/70 hover:bg-[#e5e2e1] rounded-xl transition-transform hover:translate-x-1" href="#">
<span class="material-symbols-outlined" data-icon="lock">lock</span>
<span class="font-inter text-sm font-medium uppercase tracking-widest">Digital Vault</span>
</a>
<a class="flex items-center space-x-3 px-4 py-3 text-[#28657a]/70 hover:bg-[#e5e2e1] rounded-xl transition-transform hover:translate-x-1" href="#">
<span class="material-symbols-outlined" data-icon="medical_services">medical_services</span>
<span class="font-inter text-sm font-medium uppercase tracking-widest">Health Directives</span>
</a>
<a class="flex items-center space-x-3 px-4 py-3 text-[#28657a]/70 hover:bg-[#e5e2e1] rounded-xl transition-transform hover:translate-x-1" href="#">
<span class="material-symbols-outlined" data-icon="gavel">gavel</span>
<span class="font-inter text-sm font-medium uppercase tracking-widest">Legal Legacy</span>
</a>
<a class="flex items-center space-x-3 px-4 py-3 text-[#28657a]/70 hover:bg-[#e5e2e1] rounded-xl transition-transform hover:translate-x-1" href="#">
<span class="material-symbols-outlined" data-icon="shield">shield</span>
<span class="font-inter text-sm font-medium uppercase tracking-widest">Security Center</span>
</a>
</nav>
<div class="mt-auto">
<button class="w-full vault-gradient text-white py-4 rounded-xl font-bold flex items-center justify-center space-x-2 shadow-lg scale-95 active:scale-90 transition-all">
<span class="material-symbols-outlined" data-icon="emergency_home">emergency_home</span>
<span class="text-xs uppercase tracking-widest">Emergency Access</span>
</button>
</div>
</aside>
<!-- Main Content Canvas -->
<main class="flex-1 lg:ml-72 p-8 max-w-7xl mx-auto w-full">
<!-- Header Section: Security & Welcome -->
<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
<div>
<h1 class="text-display-md font-headline font-extrabold text-primary tracking-tight leading-none mb-2">Welcome back, Curator.</h1>
<p class="text-on-surface-variant font-body">Your legacy is protected and synchronized across all secure nodes.</p>
</div>
<div class="flex items-center space-x-3 px-5 py-3 bg-surface-container-low rounded-full border border-secondary/10">
<span class="material-symbols-outlined text-secondary" data-icon="lock" style="font-variation-settings: 'FILL' 1;">lock</span>
<span class="font-label text-xs font-bold uppercase tracking-widest text-primary">Vault Encrypted &amp; Secured</span>
</div>
</div>
<!-- Dashboard Grid -->
<div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
<!-- Left Column: Score & Quick Actions -->
<div class="lg:col-span-4 space-y-8">
<!-- Completeness Score Card -->
<div class="bg-surface-container shadow-sm rounded-full p-10 flex flex-col items-center justify-center text-center aspect-square relative overflow-hidden">
<div class="absolute inset-0 opacity-5 pointer-events-none">
<div class="w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-secondary via-transparent to-transparent"></div>
</div>
<div class="relative w-48 h-48 flex items-center justify-center mb-4">
<svg class="w-full h-full transform -rotate-90">
<circle class="text-surface-variant" cx="96" cy="96" fill="transparent" r="88" stroke="currentColor" stroke-width="8"></circle>
<circle class="text-secondary" cx="96" cy="96" fill="transparent" r="88" stroke="currentColor" stroke-dasharray="552.92" stroke-dashoffset="193.52" stroke-linecap="round" stroke-width="12"></circle>
</svg>
<div class="absolute inset-0 flex flex-col items-center justify-center">
<span class="text-5xl font-headline font-black text-primary">65%</span>
<span class="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Complete</span>
</div>
</div>
<h3 class="font-headline font-bold text-lg text-primary">Vault Integrity</h3>
<p class="text-sm text-on-surface-variant mt-2 leading-relaxed">Add your 'Digital Assets' to reach 85% and unlock premium recovery.</p>
</div>
<!-- Quick Actions -->
<div class="space-y-3">
<h4 class="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4 px-2">Priority Actions</h4>
<button class="w-full flex items-center justify-between p-4 bg-surface-container-low hover:bg-surface-container transition-colors rounded-xl group">
<div class="flex items-center space-x-4">
<span class="material-symbols-outlined p-2 bg-white rounded-lg text-primary" data-icon="note_add">note_add</span>
<span class="font-headline font-bold text-primary">Add New Record</span>
</div>
<span class="material-symbols-outlined text-outline-variant group-hover:translate-x-1 transition-transform" data-icon="chevron_right">chevron_right</span>
</button>
<button class="w-full flex items-center justify-between p-4 bg-surface-container-low hover:bg-surface-container transition-colors rounded-xl group">
<div class="flex items-center space-x-4">
<span class="material-symbols-outlined p-2 bg-white rounded-lg text-primary" data-icon="contact_emergency">contact_emergency</span>
<span class="font-headline font-bold text-primary">Generate Emergency Card</span>
</div>
<span class="material-symbols-outlined text-outline-variant group-hover:translate-x-1 transition-transform" data-icon="chevron_right">chevron_right</span>
</button>
<button class="w-full flex items-center justify-between p-4 bg-surface-container-low hover:bg-surface-container transition-colors rounded-xl group">
<div class="flex items-center space-x-4">
<span class="material-symbols-outlined p-2 bg-white rounded-lg text-primary" data-icon="person_add">person_add</span>
<span class="font-headline font-bold text-primary">Invite Trusted Contact</span>
</div>
<span class="material-symbols-outlined text-outline-variant group-hover:translate-x-1 transition-transform" data-icon="chevron_right">chevron_right</span>
</button>
</div>
</div>
<!-- Right Column: Categories & Activity -->
<div class="lg:col-span-8 space-y-8">
<!-- Categories Bento Grid -->
<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
<!-- Personal Records -->
<div class="bg-surface-container-low p-8 rounded-full flex flex-col justify-between hover:bg-surface-container transition-all group">
<div class="flex justify-between items-start">
<span class="material-symbols-outlined text-3xl text-primary" data-icon="folder_shared">folder_shared</span>
<span class="px-3 py-1 bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase tracking-widest rounded-full">12 Items</span>
</div>
<div class="mt-8">
<h3 class="text-xl font-headline font-extrabold text-primary">Personal Records</h3>
<p class="text-xs text-on-surface-variant mt-1 uppercase tracking-tighter">Last Updated: 2 days ago</p>
</div>
</div>
<!-- Financial Assets -->
<div class="bg-surface-container-low p-8 rounded-full flex flex-col justify-between hover:bg-surface-container transition-all group">
<div class="flex justify-between items-start">
<span class="material-symbols-outlined text-3xl text-primary" data-icon="account_balance_wallet">account_balance_wallet</span>
<span class="px-3 py-1 bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase tracking-widest rounded-full">8 Items</span>
</div>
<div class="mt-8">
<h3 class="text-xl font-headline font-extrabold text-primary">Financial Assets</h3>
<p class="text-xs text-on-surface-variant mt-1 uppercase tracking-tighter">Last Updated: Today, 10:24 AM</p>
</div>
</div>
<!-- Business Continuity -->
<div class="bg-surface-container-low p-8 rounded-full flex flex-col justify-between hover:bg-surface-container transition-all group">
<div class="flex justify-between items-start">
<span class="material-symbols-outlined text-3xl text-primary" data-icon="corporate_fare">corporate_fare</span>
<span class="px-3 py-1 bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase tracking-widest rounded-full">4 Items</span>
</div>
<div class="mt-8">
<h3 class="text-xl font-headline font-extrabold text-primary">Business Continuity</h3>
<p class="text-xs text-on-surface-variant mt-1 uppercase tracking-tighter">Last Updated: Jan 12, 2024</p>
</div>
</div>
<!-- Digital Assets -->
<div class="bg-primary-container p-8 rounded-full flex flex-col justify-between relative overflow-hidden group">
<div class="absolute top-0 right-0 p-6">
<span class="material-symbols-outlined text-secondary text-4xl opacity-50" data-icon="cloud_done">cloud_done</span>
</div>
<div class="flex justify-between items-start relative z-10">
<span class="material-symbols-outlined text-3xl text-white" data-icon="database">database</span>
<span class="px-3 py-1 bg-secondary text-white text-[10px] font-bold uppercase tracking-widest rounded-full">Incomplete</span>
</div>
<div class="mt-8 relative z-10">
<h3 class="text-xl font-headline font-extrabold text-white">Digital Assets</h3>
<p class="text-xs text-on-primary-container mt-1 uppercase tracking-tighter">Critical: 0 Items Synced</p>
</div>
</div>
</div>
<!-- Recent Activity Section -->
<div class="bg-white p-8 rounded-full shadow-sm border border-surface-container">
<h4 class="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-6">Recent Activity</h4>
<div class="space-y-6">
<div class="flex items-center justify-between">
<div class="flex items-center space-x-4">
<div class="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center">
<span class="material-symbols-outlined text-sm text-secondary" data-icon="edit_note">edit_note</span>
</div>
<div>
<p class="text-sm font-bold text-primary">Estate Will updated</p>
<p class="text-[10px] text-on-surface-variant uppercase tracking-widest">Legal Legacy • 2h ago</p>
</div>
</div>
<span class="material-symbols-outlined text-outline-variant text-sm" data-icon="visibility">visibility</span>
</div>
<div class="flex items-center justify-between">
<div class="flex items-center space-x-4">
<div class="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center">
<span class="material-symbols-outlined text-sm text-secondary" data-icon="person_add">person_add</span>
</div>
<div>
<p class="text-sm font-bold text-primary">Trusted Contact Invited: Sarah Jenkins</p>
<p class="text-[10px] text-on-surface-variant uppercase tracking-widest">Security • Yesterday</p>
</div>
</div>
<span class="material-symbols-outlined text-outline-variant text-sm" data-icon="pending">pending</span>
</div>
<div class="flex items-center justify-between">
<div class="flex items-center space-x-4">
<div class="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center">
<span class="material-symbols-outlined text-sm text-secondary" data-icon="upload_file">upload_file</span>
</div>
<div>
<p class="text-sm font-bold text-primary">Bank Statements (Q4) uploaded</p>
<p class="text-[10px] text-on-surface-variant uppercase tracking-widest">Financial Assets • 3 days ago</p>
</div>
</div>
<span class="material-symbols-outlined text-outline-variant text-sm" data-icon="check_circle" style="font-variation-settings: 'FILL' 1;">check_circle</span>
</div>
</div>
</div>
</div>
</div>
</main>
</div>
<!-- Footer -->
<footer class="bg-[#001a20] dark:bg-[#000000] w-full py-12 px-8 mt-auto flex flex-col md:flex-row justify-between items-center border-t border-white/5">
<p class="font-inter text-xs uppercase tracking-widest text-slate-400">© 2024 Keeplas Life Continuity. Encrypted &amp; Secured.</p>
<div class="flex space-x-8 mt-6 md:mt-0">
<a class="font-inter text-xs uppercase tracking-widest text-slate-500 hover:text-[#28657a] transition-colors" href="#">Privacy Vault</a>
<a class="font-inter text-xs uppercase tracking-widest text-slate-500 hover:text-[#28657a] transition-colors" href="#">Security Protocol</a>
<a class="font-inter text-xs uppercase tracking-widest text-slate-500 hover:text-[#28657a] transition-colors" href="#">Terms of Legacy</a>
<a class="font-inter text-xs uppercase tracking-widest text-slate-500 hover:text-[#28657a] transition-colors" href="#">Contact Concierge</a>
</div>
</footer>
</body></html>

<!-- Terminate Plan & Delete Data -->
<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Terminate Your Continuity Plan - The Architectural Vault</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;700;800&amp;family=Inter:wght@400;500;600&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              "on-tertiary-container": "#5a9cae",
              "on-tertiary": "#ffffff",
              "on-primary": "#ffffff",
              "on-error": "#ffffff",
              "surface-container-lowest": "#ffffff",
              "secondary-container": "#abe5fe",
              "on-surface": "#1b1c1c",
              "surface-bright": "#fcf9f8",
              "error-container": "#ffdad6",
              "surface-container-high": "#eae7e7",
              "on-primary-fixed-variant": "#374765",
              "on-tertiary-fixed": "#001f26",
              "inverse-on-surface": "#f3f0ef",
              "primary-container": "#1b2b48",
              "outline": "#75777e",
              "on-background": "#1b1c1c",
              "error": "#ba1a1a",
              "background": "#fcf9f8",
              "secondary-fixed-dim": "#95cfe7",
              "on-secondary": "#ffffff",
              "inverse-surface": "#303030",
              "primary": "#041632",
              "primary-fixed-dim": "#b7c7eb",
              "primary-fixed": "#d7e2ff",
              "tertiary": "#001a20",
              "tertiary-fixed-dim": "#8fd0e4",
              "tertiary-container": "#00303a",
              "outline-variant": "#c5c6ce",
              "surface-variant": "#e5e2e1",
              "surface-container-low": "#f6f3f2",
              "surface": "#fcf9f8",
              "tertiary-fixed": "#aeecff",
              "inverse-primary": "#b7c7eb",
              "surface-dim": "#dcd9d9",
              "surface-container-highest": "#e5e2e1",
              "on-primary-container": "#8393b5",
              "secondary-fixed": "#b9eaff",
              "on-tertiary-fixed-variant": "#004e5d",
              "on-surface-variant": "#44474d",
              "surface-tint": "#4f5e7e",
              "on-secondary-fixed": "#001f29",
              "on-primary-fixed": "#091b37",
              "on-secondary-fixed-variant": "#004d61",
              "surface-container": "#f0eded",
              "on-error-container": "#93000a",
              "on-secondary-container": "#2b687d",
              "secondary": "#28657a"
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
      .destructive-gradient {
        background: linear-gradient(135deg, #ba1a1a 0%, #93000a 100%);
      }
    </style>
</head>
<body class="bg-background font-body text-on-surface selection:bg-secondary-container">
<!-- TopAppBar Navigation suppressed for transactional focus -->
<header class="fixed top-0 w-full flex justify-between items-center px-8 h-20 bg-[#041632]/80 backdrop-blur-xl z-50 shadow-2xl shadow-[#041632]/20">
<div class="text-2xl font-headline font-bold tracking-tighter text-[#f6f3f2]">The Architectural Vault</div>
<div class="flex gap-4">
<span class="material-symbols-outlined text-[#b9eaff]">lock</span>
<span class="material-symbols-outlined text-[#b9eaff]">account_circle</span>
</div>
</header>
<main class="min-h-screen pt-32 pb-20 px-6 flex flex-col items-center justify-center">
<!-- High-Stakes Modal Container -->
<div class="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-0 bg-surface-container-lowest rounded-xl overflow-hidden shadow-2xl ring-1 ring-on-surface/5">
<!-- Left Side: Visual Gravity -->
<div class="md:col-span-5 relative vault-gradient p-12 flex flex-col justify-between text-[#f6f3f2]">
<div class="space-y-6">
<div class="h-16 w-16 bg-error rounded-full flex items-center justify-center shadow-lg">
<span class="material-symbols-outlined text-on-error text-4xl" style="font-variation-settings: 'FILL' 1;">warning</span>
</div>
<h2 class="font-headline text-3xl font-extrabold tracking-tight leading-tight">Irrerversible Destruction</h2>
<p class="text-[#e5e2e1]/80 text-lg leading-relaxed font-body">
                        Once initiated, the curator protocols will begin immediate shredding of all digital assets, legacy letters, and emergency access keys. 
                    </p>
</div>
<div class="space-y-4 pt-12 border-t border-[#f6f3f2]/10">
<div class="flex items-center gap-4 text-sm font-label tracking-widest uppercase opacity-60">
<span class="material-symbols-outlined text-xs">history_edu</span>
<span>Archive Status: Active</span>
</div>
<div class="flex items-center gap-4 text-sm font-label tracking-widest uppercase opacity-60">
<span class="material-symbols-outlined text-xs">enhanced_encryption</span>
<span>Encryption Key: User-Held</span>
</div>
</div>
<!-- Decorative Texture -->
<div class="absolute inset-0 opacity-10 pointer-events-none mix-blend-overlay">
<img class="w-full h-full object-cover" data-alt="abstract dark geometric architectural patterns resembling secure vault shadows and heavy metal textures" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBj_n7WgE6m8e39cENZvHFoL1eqWDZIthIYVV5f_S6wfkltH4kL6ylJM7awfDtC76xaCgxnn90aku63dgy-n_CudX9BqpbYZQvI4Cc_S1EULSp2rRtwcvv6HifY9VUF9um4Hc9-cghdNbnGPgo5JoU4nMDayg9fyai-X9FEYPYVKRhEuxxGTuEpuRkx3aDaDy5vwlLCig-xDK9UtxCWODQWJ-v87u2ViiJW27pDf8OX9ITgzTmPgUwMnZ0gublcSByZoLCU0p8zR9s2"/>
</div>
</div>
<!-- Right Side: Interaction Area -->
<div class="md:col-span-7 p-10 md:p-16 bg-surface">
<div class="mb-10">
<h1 class="font-headline text-4xl md:text-5xl font-extrabold tracking-tighter text-primary mb-6">Terminate Your Continuity Plan?</h1>
<div class="p-6 bg-error-container rounded-lg mb-8">
<p class="text-on-error-container font-medium flex gap-3">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">error</span>
<span>WARNING: This will permanently purge your encrypted vault, life check protocols, and emergency card. It cannot be undone.</span>
</p>
</div>
</div>
<!-- Bento Grid Style Info Blocks -->
<div class="grid grid-cols-2 gap-4 mb-10">
<div class="p-6 bg-surface-container-low rounded-xl">
<span class="material-symbols-outlined text-primary mb-2">delete_forever</span>
<p class="font-label text-xs uppercase tracking-widest text-on-surface-variant font-bold">Vault Data</p>
<p class="text-sm text-on-surface mt-1">1.4 GB Encrypted</p>
</div>
<div class="p-6 bg-surface-container-low rounded-xl">
<span class="material-symbols-outlined text-primary mb-2">notifications_off</span>
<p class="font-label text-xs uppercase tracking-widest text-on-surface-variant font-bold">Protocols</p>
<p class="text-sm text-on-surface mt-1">6 Active Check-ins</p>
</div>
</div>
<form class="space-y-8">
<div class="space-y-2">
<label class="font-label text-xs uppercase tracking-widest text-on-surface-variant font-extrabold" for="password">Identity Confirmation Required</label>
<input class="w-full h-14 bg-surface-container-low border-0 rounded-xl focus:ring-2 focus:ring-secondary px-6 text-primary font-medium transition-all" id="password" placeholder="Enter vault password" type="password"/>
</div>
<div class="flex flex-col sm:flex-row gap-4 pt-4">
<button class="flex-1 destructive-gradient text-on-primary py-4 px-8 rounded-xl font-headline font-bold tracking-tight shadow-xl hover:scale-[1.02] transition-transform flex items-center justify-center gap-2" type="submit">
<span>Confirm Permanent Deletion</span>
</button>
<button class="flex-1 bg-surface-container-high text-primary py-4 px-8 rounded-xl font-headline font-bold tracking-tight hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-2" type="button">
<span>Keep My Plan</span>
</button>
</div>
</form>
<p class="mt-8 text-center text-xs text-on-surface-variant/60 font-label uppercase tracking-widest">
                    Request ID: KPS-882-VAULT-PRG
                </p>
</div>
</div>
<!-- Secondary Guidance -->
<div class="mt-12 text-center max-w-lg">
<p class="text-on-surface-variant text-sm leading-relaxed">
                Need to pause instead? You can deactivate your <strong>Life Check Protocols</strong> without destroying your vault assets in the <a class="text-secondary font-bold underline decoration-2 decoration-secondary/30 underline-offset-4" href="#">Security Settings</a>.
            </p>
</div>
</main>
<!-- Navigation Suppressed as per UX Goal for transactional focused journeys -->
<!-- Footer Branding -->
<footer class="py-10 text-center">
<div class="inline-flex items-center gap-3 px-6 py-2 bg-surface-container rounded-full">
<span class="material-symbols-outlined text-secondary text-sm" style="font-variation-settings: 'FILL' 1;">verified_user</span>
<span class="font-label text-[10px] uppercase tracking-[0.2em] font-bold text-on-surface-variant">The Digital Curator Protocol v4.2.0</span>
</div>
</footer>
</body></html>

<!-- Login: Access the Vault -->
<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>The Architectural Vault - Secure Login</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;700;800&amp;family=Inter:wght@400;500;600&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              "on-tertiary-container": "#5a9cae",
              "on-tertiary": "#ffffff",
              "on-primary": "#ffffff",
              "on-error": "#ffffff",
              "surface-container-lowest": "#ffffff",
              "secondary-container": "#abe5fe",
              "on-surface": "#1b1c1c",
              "surface-bright": "#fcf9f8",
              "error-container": "#ffdad6",
              "surface-container-high": "#eae7e7",
              "on-primary-fixed-variant": "#374765",
              "on-tertiary-fixed": "#001f26",
              "inverse-on-surface": "#f3f0ef",
              "primary-container": "#1b2b48",
              "outline": "#75777e",
              "on-background": "#1b1c1c",
              "error": "#ba1a1a",
              "background": "#fcf9f8",
              "secondary-fixed-dim": "#95cfe7",
              "on-secondary": "#ffffff",
              "inverse-surface": "#303030",
              "primary": "#041632",
              "primary-fixed-dim": "#b7c7eb",
              "primary-fixed": "#d7e2ff",
              "tertiary": "#001a20",
              "tertiary-fixed-dim": "#8fd0e4",
              "tertiary-container": "#00303a",
              "outline-variant": "#c5c6ce",
              "surface-variant": "#e5e2e1",
              "surface-container-low": "#f6f3f2",
              "surface": "#fcf9f8",
              "tertiary-fixed": "#aeecff",
              "inverse-primary": "#b7c7eb",
              "surface-dim": "#dcd9d9",
              "surface-container-highest": "#e5e2e1",
              "on-primary-container": "#8393b5",
              "secondary-fixed": "#b9eaff",
              "on-tertiary-fixed-variant": "#004e5d",
              "on-surface-variant": "#44474d",
              "surface-tint": "#4f5e7e",
              "on-secondary-fixed": "#001f29",
              "on-primary-fixed": "#091b37",
              "on-secondary-fixed-variant": "#004d61",
              "surface-container": "#f0eded",
              "on-error-container": "#93000a",
              "on-secondary-container": "#2b687d",
              "secondary": "#28657a"
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
<body class="bg-background font-body text-on-background antialiased overflow-hidden">
<!-- Login Container -->
<main class="relative min-h-screen flex flex-col md:flex-row overflow-hidden">
<!-- Left Side: Editorial Branding (Hidden on mobile) -->
<section class="hidden md:flex md:w-1/2 relative vault-gradient items-center justify-center p-16 overflow-hidden">
<!-- Decorative Architectural Element -->
<div class="absolute inset-0 opacity-20 pointer-events-none" data-alt="Monolithic modern architecture with sharp glass angles and deep shadows under a dramatic twilight sky" style="background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuD2vYLX7EXIdDTotwmPvjfgg_1zW5rhWkHVerxgZeAU6Cym4y03Gc4pkMmyXpZV70yhkeMThKowXOa82L6cEhZ3YXDchi4pLn7wSHbwLXCIVZprKVtAAIGmb303lyRwidCW9OTyw8PbE5p3yUPLqeHC7GfAb7pCa_5KHICtQNTggeg9npXqEOXPK63nylYoEuCCpQe4aQOPaSxVGi7Ey3jaLJ3giREm4KZBfA8SaJNmg34jHC2AWbFb5MAxJiUU4Ng0Q5dLVejCenQL'); background-size: cover; background-position: center;">
</div>
<div class="absolute inset-0 bg-primary/40 backdrop-blur-sm"></div>
<div class="relative z-10 max-w-lg">
<div class="mb-12">
<h1 class="font-headline text-6xl font-extrabold tracking-tighter text-surface-container-lowest leading-none">
                        The Architectural <br/> Vault
                    </h1>
</div>
<div class="space-y-6">
<p class="font-headline text-xl text-secondary-fixed opacity-90 leading-relaxed font-light">
                        A secure sanctuary for your digital legacies. Managed with the precision of a curator, protected by the strength of an fortress.
                    </p>
<div class="flex items-center gap-4 py-8">
<div class="h-px w-12 bg-secondary-fixed/30"></div>
<span class="font-label text-xs uppercase tracking-[0.3em] text-secondary-fixed/60">Digital Heritage Protocols</span>
</div>
</div>
</div>
<!-- Absolute Bottom Branding -->
<div class="absolute bottom-12 left-12 flex items-center gap-2">
<span class="material-symbols-outlined text-secondary-fixed" style="font-variation-settings: 'FILL' 1;">verified_user</span>
<span class="font-label text-xs uppercase tracking-widest text-secondary-fixed">Keeplas Sentinel Engine v4.0</span>
</div>
</section>
<!-- Right Side: Interaction Canvas -->
<section class="flex-1 flex flex-col justify-center items-center p-6 md:p-24 relative bg-surface">
<!-- Mobile Brand Logo -->
<div class="md:hidden absolute top-12 left-1/2 -translate-x-1/2">
<span class="font-headline text-2xl font-bold tracking-tighter text-primary">The Vault</span>
</div>
<div class="w-full max-w-md space-y-12">
<!-- Header Section -->
<header class="space-y-3">
<div class="flex items-center gap-3 mb-2">
<span class="material-symbols-outlined text-secondary text-3xl">fingerprint</span>
<span class="font-label text-xs uppercase tracking-widest text-on-surface-variant">Identification Required</span>
</div>
<h2 class="font-headline text-4xl font-bold tracking-tight text-primary">Welcome back, Curator</h2>
<p class="text-on-surface-variant font-body">Access your encrypted archives by verifying your credentials.</p>
</header>
<!-- Form Section -->
<form class="space-y-8">
<div class="space-y-6">
<!-- Email Field -->
<div class="group">
<label class="block font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-2 ml-1" for="email">Archive Identity (Email)</label>
<div class="relative transition-all duration-300">
<input class="w-full bg-surface-container-low border-none rounded-xl py-4 px-6 focus:ring-0 focus:bg-surface-container-high text-on-surface placeholder:text-on-surface-variant/40 transition-colors" id="email" placeholder="name@vault.curator" type="email"/>
</div>
</div>
<!-- Password Field -->
<div class="group">
<div class="flex justify-between items-end mb-2 ml-1">
<label class="block font-label text-[10px] uppercase tracking-widest text-on-surface-variant" for="password">Access Sequence (Password)</label>
<a class="text-[10px] uppercase tracking-widest text-secondary font-bold hover:underline" href="#">Forgot?</a>
</div>
<div class="relative transition-all duration-300">
<input class="w-full bg-surface-container-low border-none rounded-xl py-4 px-6 focus:ring-0 focus:bg-surface-container-high text-on-surface placeholder:text-on-surface-variant/40 transition-colors" id="password" placeholder="••••••••••••" type="password"/>
</div>
</div>
</div>
<!-- CTA Actions -->
<div class="space-y-4">
<button class="w-full vault-gradient text-on-primary py-5 rounded-xl font-headline font-bold text-lg shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300" type="submit">
                            Unlock Vault
                        </button>
<!-- Desktop Biometric Option -->
<button class="hidden md:flex w-full items-center justify-center gap-3 py-4 rounded-xl text-primary font-label text-xs uppercase tracking-widest border border-outline-variant/30 hover:bg-surface-container-low transition-colors" type="button">
<span class="material-symbols-outlined text-xl">face</span>
                            Biometric Authorization
                        </button>
</div>
</form>
<!-- Footer Links -->
<footer class="pt-8 flex flex-col items-center gap-8">
<p class="font-label text-[11px] uppercase tracking-widest text-on-surface-variant">
                        New Curator? <a class="text-secondary font-bold ml-1 hover:underline" href="#">Request Access</a>
</p>
<!-- Security Status Flag -->
<div class="flex items-center gap-4 bg-secondary-container/20 px-6 py-3 rounded-full">
<div class="flex -space-x-1">
<span class="material-symbols-outlined text-secondary text-sm" style="font-variation-settings: 'FILL' 1;">verified</span>
<span class="material-symbols-outlined text-secondary text-sm" style="font-variation-settings: 'FILL' 1;">lock</span>
</div>
<span class="font-label text-[10px] font-bold uppercase tracking-[0.15em] text-on-secondary-container">Vault Encrypted &amp; Secured</span>
</div>
</footer>
</div>
</section>
<!-- Decorative Floating Elements -->
<div class="fixed top-0 right-0 w-96 h-96 bg-secondary/5 blur-[120px] pointer-events-none rounded-full"></div>
<div class="fixed bottom-0 left-0 w-96 h-96 bg-primary/5 blur-[120px] pointer-events-none rounded-full"></div>
</main>
</body></html>

<!-- Signup: Secure Your Legacy -->
<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@200;400;600;700;800&amp;family=Inter:wght@300;400;500;600&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              "on-tertiary-container": "#5a9cae",
              "on-tertiary": "#ffffff",
              "on-primary": "#ffffff",
              "on-error": "#ffffff",
              "surface-container-lowest": "#ffffff",
              "secondary-container": "#abe5fe",
              "on-surface": "#1b1c1c",
              "surface-bright": "#fcf9f8",
              "error-container": "#ffdad6",
              "surface-container-high": "#eae7e7",
              "on-primary-fixed-variant": "#374765",
              "on-tertiary-fixed": "#001f26",
              "inverse-on-surface": "#f3f0ef",
              "primary-container": "#1b2b48",
              "outline": "#75777e",
              "on-background": "#1b1c1c",
              "error": "#ba1a1a",
              "background": "#fcf9f8",
              "secondary-fixed-dim": "#95cfe7",
              "on-secondary": "#ffffff",
              "inverse-surface": "#303030",
              "primary": "#041632",
              "primary-fixed-dim": "#b7c7eb",
              "primary-fixed": "#d7e2ff",
              "tertiary": "#001a20",
              "tertiary-fixed-dim": "#8fd0e4",
              "tertiary-container": "#00303a",
              "outline-variant": "#c5c6ce",
              "surface-variant": "#e5e2e1",
              "surface-container-low": "#f6f3f2",
              "surface": "#fcf9f8",
              "tertiary-fixed": "#aeecff",
              "inverse-primary": "#b7c7eb",
              "surface-dim": "#dcd9d9",
              "surface-container-highest": "#e5e2e1",
              "on-primary-container": "#8393b5",
              "secondary-fixed": "#b9eaff",
              "on-tertiary-fixed-variant": "#004e5d",
              "on-surface-variant": "#44474d",
              "surface-tint": "#4f5e7e",
              "on-secondary-fixed": "#001f29",
              "on-primary-fixed": "#091b37",
              "on-secondary-fixed-variant": "#004d61",
              "surface-container": "#f0eded",
              "on-error-container": "#93000a",
              "on-secondary-container": "#2b687d",
              "secondary": "#28657a"
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
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(20px);
        }
        .vault-gradient {
            background: linear-gradient(135deg, #041632 0%, #1b2b48 100%);
        }
    </style>
</head>
<body class="bg-background font-body text-on-background selection:bg-secondary-fixed selection:text-on-secondary-fixed overflow-x-hidden">
<!-- Top Navigation Suppressed for Focused Signup Journey -->
<main class="min-h-screen flex flex-col md:flex-row">
<!-- Brand/Hero Section: Asymmetric Editorial Layout -->
<section class="hidden md:flex w-1/2 vault-gradient relative overflow-hidden flex-col justify-between p-16">
<!-- Decorative Grain Texture (Simulated with Gradient) -->
<div class="absolute inset-0 opacity-20 pointer-events-none" style="background-image: radial-gradient(#ffffff 0.5px, transparent 0.5px); background-size: 24px 24px;"></div>
<div class="relative z-10">
<h1 class="font-headline text-surface-bright text-4xl font-extrabold tracking-tighter mb-4">Keeplas</h1>
<div class="h-1 w-12 bg-secondary mb-12"></div>
</div>
<div class="relative z-10 max-w-lg">
<span class="font-headline uppercase tracking-[0.2em] text-secondary-fixed text-sm mb-6 block">The Digital Curator</span>
<h2 class="font-headline text-surface-bright text-6xl font-bold leading-[1.1] mb-8 tracking-tight">
                    Secure Your <br/>Digital Legacy.
                </h2>
<p class="text-on-primary-container text-xl leading-relaxed font-light">
                    A private gallery for your most vital assets. Protected by architectural-grade encryption, curated for your next generation.
                </p>
</div>
<div class="relative z-10 flex gap-12 items-center">
<div class="flex flex-col">
<span class="font-headline font-bold text-surface-bright text-2xl tracking-tighter">AES-256</span>
<span class="font-label text-xs uppercase tracking-widest text-on-primary-container">Encryption Standard</span>
</div>
<div class="flex flex-col">
<span class="font-headline font-bold text-surface-bright text-2xl tracking-tighter">2FA</span>
<span class="font-label text-xs uppercase tracking-widest text-on-primary-container">Multi-factor ready</span>
</div>
</div>
<!-- Background Image with data-alt -->
<div class="absolute -bottom-24 -right-24 w-[600px] h-[600px] opacity-10 blur-3xl rounded-full bg-secondary-fixed pointer-events-none"></div>
<img alt="" class="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-30" data-alt="Modern architectural interior with clean lines, concrete surfaces, and soft cinematic lighting creating a sense of security and prestige." src="https://lh3.googleusercontent.com/aida-public/AB6AXuBpe2z21HSYoSNiB8kUX6jnKoKdfqoEhtGOkKVId3cnFl69-C4CraYL58A0J3nCD3tsB70w59-WuShrcejC2ZVlvpxtrJDyleWq16xK8wln3SKqgLho4bttz3Gk1k-il6f0c2UZD5R9TtM7TbFPEs2Ab72CUn8RJuf5UblQH_OdfR1BnuL0RmB2xgGkwME-UyIkWFMG55QWBDeElNBc_wGp2OqRvAMbwDZzyZ6yluD81xYbjdjk_CqvUlpjwYbCrfVm9V6F2eO6jchV"/>
</section>
<!-- Signup Form Section -->
<section class="flex-1 flex items-center justify-center p-8 md:p-24 relative bg-surface">
<!-- Mobile Brand Header -->
<div class="absolute top-8 left-8 md:hidden">
<h1 class="font-headline text-primary text-2xl font-black tracking-tighter">Keeplas</h1>
</div>
<div class="w-full max-w-md">
<!-- Header & Badge -->
<div class="mb-12">
<div class="inline-flex items-center gap-2 px-3 py-1 bg-surface-container-low rounded-full mb-6">
<span class="material-symbols-outlined text-secondary text-sm" data-icon="verified_user">verified_user</span>
<span class="font-label text-[10px] uppercase tracking-widest font-bold text-on-secondary-container">Zero-Knowledge Encryption</span>
</div>
<h3 class="font-headline text-3xl font-bold text-primary tracking-tight mb-2">Create your sanctuary</h3>
<p class="text-on-surface-variant font-body">Enter your details to begin your digital legacy.</p>
</div>
<!-- Form -->
<form class="space-y-6">
<div class="grid grid-cols-1 gap-5">
<div class="space-y-2">
<label class="font-label text-xs uppercase tracking-[0.1em] font-bold text-on-surface-variant ml-1" for="name">Full Name</label>
<input class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline-variant focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container-high transition-all" id="name" placeholder="Julian Voss" type="text"/>
</div>
<div class="space-y-2">
<label class="font-label text-xs uppercase tracking-[0.1em] font-bold text-on-surface-variant ml-1" for="email">Email Address</label>
<input class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline-variant focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container-high transition-all" id="email" placeholder="curator@keeplas.vault" type="email"/>
</div>
<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
<div class="space-y-2">
<label class="font-label text-xs uppercase tracking-[0.1em] font-bold text-on-surface-variant ml-1" for="password">Password</label>
<input class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline-variant focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container-high transition-all" id="password" placeholder="••••••••" type="password"/>
</div>
<div class="space-y-2">
<label class="font-label text-xs uppercase tracking-[0.1em] font-bold text-on-surface-variant ml-1" for="confirm">Confirm</label>
<input class="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline-variant focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container-high transition-all" id="confirm" placeholder="••••••••" type="password"/>
</div>
</div>
</div>
<button class="w-full vault-gradient text-surface-bright font-headline font-bold py-4 rounded-xl shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all flex items-center justify-center gap-2 group" type="submit">
                        Initialize Vault
                        <span class="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1" data-icon="arrow_forward">arrow_forward</span>
</button>
</form>
<!-- Divider -->
<div class="flex items-center my-10 gap-4">
<div class="h-[1px] flex-1 bg-surface-container-high"></div>
<span class="font-label text-[10px] uppercase tracking-widest text-outline-variant">Authorized via</span>
<div class="h-[1px] flex-1 bg-surface-container-high"></div>
</div>
<!-- SSO Options -->
<div class="grid grid-cols-2 gap-4">
<button class="flex items-center justify-center gap-3 bg-surface-container-low hover:bg-surface-container-high py-3 rounded-xl transition-colors border border-outline-variant/10">
<svg class="w-5 h-5" viewbox="0 0 24 24">
<path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v7.005C18.333 21.142 22 17.005 22 12c0-5.523-4.477-10-10-10z" fill="currentColor"></path>
</svg>
<span class="font-label text-xs font-bold text-on-surface">Apple</span>
</button>
<button class="flex items-center justify-center gap-3 bg-surface-container-low hover:bg-surface-container-high py-3 rounded-xl transition-colors border border-outline-variant/10">
<svg class="w-5 h-5" viewbox="0 0 24 24">
<path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.733-.067-1.427-.187-2.053H12.48z" fill="currentColor"></path>
</svg>
<span class="font-label text-xs font-bold text-on-surface">Google</span>
</button>
</div>
<!-- Footer Text -->
<p class="mt-12 text-center text-sm font-body text-on-surface-variant">
                    Already an owner? 
                    <a class="text-primary font-bold hover:underline decoration-secondary decoration-2 underline-offset-4" href="#">Access Vault</a>
</p>
</div>
<!-- Decorative Element: Legacy Card Preview (Tonal Layering) -->
<div class="absolute bottom-12 right-12 hidden lg:block rotate-3">
<div class="bg-primary-container text-on-primary-container p-6 rounded-2xl w-64 shadow-2xl space-y-4">
<div class="flex justify-between items-start">
<span class="material-symbols-outlined text-secondary-fixed opacity-60" data-icon="inventory_2">inventory_2</span>
<span class="font-label text-[10px] tracking-widest uppercase opacity-40">Artifact #812</span>
</div>
<div>
<p class="font-headline font-bold text-surface-bright leading-tight">Property Deed: <br/>Lake Como Villa</p>
<p class="text-xs opacity-50 mt-1">Stored June 2024</p>
</div>
<div class="h-1 w-full bg-surface-container-highest/20 rounded-full overflow-hidden">
<div class="h-full w-2/3 bg-secondary-fixed"></div>
</div>
</div>
</div>
</section>
</main>
<!-- Floating Security Badge for reassurance -->
<div class="fixed bottom-8 left-8 hidden md:flex items-center gap-3 glass-panel px-4 py-3 rounded-2xl shadow-xl border border-white/20">
<div class="w-2 h-2 rounded-full bg-secondary-fixed animate-pulse"></div>
<span class="font-label text-xs font-medium text-primary tracking-wide">Infrastructure Online: 99.9% Uptime</span>
</div>
</body></html>