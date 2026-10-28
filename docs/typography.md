# Edujay UI Typography

- Clash Display is the shared branding and heading family across public pages, authentication, onboarding and every dashboard role.
- Manrope is the shared body, navigation, label, form-control and data-table family. Financial detail and tabular figures use Manrope too.
- Use the shared `--font-heading` and `--font-body` tokens or corresponding Tailwind utilities. Avoid adding local DM Sans, Sora or Nunito overrides.
- Fonts are self-hosted. The heading stack falls back to Manrope and then system fonts for unsupported characters. Manrope's variable font covers weights 200-800; its license and font log are bundled in public/fonts/manrope.
- Legacy font-inter and font-nunito utilities resolve to the shared body family for compatibility; new components should use font-body.
- Clash Display has installed weights 400-700. Avoid synthetic extra-bold heading weights; the global heading rule disables synthetic styling.
- Preserve existing font sizes and responsive layouts. Verify long names, mobile navigation, forms, tables and print views after typography changes.
- Generated PDFs use a separate rendering pipeline and retain their existing verified document fonts in this UI-only release.
