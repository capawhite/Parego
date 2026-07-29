import { redirect } from "next/navigation"

/** Short shareable join URL: /j/{id} → /join/{id} */
export default async function ShortJoinPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/join/${encodeURIComponent(id)}`)
}
