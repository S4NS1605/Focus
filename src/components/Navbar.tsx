import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';

export const Navbar: React.FC = () => {
  const { language, toggleLanguage, t } = useLanguage();

  const handleScroll = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>, targetId: string) => {
    e.preventDefault();
    const element = document.getElementById(targetId);
    if (element) {
      const offset = 80; // height of the sticky header
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-black/60 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-6 md:px-12">
        {/* Monogram Logo on Left */}
        <a href="#hero" className="flex items-center gap-2 outline-none group" aria-label="Julian Gonzalez Portfolio Home">
          <img 
            src="/imagenarribaJulianGonzalez.webp" 
            alt="Julian Gonzalez Monogram" 
            className="h-7 w-auto object-contain brightness-100 transition-opacity group-hover:opacity-80"
          />
        </a>

        {/* Navigation Buttons and Language Toggle on Right */}
        <nav className="flex items-center gap-4" aria-label="Navegación principal">
          {/* Language Switch Toggle */}
          <button
            onClick={toggleLanguage}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-neutral-950/40 px-3.5 py-1.5 text-[10px] font-bold tracking-wider text-neutral-400 hover:bg-white/5 hover:text-white transition-all cursor-pointer uppercase"
            aria-label={language === 'es' ? 'Switch to English' : 'Cambiar a Español'}
          >
            <span className={language === 'es' ? 'text-white' : 'text-neutral-500'}>ES</span>
            <span className="text-neutral-700">|</span>
            <span className={language === 'en' ? 'text-white' : 'text-neutral-500'}>EN</span>
          </button>

          <a
            href="#sobre-mi"
            onClick={(e) => handleScroll(e, 'sobre-mi')}
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-transparent px-5 py-2 text-xs font-semibold tracking-wider text-white transition-all duration-300 hover:border-white hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black uppercase"
          >
            {t.navbar.about}
          </a>
          <motion.a
            href="#contacto"
            onClick={(e) => handleScroll(e, 'contacto')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center justify-center rounded-full bg-white px-6 py-2.5 text-xs font-bold tracking-wider text-black transition-colors hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black uppercase"
          >
            {t.navbar.contact}
          </motion.a>
        </nav>
      </div>
    </header>
  );
};
