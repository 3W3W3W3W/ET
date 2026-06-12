"use client";

import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { media } from "sanity-plugin-media";
import { apiVersion, dataset, projectId } from "./sanity/env";
import { schemaTypes } from "./sanity/schemaTypes";

const SETTINGS_SINGLETONS = [
  { id: "information", title: "Information", schemaType: "information" },
  { id: "clients", title: "Clients", schemaType: "clients" },
];

const SINGLETON_TYPES = [...SETTINGS_SINGLETONS.map((s) => s.schemaType), "portfolio"];

export default defineConfig({
  name: "default",
  title: "Eric Tsui",
  basePath: "/admin",
  projectId,
  dataset,
  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title("Content")
          .items([
            S.listItem()
              .title("Settings")
              .id("settings")
              .child(
                S.list()
                  .title("Settings")
                  .items([
                    ...SETTINGS_SINGLETONS.map((s) =>
                      S.listItem()
                        .title(s.title)
                        .id(s.id)
                        .child(
                          S.document()
                            .schemaType(s.schemaType)
                            .documentId(s.id)
                        )
                    ),
                    S.documentTypeListItem("tag").title("Tags"),
                  ])
              ),
            S.documentTypeListItem("project").title("Archive"),
            S.listItem()
              .title("Portfolio")
              .id("portfolio")
              .child(
                S.document().schemaType("portfolio").documentId("portfolio")
              ),
          ]),
    }),
    visionTool({ defaultApiVersion: apiVersion }),
    media(),
  ],
  schema: {
    types: schemaTypes,
    templates: (templates) =>
      templates.filter(({ schemaType }) => !SINGLETON_TYPES.includes(schemaType)),
  },
  document: {
    actions: (input, { schemaType }) =>
      SINGLETON_TYPES.includes(schemaType)
        ? input.filter(
            ({ action }) => !["unpublish", "delete", "duplicate"].includes(action)
          )
        : input,
  },
});
