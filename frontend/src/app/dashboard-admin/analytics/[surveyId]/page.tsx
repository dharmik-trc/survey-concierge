"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiService, Question } from "@/lib/api";
import ConciergeLogo from "@/components/ConciergeLogo";

export default function AnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const surveyId = params.surveyId as string;

  const [surveyQuestions, setSurveyQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [surveyTitle, setSurveyTitle] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"filter" | "segmentation">(
    "filter"
  );

  // Filter state
  const [filterConfigs, setFilterConfigs] = useState<
    Array<{
      questionId: string;
      selectedOptions?: string[];
      numericRange?: [number | null, number | null];
      filterType?: 'choice' | 'numeric';
    }>
  >([]);
  const [excludeOpenText, setExcludeOpenText] = useState(false);
  const [filterPreviewData, setFilterPreviewData] = useState<any>(null);
  const [loadingFilterPreview, setLoadingFilterPreview] = useState(false);
  const [generatingFiltered, setGeneratingFiltered] = useState(false);
  const filterPreviewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Segmentation state
  const [segmentationDimensions, setSegmentationDimensions] = useState<
    Array<{
      name: string;
      question_id: number;
      type: "numeric_range" | "choice_mapping";
      ranges?: { [key: string]: [number | null, number | null] };
      mapping?: { [key: string]: string };
    }>
  >([]);
  const [previewData, setPreviewData] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [generatingSegmented, setGeneratingSegmented] = useState(false);
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load survey data
  useEffect(() => {
    const loadSurveyData = async () => {
      setLoadingQuestions(true);
      try {
        const surveys = await apiService.getSurveys({ includeInactive: true });
        const survey = surveys.find((s) => s.id === surveyId);
        if (survey) {
          setSurveyTitle(survey.title);
        }

        const questions = await apiService.getSurveyQuestions(surveyId, {
          includeInactive: true,
        });
        console.log("DEBUG: Loaded questions with orders:", questions.map(q => ({ id: q.id, order: q.order, sequential: questions.indexOf(q) + 1 })));
        setSurveyQuestions(questions);
      } catch (err) {
        console.error("Failed to load survey data:", err);
        alert("Failed to load survey data");
      } finally {
        setLoadingQuestions(false);
      }
    };

    if (surveyId) {
      loadSurveyData();
    }
  }, [surveyId]);

  // Fetch preview when filter configs change (with debouncing)
  useEffect(() => {
    if (
      activeTab !== "filter" ||
      filterConfigs.length === 0 ||
      filterConfigs.some((f) => {
        if (!f.questionId) return true;
        if (f.filterType === "numeric") {
          return !f.numericRange;
        }
        return !f.selectedOptions || f.selectedOptions.length === 0;
      })
    ) {
      setFilterPreviewData(null);
      return;
    }

    // Debounce preview fetch
    if (filterPreviewTimeoutRef.current) {
      clearTimeout(filterPreviewTimeoutRef.current);
    }

    setLoadingFilterPreview(true);
    filterPreviewTimeoutRef.current = setTimeout(async () => {
      try {
        const filters = filterConfigs.map((f) => {
          const filter: any = {
            question_id: parseInt(f.questionId),
          };
          if (f.filterType === 'numeric' && f.numericRange) {
            filter.numeric_range = f.numericRange;
          } else if (f.selectedOptions) {
            filter.selected_options = f.selectedOptions;
          }
          return filter;
        });
        const preview = await apiService.previewFilteredAnalytics(
          surveyId,
          filters,
          excludeOpenText
        );
        setFilterPreviewData(preview);
      } catch (err) {
        console.error("Failed to load filter preview:", err);
        setFilterPreviewData(null);
      } finally {
        setLoadingFilterPreview(false);
      }
    }, 500); // 500ms debounce

    return () => {
      if (filterPreviewTimeoutRef.current) {
        clearTimeout(filterPreviewTimeoutRef.current);
      }
    };
  }, [activeTab, surveyId, filterConfigs, excludeOpenText]);

  // Fetch preview when dimensions change (with debouncing)
  useEffect(() => {
    if (activeTab !== "segmentation" || segmentationDimensions.length === 0) {
      setPreviewData(null);
      return;
    }

    // Check if all dimensions are valid
    const isValid = segmentationDimensions.every(
      (d) =>
        d.question_id > 0 &&
        ((d.type === "choice_mapping" &&
          Object.keys(d.mapping || {}).length > 0) ||
          (d.type === "numeric_range" &&
            Object.keys(d.ranges || {}).length > 0))
    );

    if (!isValid) {
      setPreviewData(null);
      return;
    }

    // Debounce preview fetch
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }

    setLoadingPreview(true);
    previewTimeoutRef.current = setTimeout(async () => {
      try {
        const dimensions = segmentationDimensions.map((d) => ({
          name: d.name || `Dimension ${segmentationDimensions.indexOf(d) + 1}`,
          question_id: d.question_id,
          type: d.type,
          ranges: d.ranges,
          mapping: d.mapping,
        }));
        const preview = await apiService.previewSegmentedAnalytics(
          surveyId,
          dimensions
        );
        setPreviewData(preview);
      } catch (err) {
        console.error("Failed to load segmentation preview:", err);
        setPreviewData(null);
      } finally {
        setLoadingPreview(false);
      }
    }, 500); // 500ms debounce

    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, [activeTab, surveyId, segmentationDimensions]);

  const exportFiltered = async () => {
    if (
      filterConfigs.length === 0 ||
      filterConfigs.some((f) => {
        if (!f.questionId) return true;
        if (f.filterType === 'numeric') {
          return !f.numericRange;
        }
        return !f.selectedOptions || f.selectedOptions.length === 0;
      })
    ) {
      alert(
        "Please add at least one filter with a question and valid filter criteria"
      );
      return;
    }
    try {
      setGeneratingFiltered(true);
      const filters = filterConfigs.map((f) => {
        const filter: any = {
          question_id: parseInt(f.questionId),
        };
        if (f.filterType === 'numeric' && f.numericRange) {
          filter.numeric_range = f.numericRange;
        } else if (f.selectedOptions) {
          filter.selected_options = f.selectedOptions;
        }
        return filter;
      });
      await apiService.exportFilteredAnalytics(surveyId, filters, excludeOpenText);
    } catch (err: any) {
      console.error("Failed to export filtered analytics:", err);
      alert(
        "Failed to export filtered analytics: " +
          (err.message || "Unknown error")
      );
    } finally {
      setGeneratingFiltered(false);
    }
  };

  const exportSegmented = async () => {
    if (
      segmentationDimensions.length === 0 ||
      segmentationDimensions.some(
        (d) =>
          d.question_id === 0 ||
          (d.type === "choice_mapping" &&
            Object.keys(d.mapping || {}).length === 0) ||
          (d.type === "numeric_range" &&
            Object.keys(d.ranges || {}).length === 0)
      )
    ) {
      alert("Please add at least one valid dimension with segments defined");
      return;
    }
    try {
      setGeneratingSegmented(true);
      const dimensions = segmentationDimensions.map((d) => ({
        name: d.name || `Dimension ${segmentationDimensions.indexOf(d) + 1}`,
        question_id: d.question_id,
        type: d.type,
        ranges: d.ranges,
        mapping: d.mapping,
      }));
      await apiService.exportSegmentedAnalytics(surveyId, dimensions);
    } catch (err: any) {
      console.error("Failed to export segmented analytics:", err);
      alert(
        "Failed to export segmented analytics: " +
          (err.message || "Unknown error")
      );
    } finally {
      setGeneratingSegmented(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-24">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Analytics Dashboard
                </h1>
                {surveyTitle && (
                  <p className="text-sm text-gray-600">{surveyTitle}</p>
                )}
              </div>
            </div>
            <ConciergeLogo size="sm" />
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Live Preview Section - At Top */}
        {activeTab === "filter" &&
          filterPreviewData &&
          !loadingFilterPreview && (
            <div className="mb-6 bg-white rounded-xl shadow-lg p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                📊 Live Preview
              </h3>

              {/* Filter Summary */}
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  Filter Summary
                </h4>
                <div className="space-y-2">
                  {filterPreviewData.filters?.map(
                    (filter: any, idx: number) => (
                      <div
                        key={idx}
                        className="pb-2 border-b border-gray-200 last:border-b-0"
                      >
                        <div className="text-sm">
                          <span className="text-gray-600">
                            Filter {idx + 1}:
                          </span>{" "}
                          <span className="font-medium text-gray-900">
                            {filter.filter_question}
                          </span>
                        </div>
                        {filter.selected_options && (
                          <div className="text-sm">
                            <span className="text-gray-600">Options:</span>{" "}
                            <span className="text-gray-900">
                              {filter.selected_options.join(", ")}
                            </span>
                          </div>
                        )}
                        {filter.numeric_range && (
                          <div className="text-sm">
                            <span className="text-gray-600">Range:</span>{" "}
                            <span className="text-gray-900">
                              {filter.numeric_range}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  ) || (
                    <div>
                      <span className="text-sm text-gray-600">
                        Filter Question:
                      </span>{" "}
                      <span className="text-sm font-medium text-gray-900">
                        {filterPreviewData.filter_question}
                      </span>
                    </div>
                  )}
                  {filterPreviewData.selected_options && (
                    <div>
                      <span className="text-sm text-gray-600">
                        Selected Options:
                      </span>{" "}
                      <span className="text-sm text-gray-900">
                        {filterPreviewData.selected_options?.join(", ")}
                      </span>
                    </div>
                  )}
                  <div className="flex gap-4 pt-2 border-t border-gray-200">
                    <div>
                      <span className="text-sm font-semibold text-gray-700">
                        Filtered:
                      </span>{" "}
                      <span className="text-sm font-bold text-orange-600">
                        {filterPreviewData.filtered_count}
                      </span>{" "}
                      <span className="text-sm text-gray-600">responses</span>
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-700">
                        Total:
                      </span>{" "}
                      <span className="text-sm text-gray-900">
                        {filterPreviewData.total_count}
                      </span>{" "}
                      <span className="text-sm text-gray-600">responses</span>
                    </div>
                    {filterPreviewData.total_count > 0 && (
                      <div>
                        <span className="text-sm font-semibold text-gray-700">
                          Percentage:
                        </span>{" "}
                        <span className="text-sm font-semibold text-gray-900">
                          {(
                            (filterPreviewData.filtered_count /
                              filterPreviewData.total_count) *
                            100
                          ).toFixed(1)}
                          %
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {filterPreviewData.filtered_count === 0 ? (
                <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-yellow-600 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <div>
                      <h4 className="text-sm font-semibold text-yellow-900 mb-1">
                        No Responses Match This Filter
                      </h4>
                      <p className="text-sm text-yellow-800">
                        {filterPreviewData.message ||
                          `No responses match the selected filter options: ${filterPreviewData.selected_options?.join(
                            ", "
                          )}.`}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <svg
                      className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-blue-900 mb-1">
                        Your Excel Export Will Include:
                      </p>
                      <ul className="text-xs text-blue-800 space-y-0.5 list-disc list-inside">
                        <li>
                          <strong>{filterPreviewData.filtered_count}</strong>{" "}
                          filtered responses
                          {filterPreviewData.total_count > 0 && (
                            <span>
                              {" "}
                              (
                              {(
                                (filterPreviewData.filtered_count /
                                  filterPreviewData.total_count) *
                                100
                              ).toFixed(1)}
                              % of total)
                            </span>
                          )}
                        </li>
                        <li>
                          All{" "}
                          <strong>{filterPreviewData.total_questions}</strong>{" "}
                          questions with complete analytics
                          {filterPreviewData.exclude_open_text && (
                            <span className="text-orange-700 font-semibold">
                              {" "}
                              ({filterPreviewData.open_text_excluded_count || 0} open text question{filterPreviewData.open_text_excluded_count !== 1 ? 's' : ''} excluded)
                            </span>
                          )}
                        </li>
                        {filterPreviewData.exclude_open_text && filterPreviewData.total_questions_before_filter && (
                          <li className="text-xs text-gray-600 italic">
                            (Total questions before filter: {filterPreviewData.total_questions_before_filter})
                          </li>
                        )}
                        <li>
                          Response counts, percentages, and statistics for each
                          question
                        </li>
                        {!filterPreviewData.exclude_open_text && (
                          <li>All comments and open-text responses</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        {activeTab === "filter" && loadingFilterPreview && (
          <div className="mb-6 bg-white rounded-xl shadow-lg p-6 border border-gray-200 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-orange-600 border-t-transparent mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading preview...</p>
          </div>
        )}

        {activeTab === "segmentation" && previewData && !loadingPreview && (
          <div className="mb-6 bg-white rounded-xl shadow-lg p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              📊 Live Preview
            </h3>

            {/* Segment Summary */}
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                Segment Counts
              </h4>
              <div className="flex flex-wrap gap-3">
                {previewData.segment_order?.map((segName: string) => (
                  <div
                    key={segName}
                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-md"
                  >
                    <span className="text-sm font-medium text-gray-900">
                      {segName}:
                    </span>{" "}
                    <span className="text-sm text-gray-600">
                      {previewData.segments[segName]?.count || 0} responses
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Export Info */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-blue-900 mb-1">
                    Your Excel Export Will Include:
                  </p>
                  <ul className="text-xs text-blue-800 space-y-0.5 list-disc list-inside">
                    <li>
                      <strong>{previewData.segment_order?.length || 0}</strong>{" "}
                      segments (including "All responses")
                    </li>
                    <li>
                      All <strong>{previewData.total_questions}</strong>{" "}
                      questions with analytics for each segment
                    </li>
                    <li>Side-by-side comparison columns for all segments</li>
                    <li>
                      Response counts, percentages, and statistics per segment
                    </li>
                    <li>All comments organized by segment</li>
                  </ul>
                </div>
              </div>
            </div>
            {previewData.message && (
              <div className="mt-3 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">{previewData.message}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "segmentation" && loadingPreview && (
          <div className="mb-6 bg-white rounded-xl shadow-lg p-6 border border-gray-200 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading preview...</p>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("filter")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "filter"
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Filter Analytics
            </button>
            <button
              onClick={() => setActiveTab("segmentation")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "segmentation"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Segmented Analytics
            </button>
          </nav>
        </div>

        {/* Filter Tab Content */}
        {activeTab === "filter" && (
          <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
            {loadingQuestions ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-orange-200 border-t-orange-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading questions...</p>
              </div>
            ) : (
              <>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-semibold text-orange-900 mb-2">
                    🔍 Multiple Filters
                  </h4>
                  <p className="text-sm text-orange-800 mb-2">
                    Add multiple filters to narrow down your results. Filters
                    use <strong>AND logic</strong> - responses must match ALL
                    filters. Within each filter, options use{" "}
                    <strong>OR logic</strong> - responses matching ANY option
                    are included. You can filter by choice questions or numeric
                    ranges (e.g., staff size).
                  </p>
                </div>

                {/* Exclude Open Text Toggle */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={excludeOpenText}
                      onChange={(e) => setExcludeOpenText(e.target.checked)}
                      className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        Exclude Open Text Questions
                      </span>
                      <p className="text-xs text-gray-600 mt-1">
                        When enabled, open text questions (text, paragraph) will
                        be excluded from the export to maintain question order
                        and allow easy copy/paste of data.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Filters
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setFilterConfigs([
                          ...filterConfigs,
                          {
                            questionId: "",
                            selectedOptions: [],
                            filterType: "choice",
                          },
                        ]);
                      }}
                      className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors"
                    >
                      + Add Choice Filter
                    </button>
                    <button
                      onClick={() => {
                        setFilterConfigs([
                          ...filterConfigs,
                          {
                            questionId: "",
                            numericRange: [null, null],
                            filterType: "numeric",
                          },
                        ]);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      + Add Numeric Filter
                    </button>
                  </div>
                </div>

                {filterConfigs.length === 0 && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                    <p className="text-gray-600 text-sm mb-2">
                      No filters configured yet.
                    </p>
                    <p className="text-gray-500 text-xs">
                      Click "Add Filter" to create your first filter. You can
                      add multiple filters to combine conditions.
                    </p>
                  </div>
                )}

                {filterConfigs.map((filterConfig, filterIdx) => (
                  <div
                    key={filterIdx}
                    className="border border-gray-200 rounded-lg p-4 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">
                        Filter {filterIdx + 1}
                      </h4>
                      <button
                        onClick={() => {
                          setFilterConfigs(
                            filterConfigs.filter((_, i) => i !== filterIdx)
                          );
                        }}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Filter Type
                      </label>
                      <select
                        value={filterConfig.filterType || "choice"}
                        onChange={(e) => {
                          const newFilters = [...filterConfigs];
                          newFilters[filterIdx] = {
                            questionId: "",
                            filterType: e.target.value as "choice" | "numeric",
                            selectedOptions: e.target.value === "choice" ? [] : undefined,
                            numericRange: e.target.value === "numeric" ? [null, null] : undefined,
                          };
                          setFilterConfigs(newFilters);
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-black mb-4"
                      >
                        <option value="choice">Choice Question Filter</option>
                        <option value="numeric">Numeric Range Filter</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {filterConfig.filterType === "numeric"
                          ? "Select Numeric Question"
                          : "Select Question (Choice Questions Only)"}
                      </label>
                      <select
                        value={filterConfig.questionId}
                        onChange={(e) => {
                          const newFilters = [...filterConfigs];
                          newFilters[filterIdx] = {
                            ...newFilters[filterIdx],
                            questionId: e.target.value,
                            selectedOptions: filterConfig.filterType === "choice" ? [] : undefined,
                            numericRange: filterConfig.filterType === "numeric" ? [null, null] : undefined,
                          };
                          setFilterConfigs(newFilters);
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-black"
                      >
                        <option value="">Select a question...</option>
                        {filterConfig.filterType === "numeric"
                          ? surveyQuestions
                              .filter(
                                (q) =>
                                  (q.primary_type === "open_text" &&
                                    ["number", "positive_number", "negative_number"].includes(
                                      q.secondary_type || ""
                                    )) ||
                                  (q.primary_type === "form" &&
                                    q.secondary_type === "form_fields")
                              )
                              .map((q) => (
                                <option key={q.id} value={q.id}>
                                  Q{q.order + 1}: {q.question_text.substring(0, 60)}
                                  {q.question_text.length > 60 ? "..." : ""}
                                </option>
                              ))
                          : surveyQuestions
                              .filter(
                                (q) =>
                                  q.primary_type === "form" &&
                                  [
                                    "radio",
                                    "dropdown",
                                    "multiple_choices",
                                  ].includes(q.secondary_type || "")
                              )
                              .map((q) => (
                                <option key={q.id} value={q.id}>
                                  Q{q.order + 1}: {q.question_text.substring(0, 60)}
                                  {q.question_text.length > 60 ? "..." : ""}
                                </option>
                              ))}
                      </select>
                    </div>

                    {filterConfig.questionId &&
                      filterConfig.filterType === "choice" &&
                      (() => {
                        const selectedQ = surveyQuestions.find(
                          (q) => q.id === parseInt(filterConfig.questionId)
                        );
                        return selectedQ ? (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Select Options (Multi-select - OR logic)
                            </label>
                            <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto border border-gray-200">
                              {selectedQ.options?.map((option, idx) => (
                                <label
                                  key={idx}
                                  className="flex items-center space-x-2 py-2"
                                >
                                  <input
                                    type="checkbox"
                                    checked={filterConfig.selectedOptions?.includes(
                                      option
                                    )}
                                    onChange={(e) => {
                                      const newFilters = [...filterConfigs];
                                      if (e.target.checked) {
                                        newFilters[filterIdx] = {
                                          ...newFilters[filterIdx],
                                          selectedOptions: [
                                            ...(newFilters[filterIdx]
                                              .selectedOptions || []),
                                            option,
                                          ],
                                        };
                                      } else {
                                        newFilters[filterIdx] = {
                                          ...newFilters[filterIdx],
                                          selectedOptions: (
                                            newFilters[filterIdx]
                                              .selectedOptions || []
                                          ).filter((opt) => opt !== option),
                                        };
                                      }
                                      setFilterConfigs(newFilters);
                                    }}
                                    className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                                  />
                                  <span className="text-sm text-gray-700">
                                    {option}
                                  </span>
                                </label>
                              ))}
                            </div>
                            <p className="mt-2 text-xs text-gray-500">
                              Selected: {filterConfig.selectedOptions?.length || 0}{" "}
                              option(s)
                            </p>
                          </div>
                        ) : null;
                      })()}

                    {filterConfig.questionId &&
                      filterConfig.filterType === "numeric" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Numeric Range (leave blank for unbounded)
                          </label>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">
                                Minimum (inclusive)
                              </label>
                              <input
                                type="number"
                                value={
                                  filterConfig.numericRange?.[0] === null ||
                                  filterConfig.numericRange?.[0] === undefined
                                    ? ""
                                    : filterConfig.numericRange[0]
                                }
                                onChange={(e) => {
                                  const newFilters = [...filterConfigs];
                                  const minValue =
                                    e.target.value === ""
                                      ? null
                                      : parseFloat(e.target.value);
                                  newFilters[filterIdx] = {
                                    ...newFilters[filterIdx],
                                    numericRange: [
                                      minValue,
                                      newFilters[filterIdx].numericRange?.[1] ||
                                        null,
                                    ],
                                  };
                                  setFilterConfigs(newFilters);
                                }}
                                placeholder="Min (or leave blank)"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-black"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">
                                Maximum (inclusive)
                              </label>
                              <input
                                type="number"
                                value={
                                  filterConfig.numericRange?.[1] === null ||
                                  filterConfig.numericRange?.[1] === undefined
                                    ? ""
                                    : filterConfig.numericRange[1]
                                }
                                onChange={(e) => {
                                  const newFilters = [...filterConfigs];
                                  const maxValue =
                                    e.target.value === ""
                                      ? null
                                      : parseFloat(e.target.value);
                                  newFilters[filterIdx] = {
                                    ...newFilters[filterIdx],
                                    numericRange: [
                                      newFilters[filterIdx].numericRange?.[0] ||
                                        null,
                                      maxValue,
                                    ],
                                  };
                                  setFilterConfigs(newFilters);
                                }}
                                placeholder="Max (or leave blank)"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-black"
                              />
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-gray-500">
                            Responses with values within this range will be
                            included. Leave both blank to include all numeric
                            responses.
                          </p>
                        </div>
                      )}
                  </div>
                ))}

                {/* Export Button */}
                <div className="mt-6 pt-6 border-t border-gray-200 flex justify-end">
                  <button
                    onClick={exportFiltered}
                    disabled={
                      generatingFiltered ||
                      filterConfigs.length === 0 ||
                      filterConfigs.some((f) => {
                        if (!f.questionId) return true;
                        if (f.filterType === "numeric") {
                          return !f.numericRange;
                        }
                        return (
                          !f.selectedOptions || f.selectedOptions.length === 0
                        );
                      })
                    }
                    className="px-6 py-2 bg-gradient-to-r from-orange-600 to-red-600 text-white font-semibold rounded-lg hover:from-orange-700 hover:to-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingFiltered
                      ? "Exporting..."
                      : "Export Filtered Analytics"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Segmentation Tab Content */}
        {activeTab === "segmentation" && (
          <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
            {loadingQuestions ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading questions...</p>
              </div>
            ) : (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">
                    📊 What is a Dimension?
                  </h4>
                  <p className="text-sm text-blue-800 mb-2">
                    A <strong>dimension</strong> is a way to group your
                    respondents into segments. Each dimension creates multiple
                    segments that will appear as separate columns in your Excel
                    export.
                  </p>
                  <div className="text-xs text-blue-700 space-y-1">
                    <p>
                      <strong>Example 1:</strong> "Staff Size" dimension with
                      segments: Small (5-9), Medium (10-19), Large (20-49)
                    </p>
                    <p>
                      <strong>Example 2:</strong> "Location" dimension with
                      segments: London & SE, Midlands, North, Scotland
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Segmentation Dimensions
                  </h3>
                  <button
                    onClick={() => {
                      setSegmentationDimensions([
                        ...segmentationDimensions,
                        {
                          name: "",
                          question_id: 0,
                          type: "choice_mapping",
                          mapping: {},
                        },
                      ]);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    + Add Dimension
                  </button>
                </div>

                {segmentationDimensions.length === 0 && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                    <p className="text-gray-600 text-sm mb-2">
                      No dimensions configured yet.
                    </p>
                    <p className="text-gray-500 text-xs">
                      Click "Add Dimension" to create your first segmentation
                      dimension. You can add multiple dimensions (e.g., Staff
                      Size, Location, etc.) and all segments will appear
                      side-by-side in the export.
                    </p>
                  </div>
                )}

                {segmentationDimensions.map((dim, dimIdx) => (
                  <div
                    key={dimIdx}
                    className="border border-gray-200 rounded-lg p-4 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">
                        Dimension {dimIdx + 1}
                      </h4>
                      <button
                        onClick={() => {
                          setSegmentationDimensions(
                            segmentationDimensions.filter(
                              (_, i) => i !== dimIdx
                            )
                          );
                        }}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Dimension Name (Optional)
                      </label>
                      <p className="text-xs text-gray-500 mb-2">
                        Give this dimension a friendly name (e.g., "Staff Size",
                        "Location"). This helps you identify it later.
                      </p>
                      <input
                        type="text"
                        value={dim.name}
                        onChange={(e) => {
                          const newDims = [...segmentationDimensions];
                          newDims[dimIdx].name = e.target.value;
                          setSegmentationDimensions(newDims);
                        }}
                        placeholder="e.g., Staff Size, Location, Region"
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-black"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Question *
                      </label>
                      <p className="text-xs text-gray-500 mb-2">
                        Select the question that will be used to segment
                        respondents. Based on the question type, you'll
                        configure either numeric ranges or choice mappings.
                      </p>
                      <select
                        value={dim.question_id}
                        onChange={(e) => {
                          const newDims = [...segmentationDimensions];
                          const qid = parseInt(e.target.value);
                          newDims[dimIdx].question_id = qid;
                          const q = surveyQuestions.find((q) => q.id === qid);
                          if (q) {
                            if (
                              q.primary_type === "form" &&
                              q.secondary_type === "form_fields"
                            ) {
                              newDims[dimIdx].type = "numeric_range";
                              newDims[dimIdx].ranges = {};
                            } else {
                              newDims[dimIdx].type = "choice_mapping";
                              newDims[dimIdx].mapping = {};
                            }
                          }
                          setSegmentationDimensions(newDims);
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                      >
                        <option value={0}>Select a question...</option>
                        {surveyQuestions.map((q) => (
                          <option key={q.id} value={q.id}>
                            Q{surveyQuestions.indexOf(q) + 1}: {q.question_text.substring(0, 60)}
                            {q.question_text.length > 60 ? "..." : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {dim.question_id > 0 &&
                      (() => {
                        const q = surveyQuestions.find(
                          (q) => q.id === dim.question_id
                        );
                        if (!q) return null;

                        if (
                          dim.type === "choice_mapping" &&
                          q.primary_type === "form" &&
                          ["radio", "dropdown", "multiple_choices"].includes(
                            q.secondary_type || ""
                          )
                        ) {
                          return (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Map Options to Segment Names
                              </label>
                              <p className="text-xs text-gray-500 mb-2">
                                For each answer option, enter the segment name
                                it should map to. Multiple options can map to
                                the same segment (e.g., "East Midlands" and
                                "West Midlands" both map to "Midlands").
                              </p>
                              <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
                                {q.options?.map((option, optIdx) => (
                                  <div
                                    key={optIdx}
                                    className="flex items-center gap-2"
                                  >
                                    <span className="w-32 text-sm text-gray-700">
                                      {option}:
                                    </span>
                                    <input
                                      type="text"
                                      value={dim.mapping?.[option] || ""}
                                      onChange={(e) => {
                                        const newDims = [
                                          ...segmentationDimensions,
                                        ];
                                        if (!newDims[dimIdx].mapping)
                                          newDims[dimIdx].mapping = {};
                                        newDims[dimIdx].mapping![option] =
                                          e.target.value;
                                        setSegmentationDimensions(newDims);
                                      }}
                                      placeholder="Segment name"
                                      className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm text-black"
                                    />
                                  </div>
                                ))}
                              </div>
                              <p className="mt-2 text-xs text-gray-500">
                                💡 Tip: Leave empty to exclude that option from
                                segmentation.
                              </p>
                            </div>
                          );
                        } else if (
                          dim.type === "numeric_range" &&
                          q.primary_type === "form" &&
                          q.secondary_type === "form_fields"
                        ) {
                          return (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Define Ranges
                              </label>
                              <p className="text-xs text-gray-500 mb-2">
                                Create segments based on numeric ranges. Leave
                                min empty for "less than", leave max empty for
                                "greater than". Values are inclusive (e.g., 5-9
                                means 5 ≤ value ≤ 9).
                              </p>
                              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                                {Object.entries(dim.ranges || {}).map(
                                  ([segName, [min, max]], rangeIdx) => (
                                    <div
                                      key={rangeIdx}
                                      className="flex items-center gap-2"
                                    >
                                      <input
                                        type="text"
                                        value={segName}
                                        onChange={(e) => {
                                          const newDims = [
                                            ...segmentationDimensions,
                                          ];
                                          if (!newDims[dimIdx].ranges)
                                            newDims[dimIdx].ranges = {};
                                          const oldVal =
                                            newDims[dimIdx].ranges![segName];
                                          delete newDims[dimIdx].ranges![
                                            segName
                                          ];
                                          newDims[dimIdx].ranges![
                                            e.target.value
                                          ] = oldVal;
                                          setSegmentationDimensions(newDims);
                                        }}
                                        placeholder="Segment name"
                                        className="w-32 px-3 py-1.5 border border-gray-300 rounded text-sm text-black"
                                      />
                                      <input
                                        type="number"
                                        value={min === null ? "" : min}
                                        onChange={(e) => {
                                          const newDims = [
                                            ...segmentationDimensions,
                                          ];
                                          if (!newDims[dimIdx].ranges)
                                            newDims[dimIdx].ranges = {};
                                          newDims[dimIdx].ranges![segName] = [
                                            e.target.value === ""
                                              ? null
                                              : parseFloat(e.target.value),
                                            max,
                                          ];
                                          setSegmentationDimensions(newDims);
                                        }}
                                        placeholder="Min (or empty)"
                                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm text-black"
                                      />
                                      <span className="text-gray-400">to</span>
                                      <input
                                        type="number"
                                        value={max === null ? "" : max}
                                        onChange={(e) => {
                                          const newDims = [
                                            ...segmentationDimensions,
                                          ];
                                          if (!newDims[dimIdx].ranges)
                                            newDims[dimIdx].ranges = {};
                                          newDims[dimIdx].ranges![segName] = [
                                            min,
                                            e.target.value === ""
                                              ? null
                                              : parseFloat(e.target.value),
                                          ];
                                          setSegmentationDimensions(newDims);
                                        }}
                                        placeholder="Max (or empty)"
                                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm text-black"
                                      />
                                      <button
                                        onClick={() => {
                                          const newDims = [
                                            ...segmentationDimensions,
                                          ];
                                          if (newDims[dimIdx].ranges) {
                                            delete newDims[dimIdx].ranges![
                                              segName
                                            ];
                                          }
                                          setSegmentationDimensions(newDims);
                                        }}
                                        className="text-red-500 hover:text-red-700"
                                      >
                                        <svg
                                          className="w-5 h-5"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M6 18L18 6M6 6l12 12"
                                          />
                                        </svg>
                                      </button>
                                    </div>
                                  )
                                )}
                                <button
                                  onClick={() => {
                                    const newDims = [...segmentationDimensions];
                                    if (!newDims[dimIdx].ranges)
                                      newDims[dimIdx].ranges = {};
                                    newDims[dimIdx].ranges!["New Segment"] = [
                                      null,
                                      null,
                                    ];
                                    setSegmentationDimensions(newDims);
                                  }}
                                  className="text-sm text-blue-600 hover:text-blue-800"
                                >
                                  + Add Range
                                </button>
                              </div>
                              <p className="mt-2 text-xs text-gray-500">
                                💡 Example: "Small" (min: 5, max: 9), "Medium"
                                (min: 10, max: 19), "Large" (min: 20, max:
                                empty)
                              </p>
                            </div>
                          );
                        }
                        return null;
                      })()}
                  </div>
                ))}

                {/* Export Button */}
                <div className="mt-6 pt-6 border-t border-gray-200 flex justify-end">
                  <button
                    onClick={exportSegmented}
                    disabled={
                      generatingSegmented ||
                      segmentationDimensions.length === 0 ||
                      segmentationDimensions.some(
                        (d) =>
                          d.question_id === 0 ||
                          (d.type === "choice_mapping" &&
                            Object.keys(d.mapping || {}).length === 0) ||
                          (d.type === "numeric_range" &&
                            Object.keys(d.ranges || {}).length === 0)
                      )
                    }
                    className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingSegmented
                      ? "Exporting..."
                      : "Export Segmented Analytics"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
