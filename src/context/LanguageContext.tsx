import React, { createContext, useState, useContext } from 'react';

type Language = 'es' | 'en';

interface Translations {
  navbar: {
    about: string;
    contact: string;
  };
  hero: {
    role: string;
    description: string;
    contactBtn: string;
  };
  about: {
    title: string;
    subtitle: string;
    p1: string;
    p2: string;
    moreBtn: string;
  };
  experience: {
    title: string;
    subtitle: string;
    role: string;
    date: string;
    p1: string;
    p2: string;
  };
  projects: {
    title: string;
    subtitle: string;
    autosuiteDesc: string;
    proximamenteTitle: string;
    proximamenteDesc: string;
  };
  footer: {
    tagline1: string;
    tagline2: string;
    copyright: string;
  };
}

const translations: Record<Language, Translations> = {
  es: {
    navbar: {
      about: 'Sobre Mi',
      contact: 'Contacto',
    },
    hero: {
      role: 'Software Developer',
      description: 'Técnico en sistemas apasionado por la tecnología, programación y ciberseguridad. Desarrollador Full Stack.',
      contactBtn: 'Contáctame',
    },
    about: {
      title: 'SOBRE MI',
      subtitle: 'E X P L O R A &nbsp; A H O R A',
      p1: 'Como desarrollador de software apasionado, combino la lógica de la programación con una base sólida en diseño gráfico, lo que me permite crear interfaces intuitivas y visualmente impactantes. Actualmente enfocado en el desarrollo web, mi experiencia se centra en React, PHP y CSS, donde fusiono la funcionalidad con una visión estética orientada al usuario.',
      p2: 'Con el objetivo de crear soluciones elegantes, navego en el mundo del desarrollo de software con curiosidad constante. Mi camino consiste en transformar conceptos en código, construyendo experiencias de usuario fluidas y desafiando los límites de lo que es posible mediante una ejecución técnica precisa y un enfoque creativo.',
      moreBtn: 'Más Sobre Mi',
    },
    experience: {
      title: 'EXPERIENCIA',
      subtitle: 'E X P L O R E &nbsp; A H O R A',
      role: 'Desarrollador de Software',
      date: '2024 - PRESENTE',
      p1: 'Actualmente, lidero el desarrollo de AutoSuite, una plataforma integral diseñada para la gestión automatizada de talleres automotrices, facilitando el control de inventarios, roles de usuario y órdenes de servicio. Como desarrollador enfocado en soluciones escalables, he construido una base sólida en el desarrollo de aplicaciones web dinámicas y responsivas.',
      p2: 'Mi experiencia con React me ha permitido desarrollar interfaces de usuario intuitivas y funcionales que optimizan el flujo de trabajo en talleres de mecánica y pintura. Además, mi dominio de PHP y CSS me ha dotado de las habilidades para crear sistemas robustos en el lado del servidor y experiencias visuales coherentes. Cuento con una comprensión profunda de la arquitectura basada en componentes, la gestión de datos y las buenas prácticas de desarrollo moderno.',
    },
    projects: {
      title: 'PROYECTOS',
      subtitle: 'E X P L O R E &nbsp; P R O Y E C T O S',
      autosuiteDesc: 'Plataforma integral diseñada para la gestión automatizada de talleres automotrices, optimizando el control de inventarios, órdenes de servicio y roles de usuario.',
      proximamenteTitle: 'Próximamente',
      proximamenteDesc: 'Nuevos proyectos y soluciones en desarrollo. Próximamente se añadirán más detalles.',
    },
    footer: {
      tagline1: 'Julian Gonzalez | Desarrollador de Software & Frontend Designer.',
      tagline2: 'Transformando ideas en soluciones tecnológicas escalables.',
      copyright: '© 2026. Diseñado y desarrollado por Julian Gonzalez.',
    },
  },
  en: {
    navbar: {
      about: 'About Me',
      contact: 'Contact',
    },
    hero: {
      role: 'Software Developer',
      description: 'Systems technician passionate about technology, programming, and cybersecurity. Full Stack Developer.',
      contactBtn: 'Contact Me',
    },
    about: {
      title: 'ABOUT ME',
      subtitle: 'E X P L O R E &nbsp; N O W',
      p1: 'As a passionate software developer, I combine programming logic with a solid foundation in graphic design, allowing me to create intuitive and visually striking interfaces. Currently focused on web development, my experience centers on React, PHP, and CSS, where I merge functionality with a user-oriented aesthetic vision.',
      p2: 'With the goal of creating elegant solutions, I navigate the world of software development with constant curiosity. My journey consists of transforming concepts into code, building fluid user experiences and challenging the limits of what is possible through precise technical execution and a creative approach.',
      moreBtn: 'More About Me',
    },
    experience: {
      title: 'EXPERIENCE',
      subtitle: 'E X P L O R E &nbsp; N O W',
      role: 'Software Developer',
      date: '2024 - PRESENT',
      p1: 'Currently, I lead the development of AutoSuite, a comprehensive platform designed for the automated management of automotive workshops, facilitating inventory control, user roles, and service orders. As a developer focused on scalable solutions, I have built a solid foundation in developing dynamic and responsive web applications.',
      p2: 'My experience with React has enabled me to develop intuitive and functional user interfaces that optimize the workflow in mechanic and paint workshops. Additionally, my proficiency in PHP and CSS has equipped me with the skills to create robust server-side systems and cohesive visual experiences. I have a deep understanding of component-based architecture, data management, and modern development best practices.',
    },
    projects: {
      title: 'PROJECTS',
      subtitle: 'E X P L O R E &nbsp; P R O J E C T S',
      autosuiteDesc: 'Comprehensive platform designed for the automated management of automotive workshops, optimizing inventory control, service orders, and user roles.',
      proximamenteTitle: 'Coming Soon',
      proximamenteDesc: 'New projects and solutions in development. More details will be added soon.',
    },
    footer: {
      tagline1: 'Julian Gonzalez | Software Developer & Frontend Designer.',
      tagline2: 'Transforming ideas into scalable technological solutions.',
      copyright: '© 2026. Designed and developed by Julian Gonzalez.',
    },
  },
};

interface LanguageContextType {
  language: Language;
  t: Translations;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('es'); // Default is Spanish

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'es' ? 'en' : 'es'));
  };

  const value = {
    language,
    t: translations[language],
    toggleLanguage,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
