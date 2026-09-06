const STATE_CLASS: Record<string, string> = {
  ENTRY: "bg-[#e5f7ed] text-[#087443]",
  "STRONG WATCH": "bg-[#edf6ff] text-[#1c5d91]",
  "HEALTHY PULLBACK": "bg-[#fff6df] text-[#8b6414]",
  "EXTENDED — DON'T CHASE": "bg-[#fff0e8] text-[#a64a20]",
  "RE-ENTRY WATCH": "bg-[#eeeaff] text-[#5c45a5]",
  BREAKDOWN: "bg-[#ffe9ed] text-[#ad3044]",
};

export function StateBadge({ state }: { state: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-[11px] font-extrabold tracking-wide ${
        STATE_CLASS[state] ?? "bg-[#f0f2f0] text-[#66716a]"
      }`}
    >
      {state}
    </span>
  );
}
