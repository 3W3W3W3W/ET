import { client } from "./client";

export async function sanityFetch(query, params = {}) {
  return client.fetch(query, params);
}
