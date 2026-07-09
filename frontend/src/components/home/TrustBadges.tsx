import { Gem, Headset, ShieldCheck, Truck } from "lucide-react";

const BADGES = [
  {
    icon: Gem,
    label: "Bidhaa Halisi",
    sub: "Moja kwa moja kutoka Zanzibar",
  },
  {
    icon: Truck,
    label: "Uwasilishaji wa Haraka",
    sub: "Ndani ya Dar es Salaam",
  },
  {
    icon: ShieldCheck,
    label: "Mazungumzo Salama",
    sub: "Kupitia WhatsApp ya Biashara",
  },
  {
    icon: Headset,
    label: "Huduma kwa Wateja",
    sub: "Tupo Tayari Kukusaidia",
  },
];

export function TrustBadges() {
  return (
    <section className="border-y border-line bg-surface py-10">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-y-6 px-4 sm:grid-cols-4 sm:divide-x sm:divide-line sm:px-6">
        {BADGES.map((badge) => (
          <div
            key={badge.label}
            className="flex flex-col items-center gap-2 px-2 text-center"
          >
            <span className="flex items-center justify-center text-icon">
              <badge.icon size={44} strokeWidth={1.5} />
            </span>
            <span className="text-sm font-bold text-ink">{badge.label}</span>
            <span className="text-xs text-ink-muted">{badge.sub}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
