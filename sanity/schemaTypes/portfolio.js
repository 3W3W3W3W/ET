export const portfolio = {
  name: "portfolio",
  title: "Portfolio",
  type: "document",
  fields: [
    {
      name: "projects",
      title: "Projects",
      description: "Curated projects pulled from the Archive, in display order.",
      type: "array",
      of: [
        {
          type: "reference",
          to: [{ type: "project" }],
          options: { disableNew: true },
        },
      ],
    },
  ],
  preview: {
    prepare: () => ({ title: "Portfolio" }),
  },
};
