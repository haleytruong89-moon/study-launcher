import { shirtColour } from "@/lib/schedule/uniformColor";

/**
 * A small shirt in the colour of the uniform (22/11/2026: red polo → red, white shirt → white,
 * PE shirt → green; no colour word → grey). Decorative: the uniform text sits next to it.
 */
export function Shirt({ uniform, size = 16 }: { uniform: string | null | undefined; size?: number }) {
  const fill = shirtColour(uniform) ?? "#C9CEC6";
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" className="shrink-0">
      <path
        d="M8 3 4 5.2 1.8 9.6l3.4 1.8L6.6 9V21h10.8V9l1.4 2.4 3.4-1.8L20 5.2 16 3c-.6 1.5-2.1 2.4-4 2.4S8.6 4.5 8 3Z"
        fill={fill}
        stroke="#3A403C"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
