export default defineAppConfig({
  ui: {
    colors: {
      primary: 'fire',
      // Alle neutralen Flaechen, Texte und Rahmen leiten sich aus der Navy-Palette des
      // Entwurfs ab – in beiden Farbmodi.
      neutral: 'navy',
    },
    // Im Entwurf sind Kategorie- und Statusmarken Pillen, Knoepfe dagegen eckig.
    badge: { slots: { base: 'rounded-full' } },
  },
})
