import { sanityFetch } from "../sanity/lib";
import {
  informationQuery,
  clientsQuery,
  projectsQuery,
  tagsQuery,
  portfolioQuery,
} from "../sanity/queries";
import HomeClient from "./components/HomeClient";

export default async function Home() {
  const [information, clients, projects, tags, portfolio] = await Promise.all([
    sanityFetch(informationQuery),
    sanityFetch(clientsQuery),
    sanityFetch(projectsQuery),
    sanityFetch(tagsQuery),
    sanityFetch(portfolioQuery),
  ]);

  return (
    <HomeClient
      information={information}
      clients={clients}
      projects={projects}
      tags={tags}
      portfolio={portfolio}
    />
  );
}
