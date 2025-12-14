import React from "react";
import Image from "next/image";

interface SurveyLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  logoSrc?: string | null; // Survey company logo URL
}

export default function SurveyLogo({ size = "md", className = "", logoSrc }: SurveyLogoProps) {
  // Responsive size classes for survey company logos
  const sizePx = {
    sm: 72,
    md: 92,
    lg: 112,
  }[size];

  // Don't render anything if no logo is provided
  if (!logoSrc) {
    return null;
  }

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {/* Survey Company Logo */}
      <div className="flex items-center">
        <div className="rounded-lg p-0 mr-2">
          <Image
            src={logoSrc}
            alt="Survey Company Logo"
            width={300}
            height={100}
            className={`object-contain ${sizePx}`}
            priority
          />
        </div>
      </div>
    </div>
  );
}
