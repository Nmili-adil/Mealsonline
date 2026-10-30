"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { List, X } from "@phosphor-icons/react";
import { CartButton } from "./CartButton";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="store-header">
      <div className="store-header-inner page-width">
        <Link href="/" className="store-logo" aria-label="MealsOnline, accueil">
          <Image src="/images/logo-mealsonline-clean.png" alt="MealsOnline" width={150} height={48} />
        </Link>

        <nav className="store-nav" aria-label="Navigation">
          <Link href="/menu">Menu</Link>
          <Link href="/#brands">Nos marques</Link>
          <Link href="/about">À propos</Link>
          <Link href="/contact">Contact</Link>
        </nav>

        <CartButton />

        <button
          type="button"
          className="store-mobile-toggle"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        >
          {open ? <X weight="bold" aria-hidden="true" /> : <List weight="bold" aria-hidden="true" />}
        </button>
      </div>

      {open ? (
        <nav className="store-nav mobile" style={{ padding: "4px 20px 18px", flexWrap: "wrap" }}>
          <Link href="/menu" onClick={() => setOpen(false)}>Menu</Link>
          <Link href="/#brands" onClick={() => setOpen(false)}>Nos marques</Link>
          <Link href="/about" onClick={() => setOpen(false)}>À propos</Link>
          <Link href="/contact" onClick={() => setOpen(false)}>Contact</Link>
        </nav>
      ) : null}
    </header>
  );
}
