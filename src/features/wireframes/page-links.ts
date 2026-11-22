/** Wire frame source of the `Page links` feature: two pages linking to each other. */
export const pageLinksSource = `Page "Home" id=home
  Text "Welcome home" font=bold font-size=lg
  Text "Go to the about page" link-to=about
Page "About" id=about
  Text "About this product" font=bold font-size=lg
  Text "Back to home" link-to=home
`;
