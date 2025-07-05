# Template Editing Troubleshooting

## Quick Diagnosis

Open the browser console (F12) and run these commands:

### 1. Check if templates are loaded:
```javascript
console.log('Templates loaded:', templates);
```

### 2. List all template IDs:
```javascript
templates.forEach(t => console.log(t.id, t.position));
```

### 3. Try editing directly:
```javascript
// Replace 'template-id' with an actual ID from step 2
editTemplate('template-id');
```

## Common Issues

### Issue: Edit button not visible
**Solution**: The edit button should now be more visible with updated styles. Look for blue "Edit" and red "Delete" buttons at the bottom of each template card.

### Issue: Clicking edit does nothing
**Check browser console for errors:**
- "No templates loaded" → Wait a moment and refresh
- "Template not found" → Template ID mismatch
- Other errors → Check console for details

### Issue: Form doesn't appear
The edit form should:
1. Hide the template list
2. Show the edit form
3. Populate all fields
4. Scroll to the form

If not, check:
```javascript
// Check if form elements exist
console.log('Form view:', document.getElementById('templateFormView'));
console.log('List view:', document.getElementById('templatesListView'));
```

## Manual Edit Process

If the UI isn't working, you can edit templates manually:

1. **Get template data:**
```javascript
let template = templates.find(t => t.position === "Your Position Name");
console.log(JSON.stringify(template, null, 2));
```

2. **Load it for editing:**
```javascript
editTemplate(template.id);
```

3. **After making changes, save:**
Click the "Save Template" button or in console:
```javascript
saveTemplate();
```

## Visual Guide

The template cards should look like:

```
┌─────────────────────────────┐
│ Software Engineer           │
│ Engineering · Senior Level  │
│ ⏱ 30 min · ❓ 5 questions  │
│                             │
│ Job description preview...  │
│                             │
│ 📅 Created Oct 28, 2024     │
│ [Edit] [Delete]             │ ← These buttons
└─────────────────────────────┘
```

## If Nothing Works

1. **Refresh the page** (Ctrl+F5)
2. **Check network tab** for failed API calls
3. **Verify templates exist:**
   - Check `/data/templates.json` on server
   - Or create a new template first

The edit functionality is fully implemented. The issue is likely:
- Templates not loaded yet
- Button styling/visibility
- JavaScript errors

Check the console for specific error messages!