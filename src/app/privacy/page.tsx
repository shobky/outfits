import Link from "next/link";

export const metadata = { title: "Privacy" };

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

/** Plain-language draft describing what the app really does. Needs legal review before a public launch. */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-5 py-12 text-[15px] leading-relaxed">
      <Link href="/" className="text-sm text-muted hover:text-text">
        ← Back to Outfits
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>

      <Section title="What we store">
        Your email, the photos you upload and the studio versions made from them, the details of your clothes, your outfits and wear history, your chats with the stylist, and anything you add to your profile (such as sizes or city). We also record basic usage events, such as opening the app or adding a piece, to see whether the app is useful.
      </Section>
      <Section title="Who processes it">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>OpenAI</b> receives your clothing photos and stylist messages to recognise items, make studio shots and answer you. When you choose to analyze your photo profile or generate a try-on, it also receives your reference photos and relevant saved profile details.
          </li>
          <li>
            <b>Supabase</b> stores your data and photos, in Frankfurt.
          </li>
          <li>
            <b>Vercel</b> runs the app.
          </li>
          <li>
            <b>Open-Meteo</b> receives your city&apos;s location to get the weather.
          </li>
        </ul>
      </Section>
      <Section title="Your photos">
        Clothing photos use public web addresses: anyone with the exact address can open them. Keep personal reference photos in the photo profile, where new uploads and try-on previews use separate storage protected by your account login. In local mode, your files stay on this machine and the app has no login. Older reference photos uploaded through the wardrobe storage may still have public addresses; replace them through the photo profile. Only add photos of yourself.
      </Section>
      <Section title="Photo profile and try-on">
        Reference photos help the image model preserve your appearance; we do not create face-recognition templates. Photo analysis offers qualitative suggestions for you to review before saving. It does not measure your body. You can replace or remove references in Profile. Generated try-ons are AI previews, so appearance, garment details and fit can differ from reality.
      </Section>
      <Section title="What we don't do">We don&apos;t sell your data, and there are no ads. If that ever changes, we&apos;ll tell you first. Any shop links that earn us a commission will be labelled.</Section>
      <Section title="Deleting your data">
        Go to Profile → Delete my account. This permanently removes your account, your clothes, chats and photos from our storage. Services listed above may keep what they received for a limited time under their own policies.
      </Section>
      {CONTACT && (
        <Section title="Contact">
          <a className="underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
        </Section>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h2 className="font-semibold tracking-tight">{title}</h2>
      <div className="text-muted">{children}</div>
    </section>
  );
}
