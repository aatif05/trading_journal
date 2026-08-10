"use client";

import {
  BarChart3,
  BookOpen,
  ChartCandlestick,
  CircleDollarSign,
  FileText,
  Landmark,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { label: "Journal", icon: BookOpen, href: "/" },
  { label: "Analytics", icon: BarChart3, href: "/analytics" },
  { label: "Stock charts", icon: ChartCandlestick },
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
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[#e5e9e6] bg-white/95 px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur"
    >
      <div className="journal-scrollbar mx-auto flex max-w-5xl items-center justify-start gap-1 overflow-x-auto sm:justify-center">
        {items.map(({ label, icon: Icon, href }) => {
          const active = href === pathname;
          const className = `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-medium transition sm:text-[11px] ${
            active
              ? "bg-[#e9ecea] text-[#202923]"
              : href
                ? "text-[#727b75] hover:bg-[#f5f7f6]"
                : "text-[#a0a7a2]"
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
