# FastScout Bridge - Chrome Extension

## What It Does

FastScout Bridge is a Chrome extension designed for car dealers, traders, and automotive professionals. When you view a vehicle on professional trading platforms like Auto1, CarCollect, or FastBack, the extension automatically detects the vehicle's specifications and allows you to instantly search for comparable listings on AutoScout24 Belgium.

This eliminates the need to manually copy vehicle details and re-enter them on another website. The extension handles everything automatically, letting you focus on evaluating prices and making decisions.

---

## Features

### Vehicle Detection

The extension automatically reads vehicle information directly from the trading platform page. No manual input required.

**Detected specifications:**
| Specification | Description |
|---------------|-------------|
| Brand | Manufacturer name (e.g., BMW, Audi, Mercedes) |
| Model | Vehicle model (e.g., Serie 3, A4, Classe C) |
| Version | Trim level or variant |
| Year | First registration date |
| Mileage | Odometer reading in kilometers |
| Fuel Type | Petrol, Diesel, Electric, Hybrid, etc. |
| Transmission | Manual or Automatic |
| Power | Engine power in kW |
| Body Type | Sedan, SUV, Hatchback, Break, etc. |
| Doors | Number of doors |
| Seats | Number of seats |

The extension intelligently maps these values to AutoScout24's search filters, even when platforms use different naming conventions.

---

### One-Click Search

When you're viewing a vehicle page on a supported platform, a floating button appears on the screen. Click this button and a new browser tab opens with AutoScout24 Belgium, pre-filled with search filters matching the vehicle you were viewing.

**What gets transferred:**
- Brand and model selection
- Year range (based on registration date)
- Mileage range (based on your settings)
- Fuel type filter
- Transmission type
- Body type category

---

### Mileage Settings

You control how the extension searches for comparable vehicles based on mileage. This is important because you may want to see vehicles with similar wear, or cast a wider net.

**Standard Mode**
- Searches from 0 km up to the vehicle's mileage plus your buffer
- Example: Vehicle has 80,000 km, buffer is 30,000 km → searches 0 to 110,000 km
- Good for seeing the full market range

**Strict Mode**
- Searches within a narrow range around the vehicle's mileage
- Example: Vehicle has 80,000 km, buffer is 30,000 km → searches 50,000 to 110,000 km
- Good for finding closely comparable vehicles

**Buffer Setting**
- Adjustable from 0 to 100,000 km
- Default: 30,000 km
- Higher buffer = more results, less precise matching
- Lower buffer = fewer results, more precise matching

---

### Quick Bid

On supported platforms, the extension adds a bid form directly on the vehicle page. Enter your bid amount and submit without navigating to a different screen.

**How it works:**
1. View a vehicle on Auto1, CarCollect, or FastBack
2. The extension adds a bid input field near the vehicle information
3. Enter your desired bid amount
4. Click submit
5. The bid is sent to the platform

This keeps your workflow uninterrupted when you're evaluating multiple vehicles.

---

### Enable/Disable Toggle

You can turn the extension on or off at any time through the popup menu. When disabled:
- The floating search button does not appear
- Vehicle detection is paused
- The extension icon shows "OFF" status

This is useful when you want to browse without the extension's features active.

---

## Supported Platforms

### Source Platforms

These are the trading platforms where the extension detects vehicle data:

**FastBack Trade** (fastback-trade.com)
- Professional B2B vehicle trading platform
- Full vehicle detection support
- Quick bid integration

**Auto1** (auto1.com)
- Europe's leading wholesale car platform
- Full vehicle detection support
- Quick bid integration

**CarCollect** (carcollect.com)
- Digital car trading marketplace
- Full vehicle detection support
- Quick bid integration

### Target Platform

**AutoScout24 Belgium** (autoscout24.be)
- Consumer car marketplace
- Used for price comparison and market research
- Search results open in a new tab

---

## How to Use

### Installation

1. Go to the Chrome Web Store
2. Search for "FastScout Bridge" or use the direct link
3. Click "Add to Chrome"
4. Confirm the installation when prompted

### First-Time Setup

1. Click the FastScout icon in your browser toolbar
2. Click "Sign In"
3. You'll be redirected to the FastScout website
4. Sign in with your email or use Google/GitHub authentication
5. Once signed in, return to the extension

### Daily Usage

