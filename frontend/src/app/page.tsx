"use client";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome to Survey Concierge</h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Professional survey platform for data collection and insights.
          </p>
        </div>

        <div className="text-center">
          <p className="text-gray-500">
            Navigate to the dashboard to manage surveys or take surveys directly.
          </p>
        </div>
      </div>
    </div>
  );
}
