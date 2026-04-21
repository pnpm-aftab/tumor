# Swift DocC UI & Customization

Swift DocC generates documentation websites using the **Swift-DocC-Render** Vue.js application.

## Web Components (Directives)
Use these in your Markdown to build rich layouts:
- **Layout**: `@Row`, `@Column`, `@TabNavigator` (tabbed content).
- **Interactive**: `@Stepper`, `@Tutorial` (step-by-step guides).
- **Media**: `@Snippet` (linked code), `@Image`, `@Video`.
- **Callouts**: Standard asides like `> Note:`, `> Warning:`, `> Tip:`.

## Theming (theme-settings.json)
Place in the root of your `.docc` catalog to customize the site.

```json
{
  "theme": {
    "color": {
      "standard-green": "#007c37",
      "aside-tip-border": "rgb(0, 124, 55)",
      "link": {
        "light": "#983592",
        "dark": "#bcd3ff"
      }
    },
    "typography": {
      "html-font": "sans-serif"
    }
  },
  "meta": {
    "site-name": "My Project Documentation"
  }
}
```

## Page-Specific Customization (@Metadata)
Add at the top of an article for granular control:
- `@PageImage`: Sets a header image.
- `@PageColor`: Sets an accent color for the page header.
- `@CallToAction`: Adds a prominent button (e.g., for sample code).

## Navigation Structure
- **Leading Sidebar**: Hierarchical tree-view with filter bar.
- **Breadcrumbs**: Path context below the header.
- **Language Toggle**: Switches code between Swift and Objective-C.
- **Relationships**: Automated section showing inheritance and conformance.
