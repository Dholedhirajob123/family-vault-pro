import { Link, useNavigate } from "@tanstack/react-router";
import { Home, Users, Search, LogIn, LogOut, ShieldCheck, Moon, Sun, FileText } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";

export function Nav() {
  const { user, isAdmin, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  return (
    <header className="sticky top-4 z-50 mx-4 mt-4">
      <div className="glass mx-auto flex max-w-6xl items-center justify-between gap-2 rounded-2xl px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary shadow">
            <FileText className="h-5 w-5" />
          </div>
          <span className="hidden sm:block">Dhole Family Portal</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavItem to="/" icon={<Home className="h-4 w-4" />} label="Home" />
          <NavItem to="/members" icon={<Users className="h-4 w-4" />} label="Members" />
          <NavItem to="/search" icon={<Search className="h-4 w-4" />} label="Search" />
          <NavItem to="/categories" icon={<Tag className="h-4 w-4" />} label="Categories" />
          {isAdmin && <NavItem to="/admin" icon={<ShieldCheck className="h-4 w-4" />} label="Admin" />}
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme" className="rounded-full">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {user ? (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={async () => {
                await signOut();
                navigate({ to: "/" });
              }}
            >
              <LogOut className="mr-1 h-4 w-4" /> Logout
            </Button>
          ) : (
            <Button size="sm" className="rounded-full gradient-primary border-0" onClick={() => navigate({ to: "/auth" })}>
              <LogIn className="mr-1 h-4 w-4" /> Admin Login
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      activeProps={{ className: "bg-accent text-accent-foreground" }}
      activeOptions={{ exact: to === "/" }}
    >
      {icon}
      {label}
    </Link>
  );
}
