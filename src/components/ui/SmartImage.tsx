"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageSquare } from "@phosphor-icons/react";

/** Product image with a controlled placeholder fallback. */
export function SmartImage({
  src,
  alt,
  fill,
  sizes,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  fill?: boolean;
  sizes?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`smart-image-fallback ${className ?? ""}`} role="img" aria-label={alt}>
        <ImageSquare weight="light" aria-hidden="true" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      sizes={sizes}
      className={className}
      onError={() => setFailed(true)}
      unoptimized={!src.startsWith("/")}
    />
  );
}
