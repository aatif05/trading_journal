"use client";

import { Info } from "lucide-react";
import { useState } from "react";

export function Tooltip({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onBlur={() => setOpen(false)}
        onMouseLeave={() => setOpen(false)}
        className="ml-1 inline-flex items-center text-[#8a928d] hover:text-[#202923]"
        aria-label={`Learn more about ${title}`}
      >
        <Info className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-[320px] rounded-xl border border-[#e2e9e3] bg-white p-4 text-xs leading-6 text-[#334039] shadow-[0_8px_24px_rgba(22,35,28,0.12)]"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="border-b border-[#edf0ee] pb-2">
            <p className="font-bold text-[#202923]">{title}</p>
          </div>
          <div className="mt-2 text-[#66716a]">{children}</div>
        </div>
      )}
    </div>
  );
}
