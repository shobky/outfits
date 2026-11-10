# Photo profile and try-on

The Me screen holds a full-body reference, an optional face-and-shoulders photo,
and an optional side view. The full-body image anchors the pose and framing.
Additional references help preserve appearance; they do not create a biometric
face map or prove exact body dimensions.

Users enter measurements, sizes and preferences themselves. Photo analysis
suggests qualitative proportions for review before saving. Replacing or removing
a reference invalidates saved photo observations. Profile completeness describes
setup steps, never identity accuracy or confidence that clothes will fit.

Try-on opens from a wardrobe item, a saved outfit, a Stylist proposal or a Shop
product. Users review the selected pieces and explicitly start generation. The
Stylist's `suggest_try_on` tool only creates a card; it cannot spend an image
generation allowance itself. Demo stylist supports this proposal flow without
an API key. Real image generation requires the existing `try_on` account feature
and an API-key-backed image provider.

New reference photos and results use a separate private `try-on` bucket on
Supabase, with owner-only storage policies and authenticated app image routes.
The wardrobe bucket remains unchanged. Local mode has no authentication and is
intended for the machine's owner. Older public reference URLs need replacement
through the photo profile; changing bucket policies does not revoke old URLs.

Apply `supabase/migrations/0009_try_on_profile_refs.sql` and
`supabase/migrations/0010_try_on_lease.sql` before deploying this version to
Supabase. They add reference/observation profile fields, the private bucket, and
an account-scoped lease that serializes reference changes and generation across
server instances. No database migration or deployment is performed by local verification.

Previews are downloaded explicitly and deleted when the sheet closes. If a
browser crashes or a cleanup request cannot reach the server, a private file can
remain until account deletion; there is no scheduled retention cleanup yet.
An interrupted upload before its reference is attached can also leave a private
file. Account deletion removes both private and wardrobe files.

Generated previews may alter faces, body proportions, garment details and drape.
They are visual approximations, not real photographs or a sizing guarantee.
Assess actual image quality with consented reference photos and the configured
image provider before making fidelity claims. Stubbed UI tests verify the flow,
not photorealism.
