# CropCareAI Testing Guide

## Quick Start

### 1. Start the Application
```bash
cd d:/MCA-27/CropCareAI-App/Frontend
npm run dev
```
Server will start at: **http://localhost:5173**

## Testing Checklist

### ✅ Authentication Pages
- [ ] Navigate to `/login`
  - Verify only CropCareAI logo is visible (no nav buttons)
  - Test login functionality
- [ ] Navigate to `/register`
  - Verify only CropCareAI logo is visible (no nav buttons)
  - Test registration functionality

### ✅ Home Page
- [ ] After login, check Home page (`/`)
  - Verify personalized welcome message
  - Check hero section with animated cards
  - Click "Go to Dashboard" button
  - Click "Start Detection" button
  - Verify quick access cards
  - Check responsive design (resize browser)

### ✅ Navigation Bar (Authenticated)
- [ ] Verify navbar structure: **Home | Services ▼ | Dashboard | Profile Icon**
- [ ] Test **Services** dropdown:
  - Click "Services" to open dropdown
  - Verify items:
    - ✓ Disease Detection and Diagnosis
    - ✓ Fertilizer Recommendation
    - ✓ Crop Recommendation
    - ✓ Yield Prediction (with "Coming Soon" badge)
    - ✓ History (after divider)
  - Click each item to navigate
- [ ] Test **Profile** dropdown:
  - Click profile icon (top right)
  - Verify user name and email displayed
  - Test logout button

### ✅ Dashboard Page
- [ ] Navigate to `/dashboard`
  - Verify 4 stat cards display correctly
  - Check Disease Distribution bar chart
  - Check Healthy vs Diseased pie chart
  - Check Predictions over Time line chart
  - Verify Recent Activity panel
  - Check AI Suggestions section
  - Test hover effects on cards

### ✅ Services Pages

#### Disease Detection
- [ ] Navigate to `/predict`
  - Test image upload
  - Verify prediction results
  - Check confidence display

#### Fertilizer Recommendation
- [ ] Navigate to `/fertilizer-recommendation`
  - Fill in NPK values
  - Select soil type and crop type
  - Click "Auto-fill from SHC Data" (test button)
  - Submit form
  - Verify recommendation results
  - Check dosage and timing information

#### Crop Recommendation
- [ ] Navigate to `/crop-recommendation`
  - Fill in all environmental data
  - Click "Auto-fill from Soil Data" (test button)
  - Submit form
  - Verify crop recommendation
  - Check alternatives section

#### Yield Prediction
- [ ] Navigate to `/yield-prediction`
  - Verify "Coming Soon" page displays
  - Check feature preview grid
  - Test email notification form (visual only)
  - Verify expected launch timeline

### ✅ History Page
- [ ] Navigate to `/history`
  - Verify two tabs: "Disease Predictions" and "Soil Analyses"
  - Check prediction count badges
  - Switch between tabs
  - **Test clickable cards:**
    - Hover over a prediction card (should lift up)
    - Click a prediction card
    - Verify navigation to detail view
    - Click back button
    - Click a soil analysis card
    - Verify navigation to detail view
  - Check empty state if no data

### ✅ Detail Views

#### Prediction Detail
- [ ] Navigate to a prediction detail (`/history/prediction/:id`)
  - Verify back button works
  - Check status badge (Healthy/Diseased)
  - Verify confidence circle animation
  - Check analysis summary
  - Read recommendations
  - Test "Download Report" button (visual)
  - Test "New Prediction" button

#### Soil Analysis Detail
- [ ] Navigate to soil detail (`/history/soil/:id`)
  - Verify back button works
  - Check nutrient level cards with color coding
  - Verify optimal range comparisons
  - Check status indicators (Optimal/Below/Above)
  - Read recommendations
  - Test "Download Report" button (visual)
  - Test "Get Fertilizer Recommendation" button

### ✅ Responsive Design
- [ ] Desktop (1920px)
  - All elements display correctly
  - Charts are readable
  - Navigation is clear
- [ ] Tablet (768px)
  - Mobile menu toggle appears
  - Grid layouts adjust
  - Touch targets are adequate
- [ ] Mobile (375px)
  - All content accessible
  - Forms are usable
  - Dropdowns work correctly

### ✅ UI/UX Elements
- [ ] Glassmorphism effects visible
- [ ] Smooth animations on hover
- [ ] Gradient backgrounds render correctly
- [ ] Icons display properly (lucide-react)
- [ ] Charts render without errors (recharts)
- [ ] Loading states work
- [ ] Error handling displays correctly

### ✅ Navigation Flow
Test complete user journey:
1. [ ] Login → Home
2. [ ] Home → Dashboard
3. [ ] Dashboard → Services → Disease Detection
4. [ ] Disease Detection → Make prediction
5. [ ] Navigate to History
6. [ ] Click prediction to see details
7. [ ] Back to History
8. [ ] Services → Fertilizer Recommendation
9. [ ] Fill form and get recommendation
10. [ ] Profile → Logout

### ✅ Data Integration
- [ ] Predictions display in History
- [ ] Soil data displays in History
- [ ] Dashboard shows aggregated stats
- [ ] Charts update with real data
- [ ] Recent activity shows latest actions
- [ ] AI suggestions are contextual

## Common Issues & Solutions

### Issue: Dropdown not closing
**Solution:** Click outside the dropdown or press ESC

### Issue: Charts not rendering
**Solution:** Ensure recharts is installed: `npm install recharts`

### Issue: Icons not showing
**Solution:** Ensure lucide-react is installed: `npm install lucide-react`

### Issue: Navigation not working
**Solution:** Check that all routes are defined in App.jsx

### Issue: Detail pages show "Not Found"
**Solution:** Ensure you're clicking from History page (state is passed via location)

## Browser Testing

Test on:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (if available)

## Performance Checks
- [ ] Page load time < 2s
- [ ] Smooth animations (60fps)
- [ ] No console errors
- [ ] No memory leaks on navigation

## Accessibility Checks
- [ ] Tab navigation works
- [ ] Focus indicators visible
- [ ] Color contrast sufficient
- [ ] Screen reader friendly (basic)

## Ready for Demo? ✓

Your application is ready for demonstration when:
- ✅ All pages load without errors
- ✅ Navigation works smoothly
- ✅ Charts display data correctly
- ✅ Detail views are accessible
- ✅ Responsive on all devices
- ✅ Professional appearance maintained

---

**Pro Tips for Demo:**
1. Have sample predictions ready in history
2. Prepare test data for forms
3. Show the responsive design
4. Highlight the AI suggestions
5. Demonstrate the smooth navigation
6. Show both healthy and diseased prediction details

**Last Updated:** 2026-02-13
**Status:** ✅ Ready for Testing & Demo
