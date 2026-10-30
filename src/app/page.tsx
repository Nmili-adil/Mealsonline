"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  BagSimple,
  ChefHat,
  List,
  MapPin,
  Scooter,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { CartButton } from "@/components/store/CartButton";
import { FeaturedProducts } from "@/components/store/FeaturedProducts";
import { RestaurantInfoSection } from "@/components/store/RestaurantInfoSection";

const whatsappOrder =
  "https://wa.me/?text=Bonjour%20MealsOnline%2C%20je%20souhaite%20passer%20une%20commande.";

const brands = [
  {
    name: "PizzaHub",
    tagline: "Pizzas artisanales",
    image: "/images/brand-pizzahub.png",
    logo: "/images/logo-pizzahub-v2.png",
    logoWidth: 220,
    logoHeight: 66,
    accent: "#ef2638",
    menu: "/menu?brand=pizzahub",
  },
  {
    name: "CIAO PASTA",
    tagline: "Cuisine italienne authentique",
    image: "/images/brand-ciao-pasta.png",
    logo: "/images/logo-ciao-v2.png",
    logoWidth: 235,
    logoHeight: 60,
    accent: "#58a644",
    menu: "/menu?brand=ciao-pasta",
  },
  {
    name: "SMASH IT BURGERS",
    tagline: "Burgers gourmets",
    image: "/images/brand-smash-burger.png",
    logo: "/images/logo-smash-v2.png",
    logoWidth: 180,
    logoHeight: 85,
    accent: "#efb13a",
    menu: "/menu?brand=smash-burgers",
  },
];

export default function Home() {
  return (
    <main className="site-shell">
      <section className="hero" id="accueil">
        <Image
          src="/images/hero-mealsonline.png"
          alt="Pizza, pâtes et smash burger servis dans une ambiance nocturne à Marrakech"
          fill
          preload
          className="hero-image"
          sizes="100vw"
        />
        <div className="hero-shade" />

        <header className="topbar page-width" aria-label="Navigation principale">
          <a className="brand-lockup" href="#accueil" aria-label="MealsOnline, accueil">
            <Image
              src="/images/logo-mealsonline-clean.png"
              alt="MealsOnline"
              width={210}
              height={66}
            />
          </a>

          <nav className="desktop-nav" aria-label="Pages">
            <a href="/menu">Menu</a>
            <a href="#brands">Nos marques</a>
            <a href="#location">À propos</a>
            <a href="/contact">Contact</a>
          </nav>

          <a className="location-mini" href="#location">
            <MapPin weight="fill" aria-hidden="true" />
            <span>Hay Izdihar, Marrakech</span>
          </a>

          <CartButton />

          <a className="button button-compact" href="/menu">
            Commander <ArrowRight weight="bold" aria-hidden="true" />
          </a>

          <details className="mobile-menu">
            <summary aria-label="Ouvrir le menu">
              <List weight="bold" aria-hidden="true" />
            </summary>
            <nav>
              <a href="/menu">Menu</a>
              <a href="#brands">Nos marques</a>
              <a href="#location">À propos</a>
              <a href="/contact">Contact</a>
              <a href="/menu">Commander</a>
            </nav>
          </details>
        </header>

        <div className="page-width hero-content">
          <div className="hero-copy">
            <h1>
              Trois envies.
              <span>Une seule adresse.</span>
            </h1>
            <p>
              Pizza artisanale, pasta généreuse et smash burgers, préparés à Hay Izdihar.
            </p>
            <div className="hero-actions">
              <a className="button" href="/menu">
                Commander maintenant <ArrowRight weight="bold" aria-hidden="true" />
              </a>
              <a className="button button-outline" href="#brands">
                Découvrir nos marques <ArrowRight weight="bold" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="brands-section" id="brands">
        <div className="section-title">
          <span className="ornament" aria-hidden="true">◆</span>
          <h2>
            Choisissez <em>votre cuisine</em>
          </h2>
        </div>

        <div className="brand-grid page-width">
          {brands.map((brand) => (
            <article
              className="brand-panel"
              key={brand.name}
              style={{ "--brand-accent": brand.accent } as CSSProperties}
            >
              <Image
                src={brand.image}
                alt={`${brand.name} — ${brand.tagline}`}
                fill
                loading="eager"
                className="brand-food"
                sizes="(max-width: 760px) 90vw, 31vw"
              />
              <div className="brand-heading">
                <Image
                  src={brand.logo}
                  alt={brand.name}
                  width={brand.logoWidth}
                  height={brand.logoHeight}
                  loading="eager"
                  className="brand-logo"
                />
                <p>{brand.tagline}</p>
              </div>
              <a className="brand-link" href={brand.menu}>
                Voir le menu <ArrowRight weight="bold" aria-hidden="true" />
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="benefits" aria-label="Nos avantages">
        <div className="benefits-inner page-width">
          <div className="benefit">
            <Scooter weight="light" aria-hidden="true" />
            <strong>Livraison rapide</strong>
          </div>
          <div className="benefit">
            <ChefHat weight="light" aria-hidden="true" />
            <strong>Ingrédients frais</strong>
          </div>
          <div className="benefit">
            <BagSimple weight="light" aria-hidden="true" />
            <strong>Sur place ou à emporter</strong>
          </div>
        </div>
      </section>

      <FeaturedProducts />

      <RestaurantInfoSection />

      <section className="location-section" id="location">
        <Image
          src="/images/location-mealsonline.png"
          alt="Restaurant MealsOnline à Hay Izdihar, Marrakech"
          fill
          loading="eager"
          className="location-image"
          sizes="100vw"
        />
        <div className="location-shade" />
        <div className="page-width location-content">
          <div className="location-copy">
            <span className="eyebrow">Notre emplacement</span>
            <h2>
              Au cœur de <em>Hay Izdihar</em>
            </h2>
            <p>
              Venez découvrir nos pizzas, pasta et burgers gourmands dans une ambiance conviviale,
              ou passez votre commande en ligne pour une livraison rapide.
            </p>
            <a className="address" href="https://maps.google.com/?q=Hay+Izdihar+Marrakech" target="_blank" rel="noreferrer">
              <MapPin weight="fill" aria-hidden="true" />
              <span>Hay Izdihar, Marrakech</span>
            </a>
            <a className="button location-button" href="/menu">
              Commander maintenant <ArrowRight weight="bold" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-inner page-width">
          <a href="#accueil" aria-label="MealsOnline, retour en haut">
            <Image src="/images/logo-mealsonline-clean.png" alt="MealsOnline" width={190} height={60} />
          </a>
          <nav aria-label="Navigation de pied de page">
            <a href="#brands">Nos marques</a>
            <a href="/menu">Menu</a>
            <a href="#location">À propos</a>
            <a href="/contact">Contact</a>
          </nav>
          <a className="footer-location" href="#location">
            <MapPin weight="fill" aria-hidden="true" /> Hay Izdihar, Marrakech
          </a>
        </div>
      </footer>

      <a
        className="whatsapp"
        href={whatsappOrder}
        target="_blank"
        rel="noreferrer"
        aria-label="Commander sur WhatsApp"
      >
        <WhatsappLogo weight="fill" aria-hidden="true" />
      </a>
    </main>
  );
}
