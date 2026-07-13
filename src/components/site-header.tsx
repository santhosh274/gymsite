import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X, Dumbbell } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.png";

const nav = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/plans", label: "Plans" },
  { to: "/stories", label: "Stories" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, isAdmin } = useAuth();

  return (
    <header className="w-full sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      {/* Removed mx-auto and max-w-7xl. Set to full width with custom responsive padding */}
      <div className="w-full flex h-16 items-center justify-between px-4 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logo} alt="SR GYM" className="h-12 w-11 rounded-md object-cover" />
          <span className="font-display text-base font-extrabold tracking-tight">
            SR <span className="text-primary"> GYM</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop User Actions */}
        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              {isAdmin && (
                <Button asChild variant="ghost" size="sm">
                  <Link to="/admin">Admin</Link>
                </Button>
              )}
              <Button asChild size="sm" className="bg-gradient-red text-primary-foreground hover:opacity-90">
                <Link to="/dashboard">
                  <Dumbbell className="mr-1 h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth">Login</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2 -mr-2 text-foreground"
          aria-label="Toggle menu"
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Drawer Dropdown */}
      {open && (
        <div className="w-full border-t border-border/50 bg-background md:hidden">
          <nav className="flex flex-col px-4 py-3 sm:px-8">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-border/50 pt-3">
              {user ? (
                <Button asChild className="bg-gradient-red text-primary-foreground w-full">
                  <Link to="/dashboard" onClick={() => setOpen(false)}>Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/auth" onClick={() => setOpen(false)}>Login</Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}