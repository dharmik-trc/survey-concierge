// Cookie utility functions for storing survey responses

const COOKIE_PREFIX = "survey_concierge_response_";
const COOKIE_EXPIRY_DAYS = 30;

export interface CookieData {
  responses: Record<string, any>;
  currentSectionIndex: number;
  otherTexts: Record<string, string>;
  timestamp: number;
  sessionId?: string; // Add session ID to track partial responses
}

export const cookieUtils = {
  /**
   * Save survey response data to cookies
   */
  saveSurveyProgress: (surveyId: string, data: CookieData): void => {
    try {
      const cookieName = `${COOKIE_PREFIX}${surveyId}`;
      const cookieValue = JSON.stringify(data);
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + COOKIE_EXPIRY_DAYS);

      document.cookie = `${cookieName}=${encodeURIComponent(
        cookieValue
      )}; expires=${expiryDate.toUTCString()}; path=/; SameSite=Lax`;
    } catch (error) {
      console.error("Failed to save survey progress to cookie:", error);
    }
  },

  /**
   * Retrieve survey response data from cookies
   */
  getSurveyProgress: (surveyId: string): CookieData | null => {
    try {
      const cookieName = `${COOKIE_PREFIX}${surveyId}`;
      const cookies = document.cookie.split(";");

      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split("=");
        if (name === cookieName && value) {
          const decodedValue = decodeURIComponent(value);
          const data = JSON.parse(decodedValue);

          // Check if cookie is still valid (within expiry time)
          const now = Date.now();
          const cookieAge = now - data.timestamp;
          const maxAge = COOKIE_EXPIRY_DAYS * 24 * 60 * 60 * 1000; // Convert days to milliseconds

          if (cookieAge < maxAge) {
            return data;
          } else {
            // Cookie expired, remove it
            cookieUtils.clearSurveyProgress(surveyId);
            return null;
          }
        }
      }
      return null;
    } catch (error) {
      console.error("Failed to retrieve survey progress from cookie:", error);
      return null;
    }
  },

  /**
   * Clear survey response data from cookies
   */
  clearSurveyProgress: (surveyId: string): void => {
    try {
      const cookieName = `${COOKIE_PREFIX}${surveyId}`;
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    } catch (error) {
      console.error("Failed to clear survey progress cookie:", error);
    }
  },

  /**
   * Check if survey progress exists in cookies
   */
  hasSurveyProgress: (surveyId: string): boolean => {
    return cookieUtils.getSurveyProgress(surveyId) !== null;
  },

  /**
   * Generate a unique session ID for tracking partial responses
   */
  generateSessionId: (): string => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Get or create session ID for a survey
   */
  getOrCreateSessionId: (surveyId: string): string => {
    const progress = cookieUtils.getSurveyProgress(surveyId);
    if (progress?.sessionId) {
      return progress.sessionId;
    }

    // Generate new session ID and save it
    const newSessionId = cookieUtils.generateSessionId();
    if (progress) {
      // Update existing progress with session ID
      progress.sessionId = newSessionId;
      cookieUtils.saveSurveyProgress(surveyId, progress);
    }

    return newSessionId;
  },
};
