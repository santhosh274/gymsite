import { Link } from "@tanstack/react-router";
import { Instagram, Facebook, Youtube, MapPin, Phone, Mail } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/50 bg-surface/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="font-display text-2xl font-extrabold tracking-tight">
            SR<span className="text-primary">GYM</span> AND FITNESS CENTRE
          </div>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            Transform your body. Transform your life. Premium strength training, expert coaching
            and a community that pushes you forward — every single rep.
          </p>
          <div className="mt-5 flex gap-3">
            {[Instagram, Facebook, Youtube].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface text-muted-foreground transition hover:border-primary hover:text-primary"
                aria-label="social"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground">Explore</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/about" className="hover:text-primary">About</Link></li>
            <li><Link to="/plans" className="hover:text-primary">Membership Plans</Link></li>
            <li><Link to="/trainers" className="hover:text-primary">Trainers</Link></li>
            <li><Link to="/stories" className="hover:text-primary">Success Stories</Link></li>
            <li><Link to="/contact" className="hover:text-primary">Contact</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground">Contact</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" /> Main Road, Sector 12, Your City</li>
            <li className="flex gap-2"><Phone className="h-4 w-4 mt-0.5 text-primary shrink-0" /> +91 98765 43210</li>
            <li className="flex gap-2"><Mail className="h-4 w-4 mt-0.5 text-primary shrink-0" /> hello@srgym.fit</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/50 px-4 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} SRGYM AND FITNESS CENTRE. All rights reserved.
      </div>
    </footer>
  );
}
