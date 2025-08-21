# Survey Progress Cookie Feature

This feature automatically saves survey responses to browser cookies, allowing users to resume surveys from where they left off if they close their browser or navigate away.

## Features

### 🍪 Automatic Progress Saving

- **Save & Next Button**: Progress is saved automatically when clicking "Save & Next"
- **Smart Saving**: No annoying notifications on every keystroke
- **Efficient Updates**: Progress is saved at logical breakpoints, not continuously

### 🔄 Resume Functionality

- **Browser Restart**: Users can close and reopen their browser, then return to the survey
- **Session Recovery**: All previous answers and current section position are restored
- **Smart Detection**: Automatically detects if there's saved progress when loading a survey

### 📊 Progress Indicators

- **Visual Progress Bar**: Shows completion percentage and current section
- **Section Counter**: Displays "Section X of Y" information
- **Save Notifications**: Brief green notification appears when progress is saved

### 🎯 User Experience

- **Welcome Back Message**: Blue notification appears only when actually restoring previous progress
- **Fresh Start**: No welcome message for first-time users or when starting over
- **Start Over Option**: Users can choose to clear saved progress and start fresh
- **Seamless Integration**: Works transparently without disrupting the survey flow

## Technical Implementation

### Cookie Storage

- **Cookie Name Format**: `survey_response_{surveyId}`
- **Expiry**: 30 days from last save
- **Data Structure**: JSON-encoded with responses, section index, other texts, and timestamp

### Data Persistence

```typescript
interface CookieData {
  responses: Record<string, any>; // All question responses
  currentSectionIndex: number; // Current section position
  otherTexts: Record<string, string>; // "Other" text inputs
  timestamp: number; // Last save time
}
```

### Smart Saving Strategy

- **Trigger**: Only when clicking "Save & Next" button
- **Frequency**: At logical breakpoints, not continuously
- **User Experience**: No distracting notifications during typing
- **Efficiency**: Reduces unnecessary cookie operations

## Usage

### For Users

1. **Start Survey**: Begin answering questions normally
2. **Answer Questions**: Fill out all questions in the current section
3. **Click Save & Next**: Progress is automatically saved when moving forward
4. **Close Browser**: You can close your browser at any time
5. **Return Later**: Come back to the same survey URL
6. **Resume**: Your progress will be automatically restored
7. **Continue**: Pick up exactly where you left off

### For Developers

The feature is fully integrated into the existing survey component:

```typescript
// Import cookie utilities
import { cookieUtils, CookieData } from "@/lib";

// Save progress
cookieUtils.saveSurveyProgress(surveyId, progressData);

// Retrieve progress
const savedProgress = cookieUtils.getSurveyProgress(surveyId);

// Check if progress exists
const hasProgress = cookieUtils.hasSurveyProgress(surveyId);

// Clear progress
cookieUtils.clearSurveyProgress(surveyId);
```

## Browser Compatibility

- **Modern Browsers**: Full support for Chrome, Firefox, Safari, Edge
- **Cookie Settings**: Users must have cookies enabled
- **Storage Limits**: Standard browser cookie limits apply (typically 4KB per cookie)
- **Privacy**: Cookies are set with `SameSite=Lax` for security

## Security & Privacy

- **Local Storage**: Data is stored only in the user's browser
- **No Server Storage**: Responses are not stored on the server until final submission
- **Automatic Cleanup**: Cookies expire after 30 days or are cleared after submission
- **User Control**: Users can manually clear progress using the "Start Over" button

## Testing

A test component (`CookieTest.tsx`) is available to verify cookie functionality:

1. Navigate to the home page
2. Use the test component to save/retrieve/clear cookies
3. Test browser restart scenarios
4. Verify data persistence across sessions

## Future Enhancements

- **Compression**: Implement data compression for large surveys
- **Encryption**: Add optional client-side encryption for sensitive data
- **Sync**: Consider cloud sync for cross-device progress
- **Analytics**: Track save/resume patterns for UX improvements

## Troubleshooting

### Common Issues

- **Progress Not Saved**: Check if cookies are enabled in browser settings
- **Data Not Restored**: Verify the survey ID matches the saved cookie
- **Storage Errors**: Check browser console for cookie-related errors

### Debug Information

- All cookie operations are logged to the browser console
- Use browser dev tools to inspect cookie contents
- Test component provides real-time feedback on cookie operations
