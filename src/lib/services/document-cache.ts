import { unstable_cache } from "next/cache";

type CachedDocumentOptions = {
  keyParts: Array<string | number>;
  tags: string[];
  generate: () => Promise<Buffer>;
  revalidate?: number;
};

export async function getCachedDocument({
  keyParts,
  tags,
  generate,
  revalidate = 300,
}: CachedDocumentOptions) {
  const base64 = await unstable_cache(
    async () => (await generate()).toString("base64"),
    ["generated-document", ...keyParts.map(String)],
    { revalidate, tags },
  )();

  return Buffer.from(base64, "base64");
}
