"use client";

import {
  BarChart3,
  BookOpen,
  ChartCandlestick,
  CircleDollarSign,
  FileText,
  Landmark,
  Search,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { label: "Journal", icon: BookOpen, href: "/" },
  { label: "Analytics", icon: BarChart3, href: "/analytics" },
  { label: "Stock charts", icon: ChartCandlestick, href: "/stock-charts" },
  { label: "Research", icon: Search, href: "/research" },
  { label: "Tax analytics", icon: FileText },
  { label: "Fund management", icon: Landmark, href: "/fund-management" },
  { label: "Deep analytics", icon: Sparkles },
  { label: "Notes", icon: CircleDollarSign },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[#31483c] bg-[#14211b]/95 px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 text-[#c8d4cd] shadow-[0_-8px_24px_rgba(13,28,20,0.14)] backdrop-blur"
    >
      <div className="journal-scrollbar mx-auto flex max-w-5xl items-center justify-start gap-1 overflow-x-auto sm:justify-center">
        {items.map(({ label, icon: Icon, href }) => {
          const active = href === pathname;
          const className = `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-medium transition sm:text-[11px] ${
            active
              ? "bg-[#c7f36a] text-[#14211b]"
              : href
                ? "text-[#aebdb4] hover:bg-[#253a2e] hover:text-white"
                : "text-[#63756b]"
          }`;

          return href ? (
            <Link
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              title={label}
              className={className}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          ) : (
            <button
              key={label}
              type="button"
              disabled
              title={`${label} — coming soon`}
              className={className}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
