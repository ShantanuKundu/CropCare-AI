# CropCareAI Frontend - Page Structure Overview

## 📱 Complete Page Hierarchy

```
CropCareAI Application
│
├── 🔓 PUBLIC PAGES (No Authentication Required)
│   │
│   ├── /login
│   │   └── Login Page
│   │       • Email & Password form
│   │       • Link to Register
│   │       • Logo only (no nav items)
│   │
│   └── /register
│       └── Register Page
│           • Name, Email, Password form
│           • Link to Login
│           • Logo only (no nav items)
│
└── 🔒 PROTECTED PAGES (Authentication Required)
    │
    ├── / (Home)
    │   └── Landing Page
    │       • Personalized welcome
    │       • Hero section with animated stats
    │       • Quick access links
    │       • CTA buttons
    │
    ├── /dashboard
    │   └── Analytics Dashboard ⭐ NEW
    │       • Quick Stats Cards (4)
    │       • Disease Distribution Chart
    │       • Healthy vs Diseased Pie Chart
    │       • Timeline Chart (7 days)
    │       • Recent Activity Panel
    │       • AI Suggestions Section
    │
    ├── SERVICES SECTION
    │   │
    │   ├── /predict
    │   │   └── Disease Detection & Diagnosis
    │   │       • Image upload
    │   │       • AI prediction
    │   │       • Confidence score
    │   │       • Results display
    │   │
    │   ├── /fertilizer-recommendation ⭐ NEW
    │   │   └── Fertilizer Recommendation
    │   │       • NPK input fields
    │   │       • Environmental data
    │   │       • Soil & Crop type selectors
    │   │       • Auto-fill from SHC button
    │   │       • Recommendation results
    │   │       • Dosage & timing info
    │   │
    │   ├── /crop-recommendation ⭐ NEW
    │   │   └── Crop Recommendation
    │   │       • Soil nutrient inputs
    │   │       • Environmental conditions
    │   │       • Auto-fill button
    │   │       • Recommended crop
    │   │       • Alternative crops
    │   │       • Reasoning explanation
    │   │
    │   ├── /yield-prediction ⭐ NEW
    │   │   └── Yield Prediction (Coming Soon)
    │   │       • Feature preview
    │   │       • Email notification signup
    │   │       • Expected launch date
    │   │       • Locked state indicator
    │   │
    │   └── /history
    │       └── History Page (Updated)
    │           • Two tabs: Predictions & Soil
    │           • Clickable cards ⭐
    │           • Empty states
    │           • Count badges
    │           │
    │           ├── Click Prediction Card →
    │           │   └── /history/prediction/:id ⭐ NEW
    │           │       └── Prediction Detail View
    │           │           • Full prediction info
    │           │           • Confidence circle
    │           │           • Analysis summary
    │           │           • Recommendations
    │           │           • Download report button
    │           │
    │           └── Click Soil Card →
    │               └── /history/soil/:id ⭐ NEW
    │                   └── Soil Analysis Detail View
    │                       • Nutrient breakdown
    │                       • Visual indicators
    │                       • Optimal ranges
    │                       • Status badges
    │                       • Recommendations
    │                       • Get fertilizer rec button
    │
    └── PROFILE SECTION
        └── Profile Dropdown (Top Right)
            • User name display
            • User email display
            • Logout button

```

## 🎨 Navigation Structure

### Desktop Navigation Bar
```
┌─────────────────────────────────────────────────────────────────┐
│  🌿 CropCareAI    Home    Services ▼    Dashboard         👤   │
│                                                                 │
│                    ┌───────────────────────────┐                │
│                    │ 🔬 Disease Detection      │                │
│                    │ 🌱 Fertilizer Rec         │                │
│                    │ 🌾 Crop Recommendation    │                │
│                    │ 📈 Yield Prediction 🔒    │                │
│                    │ ─────────────────────     │                │
│                    │ 📊 History                │                │
│                    └───────────────────────────┘                │
│                                                                 │
│                                          ┌──────────────────┐   │
│                                          │ John Doe         │   │
│                                          │ john@email.com   │   │
│                                          │ ──────────────   │   │
│                                          │ 🚪 Logout        │   │
│                                          └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Mobile Navigation
```
┌─────────────────────────┐
│  🌿 CropCareAI   ☰   👤│
│                         │
│  ┌───────────────────┐  │
│  │ Home              │  │
│  │ Services ▼        │  │
│  │   • Disease Det   │  │
│  │   • Fertilizer    │  │
│  │   • Crop Rec      │  │
│  │   • Yield (Soon)  │  │
│  │   • History       │  │
│  │ Dashboard         │  │
│  └───────────────────┘  │
└─────────────────────────┘
```

## 📊 Page Component Breakdown

### Dashboard Components
```
Dashboard Page
├── Header Section
│   ├── Title
│   └── Subtitle
├── Stats Grid (4 cards)
│   ├── Total Predictions
│   ├── Healthy Percentage
│   ├── Soil Reports
│   └── Last Activity
├── Charts Grid
│   ├── Disease Distribution (Bar)
│   ├── Healthy vs Diseased (Pie)
│   └── Predictions Timeline (Line)
├── Bottom Grid
│   ├── Recent Activity Panel
│   └── AI Suggestions Panel
└── Data Integration
    ├── predictionService
    └── soilService
