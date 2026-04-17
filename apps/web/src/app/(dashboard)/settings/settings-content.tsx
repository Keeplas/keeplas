"use client";

import { useEffect, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Input, Label, Select, Spinner, Switch, ErrorAlert } from "@keeplas/ui";

const SECTIONS = [
  {
    id: "identity",
    label: "Identity",
    icon: "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z",
  },
  {
    id: "security",
    label: "Security",
    icon: "M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z",
  },
  {
    id: "preferences",
    label: "Preferences",
    icon: "M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0",
  },
  {
    id: "access",
    label: "Vault Access",
    icon: "M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z",
  },
  {
    id: "billing",
    label: "Billing",
    icon: "M2.25 8.25h19.5M2.25 9v10.125c0 1.036.84 1.875 1.875 1.875h15.75c1.035 0 1.875-.84 1.875-1.875V9M10 14h4",
  },
];

const LANGUAGES = [
  { value: "en-US", label: "English (United States)" },
  { value: "fr-FR", label: "French (Français)" },
  { value: "es-ES", label: "Spanish (Español)" },
  { value: "sw-KE", label: "Swahili (Kiswahili)" },
  { value: "ja-JP", label: "Japanese (日本語)" },
];

const CURRENCIES = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "KES", label: "KES (KSh)" },
];

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "Europe/Paris", label: "Europe / Paris" },
  { value: "Europe/London", label: "Europe / London" },
  { value: "America/New_York", label: "America / New York" },
  { value: "Africa/Nairobi", label: "Africa / Nairobi" },
  { value: "Asia/Tokyo", label: "Asia / Tokyo" },
];

interface NotificationPrefs {
  lifeCheckReminders: boolean;
  vaultAccessAlerts: boolean;
  newsletterUpdates: boolean;
}

interface SecurityPrefs {
  twoFactor: boolean;
  biometric: boolean;
}

const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  lifeCheckReminders: true,
  vaultAccessAlerts: true,
  newsletterUpdates: false,
};

const DEFAULT_SECURITY: SecurityPrefs = {
  twoFactor: false,
  biometric: false,
};

