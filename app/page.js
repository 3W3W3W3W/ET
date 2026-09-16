import { sanityFetch } from "../sanity/lib";
import {
  informationQuery,
  clientsQuery,
  projectsQuery,
  tagsQuery,
} from "../sanity/queries";
import HomeClient from "./components/HomeClient";

export default async function Home() {
  const [information, clients, projects, tags] = await Promise.all([
    sanityFetch(informationQuery),
    sanityFetch(clientsQuery),
    sanityFetch(projectsQuery),
    sanityFetch(tagsQuery),
  ]);

  return (
    <HomeClient
      information={information}
      clients={clients}
      projects={projects}
      tags={tags}
    />
  );
}
