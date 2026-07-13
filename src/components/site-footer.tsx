import { Link } from "@tanstack/react-router";
import { Instagram, MapPin, Phone, Mail } from "lucide-react";
import { gym } from "@/integrations/gym";

export function SiteFooter() {
  return (
    <footer className="w-full border-t border-border/50 bg-surface/40">
      {/* Removed mx-auto and max-w-7xl. Set to full width with consistent edge padding */}
      <div className="w-full grid gap-10 px-4 py-14 sm:px-8 md:grid-cols-4">
        
        {/* Brand Pitch & Socials */}
        <div className="md:col-span-2">
          <div className="font-display text-2xl font-extrabold tracking-tight">
            SR <span className="text-primary"> GYM </span> AND FITNESS CENTRE
          </div>
          <p className="mt-3 max-w-md text-sm text-muted-foreground leading-relaxed">
            Transform your body. Transform your life. Premium strength training, expert coaching
            and a community that pushes you forward — every single rep.
          </p>
          <div className="mt-5 flex gap-3">
            {[Instagram].map((Icon, i) => (
              <a
                key={i}
                href="https://www.instagram.com/sr_gym_and_fitness?igsh=MTlvOW42Ymdpdmhi"
                target="_blank"
                rel="noopener noreferrer"
                className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface text-muted-foreground transition hover:border-primary hover:text-primary"
                aria-label="Instagram"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="text-sm font-semibold text-foreground">Explore</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/about" className="hover:text-primary transition">About</Link></li>
            <li><Link to="/plans" className="hover:text-primary transition">Membership Plans</Link></li>
            <li><Link to="/stories" className="hover:text-primary transition">Success Stories</Link></li>
            <li><Link to="/contact" className="hover:text-primary transition">Contact</Link></li>
          </ul>
        </div>

        {/* Contact Information */}
        <div>
          <h4 className="text-sm font-semibold text-foreground">Contact</h4>
          <ul className="mt-3 space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" /> 
              <span>{gym.locationText}</span>
            </li>
            <li className="flex gap-2">
              <Phone className="h-4 w-4 mt-0.5 text-primary shrink-0" /> 
              <a href="tel:+918072287744" className="hover:text-primary transition">+91 8072 287 744</a>
            </li>
            <li className="flex gap-2">
              <Mail className="h-4 w-4 mt-0.5 text-primary shrink-0" /> 
              <a href="mailto:srgym2019@gmail.com" className="hover:text-primary transition">srgym2019@gmail.com</a>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Copyright Strip — Aligned with the layout edges */}
      <div className="w-full border-t border-border/50 px-4 py-5 sm:px-8 flex flex-col sm:flex-row justify-between gap-4 text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} SR GYM AND FITNESS CENTRE. All rights reserved.</p>
        <div className="flex gap-4">
          <a href="#" className="hover:underline">Privacy Policy</a>
          <a href="#" className="hover:underline">Terms of Service</a>
        </div>
      </div>
    </footer>
  );
}