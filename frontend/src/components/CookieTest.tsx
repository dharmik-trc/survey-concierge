"use client";

import { useState } from "react";
import { cookieUtils, CookieData } from "../lib";

export default function CookieTest() {
  const [testData, setTestData] = useState<CookieData>({
    responses: { "1": "test answer" },
    currentSectionIndex: 2,
    otherTexts: { "1": "test other text" },
    timestamp: Date.now(),
  });
  const [retrievedData, setRetrievedData] = useState<CookieData | null>(null);
  const [surveyId, setSurveyId] = useState("test-survey-123");

  const handleSave = () => {
    cookieUtils.saveSurveyProgress(surveyId, testData);
    alert("Data saved to cookies!");
  };

  const handleRetrieve = () => {
    const data = cookieUtils.getSurveyProgress(surveyId);
    setRetrievedData(data);
  };

  const handleClear = () => {
    cookieUtils.clearSurveyProgress(surveyId);
    setRetrievedData(null);
    alert("Cookies cleared!");
  };

  const handleCheck = () => {
    const exists = cookieUtils.hasSurveyProgress(surveyId);
    alert(`Survey progress exists: ${exists}`);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md max-w-md mx-auto mt-8">
      <h2 className="text-xl font-bold mb-4">Cookie Test Component</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Survey ID:</label>
          <input
            type="text"
            value={surveyId}
            onChange={(e) => setSurveyId(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div className="space-y-2">
          <button
            onClick={handleSave}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Save to Cookies
          </button>

          <button
            onClick={handleRetrieve}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Retrieve from Cookies
          </button>

          <button
            onClick={handleCheck}
            className="w-full px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
          >
            Check if Exists
          </button>

          <button
            onClick={handleClear}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Clear Cookies
          </button>
        </div>

        {retrievedData && (
          <div className="mt-4 p-3 bg-gray-100 rounded-md">
            <h3 className="font-medium mb-2">Retrieved Data:</h3>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(retrievedData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
