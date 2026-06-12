export const clients = {
  name: "clients",
  title: "Clients",
  type: "document",
  fields: [
    {
      name: "header",
      title: "Header",
      type: "array",
      of: [{ type: "block" }],
    },
    {
      name: "list",
      title: "List",
      type: "array",
      of: [{ type: "block" }],
    },
  ],
  preview: {
    prepare: () => ({ title: "Clients" }),
  },
};
