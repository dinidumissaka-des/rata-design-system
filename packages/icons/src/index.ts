/**
 * @rata/icons — the curated Lucide set, plus the `Icon` wrapper that sizes it.
 *
 * WHY A CURATED SET rather than re-exporting all 6,236 of Lucide's exports:
 * a design system's icon list is a design decision. Two icons that mean the
 * same thing in two different screens is the same class of drift as two tokens
 * for one colour, and it is invisible in review because both render fine.
 * Everything below is here because something in this system needs it.
 *
 * Names are Lucide's CANONICAL names, checked against the installed version.
 * Lucide keeps deprecated aliases working — `AlertTriangle` still resolves to
 * the same component as `TriangleAlert` — so importing the old name compiles
 * and renders, then breaks on a major. The canonical name is the one that
 * survives.
 *
 * NEEDING ONE THAT ISN'T HERE: import it from `lucide-react` directly and pass
 * it to `Icon` — the wrapper takes any Lucide component, so nothing is blocked
 * while the set catches up. Then add it here, so the second person who needs
 * it finds it.
 */
export { Icon } from "./icon.js";
export type { IconProps, IconSize } from "./icon.js";

/** The type every icon in this set satisfies, and what `Icon`'s `icon` prop takes. */
export type { LucideIcon } from "lucide-react";

export {
  // ── Actions
  Check,
  X,
  Plus,
  Minus,
  Trash2,
  Pencil,
  Copy,
  Download,
  Upload,
  Search,
  Settings,
  Filter,

  // ── Overflow. Ellipsis is the canonical name; MoreHorizontal is its alias.
  Ellipsis,
  EllipsisVertical,

  // ── Navigation
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Menu,

  // ── Status. These pair with the status roles: danger → CircleX / TriangleAlert,
  //    warning → TriangleAlert, success → CircleCheck, and Info with accent.
  //    Canonical names — the AlertTriangle / CheckCircle2 / XCircle spellings
  //    are deprecated aliases of these exact components.
  Info,
  TriangleAlert,
  CircleAlert,
  CircleCheck,
  CircleX,

  // ── Text formatting, for toolbars of toggle buttons
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,

  // ── Common object and state glyphs
  Eye,
  EyeOff,
  Lock,
  User,
  Calendar,
  Star,
} from "lucide-react";
