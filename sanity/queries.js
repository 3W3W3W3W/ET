import { defineQuery } from "next-sanity";

export const informationQuery = defineQuery(`*[_id == "information"][0]{ body }`);

export const clientsQuery = defineQuery(`*[_id == "clients"][0]{ header, list }`);

export const tagsQuery = defineQuery(`*[_type == "tag"] | order(name asc){
  _id,
  name,
  "slug": slug.current
}`);

export const portfolioQuery = defineQuery(`*[_id == "portfolio"][0]{
  "projects": projects[]->{
    _id,
    title,
    "slug": slug.current,
    "tags": tags[]->{ _id, name, "slug": slug.current },
    description,
    images[]{
      _key,
      "url": asset->url,
      "aspectRatio": asset->metadata.dimensions.aspectRatio
    }
  }
}`);

export const projectsQuery = defineQuery(`*[_type == "project"] | order(order asc, title asc){
  _id,
  title,
  "slug": slug.current,
  "tags": tags[]->{ _id, name, "slug": slug.current },
  description,
  images[]{
    _key,
    "url": asset->url
  }
}`);
