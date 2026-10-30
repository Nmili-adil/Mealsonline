"use client";

import { Minus, Plus } from "@phosphor-icons/react";

export function QuantityControl({
  value,
  onChange,
  min = 1,
  max = 20,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="qty-control">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label="Diminuer la quantité"
        disabled={value <= min}
      >
        <Minus weight="bold" />
      </button>
      <span>{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        aria-label="Augmenter la quantité"
        disabled={value >= max}
      >
        <Plus weight="bold" />
      </button>
    </div>
  );
}
