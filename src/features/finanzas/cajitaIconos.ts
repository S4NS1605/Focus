import {
  Car,
  Gem,
  Gift,
  GraduationCap,
  Home,
  Laptop,
  LifeBuoy,
  PiggyBank,
  Plane,
  Target,
  Tent,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * The pocket/goal icons, listed one by one.
 *
 * This exists instead of `icons[nombre]` from lucide-react. That barrel is the
 * whole set — roughly 1500 components — and a dynamic index into it defeats
 * tree-shaking entirely: the bundler cannot know which key will be used, so it
 * keeps them all. Doing that pushed the app chunk from ~310 kB to ~840 kB.
 *
 * Keys are the stored strings in CAJITA_ICONS, so a pocket saved in the
 * database keeps rendering the same mark.
 */
const REGISTRO: Record<string, LucideIcon> = {
  PiggyBank,
  Tent,
  Car,
  Home,
  GraduationCap,
  Laptop,
  Gift,
  LifeBuoy,
  Gem,
  Plane,
  Target,
};

/** Falls back rather than crashing on a name saved before this list existed. */
export const iconoDeCajita = (nombre: string | null | undefined): LucideIcon =>
  (nombre && REGISTRO[nombre]) || PiggyBank;

/** Same, for goals, whose neutral default is a target rather than a piggy bank. */
export const iconoDeMeta = (nombre: string | null | undefined): LucideIcon =>
  (nombre && REGISTRO[nombre]) || Target;
