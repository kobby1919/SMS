# Edujay UI Typography

- Clash Display is the shared branding and heading family across public pages, authentication, onboarding and every dashboard role.
- Inter is the shared body, navigation, label, form-control and data-table family. Financial detail and tabular figures stay in Inter.
- Use the shared `--font-heading` and `--font-body` tokens or corresponding Tailwind utilities. Avoid adding local DM Sans, Sora or Nunito overrides.
- Fonts are self-hosted. The heading stack falls back to Inter and then system fonts for unsupported characters.
- Clash Display has installed weights 400-700. Avoid synthetic extra-bold heading weights; the global heading rule disables synthetic styling.
- Preserve existing font sizes and responsive layouts. Verify long names, mobile navigation, forms, tables and print views after typography changes.
- Generated PDFs use a separate rendering pipeline and retain their existing verified document fonts in this UI-only release.
