/** Wire frame source of the `Page links` feature: two pages linking to each other. */
export const pageLinksSource = `Page "Home" id=home
  Text "Welcome home"
  Text "Go to the about page" link-to=about
Page "About" id=about
  Text "About this product"
  Text "Back to home" link-to=home
`;
