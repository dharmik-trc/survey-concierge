"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import AnalyticsChatPanel from "@/components/AnalyticsChatPanel";
import ConciergeLogo from "@/components/ConciergeLogo";
import { apiService } from "@/lib/api";

export default function SurveyChatPage() {
  const params = useParams();
  const surveyId = params.id as string;
  const [surveyTitle, setSurveyTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!surveyId) return;
    apiService
      .getSurveyMeta(surveyId)
      .then((data: any) => setSurveyTitle(data?.title || "Survey"))
      .catch(() => setSurveyTitle("Survey"));
  }, [surveyId]);

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ConciergeLogo size="sm" />
              <div className="h-5 w-px bg-gray-200" />
              <span className="text-sm font-medium text-gray-600">AI Analyzer</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <p className="text-gray-600 text-[15px]">
            {surveyTitle ? (
              <>Ask questions about <span className="font-semibold text-gray-800">{surveyTitle}</span></>
            ) : (
              "Ask questions about this survey&apos;s data"
            )}
          </p>
        </div>

        <div className="overflow-hidden rounded-xl">
          <AnalyticsChatPanel surveyId={surveyId} variant="full" />
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Share this page to let others explore the insights
        </p>
      </main>
    </div>
  );
}
