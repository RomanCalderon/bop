import Link from "next/link";
import { redirect } from "next/navigation";
import { getBrowsePayload } from "@/actions/browse";
import {
  inviteEmail,
  listAllowedEmails,
  removeAllowedEmail,
  renameCity,
} from "@/actions/settings";
import { SettingsForm } from "@/components/settings-form";
import { getAllowedSession } from "@/lib/session";

export default async function SettingsPage() {
  const session = await getAllowedSession();
  if (!session.ok) {
    redirect(session.reason === "unauthenticated" ? "/sign-in" : "/not-invited");
  }
  const emails = await listAllowedEmails();
  const browse = await getBrowsePayload();
  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <Link href="/" className="text-sm underline">
        Back
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Settings</h1>
      <SettingsForm
        envEmails={emails.env}
        tableEmails={emails.table}
        cities={browse.cities.map((c) => ({ id: c.id, name: c.name }))}
        userEmail={session.user.email}
        inviteEmail={inviteEmail}
        removeAllowedEmail={removeAllowedEmail}
        renameCity={renameCity}
      />
    </main>
  );
}
