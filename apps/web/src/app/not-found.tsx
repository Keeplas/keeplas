import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-display-lg text-primary">404</h1>
      <p className="text-body-lg text-on-surface-variant">Page not found</p>
      <Link
        href="/"
        className="mt-4 px-6 py-2 rounded-xl gradient-signature text-on-primary font-medium hover:opacity-90 transition-opacity"
      >
        Go home
      </Link>
    </div>
  );
}
