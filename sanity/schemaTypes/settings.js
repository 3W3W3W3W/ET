export const settings = {
  name: "settings",
  title: "Settings",
  type: "document",
  fields: [
    {
      name: "information",
      title: "Information",
      type: "array",
      of: [{ type: "block" }],
    },
    {
      name: "clientsHeader",
      title: "Clients — Header",
      type: "array",
      of: [{ type: "block" }],
    },
    {
      name: "clientsList",
      title: "Clients — List",
      type: "array",
      of: [{ type: "block" }],
    },
  ],
  preview: {
    prepare: () => ({ title: "Settings" }),
  },
};
