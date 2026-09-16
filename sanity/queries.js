import { defineQuery } from "next-sanity";

export const informationQuery = defineQuery(`*[_id == "information"][0]{ body }`);

export const clientsQuery = defineQuery(`*[_id == "clients"][0]{ header, list }`);

export const tagsQuery = defineQuery(`*[_type == "tag"] | order(name asc){
  _id,
  name,
  "slug": slug.current
}`);

export const projectsQuery = defineQuery(`*[_type == "project"] | order(order asc, title asc){
  _id,
  title,
  "visible": coalesce(visible, true),
  "slug": slug.current,
  "tags": tags[]->{ _id, name, "slug": slug.current },
  description,
  images[]{
    _key,
    "url": asset->url
  }
}`);