export function SettingsContent() {
  const user = useQuery(api.users.viewer);
  const updateProfile = useMutation(api.users.updateProfile);
  const updatePreferences = useMutation(api.users.updatePreferences);
  const { signOut } = useAuthActions();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [language, setLanguage] = useState("en-US");
  const [timezone, setTimezone] = useState("UTC");
  const [currency, setCurrency] = useState("USD");
  const [notifications, setNotifications] = useState<NotificationPrefs>(DEFAULT_NOTIFICATIONS);
  const [security, setSecurity] = useState<SecurityPrefs>(DEFAULT_SECURITY);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setPhone(user.phoneNumber ?? "");
      setAvatarUrl(user.avatarUrl ?? "");
      setLanguage(user.language ?? "en-US");
      setTimezone(user.timezone ?? "UTC");
    }
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedCurrency = window.localStorage.getItem("keeplas.currency");
    const storedNotif = window.localStorage.getItem("keeplas.notifications");
    const storedSec = window.localStorage.getItem("keeplas.security");
    if (storedCurrency) setCurrency(storedCurrency);
    if (storedNotif) {
      try {
        setNotifications({ ...DEFAULT_NOTIFICATIONS, ...JSON.parse(storedNotif) });
      } catch {}
    }
    if (storedSec) {
      try {
        setSecurity({ ...DEFAULT_SECURITY, ...JSON.parse(storedSec) });
      } catch {}
    }
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setError("");
    setProfileSaved(false);
    try {
      await updateProfile({
        name,
        phoneNumber: phone,
        avatarUrl,
      });
      setProfileSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSavePreferences(e: React.FormEvent) {
    e.preventDefault();
    setSavingPrefs(true);
    setError("");
    setPrefsSaved(false);
    try {
      await updatePreferences({ language, timezone });
      if (typeof window !== "undefined") {
        window.localStorage.setItem("keeplas.currency", currency);
        window.localStorage.setItem("keeplas.notifications", JSON.stringify(notifications));
      }
      setPrefsSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save preferences");
    } finally {
      setSavingPrefs(false);
    }
  }

  function toggleNotification(key: keyof NotificationPrefs) {
    setNotifications((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (typeof window !== "undefined") {
        window.localStorage.setItem("keeplas.notifications", JSON.stringify(next));
      }
      return next;
    });
  }

  function toggleSecurity(key: keyof SecurityPrefs) {
    setSecurity((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (typeof window !== "undefined") {
        window.localStorage.setItem("keeplas.security", JSON.stringify(next));
      }
      return next;
    });
  }

  if (user === undefined) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner />
      </div>
    );
  }

  if (user === null) return null;

  const initials = (user.name || user.email || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const curatorSince = user._creationTime
    ? new Date(user._creationTime).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : "Unknown";

  return (
    <div className="max-w-6xl mx-auto space-y-16 md:space-y-20">
      {/* Editorial Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <span className="text-secondary font-headline font-extrabold uppercase tracking-[0.2em] text-xs">
            Settings & Curation
          </span>
          <h1 className="text-primary font-headline text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-none">
            Identity & Control.
          </h1>
        </div>
        <p className="text-on-surface-variant max-w-sm leading-relaxed">
          Configure your digital sanctuary. These settings ensure your legacy remains protected and accessible only to those you trust.
        </p>
      </header>

      {/* Sticky section nav */}
      <nav className="sticky top-20 z-20 bg-surface/80 backdrop-blur-xl -mx-6 md:mx-0 md:rounded-2xl overflow-x-auto">
        <ul className="flex items-center gap-1 py-3 px-6 md:px-4">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={section.icon} />
                </svg>
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {error && <ErrorAlert message={error} />}

      {/* IDENTITY */}
      <section id="identity" className="grid grid-cols-1 md:grid-cols-12 gap-8 scroll-mt-32">
        <div className="md:col-span-4 space-y-4">
          <h2 className="text-primary font-headline text-2xl font-bold tracking-tight">
            Identity Details
          </h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Your profile information is encrypted at rest. Update your public-facing curator details here.
          </p>
        </div>

        <form
          onSubmit={handleSaveProfile}
          className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6"
        >
          {/* Profile Card */}
          <div className="col-span-full bg-surface-container-low rounded-2xl p-8 flex flex-col sm:flex-row items-start sm:items-center gap-8">
            <div className="relative group shrink-0">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={name || "Profile"}
                  className="w-24 h-24 rounded-full object-cover shadow-xl border-4 border-surface"
                  onError={() => setAvatarUrl("")}
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-on-primary font-headline font-bold text-2xl shadow-xl border-4 border-surface">
                  {initials}
                </div>
              )}
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <h3 className="font-headline text-xl font-bold text-primary truncate">
                {name || "Unnamed Curator"}
              </h3>
              <p className="text-sm text-on-surface-variant truncate">
                Curator since {curatorSince}
              </p>
              <div className="pt-2 flex flex-wrap gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold font-headline uppercase tracking-wider bg-secondary-container text-on-secondary-container">
                  Verified Identity
                </span>
                {user.recoveryVerified && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold font-headline uppercase tracking-wider bg-primary-container text-on-primary-container">
                    Recovery Set
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="bg-surface-container-low rounded-2xl p-6 space-y-2">
            <Label htmlFor="display-name" className="text-[10px] uppercase tracking-widest font-bold text-secondary font-headline">
              Display Name
            </Label>
            <Input
              id="display-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="bg-surface-container-low rounded-2xl p-6 space-y-2">
            <Label htmlFor="email" className="text-[10px] uppercase tracking-widest font-bold text-secondary font-headline">
              Primary Email
            </Label>
            <Input
              id="email"
              type="email"
              value={user.email ?? ""}
              disabled
              className="opacity-70"
            />
            <p className="text-[10px] text-on-surface-variant mt-1">
              Managed by your auth provider
            </p>
          </div>

          <div className="bg-surface-container-low rounded-2xl p-6 space-y-2">
            <Label htmlFor="phone" className="text-[10px] uppercase tracking-widest font-bold text-secondary font-headline">
              Phone Number
            </Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div className="bg-surface-container-low rounded-2xl p-6 space-y-2">
            <Label htmlFor="avatar" className="text-[10px] uppercase tracking-widest font-bold text-secondary font-headline">
              Avatar URL
            </Label>
            <Input
              id="avatar"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="col-span-full flex items-center justify-end gap-4">
            {profileSaved && (
              <span className="text-xs text-secondary font-medium">Profile updated ✓</span>
            )}
            <button
              type="submit"
              disabled={savingProfile}
              className="px-8 py-3 vault-gradient text-on-primary font-headline font-bold rounded-xl shadow-lg shadow-primary/10 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
            >
              {savingProfile ? "Saving..." : "Save Identity"}
            </button>
          </div>
        </form>
      </section>

      {/* SECURITY */}
      <section id="security" className="scroll-mt-32 flex flex-col md:flex-row gap-8 md:gap-12 items-start">
        <div className="md:w-1/3 md:sticky md:top-40">
          <h2 className="text-primary font-headline text-2xl font-bold tracking-tight mb-4">
            Fortress Protocol
          </h2>
          <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
            Security is the bedrock of The Vault. Enable biometric layers for instantaneous yet unbreakable access.
          </p>
          <div className="p-6 bg-primary-container rounded-2xl text-on-primary-container space-y-4">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-secondary-fixed" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4Zm-1 16-4-4 1.41-1.41L11 14.17l5.59-5.59L18 10l-7 7Z" />
              </svg>
              <span className="font-bold font-headline text-xs uppercase tracking-widest text-on-primary">
                Sentinel Active
              </span>
            </div>
            <p className="text-xs text-on-primary-container leading-loose">
              Your vault is currently protected by 256-bit AES encryption and zero-knowledge cryptography.
            </p>
          </div>
        </div>

        <div className="md:w-2/3 space-y-6 flex-1">
          <div className="bg-surface-container-low rounded-2xl overflow-hidden">
            <div className="p-8 flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-headline font-bold text-primary">Two-Factor Authentication</p>
                <p className="text-xs text-on-surface-variant">Recommended for all high-value legacies.</p>
              </div>
              <Switch
                checked={security.twoFactor}
                onCheckedChange={() => toggleSecurity("twoFactor")}
              />
            </div>
            <div className="h-px bg-outline-variant/15 mx-8" />
            <div className="p-8 flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-headline font-bold text-primary">Biometric Access</p>
                <p className="text-xs text-on-surface-variant">Unlock your vault using FaceID or TouchID.</p>
              </div>
              <Switch
                checked={security.biometric}
                onCheckedChange={() => toggleSecurity("biometric")}
              />
            </div>
            <div className="h-px bg-outline-variant/15 mx-8" />
            <div className="p-8 flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-headline font-bold text-primary">Hardware Key Support</p>
                <p className="text-xs text-on-surface-variant">Register a physical YubiKey or Titan key.</p>
              </div>
              <button className="text-secondary font-headline text-xs font-bold uppercase tracking-widest hover:underline cursor-pointer">
                Manage Keys
              </button>
            </div>
          </div>

          <button className="w-full p-6 bg-surface-container-high rounded-2xl flex items-center justify-between group hover:bg-surface-container-highest transition-colors cursor-pointer">
            <div className="flex items-center gap-4">
              <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
              </svg>
              <span className="font-headline font-bold text-primary">Reset Master Password</span>
            </div>
            <svg className="w-5 h-5 text-on-surface-variant group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          <button
            onClick={() => signOut()}
            className="w-full p-6 bg-error-container/40 rounded-2xl flex items-center justify-between group hover:bg-error-container/60 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <svg className="w-6 h-6 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
              <span className="font-headline font-bold text-error">Sign out of this session</span>
            </div>
            <svg className="w-5 h-5 text-error/60 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </section>

      {/* PREFERENCES */}
      <section id="preferences" className="scroll-mt-32 space-y-6">
        <form onSubmit={handleSavePreferences} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Platform */}
          <div className="bg-surface-container-low rounded-2xl p-8 space-y-6">
            <div className="space-y-2">
              <h2 className="text-primary font-headline text-xl font-bold tracking-tight">
                Platform Localization
              </h2>
              <p className="text-xs text-on-surface-variant">
                Define how your legacy is presented across global regions.
              </p>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest font-bold text-secondary font-headline">
                  Interface Language
                </Label>
                <Select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest font-bold text-secondary font-headline">
                  Timezone
                </Label>
                <Select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest font-bold text-secondary font-headline">
                  Currency Display
                </Label>
                <Select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-surface-container-low rounded-2xl p-8 space-y-6">
            <div className="space-y-2">
              <h2 className="text-primary font-headline text-xl font-bold tracking-tight">
                Alert Preferences
              </h2>
              <p className="text-xs text-on-surface-variant">
                Control the frequency of Life Checks and vault synchronization alerts.
              </p>
            </div>
            <div className="space-y-5">
              {[
                {
                  key: "lifeCheckReminders" as const,
                  label: "Life Check Reminders",
                  description: "Bi-weekly proof-of-life verification.",
                },
                {
                  key: "vaultAccessAlerts" as const,
                  label: "Vault Access Alerts",
                  description: "Instant push notification on login.",
                },
                {
                  key: "newsletterUpdates" as const,
                  label: "Newsletter & Updates",
                  description: "Occasional legacy planning insights.",
                },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-headline font-bold text-sm text-primary truncate">
                      {item.label}
                    </p>
                    <p className="text-[11px] text-on-surface-variant">
                      {item.description}
                    </p>
                  </div>
                  <Switch
                    checked={notifications[item.key]}
                    onCheckedChange={() => toggleNotification(item.key)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-full flex items-center justify-end gap-4">
            {prefsSaved && (
              <span className="text-xs text-secondary font-medium">Preferences saved ✓</span>
            )}
            <button
              type="submit"
              disabled={savingPrefs}
              className="px-8 py-3 vault-gradient text-on-primary font-headline font-bold rounded-xl shadow-lg shadow-primary/10 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
            >
              {savingPrefs ? "Saving..." : "Save Preferences"}
            </button>
          </div>
        </form>
      </section>

      {/* VAULT ACCESS */}
      <section id="access" className="scroll-mt-32 grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-4 space-y-4">
          <h2 className="text-primary font-headline text-2xl font-bold tracking-tight">
            Vault Access
          </h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Manage who may reach your vault in an emergency, and review access history.
          </p>
        </div>
        <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a
            href="/trusted-contacts"
            className="bg-surface-container-low p-6 rounded-2xl flex items-center justify-between hover:bg-surface-container transition-colors group"
          >
            <div>
              <p className="font-headline font-bold text-primary">Trusted Contacts</p>
              <p className="text-xs text-on-surface-variant mt-1">Recovery partners & guardians</p>
            </div>
            <svg className="w-5 h-5 text-outline-variant group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </a>
          <a
            href="/life-check"
            className="bg-surface-container-low p-6 rounded-2xl flex items-center justify-between hover:bg-surface-container transition-colors group"
          >
            <div>
              <p className="font-headline font-bold text-primary">Life Check Protocol</p>
              <p className="text-xs text-on-surface-variant mt-1">Proof of life configuration</p>
            </div>
            <svg className="w-5 h-5 text-outline-variant group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </a>
          <a
            href="/emergency-card"
            className="bg-surface-container-low p-6 rounded-2xl flex items-center justify-between hover:bg-surface-container transition-colors group"
          >
            <div>
              <p className="font-headline font-bold text-primary">Emergency Card</p>
              <p className="text-xs text-on-surface-variant mt-1">Public safety profile</p>
            </div>
            <svg className="w-5 h-5 text-outline-variant group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </a>
          <div className="bg-surface-container-low p-6 rounded-2xl flex items-center justify-between opacity-60">
            <div>
              <p className="font-headline font-bold text-primary">Access Audit Log</p>
              <p className="text-xs text-on-surface-variant mt-1">Coming soon</p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Soon
            </span>
          </div>
        </div>
      </section>

      {/* BILLING — Legacy Card visual anchor */}
      <section id="billing" className="scroll-mt-32 bg-primary text-on-primary rounded-2xl p-8 md:p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-secondary opacity-10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-10">
          <div className="space-y-4 max-w-xl">
            <span className="inline-flex items-center px-3 py-1 bg-on-primary/10 backdrop-blur rounded-full text-[10px] font-bold font-headline uppercase tracking-widest ghost-border">
              Current Tier
            </span>
            <h2 className="text-3xl md:text-4xl font-headline font-black tracking-tight">
              Pro Legacy Curator
            </h2>
            <p className="text-on-primary/70 leading-relaxed">
              You are currently utilizing the Pro tier, which includes 50GB encrypted storage, unlimited heirs, and automated Life Checks.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 shrink-0">
            <div className="p-6 bg-on-primary/5 backdrop-blur rounded-xl ghost-border min-w-[180px]">
              <p className="text-[10px] uppercase tracking-widest text-secondary-fixed font-bold mb-1">
                Renewal Date
              </p>
              <p className="text-xl font-headline font-bold">—</p>
              <p className="text-[10px] text-on-primary/50 mt-1 uppercase tracking-widest">
                Free plan active
              </p>
            </div>
            <button className="bg-secondary-fixed text-on-secondary-fixed px-6 py-4 rounded-xl font-headline font-extrabold uppercase tracking-widest text-xs hover:bg-secondary-fixed-dim transition-colors cursor-pointer">
              Upgrade Plan
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
