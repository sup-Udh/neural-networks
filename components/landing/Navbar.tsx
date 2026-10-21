"use client";

import { useState } from "react";
import Link from "next/link";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="site-header">
      <div className="nav-wrap">
        <Link className="brand-lockup" href="/" aria-label="NeuralArc home" onClick={closeMenu}>
          <span>Neural<span>Arc</span></span>
        </Link>
        <button
          className={`menu-toggle ${menuOpen ? "is-open" : ""}`}
          type="button"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span /><span />
        </button>
        <nav className={`primary-nav ${menuOpen ? "menu-open" : ""}`} id="primary-navigation" aria-label="Main navigation">
          <Link href="/#home" onClick={closeMenu}>Home</Link>
          <Link href="/#about" onClick={closeMenu}>About</Link>
          <Link className="nav-cta" href="/get-started" onClick={closeMenu}>Get Started <span aria-hidden="true">↗</span></Link>
        </nav>
      </div>
    </header>
  );
}
