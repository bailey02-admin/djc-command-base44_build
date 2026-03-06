import { Button } from "@/components/ui/button";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subYears } from "date-fns";

const today = () => new Date();
const fmt = d => format(d, "yyyy-MM-dd");

export const DATE_PRESETS = [
  {
    label: "This Month",
    get: () => ({ date_from: fmt(startOfMonth(today())), date_to: fmt(endOfMonth(today())) }),
  },
  {
    label: "Last Month",
    get: () => {
      const lm = subMonths(today(), 1);
      return { date_from: fmt(startOfMonth(lm)), date_to: fmt(endOfMonth(lm)) };
    },
  },
  {
    label: "Last 3 Months",
    get: () => ({ date_from: fmt(subMonths(today(), 3)), date_to: fmt(today()) }),
  },
  {
    label: "This Year",
    get: () => ({ date_from: fmt(startOfYear(today())), date_to: fmt(endOfYear(today())) }),
  },
  {
    label: "Last Year",
    get: () => {
      const ly = subYears(today(), 1);
      return { date_from: fmt(startOfYear(ly)), date_to: fmt(endOfYear(ly)) };
    },
  },
  {
    label: "All Time",
    get: () => ({ date_from: "2020-01-01", date_to: fmt(today()) }),
  },
];

export default function FinanceDatePresets({ active, onSelect }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {DATE_PRESETS.map(p => (
        <Button
          key={p.label}
          size="sm"
          variant={active === p.label ? "default" : "outline"}
          className={`h-7 text-xs px-2.5 ${active === p.label ? "bg-violet-600 hover:bg-violet-700" : ""}`}
          onClick={() => onSelect(p.label, p.get())}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}