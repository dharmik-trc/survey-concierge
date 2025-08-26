import React from "react";
import Image from "next/image";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  tafSrc?: string | null; // Optional override, defaults to local logo
}

export default function Logo({
  size = "md",
  className = "",
  tafSrc,
}: LogoProps) {
  const sizePx = {
    sm: 36,
    md: 56,
    lg: 72,
  }[size];

  // Use local TAF logo by default, or override with tafSrc if provided
  const logoSource = tafSrc || "/logos/taf-logo-blue-full.svg";

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {/* TAF Logo */}
      <div className="flex items-center">
        <div className="rounded-lg p-0 mr-2">
          <Image
            src={logoSource}
            alt="TAF Logo"
            width={sizePx}
            height={sizePx}
            className="object-contain"
            priority
          />
        </div>
      </div>
    </div>
  );
}
