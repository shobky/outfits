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

Previews are saved automatically with private copies of the original person,
optional identity references, garment inputs, sizing context, model, cost and
creation time. Apply `20261110183548_saved_try_ons_and_garment_dimensions.sql`
before deploying this behavior. Closing the sheet does not delete a result.
Profile → Saved try-ons reopens or explicitly deletes it. Chat proposals also
reopen matching results using the conversation and tool-call identifiers.
Recreation uses the saved input copies and context, runs the currently configured
image model, consumes a new allowance and may produce a different image.

“Photo for this look” uses a one-off photo without replacing the profile. It is
kept in browser memory until generation and sent in the same multipart request;
no abandoned server upload is created by simply choosing a photo. Saved face,
side and photo-derived observations are excluded for this override. User-entered
measurements still apply, so the UI asks for a photo of the account owner.

Garment labels can be read during catalogue analysis when clearly visible;
unreadable sizes remain unknown. Physical widths and lengths are user-entered
flat garment measurements, distinct from photo pixel dimensions. Retailer
try-on accepts the size being considered, explicitly without verified physical
measurements. The prompt preserves oversized/tight silhouettes and forbids
tailoring clothes to flatter the person, but this does not establish real fit.

An interrupted profile upload before attachment or an interrupted multi-file
save can still leave private files; scheduled orphan cleanup is not implemented.
Account deletion removes both private and wardrobe files. Successful result
records remain until explicitly deleted; do not assume automatic expiry.

Generated previews may alter faces, body proportions, garment details and drape.
They are visual approximations, not real photographs or a sizing guarantee.
Assess actual image quality with consented reference photos and the configured
image provider before making fidelity claims. Stubbed UI tests verify the flow,
not photorealism.
