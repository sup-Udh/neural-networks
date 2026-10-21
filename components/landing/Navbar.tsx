"use client";

import { useState } from "react";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="site-header">
      <div className="nav-wrap">
        <a className="brand-lockup" href="#home" aria-label="NeuralArc home" onClick={closeMenu}>
          <span>Neural<span>Arc</span></span>
        </a>
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
          <a href="#home" onClick={closeMenu}>Home</a>
          <a href="#about" onClick={closeMenu}>About</a>
          <a className="nav-cta" href="#playground" onClick={closeMenu}>Get Started <span aria-hidden="true">↗</span></a>
        </nav>
      </div>
    </header>
  );
}
