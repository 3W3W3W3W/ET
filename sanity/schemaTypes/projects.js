export const projects = {
  name: "project",
  title: "Archive",
  type: "document",
  fields: [
    {
      name: "title",
      title: "Title",
      type: "string",
      validation: (Rule) => Rule.required(),
    },
    {
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (Rule) => Rule.required(),
    },
    {
      name: "visible",
      title: "Show in grid",
      type: "boolean",
      description:
        "On by default. Turn off to hide this project from the grid and the Archive without deleting it.",
      initialValue: true,
    },
    {
      name: "order",
      title: "Order",
      type: "number",
      description: "Lower numbers appear first.",
    },
    {
      name: "tags",
      title: "Tags",
      type: "array",
      of: [{ type: "reference", to: [{ type: "tag" }] }],
    },
    {
      name: "description",
      title: "Description",
      type: "array",
      of: [{ type: "block" }],
    },
    {
      name: "images",
      title: "Images",
      type: "array",
      of: [
        {
          type: "image",
          options: { hotspot: true },
        },
      ],
      options: { layout: "grid" },
    },
  ],
  preview: {
    select: { title: "title", media: "images.0" },
  },
};