```

### Recommendation Pages
```
Crop/Fertilizer Recommendation
├── Header Section
│   ├── Icon
│   ├── Title
│   └── Description
├── Form Section
│   ├── Info Banner
│   ├── Input Fields Grid
│   ├── Auto-fill Button
│   └── Submit Button
└── Results Section (conditional)
    ├── Main Recommendation
    ├── Details/Dosage
    ├── Alternatives
    └── Action Buttons
```

### History & Details
```
History Page
├── Tabs (Predictions | Soil)
├── Cards Grid
│   └── Clickable Cards
│       ├── Header (title + date)
│       ├── Body (data preview)
│       └── Footer (view details)
└── Empty States

Detail View Pages
├── Back Button
├── Header (status badge + title)
├── Info Cards Grid
│   ├── Main Details Card
│   ├── Analysis/Nutrients Card
│   └── Recommendations Card
└── Action Buttons
```

## 🎯 User Flow Diagram

```
Start
  │
  ├─── New User? ──→ Register ──→ Login ──┐
  │                                       │
  └─── Existing? ──→ Login ──────────────┘
                                           │
                                           ▼
                                     🏠 Home Page
                                           │
                        ┌──────────────────┼──────────────────┐
                        │                  │                  │
                        ▼                  ▼                  ▼
                   Dashboard          Services            Profile
                        │                  │                  │
                   • View Stats      ┌─────┴─────┐        • Logout
                   • Charts          │           │
                   • AI Tips         ▼           ▼
                   • Activity    Predict    Recommend
                                     │           │
                                     ├────── Fertilizer
                                     ├────── Crop
                                     ├────── Yield (Soon)
                                     │
                                     ▼
                                 History
                                     │
                            ┌────────┴────────┐
                            ▼                 ▼
                    Prediction Detail   Soil Detail
                            │                 │
                            └────── ➡ ────────┘
                                     │
                                     ▼
                            Take Action or Back
```

## 🔄 Data Flow

```
Backend API
    │
    ▼
Services Layer
    │
    ├───→ predictionService.getPredictionHistory()
    │                           │
    │                           ▼
    │                      Dashboard (aggregates)
    │                           │
    │                           ▼
    │                      History (lists)
    │                           │
    │                           ▼
    │                 PredictionDetail (shows full)
    │
    └───→ soilService.getSoilHistory()
                                │
                                ▼
                           Dashboard (charts)
                                │
                                ▼
                           History (lists)
                                │
                                ▼
                          SoilDetail (shows full)
```

## 📱 Responsive Breakpoints

```
Desktop (1024px+)
├── Full navbar
├── Multi-column grids
├── Sidebar layouts
└── Large charts

Tablet (768px - 1023px)
├── Collapsible navbar
├── 2-column grids
├── Stacked sections
└── Medium charts

Mobile (< 768px)
├── Hamburger menu
├── Single column
├── Vertical stacks
└── Adaptive charts
```

## 🎨 Visual Hierarchy

```
Level 1: Primary Actions
  • CTA Buttons (Go to Dashboard, Start Detection)
  • Navigation Links (Home, Dashboard)
  
Level 2: Content Sections
  • Stats Cards
  • Charts
  • Service Cards
  
Level 3: Details & Meta
  • Timestamps
  • Secondary info
  • Supporting text
  
Level 4: Microcopy
  • Tooltips
  • Helper text
  • Status indicators
```

---

**Legend:**
- ⭐ NEW = Newly created page/feature
- 🔒 = Coming soon/locked feature
- ▼ = Dropdown menu
- → = Navigation action
- • = List item/option

**Total Pages:** 13 (3 public + 10 protected)
**New Pages:** 6
**Updated Pages:** 4
**Total Components:** 20+