1. **Navigate** to a vehicle page on Auto1, CarCollect, or FastBack
2. **Wait** for the page to fully load (the extension needs a moment to detect the vehicle)
3. **Look** for the FastScout floating button (usually bottom-right of the screen)
4. **Click** the button to search AutoScout24
5. **Review** the comparable listings in the new tab

### Adjusting Settings

1. Click the FastScout icon in your toolbar
2. Toggle "Enable extension" on or off
3. Adjust mileage mode (Standard or Strict)
4. Set your preferred mileage buffer using the slider or input field
5. Settings are saved automatically

---

## Extension Interface

### Popup Menu

*[Image: popup-main.png]*

The popup menu appears when you click the FastScout icon in your browser toolbar.

**Header Section**
- Extension name and logo
- Enable/Disable toggle switch

**Status Section**
- **Status**: Shows if the extension is active, disabled, or has an error
- **Platform**: Shows which platform is detected on the current tab (Auto1, CarCollect, FastBack, or "Not detected")
- **Account**: Shows your sign-in status and subscription state

**Mileage Configuration**
- Toggle between Standard and Strict mode
- Buffer input field (in kilometers)
- Explanation text for each mode

**Supported Platforms List**
- Visual indicator of which platforms work with the extension

**Account Actions**
- Sign In / Sign Out button
- Link to manage subscription

---

### Floating Search Button

*[Image: fab-button.png]*

The floating action button (FAB) appears on vehicle pages when:
- The extension is enabled
- You're on a supported platform
- A vehicle has been detected on the page

**Button behavior:**
- Positioned at the bottom-right of the screen
- Does not block important page content
- Click to open AutoScout24 search
- Shows the FastScout logo

---

### Quick Bid Form

*[Image: quick-bid.png]*

The bid form appears on vehicle listing pages where bidding is supported.

**Form elements:**
- Input field for bid amount (in euros)
- Submit button
- Confirmation message after submission

---

## Requirements

### Browser Compatibility

| Browser | Supported |
|---------|-----------|
| Google Chrome | Yes |
| Microsoft Edge | Yes |
| Brave | Yes |
| Opera | Yes |
| Firefox | No |
| Safari | No |

The extension requires a Chromium-based browser (Chrome version 88 or later recommended).

### Account Requirements

- A FastScout account (create one at fastscout.vercel.app)
- An active subscription plan

### System Requirements

- Desktop or laptop computer
- Stable internet connection
- Supported browser installed

**Note:** The extension is designed for desktop use. Mobile browsers do not support Chrome extensions.

---

## Languages

The extension interface is available in:

| Language | Code |
|----------|------|
| French | fr |
| English | en |

The language is automatically detected based on your browser settings. French is the default language.

**Translated elements:**
- Popup menu text
- Button labels
- Status messages
- Error messages
- Tooltips

---

## Privacy & Data

### What the extension accesses

- Vehicle information displayed on supported trading platform pages
- Your FastScout account authentication status

### What the extension does NOT access

- Your browsing history on other websites
- Personal files on your computer
- Login credentials for trading platforms
- Payment information

### Data storage

- Settings (enabled state, mileage preferences) are stored locally in your browser
- No vehicle data is sent to FastScout servers
- Authentication tokens are stored securely in browser storage

---

## Troubleshooting

### The search button doesn't appear

1. Check that the extension is enabled (click the icon and verify the toggle)
2. Make sure you're on a vehicle detail page, not a list page
3. Wait a few seconds for the page to fully load
4. Refresh the page
5. Check that your subscription is active

### Wrong vehicle data detected

1. Refresh the page
2. Wait for all vehicle information to load before clicking the search button
3. Some vehicle details may not be available on all platforms

### Extension shows "Not Connected"

1. Click "Sign In" in the popup menu
2. Complete the sign-in process on the FastScout website
3. Return to the extension and check your status

### Search opens but filters are empty

1. The vehicle page may not contain all required information
2. Try a different vehicle listing
3. Check that the platform is fully loaded

---

## Subscription Plans

An active subscription is required to use FastScout Bridge. Plans are available at:

- Monthly
- Quarterly
- Half-yearly
- Yearly

Manage your subscription through the FastScout website or click "Manage Subscription" in the extension popup.

---

## Support

For help with the extension:

- Visit the FastScout website
- Use the contact form
- Check the FAQ section

---

## Version

Current version: 3.0.0
