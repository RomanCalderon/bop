import { createPlacesClient } from "@/lib/places";
import { getAllowedSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await getAllowedSession();
  if (!session.ok) {
    return new Response("Forbidden", {
      status: session.reason === "unauthenticated" ? 401 : 403,
    });
  }
  const name = new URL(request.url).searchParams.get("name");
  if (!name || !name.startsWith("places/")) {
    return new Response("Bad request", { status: 400 });
  }
  const photo = await createPlacesClient(
    process.env.GOOGLE_PLACES_SERVER_KEY ?? "",
  ).fetchPhoto(name);
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(photo.bytes), {
    headers: {
      "content-type": photo.contentType,
      "cache-control": "private, max-age=86400",
    },
  });
}
