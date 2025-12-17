import React from "react";
import Image from "next/image";

interface ConciergeLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function ConciergeLogo({
  size = "md",
  className = "",
}: ConciergeLogoProps) {
  // Responsive size classes for TSC Concierge logo
  const sizePx = {
    sm: 82,
    md: 112,
    lg: 132,
  }[size];

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {/* TSC Concierge Logo */}
      <div className="flex items-center">
        <div className="rounded-lg p-0 mr-2">
          <Image
            src="/logos/TSC_Logo_Rectangle_Without_BG.png"
            alt="TSC Survey Concierge"
            width={150}
            height={150}
            className={`object-contain ${sizePx}`}
            priority
          />
        </div>
      </div>
    </div>
  );
}
