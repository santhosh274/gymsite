// Centralized gym details so pages can stay editable.
// Update these two fields:
// - locationText: what you want to display on the UI
// - mapsEmbedSrc: the Google Maps embed URL

export const gym = {
  locationText: "SR Gym and Fitness centre",
  mapsEmbedSrc:
    "https://www.google.com/maps?q=SR+Gym+and+Fitness+centre&output=embed",
};

// Placeholder for any app/auth integrations that expect the `lovable` export.
// If you have a real Lovable OAuth client/config, wire it here.
export const lovable = {
  auth: {
    async signInWithOAuth(_provider: string, _opts: { redirect_uri: string }) {
      return { error: undefined as undefined | { message?: string }, redirected: false };
    },
  },
};


    