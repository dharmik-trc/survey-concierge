import React from "react";
import Image from "next/image";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  logoSrc?: string | null; // Optional override, defaults to local logo
}

export default function Logo({
  size = "md",
  className = "",
  logoSrc,
}: LogoProps) {
  const sizePx = {
    sm: 36,
    md: 56,
    lg: 72,
  }[size];

  // If no logo source is provided, don't render anything
  if (!logoSrc) {
    return null;
  }

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {/* Logo */}
      <div className="flex items-center">
        <div className="rounded-lg p-0 mr-2">
          <Image
            src={logoSrc}
            alt="Logo"
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
